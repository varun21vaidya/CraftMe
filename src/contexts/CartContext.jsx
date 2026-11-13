import { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOrderStage, switchSavedCart, switchSavedCartMany, useSavedCart } from '../api/gateway';
import { useToast } from '../components/ui/Toast';
import { useAuth } from './AuthContext';
import { cartReducer, emptyCart, parseCart, serializeCart } from './cart';

const KEY = 'cm-cart';
const PENDING = 'cm-pending-order';
const PAID_OR_LATER = ['paid', 'shipped', 'received', 'refunded'];
const CartContext = createContext(null);

const load = (key) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null || key === KEY) return parseCart(stored);
    const legacy = localStorage.getItem(KEY);
    if (legacy === null) return emptyCart;
    localStorage.setItem(key, legacy);
    localStorage.removeItem(KEY);
    return parseCart(legacy);
  } catch {
    return emptyCart; // storage can be blocked (private window)
  }
};
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* blocked */ } };

/** "2 added. 2 skipped: …" after a group add (D07). */
export const groupMessage = (added, skipped) =>
  `${added} added.${skipped ? ` ${skipped} skipped: sold, already in your Cart, or a version must be chosen.` : ''}`;

export function CartProvider({ children }) {
  const { currentUser } = useAuth();
  return <BuyerCart key={currentUser?.uid || 'guest'} uid={currentUser?.uid}>{children}</BuyerCart>;
}

function BuyerCart({ children, uid }) {
  const key = uid ? `${KEY}:${uid}` : KEY;
  const pendingKey = `${PENDING}:${uid}`;
  const navigate = useNavigate();
  const toast = useToast();
  const [cart, dispatch] = useReducer(cartReducer, key, load);
  const journal = `cm-cart-operation:${uid}`;
  const [saved, savedLoading, savedError, reloadSaved] = useSavedCart(uid);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(''); // the result of the last group add, for a role="status" line
  const [operation, setOperation] = useState(() => {
    try { return uid ? JSON.parse(localStorage.getItem(journal)) : null; }
    catch { return null; }
  });
  const busy = useRef(false);
  const mounted = useRef(false);
  const latest = useRef(cart);
  latest.current = cart;

  useEffect(() => {
    try {
      if (uid || cart.items.length) localStorage.setItem(key, serializeCart(cart));
    } catch { /* the Cart still works for this visit */ }
  }, [cart, key, uid]);

  // The Buyer paid in another tab, or the webhook landed after they left: empty the Cart once the server says Paid.
  useEffect(() => {
    const orderId = uid && read(pendingKey);
    if (!orderId) return;
    getOrderStage(orderId).then((r) => {
      if (!r.ok || !mounted.current) return;
      if (PAID_OR_LATER.includes(r.stage)) { dispatch({ type: 'CLEAR' }); write(pendingKey, null); }
      else if (r.stage !== 'hold') write(pendingKey, null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per provider mount
  }, []);

  async function run(next) {
    if (busy.current || !uid) return;
    try { localStorage.setItem(journal, JSON.stringify(next)); }
    catch { setMessage('Enable browser storage to switch carts safely.'); return; }
    busy.current = true;
    setOperation(next);
    setPending(true);
    setMessage('');
    setStatus('');
    const response = next.kind === 'many' ? await switchSavedCartMany(uid, next) : await switchSavedCart(uid, next);
    busy.current = false;
    if (!mounted.current) return;
    setPending(false);
    if (!response.ok) {
      setMessage('Could not switch carts. Try again.');
      return;
    }
    const result = response.result;
    const before = latest.current.items;
    // keep the price the Buyer saw: from this selection, else from the line already in the Cart
    const items = (result.items || []).map((i) => {
      const seen = next.prices?.[i.listingId] ?? before.find((b) => b.listingId === i.listingId)?.seen;
      return seen === undefined ? i : { ...i, seen };
    });
    try {
      if (!result.unavailable && !result.unchanged) localStorage.setItem(key, serializeCart({ ...latest.current, artistId: result.artistId, items }));
      localStorage.removeItem(journal);
    } catch {
      setMessage('Could not update browser storage. Try again.');
      return;
    }
    setOperation(null);
    reloadSaved();
    if (result.unavailable) {
      const names = result.unavailable.map((id) => next.labels?.[id] || 'Selected work');
      setMessage(`${names.join(', ')} could not be moved. Check availability and try again.`);
      return;
    }
    if (next.kind === 'many') {
      const added = result.unchanged ? 0 : next.add.filter((id) => !before.some((b) => b.listingId === id) && items.some((i) => i.listingId === id)).length;
      const text = groupMessage(added, (next.works ?? next.add.length) - added);
      setStatus(text);
      toast(text);
      if (result.unchanged) return;
    }
    dispatch({ type: 'APPLY', cart: { artistId: result.artistId, items } });
    if (result.excess) setMessage('The cart quantity limit was reached. Extra units are still saved for later.');
    if (next.then === 'checkout') navigate('/checkout');
  }

  useEffect(() => {
    mounted.current = true;
    if (operation) run(operation);
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replay only on provider mount
  }, []);

  function begin(selection) {
    if (operation || busy.current) return;
    if (selection.kind === 'many') {
      run({ kind: 'many', id: crypto.randomUUID(), active: cart.items, add: selection.add, works: selection.works,
        prices: selection.prices, labels: selection.labels });
      return;
    }
    run({ id: crypto.randomUUID(), active: cart.items, restore: selection.restore || [],
      listingId: selection.listingId || null, labels: selection.labels, then: selection.then,
      prices: selection.listingId && selection.price !== undefined ? { [selection.listingId]: selection.price } : undefined });
  }

  function restore(lines) {
    if (!lines.length || operation || busy.current) return;
    const artistId = lines[0].listing.artistId;
    const selection = { artistId, restore: lines.map((line) => line.listingId),
      labels: Object.fromEntries(lines.map((line) => [line.listingId, line.listing.artwork?.title || line.listing.title])) };
    if (cart.items.length && cart.artistId !== artistId) dispatch({ type: 'CONFLICT', selection });
    else begin(selection);
  }

  const free = () => !operation && !busy.current;
  const clash = (artistId) => cart.items.length > 0 && cart.artistId !== artistId;
  const mutate = (action) => { if (free()) dispatch(action); };

  /** Adds one unit. Returns 'added', or 'conflict' when the "Start a new Cart?" dialog opened instead. */
  const add = (artistId, listingId, { qty = 1, price } = {}) => {
    if (!free()) return 'busy';
    dispatch({ type: 'ADD', artistId, listingId, qty, price });
    return clash(artistId) ? 'conflict' : 'added';
  };

  /** D07: every listing goes in with one switch. listings: [{ id, price, title }]; works: how many saved works were considered. */
  const addMany = (artistId, artistName, listings, { works } = {}) => {
    if (!free() || !uid || !listings.length) return;
    const selection = {
      kind: 'many', artistId, artistName, add: listings.map((l) => l.id), works,
      prices: Object.fromEntries(listings.map((l) => [l.id, l.price])),
      labels: Object.fromEntries(listings.map((l) => [l.id, l.title])),
    };
    if (clash(artistId)) dispatch({ type: 'CONFLICT', selection });
    else begin(selection);
  };

  /** Add (or switch to) this one listing, then go to checkout; with a clash the dialog asks first. */
  const buyNow = (artistId, artistName, listing) => {
    if (!free()) return;
    if (clash(artistId)) {
      dispatch({ type: 'CONFLICT', selection: { artistId, artistName, listingId: listing.id, price: listing.price, then: 'checkout' } });
      return;
    }
    dispatch({ type: 'ADD', artistId, listingId: listing.id, price: listing.price, once: true });
    navigate('/checkout');
  };

  const value = {
    cart,
    count: cart.items.reduce((n, i) => n + i.qty, 0),
    add, addMany, buyNow,
    remove: (listingId) => mutate({ type: 'REMOVE', listingId }),
    removeMany: (listingIds) => mutate({ type: 'REMOVE_MANY', listingIds }),
    setQty: (listingId, qty) => mutate({ type: 'SET_QTY', listingId, qty }),
    acceptPrices: (prices) => mutate({ type: 'ACCEPT_PRICES', prices }),
    setNote: (note) => dispatch({ type: 'NOTE', note }),
    clear: () => { dispatch({ type: 'CLEAR' }); write(pendingKey, null); },
    startNewCart: () => begin(cart.conflict),
    dismissConflict: () => mutate({ type: 'DISMISS' }),
    pendingOrder: () => (uid ? read(pendingKey) : null),
    setPendingOrder: (orderId) => uid && write(pendingKey, orderId),
    saved, savedLoading, savedError, reloadSaved, pending, message, status, restore,
    locked: !!operation,
    retry: operation && !pending ? () => run(operation) : null,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
