import { useArtist } from '../../api/gateway';
import { useCart } from '../../contexts/CartContext';
import { Dialog } from '../ui/Dialog';

/** Shown when the Buyer adds work from a second Artist (D07): one Order is one parcel from one Artist. */
export function CartConflictDialog() {
  const { cart, startNewCart, dismissConflict, pending, locked, retry, message } = useCart();
  const [outgoing] = useArtist(cart.conflict ? cart.artistId : null);
  const selection = cart.conflict;
  const from = outgoing?.displayName || 'another Artist';
  return (
    <Dialog open={Boolean(selection)} alert busy={pending} title="Start a new Cart?" onClose={locked ? undefined : dismissConflict}
      footer={(
        <>
          <button className="btn btn-secondary" disabled={locked || pending} onClick={dismissConflict}>Keep my Cart</button>
          <button className="btn btn-primary" disabled={pending} onClick={retry || startNewCart}>
            {pending ? 'Switching…' : retry ? 'Try again' : 'Switch Cart'}
          </button>
        </>
      )}>
      <p>Your Cart has work from {from}. Each Order is one parcel from one Artist. If you switch, everything in this Cart moves to Saved for later.</p>
      {selection?.kind === 'many' && <p>{selection.add.length} {selection.add.length === 1 ? 'work' : 'works'} by {selection.artistName} will be added.</p>}
      {message && <p className="error-msg" role="alert">{message}</p>}
    </Dialog>
  );
}
