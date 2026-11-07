import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import { cartReducer, emptyCart, parseCart, serializeCart } from './cart';

const KEY = 'cm-cart';
const CartContext = createContext(null);

const load = () => {
  try {
    return parseCart(localStorage.getItem(KEY));
  } catch {
    return emptyCart; // storage can be blocked (private window)
  }
};

export function CartProvider({ children }) {
  const [cart, dispatch] = useReducer(cartReducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, serializeCart(cart));
    } catch { /* the Cart still works for this visit */ }
  }, [cart]);

  const value = useMemo(() => ({
    cart,
    count: cart.items.reduce((n, i) => n + i.qty, 0),
    add: (artistId, listingId) => dispatch({ type: 'ADD', artistId, listingId }),
    remove: (listingId) => dispatch({ type: 'REMOVE', listingId }),
    setQty: (listingId, qty) => dispatch({ type: 'SET_QTY', listingId, qty }),
    clear: () => dispatch({ type: 'CLEAR' }),
    startNewCart: () => dispatch({ type: 'REPLACE' }),
    dismissConflict: () => dispatch({ type: 'DISMISS' }),
  }), [cart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
