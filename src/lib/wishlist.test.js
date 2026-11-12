import { describe, expect, it } from 'vitest';
import { cartAction, groupByArtist, nameTaken, wishlistMessage } from './wishlist';

const live = (id, stock = 1, held = 0) => ({ id, status: 'live', stock, held });
const art = (over = {}) => ({ status: 'published', artistOpen: true, artistId: 'a1', listings: [live('l1')], ...over });

describe('cartAction', () => {
  it('adds straight away when exactly one version is on sale', () => expect(cartAction(art())).toEqual({ kind: 'add', listing: live('l1') }));
  it('asks to choose when several versions are on sale', () => expect(cartAction(art({ listings: [live('l1'), live('l2')] })).kind).toBe('choose'));
  it('ignores sold, draft and fully held versions', () => {
    expect(cartAction(art({ listings: [{ id: 'x', status: 'sold', stock: 0, held: 0 }, live('h', 1, 1), { id: 'd', status: 'draft', stock: 1, held: 0 }] })).kind).toBe('gone');
  });
  it('is gone when hidden, taken down, restricted or missing', () => {
    expect(cartAction(null).kind).toBe('gone');
    expect(cartAction(art({ status: 'draft' })).kind).toBe('gone');
    expect(cartAction(art({ artistOpen: false })).kind).toBe('gone');
    expect(cartAction(art({ listings: [] })).kind).toBe('gone');
  });
});

describe('groupByArtist', () => {
  it('groups by Artist in order and separates works that are gone', () => {
    const s = [
      { artworkId: '1', artwork: art({ artistId: 'a1', artist: { displayName: 'Meera' } }) },
      { artworkId: '2', artwork: null },
      { artworkId: '3', artwork: art({ artistId: 'a2' }) },
      { artworkId: '4', artwork: art({ artistId: 'a1' }) },
    ];
    const { groups, gone } = groupByArtist(s);
    expect(groups.map((g) => [g.artistId, g.name, g.items.length])).toEqual([['a1', 'Meera', 2], ['a2', 'Artist', 1]]);
    expect(gone).toHaveLength(1);
  });
  it('handles an empty list', () => expect(groupByArtist([])).toEqual({ groups: [], gone: [] }));
});

describe('nameTaken', () => {
  const cs = [{ id: '1', name: 'Gifts' }];
  it('ignores case and spaces', () => expect(nameTaken(cs, ' gifts ')).toBe(true));
  it('lets a collection keep its own name', () => expect(nameTaken(cs, 'GIFTS', '1')).toBe(false));
  it('allows a new name', () => expect(nameTaken(cs, 'Diwali')).toBe(false));
});

describe('wishlistMessage', () => {
  it('explains the limits', () => expect(wishlistMessage({ error: { code: 'invalid', reason: 'wishlist_full' } })).toMatch(/500/));
  it('falls back to a plain message', () => expect(wishlistMessage({ error: { code: 'unavailable' } })).toMatch(/try again/));
});
