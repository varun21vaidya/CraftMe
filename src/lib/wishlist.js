/** Why a save or collection change was refused, in words for the buyer. */
export const wishlistMessage = (r) => ({
  wishlist_full: 'Your wish list is full (500 works). Remove one first.',
  collection_limit: 'You can have up to 20 collections.',
  collection_full: 'A collection holds up to 100 works.',
}[r?.error?.reason]
  || (r?.error?.code === 'forbidden' ? 'That work can’t be saved.' : 'Something went wrong. Please try again.'));

/** The same name in other capitals or with extra spaces counts as the same name. */
export const nameTaken = (collections, name, exceptId) =>
  collections.some((c) => c.id !== exceptId && c.name.trim().toLowerCase() === name.trim().toLowerCase());

/** The on-sale versions of a saved work with stock left. */
export const buyable = (artwork) => (artwork?.listings || []).filter((l) => l.status === 'live' && (l.stock || 0) - (l.held || 0) > 0);

/** What "Add to Cart" does for a saved work: add now, choose a version on the product page, or not available. */
export const cartAction = (artwork) => {
  if (!artwork || artwork.status !== 'published' || artwork.artistOpen === false) return { kind: 'gone' };
  const open = buyable(artwork);
  if (open.length === 0) return { kind: 'gone' };
  return open.length === 1 ? { kind: 'add', listing: open[0] } : { kind: 'choose' };
};

/** Saved items grouped by Artist (a Cart holds one Artist's work). Keeps order; works that are gone go in a separate list. */
export const groupByArtist = (saved) => {
  const groups = [];
  const gone = [];
  for (const s of saved) {
    if (!s.artwork) { gone.push(s); continue; }
    let g = groups.find((x) => x.artistId === s.artwork.artistId);
    if (!g) { g = { artistId: s.artwork.artistId, name: s.artwork.artist?.displayName || 'Artist', items: [] }; groups.push(g); }
    g.items.push(s);
  }
  return { groups, gone };
};
