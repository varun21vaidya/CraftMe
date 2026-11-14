// Instagram connection (phase 2) through the Instagram API with Unified Login (Facebook Login for Business).
// Needs the META_* / INSTAGRAM_* secrets; without them every command answers "unavailable" and the app hides the card.
// The token is a business-level token that never expires. It stays on the server: encrypted in instagram_accounts,
// never logged, never returned to the browser.
import { authorizeUrl, decryptToken, encryptToken, filterMedia, parseSignedRequest } from "./instagram_pure.js";

type Ctx = { uid: string; meta: Record<string, unknown>; input: Record<string, unknown> };
type Deps = {
  // deno-lint-ignore no-explicit-any
  admin: any;
  CommandError: new (code: string, reason?: string, extra?: Record<string, unknown>) => Error;
};

const GRAPH = "https://graph.facebook.com/v26.0";
const MAX_REELS = 12;
const env = (k: string) => Deno.env.get(k) ?? "";
const cfg = () => ({
  appId: env("META_APP_ID"), appSecret: env("META_APP_SECRET"), configId: env("INSTAGRAM_CONFIG_ID"),
  redirect: env("INSTAGRAM_REDIRECT_URI"), key: env("INSTAGRAM_TOKEN_KEY"), site: env("SITE_URL").replace(/\/$/, ""),
});
const enabled = () => Object.values(cfg()).every(Boolean);
const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

class GraphError extends Error {
  constructor(public status: number, public code: number | undefined, message: string) {
    super(message);
  }
}
/** One HTTP call with a timeout. The error text never includes the URL, so tokens can't leak into logs. */
async function http(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new GraphError(res.status, body?.error?.code, `graph ${res.status}: ${body?.error?.message ?? "error"}`);
  return body;
}
const graph = (path: string, params: Record<string, string>) => http(`${GRAPH}${path}?${new URLSearchParams(params)}`);
/** Code 190 (or 401) means the token no longer works: the client removed the app or moved the account. Stop retrying; reconnect. */
const tokenDead = (e: unknown) => e instanceof GraphError && (e.code === 190 || e.status === 401);

const mediaOf = async (igId: string, token: string) =>
  filterMedia((await graph(`/${igId}/media`, {
    fields: "id,media_type,media_product_type,permalink,thumbnail_url,caption,timestamp", limit: "50", access_token: token,
  })).data);

export function makeInstagram({ admin, CommandError }: Deps) {
  const need = () => {
    if (!enabled()) throw new CommandError("unavailable", "instagram_not_configured");
  };
  const artistOnly = ({ meta }: Ctx) => {
    if (meta.artist !== true) throw new CommandError("forbidden");
  };

  const markReconnect = async (uid: string) => {
    await admin.from("instagram_accounts").update({ needs_reconnect: true }).eq("artist_id", uid);
    await admin.from("profiles").update({ instagram_needs_reconnect: true }).eq("id", uid);
  };

  /** The artist's reels and videos from Instagram. */
  async function fetchMedia(uid: string) {
    const { data } = await admin.from("instagram_accounts").select("ig_user_id,token_cipher,needs_reconnect").eq("artist_id", uid).maybeSingle();
    if (!data) throw new CommandError("conflict", "not_connected");
    if (data.needs_reconnect) throw new CommandError("conflict", "reconnect");
    try {
      return await mediaOf(data.ig_user_id, await decryptToken(data.token_cipher, cfg().key));
    } catch (e) {
      if (tokenDead(e)) {
        await markReconnect(uid);
        throw new CommandError("conflict", "reconnect");
      }
      console.error("instagram media failed", String(e));
      throw new CommandError("unavailable", "instagram_down");
    }
  }

  /** Instagram's thumbnail links expire, so a copy goes into our own storage. A failure just means no cover. */
  async function copyThumbnail(uid: string, url: string): Promise<string | null> {
    try {
      if (new URL(url).protocol !== "https:") return null;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const type = (res.headers.get("content-type") ?? "").split(";")[0];
      if (!res.ok || !["image/jpeg", "image/png"].includes(type)) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > 2 * 1024 * 1024) return null;
      const path = `${uid}/${crypto.randomUUID()}.${type === "image/png" ? "png" : "jpg"}`;
      const { error } = await admin.storage.from("artworks").upload(path, bytes, { contentType: type });
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

  /** Everything Instagram gave us for one Artist: imported reels and their covers, then the account and token. Pasted links stay. */
  async function purge(uid: string) {
    const { data: imported } = await admin.from("reels").select("id,cover").eq("artist_id", uid).not("ig_media_id", "is", null);
    for (const r of imported ?? []) await dropCover(r.cover);
    await admin.from("reels").delete().eq("artist_id", uid).not("ig_media_id", "is", null);
    await disconnect(uid);
  }

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
      return { url: authorizeUrl({ appId: c.appId, configId: c.configId, redirectUri: c.redirect, state }) };
    },

    async instagramMedia(ctx) {
      artistOnly(ctx);
      need();
      const items = await fetchMedia(ctx.uid);
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
      const byId = new Map((await fetchMedia(ctx.uid)).map((m) => [m.id, m]));
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

    // An Artist deletes their own Instagram data (S19, "Only my Instagram data"); works with or without a live connection.
    async instagramDeleteMyData(ctx) {
      artistOnly(ctx);
      await purge(ctx.uid);
      return {};
    },

    async instagramDisconnect(ctx) {
      artistOnly(ctx);
      await disconnect(ctx.uid);
      return {};
    },
  };

  // ---------- the browser comes back from Meta here (GET) ----------
  async function callback(url: URL) {
    const { site, appId, appSecret, redirect, key } = cfg();
    const back = (q: string) => Response.redirect(`${site}/instagram/return?instagram=${q}`, 302); // the login popup's last page
    if (!enabled()) return new Response("Instagram is not set up", { status: 503 });
    const state = url.searchParams.get("state") ?? "";
    // A state works once and only for ten minutes: this stops forged and replayed callbacks.
    const { data: row } = await admin.from("instagram_states").delete().eq("state", state).select("artist_id,expires_at").maybeSingle();
    if (!row || Date.parse(row.expires_at) < Date.now()) return back("error&reason=expired");
    if (url.searchParams.get("error")) return back("error&reason=denied");
    const code = url.searchParams.get("code") ?? "";
    if (!code) return back("error&reason=failed");
    try {
      const exchange = (extra: Record<string, string> = {}) => graph("/oauth/access_token", { client_id: appId, client_secret: appSecret, code, ...extra });
      let tok;
      try {
        tok = await exchange(); // as Meta's Unified Login guide shows it
      } catch (e) {
        if (!(e instanceof GraphError) || e.status !== 400) throw e;
        tok = await exchange({ redirect_uri: redirect }); // shortcut: some login dialogs want the redirect repeated; confirm in testing and drop one
      }
      const token: string = tok.access_token;
      const me = await graph("/me", { fields: "client_business_id", access_token: token });
      const accounts = await graph("/me/assigned_instagram_accounts", { fields: "id,username", access_token: token });
      const account = accounts.data?.[0]; // shortcut: if the artist shares several accounts only the first is used; upgrade if artists ask
      if (!account?.id || !account.username) return back("error&reason=no_account");
      const now = new Date().toISOString();
      const { error } = await admin.from("instagram_accounts").upsert({
        artist_id: row.artist_id, ig_user_id: String(account.id), username: account.username, token_cipher: await encryptToken(token, key),
        token_expires_at: null, refreshed_at: now, connected_at: now, needs_reconnect: false,
        client_business_id: me.client_business_id ?? null, app_user_id: me.id ? String(me.id) : null,
      }, { onConflict: "artist_id" });
      if (error) return back(error.code === "23505" ? "error&reason=already_linked" : "error&reason=failed");
      const handle = /^[A-Za-z0-9._]{1,30}$/.test(account.username) ? { instagram_handle: account.username } : {};
      await admin.from("profiles").update({ ...handle, instagram_verified: true, instagram_needs_reconnect: false }).eq("id", row.artist_id);
      return back("connected");
    } catch (e) {
      console.error("instagram callback failed", String(e));
      return back("error&reason=failed");
    }
  }

  // ---------- Meta tells us a person removed the app, or asks us to delete their data ----------
  // The signed_request's user_id may be the person's app-scoped id or the Instagram account id: match either.
  const signedUser = async (req: Request) => {
    const form = await req.formData().catch(() => null);
    const payload = await parseSignedRequest(String(form?.get("signed_request") ?? ""), cfg().appSecret);
    const id = payload?.user_id ? String(payload.user_id) : "";
    return /^\d+$/.test(id) ? id : null;
  };
  const artistOfMetaUser = async (id: string): Promise<string | null> =>
    (await admin.from("instagram_accounts").select("artist_id").or(`ig_user_id.eq.${id},app_user_id.eq.${id}`).limit(1).maybeSingle()).data?.artist_id ?? null;

  async function deauthorize(req: Request) {
    const id = await signedUser(req);
    if (!id) return new Response(null, { status: 400 });
    const artist = await artistOfMetaUser(id);
    if (artist) await disconnect(artist);
    return new Response(null, { status: 200 });
  }

  async function dataDeletion(req: Request) {
    const id = await signedUser(req);
    if (!id) return new Response(null, { status: 400 });
    const code = randomHex(16);
    await admin.from("instagram_deletions").insert({ code, ig_user_id: id });
    const artist = await artistOfMetaUser(id);
    if (artist) await purge(artist);
    await admin.from("instagram_deletions").update({ done_at: new Date().toISOString() }).eq("code", code);
    return new Response(JSON.stringify({ url: `${cfg().site}/instagram-deletion?code=${code}`, confirmation_code: code }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
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
    return new Response(null, { status: 404 });
  }

  return { commands, route };
}
