import { describe, expect, it } from 'vitest';
import { cartChanges, cartReducer, emptyCart, MAX_QTY, NOTE_MAX, parseCart, serializeCart } from './cart';

const add = (s, artistId, listingId, price) => cartReducer(s, { type: 'ADD', artistId, listingId, price });

describe('cart', () => {
  it('adds, merges the same Listing and caps the quantity', () => {
    let s = add(emptyCart, 'a1', 'l1');
    s = add(s, 'a1', 'l2');
    s = add(s, 'a1', 'l1');
    expect(s.items).toEqual([{ listingId: 'l1', qty: 2 }, { listingId: 'l2', qty: 1 }]);
    for (let i = 0; i < 20; i++) s = add(s, 'a1', 'l1');
    expect(s.items[0].qty).toBe(MAX_QTY);
  });

  it('refuses a second Artist and offers a new Cart instead', () => {
    const s = add(add(emptyCart, 'a1', 'l1'), 'a2', 'l9', 5000);
    expect(s.items).toEqual([{ listingId: 'l1', qty: 1 }]);
    expect(s.conflict).toEqual({ artistId: 'a2', listingId: 'l9', price: 5000 });
    expect(cartReducer(s, { type: 'DISMISS' }).conflict).toBeNull();
    const fresh = cartReducer(s, { type: 'REPLACE' });
    expect(fresh).toEqual({ artistId: 'a2', items: [{ listingId: 'l9', qty: 1, seen: 5000 }], conflict: null, note: '' });
  });

  it('removing the last item frees the Cart for any Artist', () => {
    const s = cartReducer(add(emptyCart, 'a1', 'l1'), { type: 'REMOVE', listingId: 'l1' });
    expect(s.artistId).toBeNull();
    expect(add(s, 'a2', 'l5').artistId).toBe('a2');
  });

  it('SET_QTY clamps to 1 to 10 and removes the line below 1 (QA-S08-04)', () => {
    const one = add(emptyCart, 'a1', 'l1');
    expect(cartReducer(one, { type: 'SET_QTY', listingId: 'l1', qty: 99 }).items[0].qty).toBe(MAX_QTY);
    expect(cartReducer(one, { type: 'SET_QTY', listingId: 'l1', qty: 0 }).items).toEqual([]);
  });

  it('remembers the price the Buyer saw, and only when first added', () => {
    let s = add(emptyCart, 'a1', 'l1', 220000);
    s = add(s, 'a1', 'l1', 240000); // a second unit does not silently accept a new price
    expect(s.items).toEqual([{ listingId: 'l1', qty: 2, seen: 220000 }]);
  });

  it('ACCEPT_PRICES records today\'s prices as seen', () => {
    const s = add(add(emptyCart, 'a1', 'l1', 220000), 'a1', 'l2', 100);
    const next = cartReducer(s, { type: 'ACCEPT_PRICES', prices: { l1: 240000 } });
    expect(next.items).toEqual([{ listingId: 'l1', qty: 1, seen: 240000 }, { listingId: 'l2', qty: 1, seen: 100 }]);
  });

  it('REMOVE_MANY drops several lines at once', () => {
    const s = add(add(add(emptyCart, 'a1', 'l1'), 'a1', 'l2'), 'a1', 'l3');
    expect(cartReducer(s, { type: 'REMOVE_MANY', listingIds: ['l1', 'l3'] }).items).toEqual([{ listingId: 'l2', qty: 1 }]);
    expect(cartReducer(s, { type: 'REMOVE_MANY', listingIds: ['zz'] })).toBe(s);
  });

  it('keeps a gift note of at most 120 characters', () => {
    expect(cartReducer(emptyCart, { type: 'NOTE', note: 'x'.repeat(130) }).note).toHaveLength(NOTE_MAX);
  });

  it('saves ids, quantities, seen prices and the note, and reloads them', () => {
    let s = add(add(emptyCart, 'a1', 'l1', 220000), 'a1', 'l1');
    s = cartReducer(s, { type: 'NOTE', note: 'Happy birthday' });
    const raw = serializeCart({ ...s, conflict: { artistId: 'x', listingId: 'y' } });
    expect(JSON.parse(raw)).toEqual({ artistId: 'a1', items: [{ listingId: 'l1', qty: 2, seen: 220000 }], note: 'Happy birthday' });
    expect(parseCart(raw)).toEqual(s);
  });

  it('treats a missing, broken or old-shape saved Cart as empty, and drops a bad seen price', () => {
    expect(parseCart(null)).toEqual(emptyCart);
    expect(parseCart('{not json')).toEqual(emptyCart);
    expect(parseCart(JSON.stringify({ items: [{ id: 'x', price: 5, quantity: 1 }] }))).toEqual(emptyCart);
    expect(parseCart(JSON.stringify({ artistId: 'a', items: [{ listingId: 'l', qty: 1, seen: 'cheap' }] })).items).toEqual([{ listingId: 'l', qty: 1 }]);
  });
});

describe('cartChanges', () => {
  const items = [{ listingId: 'p', qty: 2, seen: 220000 }, { listingId: 'o', qty: 1, seen: 4200000 }, { listingId: 'h', qty: 1 }, { listingId: 'n', qty: 1 }];
  it('finds changed prices, gone lines and lines held by someone else (QA-S08-03)', () => {
    const listings = {
      p: { status: 'live', price: 240000, stock: 12, held: 0 },
      o: { status: 'sold', price: 4200000, stock: 0, held: 0 },
      h: { status: 'live', price: 100, stock: 1, held: 1 },
      n: undefined, // still loading
    };
    expect(cartChanges(items, listings)).toEqual({ changed: [{ listingId: 'p', from: 220000, to: 240000 }], gone: ['o'], busy: ['h'] });
  });
  it('a missing listing counts as gone', () => {
    expect(cartChanges([{ listingId: 'x', qty: 1 }], { x: null }).gone).toEqual(['x']);
  });
});
