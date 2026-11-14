import { useState } from 'react';
import { call, useDeletionRequest } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { errorText } from '../../lib/format';
import { useToast } from '../ui/Toast';

// What keeps a deletion waiting, in the person's words.
const REASON = {
  buyer_open_orders: 'you have open Orders',
  artist_open_orders: 'you have Orders to ship',
  open_reports: 'a Damage Report is still open',
  unpaid_payouts: 'a payout is still to be paid',
  amount_owed: 'you owe CraftMe money',
};
export const reasonsInWords = (blockers) => (blockers || []).map((b) => REASON[b]).filter(Boolean).join(', ');

/** S16.i.08: the banner every page shows while the signed-in person's deletion is pending or waiting (PD24). */
export function DeletionStatus() {
  const { currentUser } = useAuth();
  const [request, , , reload] = useDeletionRequest(currentUser?.uid);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  if (!request || !['pending', 'waiting'].includes(request.status)) return null;

  const keep = async () => {
    setBusy(true);
    const res = await call('cancelDeletion');
    setBusy(false);
    if (res.ok) reload(); else toast(errorText(res.error), { kind: 'err' });
  };
  const why = request.status === 'waiting' ? reasonsInWords(request.blockers) : '';
  return (
    <div className="banner warn" role="status">
      <div className="wrap">
        <span>
          <strong>Your Account is set to be deleted.</strong>
          {request.status === 'waiting' && ` We can’t finish yet${why ? `: ${why}` : ''}. We’ll delete it once that is settled.`}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={keep}>Keep my Account</button>
      </div>
    </div>
  );
}
