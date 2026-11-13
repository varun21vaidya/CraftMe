import { useCart } from '../../contexts/CartContext';
import { Dialog } from '../ui/Dialog';

/** Shown when the Buyer adds work from a second Artist: one Order is one parcel from one Artist. */
export function CartConflictDialog() {
  const { cart, startNewCart, dismissConflict, pending, locked, retry, message } = useCart();
  return (
    <Dialog open={Boolean(cart.conflict)} alert busy={pending} title="Start a new Cart?" onClose={locked ? undefined : dismissConflict}
      footer={(
        <>
          <button className="btn btn-secondary" disabled={locked || pending} onClick={dismissConflict}>Keep my cart</button>
          <button className="btn btn-primary" disabled={pending} onClick={retry || startNewCart}>
            {pending ? 'Switching…' : retry ? 'Try again' : 'Switch cart'}
          </button>
        </>
      )}>
      <p>Your cart has work from another artist. If you switch, everything in this cart will move to Saved for later.</p>
      {message && <p role="alert">{message}</p>}
    </Dialog>
  );
}
