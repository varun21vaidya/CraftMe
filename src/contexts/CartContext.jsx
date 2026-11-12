import { createContext, useContext, useEffect, useReducer, useRef, useState } from 'react';
import { switchSavedCart, useSavedCart } from '../api/gateway';
import { useAuth } from './AuthContext';
import { cartReducer, emptyCart, parseCart, serializeCart } from './cart';

const KEY = 'cm-cart';
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

export function CartProvider({ children }) {
  const { currentUser } = useAuth();
  return <BuyerCart key={currentUser?.uid || 'guest'} uid={currentUser?.uid}>{children}</BuyerCart>;
}

function BuyerCart({ children, uid }) {
  const key = uid ? `${KEY}:${uid}` : KEY;
  const [cart, dispatch] = useReducer(cartReducer, key, load);
  const journal = `cm-cart-operation:${uid}`;
  const [saved, savedLoading, savedError, reloadSaved] = useSavedCart(uid);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [operation, setOperation] = useState(() => {
    try { return uid ? JSON.parse(localStorage.getItem(journal)) : null; }
    catch { return null; }
  });
  const busy = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    try {
      if (uid || cart.items.length) localStorage.setItem(key, serializeCart(cart));
    } catch { /* the Cart still works for this visit */ }
  }, [cart, key, uid]);

  async function run(next) {
    if (busy.current || !uid) return;
    try { localStorage.setItem(journal, JSON.stringify(next)); }
    catch { setMessage('Enable browser storage to switch carts safely.'); return; }
    busy.current = true;
    setOperation(next);
    setPending(true);
    setMessage('');
    const response = await switchSavedCart(uid, next);
    busy.current = false;
    if (!mounted.current) return;
    setPending(false);
    if (!response.ok) {
      setMessage('Could not switch carts. Try again.');
      return;
    }
    const result = response.result;
    try {
      if (!result.unavailable) localStorage.setItem(key, serializeCart(result));
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
    dispatch({ type: 'APPLY', cart: result });
    if (result.excess) setMessage('The cart quantity limit was reached. Extra units are still saved for later.');
  }

  useEffect(() => {
    mounted.current = true;
    if (operation) run(operation);
    return () => { mounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replay only on provider mount
  }, []);

  function begin(selection) {
    if (operation || busy.current) return;
    run({ id: crypto.randomUUID(), active: cart.items, restore: selection.restore || [],
      listingId: selection.listingId || null, labels: selection.labels });
  }

  function restore(lines) {
    if (!lines.length || operation || busy.current) return;
    const artistId = lines[0].listing.artistId;
    const selection = { artistId, restore: lines.map((line) => line.listingId),
      labels: Object.fromEntries(lines.map((line) => [line.listingId, line.listing.title])) };
    if (cart.items.length && cart.artistId !== artistId) dispatch({ type: 'CONFLICT', selection });
    else begin(selection);
  }

  const mutate = (action) => { if (!operation && !busy.current) dispatch(action); };
  const value = {
    cart,
    count: cart.items.reduce((n, i) => n + i.qty, 0),
    add: (artistId, listingId) => mutate({ type: 'ADD', artistId, listingId }),
    remove: (listingId) => mutate({ type: 'REMOVE', listingId }),
    setQty: (listingId, qty) => mutate({ type: 'SET_QTY', listingId, qty }),
    clear: () => mutate({ type: 'CLEAR' }),
    startNewCart: () => begin(cart.conflict),
    dismissConflict: () => mutate({ type: 'DISMISS' }),
    saved, savedLoading, savedError, reloadSaved, pending, message, restore,
    locked: !!operation,
    retry: operation && !pending ? () => run(operation) : null,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
