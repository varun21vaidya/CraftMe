// Pure Cart rules. The Cart holds ids, quantities and the unit price the Buyer last saw: prices and stock are the server's to decide.
// One Artist per Cart: adding from another Artist raises a conflict the UI turns into a "start a new Cart?" dialog.

export const MAX_QTY = 10; // same cap the server enforces
export const NOTE_MAX = 120; // orders.gift_note
export const emptyCart = { artistId: null, items: [], conflict: null, note: '' };

const clamp = (n) => Math.min(Math.max(Math.trunc(n) || 1, 1), MAX_QTY);
const price = (p) => (Number.isInteger(p) && p >= 0 ? p : undefined);
const line = (listingId, qty, seen) => (seen === undefined ? { listingId, qty } : { listingId, qty, seen });

export function cartReducer(state, action) {
  switch (action.type) {
    case 'CONFLICT':
      return { ...state, conflict: action.selection };
    case 'APPLY':
      return { ...state, artistId: action.cart.artistId, items: action.cart.items, conflict: null };
    case 'ADD': {
      const { artistId, listingId } = action;
      const seen = price(action.price);
      if (state.items.length && state.artistId !== artistId) return { ...state, conflict: { artistId, listingId, ...(seen !== undefined && { price: seen }) } };
      const found = state.items.some((i) => i.listingId === listingId);
      if (found && action.once) return state; // "Buy now" pressed twice is still one unit
      const items = found
        ? state.items.map((i) => (i.listingId === listingId ? { ...i, qty: clamp(i.qty + 1) } : i))
        : [...state.items, line(listingId, 1, seen)];
      return { ...state, artistId, items, conflict: null };
    }
    case 'REPLACE': // the Buyer chose "start a new Cart"
      return state.conflict
        ? { ...state, artistId: state.conflict.artistId, items: [line(state.conflict.listingId, 1, price(state.conflict.price))], conflict: null }
        : state;
    case 'DISMISS':
      return { ...state, conflict: null };
    case 'SET_QTY': {
      if (action.qty < 1) return cartReducer(state, { type: 'REMOVE', listingId: action.listingId });
      return { ...state, items: state.items.map((i) => (i.listingId === action.listingId ? { ...i, qty: clamp(action.qty) } : i)) };
    }
    case 'REMOVE':
      return cartReducer(state, { type: 'REMOVE_MANY', listingIds: [action.listingId] });
    case 'REMOVE_MANY': {
      const items = state.items.filter((i) => !action.listingIds.includes(i.listingId));
      if (items.length === state.items.length) return state;
      return { ...state, artistId: items.length ? state.artistId : null, items, conflict: null };
    }
    case 'ACCEPT_PRICES': // the Buyer agreed to today's prices: remember them as seen
      return { ...state, items: state.items.map((i) => (price(action.prices[i.listingId]) === undefined ? i : { ...i, seen: action.prices[i.listingId] })) };
    case 'NOTE':
      return { ...state, note: String(action.note || '').slice(0, NOTE_MAX) };
    case 'CLEAR':
      return emptyCart;
    default:
      return state;
  }
}

export const serializeCart = (s) => JSON.stringify({ artistId: s.artistId, items: s.items, ...(s.note && { note: s.note }) });

/** Reads a saved Cart; anything malformed (or from an older shape) becomes an empty Cart. */
export function parseCart(raw) {
  try {
    const d = JSON.parse(raw);
    const items = Array.isArray(d?.items) ? d.items.filter((i) => typeof i?.listingId === 'string' && i.qty >= 1) : [];
    if (!items.length || typeof d.artistId !== 'string') return emptyCart;
    return {
      artistId: d.artistId,
      items: items.map((i) => line(i.listingId, clamp(i.qty), price(i.seen))),
      conflict: null,
      note: typeof d.note === 'string' ? d.note.slice(0, NOTE_MAX) : '',
    };
  } catch {
    return emptyCart;
  }
}

/**
 * What changed since the Buyer added each line. listings: {id: listing | null | undefined} (undefined = still loading).
 * Returns { changed: [{listingId, from, to}], gone: [listingId], busy: [listingId] }.
 */
export function cartChanges(items, listings) {
  const out = { changed: [], gone: [], busy: [] };
  for (const i of items) {
    const l = listings[i.listingId];
    if (l === undefined) continue;
    if (l === null || l.status !== 'live') out.gone.push(i.listingId);
    else if ((l.stock || 0) - (l.held || 0) < 1) out.busy.push(i.listingId);
    else if (i.seen !== undefined && i.seen !== l.price) out.changed.push({ listingId: i.listingId, from: i.seen, to: l.price });
  }
  return out;
}
