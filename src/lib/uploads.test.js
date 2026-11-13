import { describe, expect, it } from 'vitest';
import { rejectionText, uploadAll, validateFiles } from './uploads';

const file = (name, type, mb = 1) => ({ name, type, size: mb * 1024 * 1024 });
const opts = { accept: 'image/jpeg,image/png', maxBytes: 5 * 1024 * 1024, maxFiles: 6 };

describe('validateFiles', () => {
  it('QA-S14-03: a mixed batch keeps the good files and names each refusal', () => {
    const batch = [file('a.jpg', 'image/jpeg'), file('b.jpg', 'image/jpeg'), file('big.png', 'image/png', 6), file('doc.pdf', 'application/pdf'), file('c.webp', 'image/webp')];
    const { ok, rejected } = validateFiles(batch, opts);
    expect(ok.map((f) => f.name)).toEqual(['a.jpg', 'b.jpg']);
    expect(rejected).toEqual([{ name: 'big.png', reason: 'size' }, { name: 'doc.pdf', reason: 'type' }, { name: 'c.webp', reason: 'type' }]);
  });

  it('accepts up to the limit counting files already chosen, and refuses the rest as count', () => {
    const more = ['1', '2', '3', '4', '5'].map((n) => file(`${n}.jpg`, 'image/jpeg'));
    const { ok, rejected } = validateFiles(more, { ...opts, have: 2 });
    expect(ok).toHaveLength(4);
    expect(rejected).toEqual([{ name: '5.jpg', reason: 'count' }]);
  });

  it('a file of exactly the size limit passes; a full list refuses everything', () => {
    expect(validateFiles([file('x.png', 'image/png', 5)], opts).ok).toHaveLength(1);
    expect(validateFiles([file('x.png', 'image/png')], { ...opts, have: 6 }).rejected[0].reason).toBe('count');
  });

  it('words the refusals', () => {
    expect(rejectionText({ name: 'a.pdf', reason: 'type' }, opts)).toBe('a.pdf: not a JPEG or PNG.');
    expect(rejectionText({ name: 'a.png', reason: 'size' }, opts)).toBe('a.png: too large (up to 5 MB).');
    expect(rejectionText({ name: 'a.jpg', reason: 'count' }, opts)).toBe('a.jpg: up to 6 photos.');
  });
});

describe('uploadAll', () => {
  const queued = (n) => Array.from({ length: n }, (_, i) => ({ id: i, file: { name: `${i}.jpg` }, status: 'queued' }));

  it('uploads two at a time and records each path', async () => {
    let live = 0; let peak = 0;
    const out = await uploadAll(queued(5), async (f) => {
      live += 1; peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      live -= 1;
      return { ok: true, path: `damage/u/${f.name}` };
    });
    expect(peak).toBe(2);
    expect(out.map((i) => i.status)).toEqual(Array(5).fill('done'));
    expect(out[3].path).toBe('damage/u/3.jpg');
  });

  it('a failed item is marked and the others still finish; a retry sends only the failed one', async () => {
    const sent = [];
    let failOnce = true;
    const uploadOne = async (f) => {
      sent.push(f.name);
      if (f.name === '1.jpg' && failOnce) { failOnce = false; return { ok: false, error: { code: 'unavailable' } }; }
      return { ok: true, path: `p/${f.name}` };
    };
    const first = await uploadAll(queued(3), uploadOne);
    expect(first.map((i) => i.status)).toEqual(['done', 'failed', 'done']);
    expect(first[1].error).toBe('unavailable');
    sent.length = 0;
    const second = await uploadAll(first, uploadOne);
    expect(sent).toEqual(['1.jpg']);
    expect(second.map((i) => i.status)).toEqual(['done', 'done', 'done']);
    expect(second.map((i) => i.path)).toEqual(['p/0.jpg', 'p/1.jpg', 'p/2.jpg']);
  });

  it('treats a throw as a failure, reports changes, and does not mutate the input', async () => {
    const items = queued(2);
    const seen = [];
    const out = await uploadAll(items, async (f) => { if (f.name === '0.jpg') throw new Error('network'); return { ok: true, path: 'p' }; }, { onChange: (s) => seen.push(s.map((i) => i.status).join()) });
    expect(out.map((i) => i.status)).toEqual(['failed', 'done']);
    expect(items.every((i) => i.status === 'queued')).toBe(true);
    expect(seen.at(-1)).toBe('failed,done');
    expect(seen).toContain('uploading,uploading');
  });

  it('does nothing when every item is done', async () => {
    let calls = 0;
    const done = queued(2).map((i) => ({ ...i, status: 'done', path: 'p' }));
    await uploadAll(done, async () => { calls += 1; return { ok: true }; });
    expect(calls).toBe(0);
  });
});
