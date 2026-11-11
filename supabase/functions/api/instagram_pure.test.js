import { describe, expect, it } from 'vitest';
import { authorizeUrl, decryptToken, encryptToken, filterMedia, parseSignedRequest } from './instagram_pure.js';

const b64url = (bytes) => Buffer.from(bytes).toString('base64url');
async function sign(payload, secret) {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  return `${b64url(sig)}.${body}`;
}

describe('parseSignedRequest', () => {
  it('accepts a good signature', async () => {
    const signed = await sign({ algorithm: 'HMAC-SHA256', user_id: '123' }, 's3cret');
    expect((await parseSignedRequest(signed, 's3cret')).user_id).toBe('123');
  });
  it('refuses a wrong secret, a tampered payload, a wrong algorithm and junk', async () => {
    const signed = await sign({ algorithm: 'HMAC-SHA256', user_id: '123' }, 's3cret');
    expect(await parseSignedRequest(signed, 'other')).toBeNull();
    const [sig] = signed.split('.');
    expect(await parseSignedRequest(`${sig}.${b64url(Buffer.from('{"algorithm":"HMAC-SHA256","user_id":"999"}'))}`, 's3cret')).toBeNull();
    expect(await parseSignedRequest(await sign({ algorithm: 'none', user_id: '1' }, 's3cret'), 's3cret')).toBeNull();
    expect(await parseSignedRequest('nope', 's3cret')).toBeNull();
    expect(await parseSignedRequest(signed, '')).toBeNull();
  });
});

describe('token encryption', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  it('round-trips and never repeats', async () => {
    const a = await encryptToken('IGQ-token', key);
    const b = await encryptToken('IGQ-token', key);
    expect(a).not.toBe(b);
    expect(await decryptToken(a, key)).toBe('IGQ-token');
  });
  it('refuses a wrong key and a short key', async () => {
    const a = await encryptToken('IGQ-token', key);
    await expect(decryptToken(a, Buffer.alloc(32, 8).toString('base64'))).rejects.toThrow();
    await expect(encryptToken('x', Buffer.alloc(8).toString('base64'))).rejects.toThrow();
  });
});

describe('small helpers', () => {
  it('builds the Unified Login dialog URL', () => {
    const u = new URL(authorizeUrl({ appId: '1', configId: '99', redirectUri: 'https://x.test/cb', state: 'st' }));
    expect(u.origin + u.pathname).toBe('https://www.facebook.com/dialog/oauth');
    expect(u.searchParams.get('client_id')).toBe('1');
    expect(u.searchParams.get('config_id')).toBe('99');
    expect(u.searchParams.get('redirect_uri')).toBe('https://x.test/cb');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('state')).toBe('st');
    expect(u.searchParams.get('display')).toBe('popup');
  });
  it('keeps reels and videos only', () => {
    const out = filterMedia([
      { id: '1', permalink: 'https://www.instagram.com/reel/A/', media_product_type: 'REELS', media_type: 'VIDEO', thumbnail_url: 't' },
      { id: '2', permalink: 'https://www.instagram.com/p/B/', media_type: 'VIDEO' },
      { id: '3', permalink: 'https://www.instagram.com/p/C/', media_type: 'IMAGE', media_product_type: 'FEED' },
      { id: '4', permalink: 'https://www.instagram.com/p/D/', media_type: 'CAROUSEL_ALBUM' },
      { id: '5', media_type: 'VIDEO' },
    ]);
    expect(out.map((m) => m.id)).toEqual(['1', '2']);
    expect(out[0].thumbnail).toBe('t');
    expect(out[1].thumbnail).toBeNull();
  });
});
