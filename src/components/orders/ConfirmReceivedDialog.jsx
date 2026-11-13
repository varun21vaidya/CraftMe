import { useState } from 'react';
import { call } from '../../api/gateway';
import { errorText } from '../../lib/format';
import { Dialog } from '../ui/Dialog';
import { useToast } from '../ui/Toast';

const first = (name) => String(name || 'the Artist').trim().split(/\s+/)[0];

/** "Confirm it arrived?" for a shipped Order. onDone runs after the server answered (also when it was already Received). */
export function ConfirmReceivedDialog({ order, open, onClose, onDone }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const artist = first(order?.artist?.displayName);
  const confirm = async () => {
    setBusy(true);
    setError('');
    const res = await call('confirmReceived', { orderId: order.id });
    setBusy(false);
    // already Received (the sweep, or another tab): the stage is what was asked for
    if (res.ok || res.error?.reason === 'wrong_stage') {
      if (res.ok) toast('Marked as Received');
      onClose();
      onDone?.();
      return;
    }
    setError(errorText(res.error));
  };
  return (
    <Dialog open={open} onClose={onClose} busy={busy} title="Confirm it arrived?"
      footer={(
        <>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Not yet</button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Yes, it arrived'}</button>
        </>
      )}>
      <p className="muted">Only confirm if the parcel is in your hands. You can then review {artist}.</p>
      {error && <p className="error-msg" role="alert">{error}</p>}
    </Dialog>
  );
}
