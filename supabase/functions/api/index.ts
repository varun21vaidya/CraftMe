// CraftMe server commands that need Razorpay or the auth admin API. Everything stateful lives in Postgres
// functions (supabase/migrations/0003_logic.sql); this file only talks to Razorpay and hands the result to them.
//   POST /api            {name, requestId, ...input}  -> envelope {ok, data|error, requestId}   (needs a signed-in user)
//   POST /api/webhook    Razorpay webhook (signature checked, events de-duplicated)
//   /api/instagram/*     Instagram connection (Unified Login): browser callback, Meta deauthorize and data-deletion (instagram.ts)
// Deployed with verify_jwt off: commands verify the user below, the webhook verifies Razorpay's signature.
import { createClient } from "npm:@supabase/supabase-js@2";
import { makeInstagram } from "./instagram.ts";
import { fakeRz, providerMode } from "./providers.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
const WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";

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
  if (!out.oversold) return out;

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

async function markFeePaid(rzOrderId: string, paymentId: string) {
  const { data: priv } = await admin.from("artist_private").select("profile_id,onboarding_amount,onboarding_paid_at")
    .eq("onboarding_order_id", rzOrderId).maybeSingle();
  if (!priv) return { ignored: true };
  if (priv.onboarding_paid_at) return { paid: true };
  const p = await rz(`/payments/${paymentId}`, "GET");
  if (p.status !== "captured" || p.amount !== Number(priv.onboarding_amount) || p.order_id !== rzOrderId) {
    throw new CommandError("conflict", "amount_mismatch");
  }
  await admin.from("artist_private").update({ onboarding_paid_at: new Date().toISOString(), onboarding_payment_id: paymentId })
    .eq("profile_id", priv.profile_id);
  return { paid: true };
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
};

const commands: Record<string, (c: Ctx) => Promise<unknown>> = {
  async placeOrder({ uid, input }) {
    configured();
    const lines = input.lines;
    need(typeof input.artistId === "string" && Array.isArray(lines) && lines.length >= 1 && lines.length <= 20, "lines");
    need(lines.every((l: any) => typeof l?.listingId === "string" && Number.isInteger(l.quantity)), "lines");
    const address: Record<string, string> = {};
    const bad = Object.keys(ADDR).filter((k) => !ADDR[k].test((address[k] = String(input.address?.[k] ?? "").trim())));
    if (bad.length) throw new CommandError("invalid", undefined, { fields: bad });

    const placed = await rpc("place_order", { p_buyer: uid, p_artist: input.artistId, p_lines: lines, p_address: address });
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
      orderId: placed.orderId, razorpayOrderId: rzOrder.id, keyId: KEY_ID, amount: Number(placed.amount),
      holdUntil: Date.parse(placed.holdUntil),
    };
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

  async payOnboardingFee({ uid }) {
    configured();
    const { data: priv } = await admin.from("artist_private").select("legal_name,onboarding_paid_at").eq("profile_id", uid).maybeSingle();
    if (!priv?.legal_name) throw new CommandError("conflict", "verification_missing");
    if (priv.onboarding_paid_at) throw new CommandError("conflict", "already_paid");
    const { data: s } = await admin.from("settings").select("onboarding_fee_paise").single();
    const fee = Number(s?.onboarding_fee_paise);
    if (!Number.isInteger(fee) || fee <= 0) throw new CommandError("conflict", "fee_not_set");
    let order;
    try {
      order = await rz("/orders", "POST", { amount: fee, currency: "INR", receipt: `fee_${uid}` });
    } catch {
      throw new CommandError("unavailable", "payments_down");
    }
    await admin.from("artist_private").update({ onboarding_order_id: order.id, onboarding_amount: fee }).eq("profile_id", uid);
    return { razorpayOrderId: order.id, keyId: KEY_ID, amount: fee };
  },

  // The fee is recorded by the webhook; the client waits for it before calling this.
  async becomeArtist({ uid, meta }) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const instagram = await ig.route(req); // GET /instagram/callback is the only non-POST route
  if (instagram) return instagram;
  if (req.method !== "POST") return json({ ok: false, error: { code: "invalid" } }, 405);
  if (new URL(req.url).pathname.endsWith("/webhook")) return await webhook(req);
  return json(await runCommand(req));
});
