// Instagram API calls, one module (no port: one vendor). Endpoints follow Meta's "Instagram API with Instagram Login"
// as documented; they have not been run against a real app yet (blueprint Part 14).
// Only permalinks and ids are ever stored; media_url values expire and Meta forbids re-hosting.

const crypto = require("crypto");
const {FieldPath, FieldValue} = require("firebase-admin/firestore");

const GRAPH = "https://graph.instagram.com";
const PERMALINK = /^https:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?$/;

async function getJson(url, init) {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error?.message || body.error_message || `instagram ${res.status}`);
  return body;
}

const authorizeUrl = ({appId, redirectUri, state}) => "https://www.instagram.com/oauth/authorize?" + new URLSearchParams({
  client_id: appId, redirect_uri: redirectUri, response_type: "code", scope: "instagram_business_basic", state,
});

async function exchangeCode({appId, appSecret, redirectUri, code}) {
  const body = await getJson("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: appId, client_secret: appSecret, grant_type: "authorization_code", redirect_uri: redirectUri, code,
    }),
  });
  return {token: body.access_token, userId: String(body.user_id)};
}

async function longLived({appSecret, token}) {
  const b = await getJson(`${GRAPH}/access_token?` + new URLSearchParams({
    grant_type: "ig_exchange_token", client_secret: appSecret, access_token: token,
  }));
  return {token: b.access_token, expiresInMs: b.expires_in * 1000};
}

async function refresh(token) {
  const b = await getJson(`${GRAPH}/refresh_access_token?` + new URLSearchParams({
    grant_type: "ig_refresh_token", access_token: token,
  }));
  return {token: b.access_token, expiresInMs: b.expires_in * 1000};
}

const me = async (token) => {
  const b = await getJson(`${GRAPH}/me?` + new URLSearchParams({fields: "user_id,username,account_type", access_token: token}));
  return {id: String(b.user_id || b.id), username: b.username, accountType: b.account_type};
};

async function media(token) {
  const b = await getJson(`${GRAPH}/me/media?` + new URLSearchParams({
    fields: "id,media_type,permalink,thumbnail_url,media_url,caption", limit: "25", access_token: token,
  }));
  return (b.data || []).map((m) => ({
    id: m.id, mediaType: m.media_type, permalink: m.permalink, caption: (m.caption || "").slice(0, 120),
    thumbnail: m.thumbnail_url || m.media_url || null, // shown now, never stored
  }));
}

/** Meta's deauthorise and data-deletion callbacks send a signed_request: signature.payload (base64url). */
function parseSignedRequest(signed, appSecret) {
  const [sig, payload] = String(signed || "").split(".");
  if (!sig || !payload) return null;
  const expected = crypto.createHmac("sha256", appSecret).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

/** Disconnect or deletion request: remove the token, the picks and any reel links. */
async function removeInstagram(db, uid) {
  await db.doc(`instagramTokens/${uid}`).delete();
  await db.doc(`artistPrivate/${uid}`).set({instagram: {connected: false}}, {merge: true});
  await db.doc(`users/${uid}`).set({instagramUsername: null, showcase: []}, {merge: true});
  let last = null;
  for (;;) {
    let q = db.collection("artworks").where("artistId", "==", uid).where("video.type", "==", "instagram")
        .orderBy(FieldPath.documentId()).limit(400);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, {video: FieldValue.delete()}));
    await batch.commit();
    if (snap.size < 400) break;
    last = snap.docs[snap.docs.length - 1];
  }
}

module.exports = {PERMALINK, authorizeUrl, exchangeCode, longLived, refresh, me, media, parseSignedRequest, removeInstagram};
