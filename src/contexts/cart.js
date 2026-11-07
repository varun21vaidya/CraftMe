// Pure Cart rules. The Cart holds ids and quantities only: prices and stock are the server's to decide.
// One Artist per Cart: adding from another Artist raises a conflict the UI turns into a "start a new Cart?" dialog.

export const MAX_QTY = 10; // same cap the server enforces
export const emptyCart = { artistId: null, items: [], conflict: null };

const clamp = (n) => Math.min(Math.max(Math.trunc(n) || 1, 1), MAX_QTY);

export function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD': {
      const { artistId, listingId } = action;
      if (state.items.length && state.artistId !== artistId) return { ...state, conflict: { artistId, listingId } };
      const found = state.items.some((i) => i.listingId === listingId);
      const items = found
        ? state.items.map((i) => (i.listingId === listingId ? { ...i, qty: clamp(i.qty + 1) } : i))
        : [...state.items, { listingId, qty: 1 }];
      return { artistId, items, conflict: null };
    }
    case 'REPLACE': // the Buyer chose "start a new Cart"
      return state.conflict
        ? { artistId: state.conflict.artistId, items: [{ listingId: state.conflict.listingId, qty: 1 }], conflict: null }
        : state;
    case 'DISMISS':
      return { ...state, conflict: null };
    case 'SET_QTY': {
      if (action.qty < 1) return cartReducer(state, { type: 'REMOVE', listingId: action.listingId });
      return { ...state, items: state.items.map((i) => (i.listingId === action.listingId ? { ...i, qty: clamp(action.qty) } : i)) };
    }
    case 'REMOVE': {
      const items = state.items.filter((i) => i.listingId !== action.listingId);
      return { artistId: items.length ? state.artistId : null, items, conflict: null };
    }
    case 'CLEAR':
      return emptyCart;
    default:
      return state;
  }
}

export const serializeCart = (s) => JSON.stringify({ artistId: s.artistId, items: s.items });

/** Reads a saved Cart; anything malformed (or from an older shape) becomes an empty Cart. */
export function parseCart(raw) {
  try {
    const d = JSON.parse(raw);
    const items = Array.isArray(d?.items) ? d.items.filter((i) => typeof i?.listingId === 'string' && i.qty >= 1) : [];
    if (!items.length || typeof d.artistId !== 'string') return emptyCart;
    return { artistId: d.artistId, items: items.map((i) => ({ listingId: i.listingId, qty: clamp(i.qty) })), conflict: null };
  } catch {
    return emptyCart;
  }
}
