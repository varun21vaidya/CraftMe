import { describe, expect, it, vi } from 'vitest';

vi.mock('../../api/supabase', () => ({ supabase: {} })); // importing the form must not create a real client
const { schema } = await import('./ArtworkUploadForm');

const photo = { type: 'image/jpeg', size: 1000 };
const base = { title: 'Cute Keychain', description: 'Beaded', category: 'Keychains', photos: [photo], kind: 'product', price: '199', stock: '5', size: '', medium: '' };
const ok = (v) => schema.isValidSync({ ...base, ...v });

describe('artwork form: what is being sold', () => {
  it('accepts a priced, stocked item', () => {
    expect(ok({})).toBe(true);
  });
  it('needs a whole-rupee price of at least 1', () => {
    expect(ok({ price: '' })).toBe(false);
    expect(ok({ price: '0' })).toBe(false);
    expect(ok({ price: '19.5' })).toBe(false);
    expect(ok({ price: 'abc' })).toBe(false);
  });
  it('needs a quantity unless it is a one-of-a-kind original', () => {
    expect(ok({ stock: '' })).toBe(false);
    expect(ok({ stock: '0' })).toBe(false);
    expect(ok({ stock: '1001' })).toBe(false);
    expect(ok({ kind: 'original', stock: '' })).toBe(true);
  });
  it('needs a kind', () => {
    expect(ok({ kind: '' })).toBe(false);
  });
});
