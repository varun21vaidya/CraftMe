// Pure helpers for the Instagram connection: no network, no database, so they run in Deno (Edge Function) and Node (tests).
const enc = new TextEncoder();
const dec = new TextDecoder();

export const b64urlToBytes = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};
const bytesToB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const equal = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
};

/** Meta's signed_request ("<sig>.<payload>", HMAC-SHA256 over the payload with the app secret). Returns the payload, or null. */
export async function parseSignedRequest(signed, secret) {
  if (typeof signed !== 'string' || !secret) return null;
  const [sigPart, payloadPart, extra] = signed.split('.');
  if (!sigPart || !payloadPart || extra !== undefined) return null;
  try {
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const expected = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payloadPart)));
    if (!equal(expected, b64urlToBytes(sigPart))) return null;
    const payload = JSON.parse(dec.decode(b64urlToBytes(payloadPart)));
    return payload?.algorithm?.toUpperCase() === 'HMAC-SHA256' ? payload : null;
  } catch {
    return null;
  }
}

const aesKey = (keyB64, usage) => {
  const raw = b64ToBytes(keyB64);
  if (raw.length !== 32) throw new Error('INSTAGRAM_TOKEN_KEY must be 32 bytes, base64');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [usage]);
};
/** AES-256-GCM. Output is base64(iv + ciphertext); a new random iv every time. */
export async function encryptToken(token, keyB64) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(keyB64, 'encrypt'), enc.encode(token)));
  return bytesToB64(new Uint8Array([...iv, ...body]));
}
export async function decryptToken(cipher, keyB64) {
  const all = b64ToBytes(cipher);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, await aesKey(keyB64, 'decrypt'), all.slice(12));
  return dec.decode(plain);
}

/** The Facebook Login for Business dialog of the Instagram API with Unified Login. config_id picks the permissions and assets asked for. */
export const authorizeUrl = ({ appId, configId, redirectUri, state }) =>
  'https://www.facebook.com/dialog/oauth?' + new URLSearchParams({
    client_id: appId, config_id: configId, redirect_uri: redirectUri, response_type: 'code',
    override_default_response_type: 'true', state, prompt: 'login',
  });

/** Keeps reels and videos; drops photos and carousels. media_url is never used (it can be missing). */
export const filterMedia = (items) => (Array.isArray(items) ? items : [])
  .filter((m) => m && m.id && m.permalink && (m.media_product_type === 'REELS' || m.media_type === 'VIDEO'))
  .map((m) => ({
    id: String(m.id), permalink: m.permalink, thumbnail: m.thumbnail_url || null,
    caption: String(m.caption ?? '').slice(0, 200), timestamp: m.timestamp ?? null,
  }));
