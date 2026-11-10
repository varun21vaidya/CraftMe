// Instagram connection (phase 2). Needs the INSTAGRAM_* secrets; without them every command answers "unavailable" and the app hides the card.
// Tokens stay on the server: encrypted in instagram_accounts, never logged, never returned to the browser.
import { authorizeUrl, cleanCode, decryptToken, encryptToken, filterMedia, isProfessional, parseSignedRequest } from "./instagram_pure.js";

type Ctx = { uid: string; meta: Record<string, unknown>; input: Record<string, unknown> };
type Deps = {
  // deno-lint-ignore no-explicit-any
  admin: any;
  CommandError: new (code: string, reason?: string, extra?: Record<string, unknown>) => Error;
  safeEqual: (a: string, b: string) => boolean;
};

const GRAPH = "https://graph.instagram.com";
const MAX_REELS = 12;
const DAY = 86_400_000;
const env = (k: string) => Deno.env.get(k) ?? "";
const cfg = () => ({
  appId: env("INSTAGRAM_APP_ID"), appSecret: env("INSTAGRAM_APP_SECRET"), redirect: env("INSTAGRAM_REDIRECT_URI"),
  key: env("INSTAGRAM_TOKEN_KEY"), cron: env("INSTAGRAM_CRON_SECRET"), site: env("SITE_URL").replace(/\/$/, ""),
});
const enabled = () => {
  const c = cfg();
  return Boolean(c.appId && c.appSecret && c.redirect && c.key && c.site);
};
const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

/** One HTTP call with a timeout. The error text never includes the URL, so tokens can't leak into logs. */
async function http(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`instagram ${res.status}: ${body?.error_message ?? body?.error?.message ?? "error"}`);
  return body;
}
const mediaOf = async (token: string) => {
  const q = new URLSearchParams({
    fields: "id,media_type,media_product_type,permalink,thumbnail_url,caption,timestamp", limit: "50", access_token: token,
  });
  return filterMedia((await http(`${GRAPH}/me/media?${q}`)).data);
};

export function makeInstagram({ admin, CommandError, safeEqual }: Deps) {
  const need = () => {
    if (!enabled()) throw new CommandError("unavailable", "instagram_not_configured");
  };
  const artistOnly = ({ meta }: Ctx) => {
    if (meta.artist !== true) throw new CommandError("forbidden");
  };

  async function tokenOf(uid: string) {
    const { data } = await admin.from("instagram_accounts").select("token_cipher,needs_reconnect,token_expires_at").eq("artist_id", uid).maybeSingle();
    if (!data) throw new CommandError("conflict", "not_connected");
    if (data.needs_reconnect || Date.parse(data.token_expires_at) < Date.now()) throw new CommandError("conflict", "reconnect");
    return await decryptToken(data.token_cipher, cfg().key);
  }

  /** Instagram's thumbnail links expire, so a copy goes into our own storage. A failure just means no cover. */
  async function copyThumbnail(uid: string, url: string): Promise<string | null> {
    try {
      if (new URL(url).protocol !== "https:") return null;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !["image/jpeg", "image/png"].includes(type.split(";")[0])) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > 2 * 1024 * 1024) return null;
      const path = `${uid}/${crypto.randomUUID()}.${type.includes("png") ? "png" : "jpg"}`;
      const { error } = await admin.storage.from("artworks").upload(path, bytes, { contentType: type.split(";")[0] });
      return error ? null : admin.storage.from("artworks").getPublicUrl(path).data.publicUrl;
    } catch {
      return null;
    }
  }
  const dropCover = async (cover: string | null) => {
    const marker = "/object/public/artworks/";
    const i = cover ? cover.indexOf(marker) : -1;
    if (cover && i >= 0) await admin.storage.from("artworks").remove([cover.slice(i + marker.length)]);
  };

  /** Unlinks the account. The reels stay, as plain artist-added reels (ig_media_id cleared, so they can be imported again). */
  async function disconnect(uid: string) {
    await admin.from("instagram_accounts").delete().eq("artist_id", uid);
    await admin.from("profiles").update({ instagram_verified: false, instagram_needs_reconnect: false }).eq("id", uid);
    await admin.from("reels").update({ verified: false, ig_media_id: null }).eq("artist_id", uid);
  }

  const commands: Record<string, (c: Ctx) => Promise<unknown>> = {
    async instagramStatus(ctx) {
      artistOnly(ctx);
      if (!enabled()) return { enabled: false };
      const { data } = await admin.from("instagram_accounts").select("username,needs_reconnect").eq("artist_id", ctx.uid).maybeSingle();
      return { enabled: true, connected: Boolean(data), username: data?.username ?? null, needsReconnect: Boolean(data?.needs_reconnect) };
    },

    async instagramStart(ctx) {
      artistOnly(ctx);
      need();
      await admin.from("instagram_states").delete().lt("expires_at", new Date().toISOString());
      const state = randomHex(32);
      const { error } = await admin.from("instagram_states").insert({ state, artist_id: ctx.uid, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
      if (error) throw new Error(`state: ${error.message}`);
      const c = cfg();
      return { url: authorizeUrl({ appId: c.appId, redirectUri: c.redirect, state }) };
    },

    async instagramMedia(ctx) {
      artistOnly(ctx);
      need();
      const token = await tokenOf(ctx.uid);
      let items;
      try {
        items = await mediaOf(token);
      } catch (e) {
        console.error("instagram media failed", String(e));
        throw new CommandError("unavailable", "instagram_down");
      }
      const { data: mine } = await admin.from("reels").select("ig_media_id").eq("artist_id", ctx.uid);
      const have = new Set((mine ?? []).map((r: { ig_media_id: string | null }) => r.ig_media_id).filter(Boolean));
      return { items: items.map((m) => ({ ...m, imported: have.has(m.id) })), slotsLeft: Math.max(0, MAX_REELS - (mine ?? []).length) };
    },

    async instagramImport(ctx) {
      artistOnly(ctx);
      need();
      const ids = ctx.input.mediaIds;
      if (!Array.isArray(ids) || ids.length < 1 || ids.length > MAX_REELS || !ids.every((i) => typeof i === "string")) {
        throw new CommandError("invalid", undefined, { fields: ["mediaIds"] });
      }
      const token = await tokenOf(ctx.uid);
      let items;
      try {
        items = await mediaOf(token);
      } catch (e) {
        console.error("instagram media failed", String(e));
        throw new CommandError("unavailable", "instagram_down");
      }
      const byId = new Map(items.map((m) => [m.id, m]));
      const { data: have } = await admin.from("reels").select("position").eq("artist_id", ctx.uid);
      let next = Math.max(-1, ...(have ?? []).map((r: { position: number }) => r.position)) + 1;
      const added: string[] = [];
      const refused: { id: string; reason: string }[] = [];
      for (const id of [...new Set(ids as string[])]) {
        const m = byId.get(id); // only media the artist's own account returned can be imported
        if (!m) { refused.push({ id, reason: "not_yours" }); continue; }
        const cover = m.thumbnail ? await copyThumbnail(ctx.uid, m.thumbnail) : null;
        const { error } = await admin.from("reels").insert({
          artist_id: ctx.uid, url: m.permalink, cover, position: next, owner_confirmed: true, verified: true, ig_media_id: id,
        });
        if (error) {
          await dropCover(cover);
          let reason = error.code === "23505" ? "already_added" : "failed";
          try { reason = JSON.parse(error.message).reason ?? reason; } catch { /* not one of ours */ }
          refused.push({ id, reason });
          continue;
        }
        next++;
        added.push(id);
      }
      return { added, refused };
    },

    async instagramDisconnect(ctx) {
      artistOnly(ctx);
      await disconnect(ctx.uid);
      return {};
    },
  };

  // ---------- the browser comes back from Instagram here (GET) ----------
  async function callback(url: URL) {
    const { site, appId, appSecret, redirect, key } = cfg();
    const back = (q: string) => Response.redirect(`${site}/dashboard/profile?instagram=${q}`, 302);
    if (!enabled()) return new Response("Instagram is not set up", { status: 503 });
    const state = url.searchParams.get("state") ?? "";
    // A state works once and only for ten minutes: this stops forged and replayed callbacks.
    const { data: row } = await admin.from("instagram_states").delete().eq("state", state).select("artist_id,expires_at").maybeSingle();
    if (!row || Date.parse(row.expires_at) < Date.now()) return back("error&reason=expired");
    if (url.searchParams.get("error")) return back("error&reason=denied");
    const code = cleanCode(url.searchParams.get("code"));
    if (!code) return back("error&reason=failed");
    try {
      const short = await http("https://api.instagram.com/oauth/access_token", {
        method: "POST",
        body: new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: "authorization_code", redirect_uri: redirect, code }),
      });
      const shortToken = (short.data?.[0] ?? short).access_token;
      const long = await http(`${GRAPH}/access_token?` + new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: appSecret, access_token: shortToken }));
      const who = await http(`${GRAPH}/me?` + new URLSearchParams({ fields: "user_id,username,account_type", access_token: long.access_token }));
      if (!isProfessional(who.account_type)) return back("error&reason=personal_account");
      const igId = String(who.user_id ?? who.id ?? "");
      if (!igId || !who.username) return back("error&reason=failed");
      const now = new Date();
      const { error } = await admin.from("instagram_accounts").upsert({
        artist_id: row.artist_id, ig_user_id: igId, username: who.username, token_cipher: await encryptToken(long.access_token, key),
        token_expires_at: new Date(now.getTime() + Number(long.expires_in) * 1000).toISOString(),
        refreshed_at: now.toISOString(), connected_at: now.toISOString(), needs_reconnect: false,
      }, { onConflict: "artist_id" });
      if (error) return back(error.code === "23505" ? "error&reason=already_linked" : "error&reason=failed");
      const handle = /^[A-Za-z0-9._]{1,30}$/.test(who.username) ? { instagram_handle: who.username } : {};
      await admin.from("profiles").update({ ...handle, instagram_verified: true, instagram_needs_reconnect: false }).eq("id", row.artist_id);
      return back("connected");
    } catch (e) {
      console.error("instagram callback failed", String(e));
      return back("error&reason=failed");
    }
  }

  // ---------- Meta tells us a person removed the app, or asks us to delete their data ----------
  const signedUser = async (req: Request) => {
    const form = await req.formData().catch(() => null);
    const payload = await parseSignedRequest(String(form?.get("signed_request") ?? ""), cfg().appSecret);
    return payload?.user_id ? String(payload.user_id) : null;
  };
  const artistOfIgUser = async (igUserId: string): Promise<string | null> =>
    (await admin.from("instagram_accounts").select("artist_id").eq("ig_user_id", igUserId).maybeSingle()).data?.artist_id ?? null;

  async function deauthorize(req: Request) {
    const igUser = await signedUser(req);
    if (!igUser) return new Response(null, { status: 400 });
    const artist = await artistOfIgUser(igUser);
    if (artist) await disconnect(artist);
    return new Response(null, { status: 200 });
  }

  async function dataDeletion(req: Request) {
    const igUser = await signedUser(req);
    if (!igUser) return new Response(null, { status: 400 });
    const code = randomHex(16);
    await admin.from("instagram_deletions").insert({ code, ig_user_id: igUser });
    const artist = await artistOfIgUser(igUser);
    if (artist) {
      const { data: imported } = await admin.from("reels").select("id,cover").eq("artist_id", artist).not("ig_media_id", "is", null);
      for (const r of imported ?? []) await dropCover(r.cover);
      await admin.from("reels").delete().eq("artist_id", artist).not("ig_media_id", "is", null);
      await disconnect(artist);
    }
    await admin.from("instagram_deletions").update({ done_at: new Date().toISOString() }).eq("code", code);
    return new Response(JSON.stringify({ url: `${cfg().site}/instagram-deletion?code=${code}`, confirmation_code: code }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // ---------- daily: refresh tokens that expire within 14 days (called by pg_cron, see migration 0010) ----------
  async function refresh(req: Request) {
    const secret = cfg().cron;
    if (!secret || !safeEqual(req.headers.get("x-cron-secret") ?? "", secret)) return new Response(null, { status: 401 });
    const { data: rows } = await admin.from("instagram_accounts").select("artist_id,token_cipher")
      .eq("needs_reconnect", false).lt("token_expires_at", new Date(Date.now() + 14 * DAY).toISOString())
      .lt("refreshed_at", new Date(Date.now() - DAY).toISOString()).limit(50);
    let refreshed = 0;
    let failed = 0;
    for (const r of rows ?? []) {
      try {
        const token = await decryptToken(r.token_cipher, cfg().key);
        const out = await http(`${GRAPH}/refresh_access_token?` + new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token }));
        await admin.from("instagram_accounts").update({
          token_cipher: await encryptToken(out.access_token, cfg().key),
          token_expires_at: new Date(Date.now() + Number(out.expires_in) * 1000).toISOString(), refreshed_at: new Date().toISOString(),
        }).eq("artist_id", r.artist_id);
        refreshed++;
      } catch (e) {
        console.error("instagram refresh failed", r.artist_id, String(e)); // the artist sees a "Reconnect" banner
        await admin.from("instagram_accounts").update({ needs_reconnect: true }).eq("artist_id", r.artist_id);
        await admin.from("profiles").update({ instagram_needs_reconnect: true }).eq("id", r.artist_id);
        failed++;
      }
    }
    return new Response(JSON.stringify({ refreshed, failed }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  /** Returns a Response for /instagram/* routes, or null for everything else. */
  async function route(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    const i = url.pathname.indexOf("/instagram/");
    if (i < 0) return null;
    const leaf = url.pathname.slice(i + "/instagram/".length).replace(/\/$/, "");
    if (req.method === "GET" && leaf === "callback") return await callback(url);
    if (req.method === "POST" && leaf === "deauthorize") return await deauthorize(req);
    if (req.method === "POST" && leaf === "data-deletion") return await dataDeletion(req);
    if (req.method === "POST" && leaf === "refresh") return await refresh(req);
    return new Response(null, { status: 404 });
  }

  return { commands, route };
}
