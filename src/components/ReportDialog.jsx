import { useState } from 'react';
import { call } from '../api/gateway';
import { Dialog } from './ui/Dialog';
import { useToast } from './ui/Toast';

const MAX = 500;
const REASONS = {
  artwork: [['copied', 'It looks copied or stolen from another Artist'], ['mismatch', 'It isn’t what the photos show'], ['offensive', 'Offensive or inappropriate'], ['other', 'Something else']],
  artist: [['impersonation', 'Impersonation or stolen work'], ['mismatch', 'Selling something other than what is shown'], ['offensive', 'Offensive content'], ['other', 'Other']],
};
const TITLE = { artwork: 'Report this Artwork', artist: 'Report this Artist' };

function ReportForm({ targetType, targetId, onClose }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!reason) { setError('Choose what’s wrong.'); return; }
    setBusy(true);
    setError('');
    const res = await call('report', { targetType, targetId, reason, details: details.trim() });
    setBusy(false);
    if (res.ok) { toast('Report sent. Thank you.'); onClose(); return; }
    const why = res.error?.reason;
    setError(why === 'already_exists' ? 'You’ve already reported this. We’re looking at it.'
      : why === 'not_found' ? 'This is no longer on CraftMe.'
      : why === 'own_target' ? 'You can’t report your own work.'
      : 'We couldn’t send your report. Try again.');
  };

  return (
    <form className="stack" onSubmit={send} noValidate>
      <p className="muted">Reports go to the CraftMe team. The Artist isn’t told who reported.</p>
      {targetType === 'artwork' ? (
        <fieldset className="stack sm" style={{ border: 0, padding: 0, margin: 0 }} disabled={busy}>
          <legend className="sr">What’s wrong</legend>
          {REASONS.artwork.map(([v, text]) => (
            <label key={v} className="radio"><input type="radio" name="reason" value={v} checked={reason === v} onChange={() => { setReason(v); setError(''); }} /> {text}</label>
          ))}
        </fieldset>
      ) : (
        <div className="field">
          <label htmlFor="rep-reason">What’s wrong</label>
          <select id="rep-reason" className="select" value={reason} disabled={busy} onChange={(e) => { setReason(e.target.value); setError(''); }}>
            <option value="">Choose a reason</option>
            {REASONS.artist.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="rep-details">Details <span className="opt">optional</span></label>
        <textarea id="rep-details" className="textarea" maxLength={MAX} value={details} disabled={busy} aria-describedby="rep-count" onChange={(e) => setDetails(e.target.value)} />
        <span className="counter" id="rep-count">{details.length} / {MAX}</span>
      </div>
      {error && <p className="error-msg" role="alert">{error}</p>}
      <div className="row end">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send report'}</button>
      </div>
    </form>
  );
}

/** Report an Artwork or an Artist (S03.dlg.report, S04.dlg.rep). The caller sends signed-out visitors to log in instead of opening it. */
export default function ReportDialog({ open, onClose, targetType, targetId }) {
  return <Dialog open={open} onClose={onClose} title={TITLE[targetType]}><ReportForm targetType={targetType} targetId={targetId} onClose={onClose} /></Dialog>;
}
