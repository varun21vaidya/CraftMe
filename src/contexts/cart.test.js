import { describe, expect, it } from 'vitest';
import { cartReducer, emptyCart, MAX_QTY, parseCart, serializeCart } from './cart';

const add = (s, artistId, listingId) => cartReducer(s, { type: 'ADD', artistId, listingId });

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
    const s = add(add(emptyCart, 'a1', 'l1'), 'a2', 'l9');
    expect(s.items).toEqual([{ listingId: 'l1', qty: 1 }]);
    expect(s.conflict).toEqual({ artistId: 'a2', listingId: 'l9' });
    expect(cartReducer(s, { type: 'DISMISS' }).conflict).toBeNull();
    const fresh = cartReducer(s, { type: 'REPLACE' });
    expect(fresh).toEqual({ artistId: 'a2', items: [{ listingId: 'l9', qty: 1 }], conflict: null });
  });

  it('removing the last item frees the Cart for any Artist', () => {
    const s = cartReducer(add(emptyCart, 'a1', 'l1'), { type: 'REMOVE', listingId: 'l1' });
    expect(s.artistId).toBeNull();
    expect(add(s, 'a2', 'l5').artistId).toBe('a2');
  });

  it('a quantity below one removes the line', () => {
    const s = cartReducer(add(emptyCart, 'a1', 'l1'), { type: 'SET_QTY', listingId: 'l1', qty: 0 });
    expect(s.items).toEqual([]);
  });

  it('saves only ids and quantities and reloads them', () => {
    const s = add(add(emptyCart, 'a1', 'l1'), 'a1', 'l1');
    const raw = serializeCart({ ...s, conflict: { artistId: 'x', listingId: 'y' } });
    expect(JSON.parse(raw)).toEqual({ artistId: 'a1', items: [{ listingId: 'l1', qty: 2 }] });
    expect(parseCart(raw)).toEqual(s);
  });

  it('treats a missing, broken or old-shape saved Cart as empty', () => {
    expect(parseCart(null)).toEqual(emptyCart);
    expect(parseCart('{not json')).toEqual(emptyCart);
    expect(parseCart(JSON.stringify({ items: [{ id: 'x', price: 5, quantity: 1 }] }))).toEqual(emptyCart);
  });
});
