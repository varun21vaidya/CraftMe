import { useCart } from '../../contexts/CartContext';

/** Shown when the Buyer adds work from a second Artist: one Order is one parcel from one Artist. */
export function CartConflictDialog() {
  const { cart, startNewCart, dismissConflict, pending, locked, retry, message } = useCart();
  if (!cart.conflict) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cc-title">
      <div className="modal">
        <div className="modal-head"><h3 id="cc-title">Start a new Cart?</h3></div>
        <div className="modal-body">
          <p>Your cart has work from another artist. If you switch, everything in this cart will move to Saved for later.</p>
          {message && <p role="alert">{message}</p>}
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary" disabled={locked} onClick={dismissConflict}>Keep my cart</button>
          <button className="btn btn-primary" disabled={pending} onClick={retry || startNewCart}>
            {pending ? 'Switching…' : retry ? 'Try again' : 'Switch cart'}
          </button>
        </div>
      </div>
    </div>
  );
}
