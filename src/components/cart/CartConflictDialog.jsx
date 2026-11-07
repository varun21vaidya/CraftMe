import { useCart } from '../../contexts/CartContext';

/** Shown when the Buyer adds work from a second Artist: one Order is one parcel from one Artist. */
export function CartConflictDialog() {
  const { cart, startNewCart, dismissConflict } = useCart();
  if (!cart.conflict) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cc-title">
      <div className="modal">
        <div className="modal-head"><h3 id="cc-title">Start a new Cart?</h3></div>
        <div className="modal-body">
          <p>Your Cart has work from another Artist. Each order is one parcel from one Artist, so you can check out first or start a new Cart with this piece.</p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-secondary" onClick={dismissConflict}>Keep my Cart</button>
          <button className="btn btn-primary" onClick={startNewCart}>Start a new Cart</button>
        </div>
      </div>
    </div>
  );
}
