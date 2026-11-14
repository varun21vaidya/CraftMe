import { describe, expect, it } from 'vitest';
import { verifyHook, whatsappBody } from './whatsapp_pure.js';

const secretBytes = Buffer.from('0123456789abcdef0123456789abcdef');
const SECRET = `v1,whsec_${secretBytes.toString('base64')}`;
const NOW = 1_800_000_000;
const body = JSON.stringify({ user: { phone: '919000000001' }, sms: { otp: '123456' } });

async function sign(raw, { id = 'msg_1', ts = NOW } = {}) {
  const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${raw}`))).toString('base64');
  return { 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${sig}` };
}

describe('verifyHook', () => {
  it('accepts a signed, fresh request', async () => {
    expect((await verifyHook(body, await sign(body), SECRET, NOW)).sms.otp).toBe('123456');
  });
  it('accepts a rotated header with an old and a good signature', async () => {
    const h = await sign(body);
    expect(await verifyHook(body, { ...h, 'webhook-signature': `v1,AAAA ${h['webhook-signature']}` }, SECRET, NOW)).not.toBeNull();
  });
  it('refuses a changed body, a wrong secret, a missing header and no secret', async () => {
    const h = await sign(body);
    expect(await verifyHook(body.replace('123456', '654321'), h, SECRET, NOW)).toBeNull();
    expect(await verifyHook(body, h, `v1,whsec_${Buffer.from('another-secret-another-secret-12').toString('base64')}`, NOW)).toBeNull();
    expect(await verifyHook(body, { ...h, 'webhook-signature': undefined }, SECRET, NOW)).toBeNull();
    expect(await verifyHook(body, h, '', NOW)).toBeNull();
  });
  it('refuses a request older or newer than five minutes', async () => {
    expect(await verifyHook(body, await sign(body, { ts: NOW - 301 }), SECRET, NOW)).toBeNull();
    expect(await verifyHook(body, await sign(body, { ts: NOW + 301 }), SECRET, NOW)).toBeNull();
    expect(await verifyHook(body, await sign(body, { ts: NOW - 299 }), SECRET, NOW)).not.toBeNull();
  });
  it('refuses a payload without a six-digit code or a phone', async () => {
    for (const raw of [JSON.stringify({ user: { phone: '919000000001' }, sms: { otp: '12' } }), JSON.stringify({ user: {}, sms: { otp: '123456' } }), 'not json']) {
      expect(await verifyHook(raw, await sign(raw), SECRET, NOW)).toBeNull();
    }
  });
});

describe('whatsappBody', () => {
  it('builds an authentication template message with the code in body and button, and no plus sign', () => {
    const b = whatsappBody({ phone: '+919000000001', otp: '123456', template: 'craftme_code', lang: 'en' });
    expect(b.to).toBe('919000000001');
    expect(b.template.name).toBe('craftme_code');
    expect(b.template.language.code).toBe('en');
    expect(b.template.components.map((c) => c.parameters[0].text)).toEqual(['123456', '123456']);
  });
});
