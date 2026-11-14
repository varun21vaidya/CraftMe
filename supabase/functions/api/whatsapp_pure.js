// Pure helpers for the WhatsApp phone check: no network, no database, so they run in Deno (Edge Function) and Node (tests).
// Supabase Auth calls the Send SMS Hook with a Standard Webhooks signed POST: {"user": {"phone": "919000000001", ...}, "sms": {"otp": "123456"}}.
const enc = new TextEncoder();
const b64ToBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const bytesToB64 = (bytes) => btoa(String.fromCharCode(...bytes));
const TOLERANCE_SECONDS = 300;

const equal = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

/** The hook's payload when the signature, id and timestamp (five minutes) check out; otherwise null. secret is "v1,whsec_<base64>". */
export async function verifyHook(rawBody, headers, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  const id = headers['webhook-id'], timestamp = headers['webhook-timestamp'], given = headers['webhook-signature'];
  if (!secret || !id || !timestamp || !given || typeof rawBody !== 'string') return null;
  if (!/^\d+$/.test(timestamp) || Math.abs(nowSeconds - Number(timestamp)) > TOLERANCE_SECONDS) return null;
  try {
    const key = await crypto.subtle.importKey('raw', b64ToBytes(secret.replace(/^v1,whsec_/, '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const expected = bytesToB64(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${id}.${timestamp}.${rawBody}`))));
    // the header may carry several signatures ("v1,<b64> v1,<b64>") while a secret is being rotated
    if (!given.split(' ').some((s) => s.startsWith('v1,') && equal(s.slice(3), expected))) return null;
    const payload = JSON.parse(rawBody);
    return /^\d{6}$/.test(String(payload?.sms?.otp ?? '')) && /^\d{8,15}$/.test(String(payload?.user?.phone ?? '').replace(/^\+/, '')) ? payload : null;
  } catch {
    return null;
  }
}

/** The Meta Cloud API request for an approved authentication template (code in the body and on the copy-code button). */
export const whatsappBody = ({ phone, otp, template, lang }) => ({
  messaging_product: 'whatsapp',
  to: String(phone).replace(/^\+/, ''),
  type: 'template',
  template: {
    name: template,
    language: { code: lang },
    components: [
      { type: 'body', parameters: [{ type: 'text', text: otp }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] },
    ],
  },
});
