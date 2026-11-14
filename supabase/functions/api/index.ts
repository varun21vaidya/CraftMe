// CraftMe server commands that need Razorpay or the auth admin API. Everything stateful lives in Postgres
// functions (supabase/migrations/0003_logic.sql); this file only talks to Razorpay and hands the result to them.
//   POST /api            {name, requestId, ...input}  -> envelope {ok, data|error, requestId}   (needs a signed-in user)
//   POST /api/webhook    Razorpay webhook (signature checked, events de-duplicated)
//   POST /api/cron?job=cleanup   scheduled jobs (header x-cron-secret = CRON_SECRET); `cleanup` removes damage photos no report uses, older than 24 hours; `deletions` finishes Account deletions
//   POST /api/sms-hook   Supabase Auth's Send SMS Hook: sends the phone-check code over WhatsApp (whatsapp_pure.js)
//   /api/instagram/*     Instagram connection (Unified Login): browser callback, Meta deauthorize and data-deletion (instagram.ts)
// Deployed with verify_jwt off: commands verify the user below, the webhook verifies Razorpay's signature.
import { createClient } from "npm:@supabase/supabase-js@2";
import { makeInstagram } from "./instagram.ts";
import { verifyHook, whatsappBody } from "./whatsapp_pure.js";
import { fakeRz, providerMode } from "./providers.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

// Fake provider mode (local tests only). Asked for in production, every command and the webhook answer "unavailable".
let MODE: "live" | "fake" = "live";
let MODE_ERROR: string | null = null;
try { MODE = providerMode(); } catch (e) { MODE_ERROR = (e as Error).message; }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------- errors: same shape the old Firebase commands used ----------
class CommandError extends Error {
  constructor(public code: string, public reason?: string, public extra: Record<string, unknown> = {}) {
    super(reason ?? code);
  }
}
const fail = (code: string, requestId: string | null, extra: Record<string, unknown> = {}) => ({ ok: false, error: { code, ...extra }, requestId });

/** Postgres functions raise {"code":..,"reason":..} as the exception message (see public.fail). */
function fromDb(error: { message: string }): never {
  try {
    const { code, reason, ...extra } = JSON.parse(error.message);
    if (code) throw new CommandError(code, reason ?? undefined, extra);
  } catch (e) {
    if (e instanceof CommandError) throw e;
  }
  throw new Error(`database: ${error.message}`);
}
const rpc = async (name: string, args: Record<string, unknown>) => {
  const { data, error } = await admin.rpc(name, args);
  if (error) fromDb(error);
  return data;
};

// ---------- Razorpay over REST (no SDK needed) ----------
const enc = new TextEncoder();
async function hmacHex(secret: string, data: string | Uint8Array) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, typeof data === "string" ? enc.encode(data) : data);
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};
async function rz(path: string, method: "GET" | "POST", body?: unknown) {
  if (MODE === "fake") return await fakeRz(admin, path, method, body);
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: "Basic " + btoa(`${KEY_ID}:${KEY_SECRET}`), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`razorpay ${res.status}: ${out?.error?.description ?? "error"}`);
  return out;
}
const configured = () => {
  if (!KEY_ID || !KEY_SECRET) throw new CommandError("unavailable", "payments_not_configured");
};

// ---------- a verified payment arrived: shared by the buyer's callback and the webhook ----------
const DONE = ["paid", "shipped", "received", "refunded"];
async function markPaid(orderId: string, paymentId: string) {
  const { data: pre } = await admin.from("orders").select("stage,total,razorpay_order_id").eq("id", orderId).maybeSingle();
  if (!pre) throw new CommandError("conflict", "not_found");
  if (DONE.includes(pre.stage)) return { stage: pre.stage };

  // Never trust the client or the event alone: ask Razorpay what was really paid.
  const p = await rz(`/payments/${paymentId}`, "GET");
  if (p.status !== "captured" || p.amount !== Number(pre.total) || p.order_id !== pre.razorpay_order_id) {
    throw new CommandError("conflict", "amount_mismatch");
  }
  const out = await rpc("mark_paid", { p_order: orderId, p_payment: paymentId, p_fee: p.fee ?? 0 });
  if (!out.oversold) {
    // display data only, like razorpay_order_id: written after the money rules have run
    if (typeof p.method === "string") await admin.from("orders").update({ payment_method: p.method }).eq("id", orderId).is("payment_method", null);
    return out;
  }

  // Sold to someone else while this payment was in flight: the only automatic refund.
  let refundId: string | null = null;
  try {
    refundId = (await rz(`/payments/${paymentId}/refund`, "POST", { amount: Number(pre.total) })).id;
  } catch {
    // The refund may already have gone through on an earlier attempt: record it instead of failing forever.
    if ((await rz(`/payments/${paymentId}`, "GET")).status !== "refunded") throw new CommandError("unavailable", "refund_failed");
  }
  await rpc("refund_oversold", { p_order: orderId, p_payment: paymentId, p_refund_id: refundId });
  throw new CommandError("conflict", "sold_during_payment");
}

/** The fee for one fee order. The payment is asked of Razorpay first; the database records it once and says when it was a second payment. */
async function markFeePaid(rzOrderId: string, paymentId: string) {
  const { data: fo } = await admin.from("fee_orders").select("amount,refunded_at").eq("razorpay_order_id", rzOrderId).maybeSingle();
  if (!fo) return { ignored: true };
  const p = await rz(`/payments/${paymentId}`, "GET");
  if (p.status !== "captured" || p.amount !== Number(fo.amount) || p.order_id !== rzOrderId) throw new CommandError("conflict", "amount_mismatch");
  const out = await rpc("record_fee_payment", { p_order: rzOrderId, p_payment: paymentId });
  if (!out.duplicate) return { paid: true };

  // The fee was already paid on another order: give this payment back (a plain Error on failure, so the webhook is retried).
  if (!fo.refunded_at) {
    try {
      await rz(`/payments/${paymentId}/refund`, "POST", { amount: Number(fo.amount) });
    } catch {
      if ((await rz(`/payments/${paymentId}`, "GET")).status !== "refunded") throw new Error("fee refund failed");
    }
    await admin.from("fee_orders").update({ refunded_at: new Date().toISOString() }).eq("razorpay_order_id", rzOrderId);
  }
  return { duplicate: true };
}

/** New Artists can be switched off in the Admin settings. */
async function artistsOpen() {
  const { data } = await admin.from("settings").select("switches").limit(1).maybeSingle();
  if (data?.switches?.acceptArtists !== true) throw new CommandError("conflict", "artists_closed");
}

// ---------- commands ----------
type Ctx = { uid: string; meta: Record<string, unknown>; input: Record<string, any> };
const requireRole = (ctx: Ctx, role: "admin" | "artist") => {
  if (ctx.meta[role] !== true) throw new CommandError("forbidden");
};
const need = (cond: unknown, ...fields: string[]) => {
  if (!cond) throw new CommandError("invalid", undefined, { fields });
};
const ADDR: Record<string, RegExp> = {
  name: /^[\s\S]{1,100}$/, phone: /^[6-9]\d{9}$/, address: /^[\s\S]{1,300}$/,
  city: /^[\s\S]{1,80}$/, state: /^[\s\S]{1,80}$/, pin: /^\d{6}$/,
  address2: /^[\s\S]{0,300}$/, landmark: /^[\s\S]{0,120}$/,
};

/** The payment details the browser needs to open (or reopen) the payment window for a held Order. */
// deno-lint-ignore no-explicit-any
const holdReply = (o: any) => ({
  orderId: o.id, code: o.code, razorpayOrderId: o.razorpay_order_id, keyId: KEY_ID, amount: Number(o.total),
  holdUntil: Date.parse(o.hold_until), serverNow: Date.now(),
  // so the page can tell whether the hold still matches the Cart, and show the address it was placed with
  lines: (o.order_lines ?? []).map((l: { listing_id: string; quantity: number }) => ({ listingId: l.listing_id, quantity: l.quantity })),
  address: o.order_shipping ?? null,
});

/** The caller's own Order, or conflict not_found for a missing one and forbidden for someone else's. */
async function ownOrder(uid: string, orderId: unknown) {
  need(typeof orderId === "string" && orderId, "orderId");
  const { data: o } = await admin.from("orders")
    .select("id,code,buyer_id,stage,total,hold_until,razorpay_order_id,order_lines(listing_id,quantity),order_shipping(*)").eq("id", orderId).maybeSingle();
  if (!o) throw new CommandError("conflict", "not_found");
  if (o.buyer_id !== uid) throw new CommandError("forbidden");
  return o;
}

const commands: Record<string, (c: Ctx) => Promise<unknown>> = {
  async placeOrder({ uid, input }) {
    configured();
    const lines = input.lines;
    need(typeof input.artistId === "string" && Array.isArray(lines) && lines.length >= 1 && lines.length <= 20, "lines");
    need(lines.every((l: any) => typeof l?.listingId === "string" && Number.isInteger(l.quantity)), "lines");
    const address: Record<string, string> = {};
    const bad = Object.keys(ADDR).filter((k) => !ADDR[k].test((address[k] = String(input.address?.[k] ?? "").trim())));
    if (bad.length) throw new CommandError("invalid", undefined, { fields: bad });
    need(input.note === undefined || (typeof input.note === "string" && input.note.length <= 120), "note");

    const placed = await rpc("place_order", {
      p_buyer: uid, p_artist: input.artistId, p_lines: lines,
      p_address: { ...address, note: input.note ?? "", save: input.saveAddress === true },
    });
    let rzOrder;
    try {
      rzOrder = await rz("/orders", "POST", { amount: Number(placed.amount), currency: "INR", receipt: placed.orderId });
    } catch (e) {
      console.error("razorpay createOrder failed", String(e));
      await rpc("expire_hold", { p_order: placed.orderId, p_force: true }); // release the stock; the buyer can try again
      throw new CommandError("unavailable", "payments_down");
    }
    await admin.from("orders").update({ razorpay_order_id: rzOrder.id }).eq("id", placed.orderId);
    return {
      orderId: placed.orderId, code: placed.code, razorpayOrderId: rzOrder.id, keyId: KEY_ID, amount: Number(placed.amount),
      holdUntil: Date.parse(placed.holdUntil), serverNow: Date.parse(placed.serverNow),
    };
  },

  // Back to a hold after a reload: the same payment details while time is left.
  async resumeHold({ uid, input }) {
    configured();
    const o = await ownOrder(uid, input.orderId);
    if (o.stage !== "hold" || Date.parse(o.hold_until) <= Date.now() || !o.razorpay_order_id) throw new CommandError("conflict", "hold_over");
    return holdReply(o);
  },

  // "Change address or Cart": give the pieces back now. A hold that already ended is fine.
  async cancelHold({ uid, input }) {
    const o = await ownOrder(uid, input.orderId);
    if (o.stage === "hold") await rpc("expire_hold", { p_order: o.id, p_force: true });
    return {};
  },

  async confirmPayment({ uid, input }) {
    configured();
    need(["orderId", "razorpayOrderId", "razorpayPaymentId", "signature"].every((k) => typeof input[k] === "string" && input[k]), "orderId");
    const { data: order } = await admin.from("orders").select("buyer_id,razorpay_order_id").eq("id", input.orderId).maybeSingle();
    if (!order) throw new CommandError("conflict", "not_found");
    if (order.buyer_id !== uid) throw new CommandError("forbidden");
    const expected = await hmacHex(KEY_SECRET, `${input.razorpayOrderId}|${input.razorpayPaymentId}`);
    const signed = (MODE === "fake" && input.signature === "fake") || safeEqual(expected, input.signature);
    if (input.razorpayOrderId !== order.razorpay_order_id || !signed) throw new CommandError("conflict", "bad_signature");
    return await markPaid(input.orderId, input.razorpayPaymentId);
  },

  // Reserve in the database first (so two Admins cannot refund the same lines), call Razorpay, then confirm.
  // If Razorpay errors or times out it may still have refunded, so the reservation stays as "unknown" for the Admin to check.
  async issueRefund(ctx) {
    requireRole(ctx, "admin");
    configured();
    const { input } = ctx;
    need(typeof input.orderId === "string" && Array.isArray(input.lines) && input.lines.length > 0, "lines");
    const r = await rpc("reserve_refund", { p_order: input.orderId, p_lines: input.lines, p_reason: input.reason ?? "" });
    let provider;
    try {
      provider = await rz(`/payments/${r.paymentId}/refund`, "POST", { amount: Number(r.amount) });
    } catch (e) {
      console.error("razorpay refund failed", String(e));
      await rpc("mark_refund_unknown", { p_refund: r.refundId });
      throw new CommandError("unavailable", "refund_unknown");
    }
    await rpc("confirm_refund", { p_refund: r.refundId, p_rz: provider.id });
    return { refundId: r.refundId, amount: Number(r.amount) };
  },

  // One fee order per attempt, reused for 15 minutes while unpaid, so closing the window and trying again does not pile up orders.
  async payOnboardingFee({ uid }) {
    await artistsOpen();
    configured();
    const { data: priv } = await admin.from("artist_private").select("legal_name,onboarding_paid_at").eq("profile_id", uid).maybeSingle();
    if (!priv?.legal_name) throw new CommandError("conflict", "verification_missing");
    if (priv.onboarding_paid_at) throw new CommandError("conflict", "already_paid");
    const { data: s } = await admin.from("settings").select("onboarding_fee_paise").single();
    const fee = Number(s?.onboarding_fee_paise);
    if (!Number.isInteger(fee) || fee <= 0) throw new CommandError("conflict", "fee_not_set");
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { data: recent } = await admin.from("fee_orders").select("razorpay_order_id").eq("profile_id", uid).eq("amount", fee)
      .is("paid_at", null).gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (recent) return { razorpayOrderId: recent.razorpay_order_id, keyId: KEY_ID, amount: fee };
    let order;
    try {
      order = await rz("/orders", "POST", { amount: fee, currency: "INR", receipt: `fee_${uid}` });
    } catch {
      throw new CommandError("unavailable", "payments_down");
    }
    const { error } = await admin.from("fee_orders").insert({ razorpay_order_id: order.id, profile_id: uid, amount: fee });
    if (error) throw new Error(`fee order: ${error.message}`);
    return { razorpayOrderId: order.id, keyId: KEY_ID, amount: fee };
  },

  // The browser's proof of payment; the webhook does the same work, whichever arrives first.
  async confirmFeePayment({ uid, input }) {
    configured();
    need(["razorpayOrderId", "razorpayPaymentId", "signature"].every((k) => typeof input[k] === "string" && input[k]), "razorpayOrderId");
    const { data: fo } = await admin.from("fee_orders").select("profile_id").eq("razorpay_order_id", input.razorpayOrderId).maybeSingle();
    if (!fo) throw new CommandError("conflict", "not_found");
    if (fo.profile_id !== uid) throw new CommandError("forbidden");
    const expected = await hmacHex(KEY_SECRET, `${input.razorpayOrderId}|${input.razorpayPaymentId}`);
    if (!((MODE === "fake" && input.signature === "fake") || safeEqual(expected, input.signature))) throw new CommandError("conflict", "bad_signature");
    return await markFeePaid(input.razorpayOrderId, input.razorpayPaymentId);
  },

  // Supabase Auth verified the number; this copies that fact. The browser cannot set phone_verified itself.
  async confirmPhone({ uid }) {
    const { data } = await admin.auth.admin.getUserById(uid);
    const user = data?.user;
    if (!user?.phone_confirmed_at || !user.phone) throw new CommandError("conflict", "phone_not_verified");
    const { data: row } = await admin.from("artist_private").update({ phone_verified: true, phone: user.phone }).eq("profile_id", uid).select("profile_id");
    if (!row?.length) throw new CommandError("conflict", "verification_missing");
    return {};
  },

  // The fee is recorded by the webhook or confirmFeePayment; the client waits for it before calling this.
  async becomeArtist({ uid, meta }) {
    await artistsOpen();
    const { data: p } = await admin.from("artist_private").select("legal_name,pan,phone_verified,onboarding_paid_at").eq("profile_id", uid).maybeSingle();
    if (!p?.legal_name || !p.pan || !p.phone_verified || !p.onboarding_paid_at) throw new CommandError("conflict", "verification_or_fee_missing");
    await setRoleFlag(uid, meta, "artist", true);
    return { roles: ["artist"] };
  },

  async setRole(ctx) {
    requireRole(ctx, "admin");
    const { uid, input } = ctx;
    need(typeof input.uid === "string" && ["admin", "artist"].includes(input.role) && typeof input.value === "boolean", "role");
    if (uid === input.uid && input.role === "admin" && !input.value) throw new CommandError("conflict", "self_demote");
    const { data } = await admin.auth.admin.getUserById(input.uid);
    if (!data?.user) throw new CommandError("conflict", "not_found");
    await setRoleFlag(input.uid, data.user.app_metadata ?? {}, input.role, input.value);
    return {};
  },
};

// Instagram: its commands join the table above; its /instagram/* routes (browser callback, Meta callbacks, cron) are handled in serve().
const ig = makeInstagram({ admin, CommandError });
Object.assign(commands, ig.commands);

/** Roles live in app_metadata (only the server can write it) and are mirrored on the public profile. */
async function setRoleFlag(uid: string, meta: Record<string, unknown>, role: string, value: boolean) {
  const next = { ...meta };
  if (value) next[role] = true; else delete next[role];
  const { error } = await admin.auth.admin.updateUserById(uid, { app_metadata: next });
  if (error) throw new Error(`setRole: ${error.message}`);
  const { data: p } = await admin.from("profiles").select("roles").eq("id", uid).single();
  const roles = new Set<string>(p?.roles ?? []);
  if (value) roles.add(role); else roles.delete(role);
  await admin.from("profiles").update({ roles: [...roles] }).eq("id", uid);
}

// ---------- idempotency: a retry with the same requestId replays the first result ----------
const PENDING_STALE_MS = 60_000;
async function claim(uid: string, rid: string) {
  const { error } = await admin.from("requests").insert({ user_id: uid, request_id: rid });
  if (!error) return { state: "new" as const };
  if (error.code !== "23505") throw new Error(error.message);
  const { data } = await admin.from("requests").select("state,result,created_at").eq("user_id", uid).eq("request_id", rid).single();
  if (data?.state === "done") return { state: "done" as const, result: data.result };
  if (Date.now() - Date.parse(data?.created_at) > PENDING_STALE_MS) { // a crashed run left it pending
    await admin.from("requests").update({ created_at: new Date().toISOString() }).eq("user_id", uid).eq("request_id", rid);
    return { state: "new" as const };
  }
  return { state: "pending" as const };
}

async function runCommand(req: Request) {
  if (MODE_ERROR) return fail("unavailable", null, { reason: MODE_ERROR });
  const body = await req.json().catch(() => ({}));
  const rid = typeof body.requestId === "string" && body.requestId.length > 0 && body.requestId.length <= 100 ? body.requestId : null;
  if (!rid) return fail("invalid", null, { reason: "missing", fields: ["requestId"] });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user) return fail("unauthenticated", rid);
  const handler = commands[body.name];
  if (!handler) return fail("invalid", rid, { reason: "unknown_command" });

  const c = await claim(user.id, rid);
  if (c.state === "done") return c.result;
  if (c.state === "pending") return fail("conflict", rid, { reason: "in_progress" });

  const { name: _n, requestId: _r, ...input } = body;
  let envelope: unknown;
  let retryable = false;
  try {
    envelope = { ok: true, data: (await handler({ uid: user.id, meta: user.app_metadata ?? {}, input })) ?? {}, requestId: rid };
  } catch (e) {
    if (e instanceof CommandError) {
      envelope = fail(e.code, rid, { ...(e.reason ? { reason: e.reason } : {}), ...e.extra });
      retryable = e.code === "unavailable" || e.code === "rate_limited";
    } else {
      console.error("command failed", body.name, String(e));
      envelope = fail("internal", rid);
      retryable = true;
    }
  }
  // A transient failure must not be replayed forever: free the key so a retry can run.
  if (retryable) await admin.from("requests").delete().eq("user_id", user.id).eq("request_id", rid);
  else await admin.from("requests").update({ state: "done", result: envelope }).eq("user_id", user.id).eq("request_id", rid);
  return envelope;
}

// ---------- Razorpay webhook ----------
async function webhook(req: Request) {
  if (MODE_ERROR) return json(fail("unavailable", null, { reason: MODE_ERROR }), 503);
  const raw = new Uint8Array(await req.arrayBuffer());
  const sig = req.headers.get("X-Razorpay-Signature") ?? "";
  if (!WEBHOOK_SECRET || !safeEqual(await hmacHex(WEBHOOK_SECRET, raw), sig)) return new Response(null, { status: 400 });
  const eventId = req.headers.get("X-Razorpay-Event-Id");
  if (!eventId) return new Response(null, { status: 400 });

  const { error: dup } = await admin.from("processed_events").insert({ event_id: eventId });
  if (dup) return new Response(null, { status: dup.code === "23505" ? 200 : 500 }); // replay: nothing to do
  try {
    const event = JSON.parse(new TextDecoder().decode(raw));
    const payment = event.payload?.payment?.entity;
    if ((event.event === "payment.captured" || event.event === "order.paid") && payment) {
      const { data: order } = await admin.from("orders").select("id").eq("razorpay_order_id", payment.order_id).maybeSingle();
      if (order) await markPaid(order.id, payment.id);
      else await markFeePaid(payment.order_id, payment.id);
    }
  } catch (e) {
    if (e instanceof CommandError) { // a bad reference will never succeed: log it and acknowledge
      console.warn("webhook event ignored", eventId, e.code, e.reason);
    } else { // transient: free the claim and answer non-2xx so Razorpay retries
      console.error("webhook failed", eventId, String(e));
      await admin.from("processed_events").delete().eq("event_id", eventId);
      return new Response(null, { status: 500 });
    }
  }
  return new Response(null, { status: 200 });
}

/**
 * Supabase Auth's Send SMS Hook (signed, Standard Webhooks): sends the 6-digit code as a WhatsApp authentication template.
 * The code is never logged. Without the WHATSAPP_* secrets every send fails with 503 and the browser says phone checks are not working.
 */
async function smsHook(req: Request) {
  const hookError = (status: number, message: string) => json({ error: { http_code: status, message } }, status);
  const payload = await verifyHook(await req.text(), Object.fromEntries(req.headers), Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "");
  if (!payload) return hookError(401, "invalid_signature");
  const token = Deno.env.get("WHATSAPP_TOKEN"), id = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const template = Deno.env.get("WHATSAPP_TEMPLATE"), lang = Deno.env.get("WHATSAPP_TEMPLATE_LANG");
  if (!token || !id || !template || !lang) return hookError(503, "whatsapp_not_configured");
  try {
    const res = await fetch(`https://graph.facebook.com/v26.0/${id}/messages`, {
      method: "POST", signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(whatsappBody({ phone: payload.user.phone, otp: payload.sms.otp, template, lang })),
    });
    if (!res.ok) { console.error("whatsapp send refused", res.status); return hookError(502, "whatsapp_send_failed"); }
  } catch (e) {
    console.error("whatsapp send failed", (e as Error).name);
    return hookError(502, "whatsapp_send_failed");
  }
  return json({});
}

/** The one scheduled-jobs route. Without the secret nothing runs. Jobs: cleanup, deletions. */
async function cron(req: Request) {
  const given = req.headers.get("x-cron-secret") ?? "";
  let diff = given.length ^ CRON_SECRET.length; // compare every character so the time doesn't say how many matched
  for (let i = 0; i < CRON_SECRET.length; i++) diff |= (given.charCodeAt(i) || 0) ^ CRON_SECRET.charCodeAt(i);
  if (!CRON_SECRET || diff !== 0) return json({ ok: false, error: { code: "forbidden" } }, 403);
  const job = new URL(req.url).searchParams.get("job");
  if (job === "deletions") return await deletions();
  if (job !== "cleanup") return json({ ok: false, error: { code: "invalid" } }, 400);
  const { data, error } = await admin.rpc("damage_orphans");
  if (error) return json({ ok: false, error: { code: "unavailable" } }, 500);
  const names = (data ?? []) as string[];
  for (let i = 0; i < names.length; i += 100) {
    const { error: rmError } = await admin.storage.from("damage").remove(names.slice(i, i + 100));
    if (rmError) return json({ ok: false, error: { code: "unavailable" } }, 500);
  }
  return json({ ok: true, data: { removed: names.length } });
}

/**
 * Finishes Account deletions: the database step anonymises (process_deletions), then the files and the sign-in go.
 * Every request already done is visited again, so an auth user the last run failed to delete is removed now.
 */
async function deletions() {
  const { data: finished, error } = await admin.rpc("process_deletions");
  if (error) return json({ ok: false, error: { code: "unavailable" } }, 500);
  const { data: done } = await admin.from("deletion_requests").select("user_id").eq("status", "done");
  let removed = 0, failed = 0;
  for (const { user_id } of done ?? []) {
    const { data: found } = await admin.auth.admin.getUserById(user_id);
    if (!found?.user) continue;
    if ((finished ?? []).includes(user_id)) {
      const { data: files } = await admin.rpc("deletion_files", { p_user: user_id });
      for (const bucket of ["avatars", "artworks"]) {
        const names = ((files ?? []) as string[]).filter((f) => f.startsWith(bucket + "/")).map((f) => f.slice(bucket.length + 1));
        if (names.length) await admin.storage.from(bucket).remove(names);
      }
    }
    const { error: delError } = await admin.auth.admin.deleteUser(user_id);
    if (delError) { failed++; console.error("deleteUser failed", user_id, delError.message); } else removed++;
  }
  return json({ ok: true, data: { finished: (finished ?? []).length, removed, failed } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const instagram = await ig.route(req); // GET /instagram/callback is the only non-POST route
  if (instagram) return instagram;
  if (req.method !== "POST") return json({ ok: false, error: { code: "invalid" } }, 405);
  const path = new URL(req.url).pathname;
  if (path.endsWith("/sms-hook")) return await smsHook(req);
  if (path.endsWith("/webhook")) return await webhook(req);
  if (path.endsWith("/cron")) return await cron(req);
  return json(await runCommand(req));
});
