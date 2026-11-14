import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { call, signOutUser } from '../../api/gateway';
import { errorText } from '../../lib/format';
import { Dialog } from '../ui/Dialog';
import { Field } from '../ui/Field';
import { useToast } from '../ui/Toast';

/** S16.dlg.del: the one place an Account deletion is requested (the profile page and the legal page both open it). */
export function DeleteAccountDialog({ open, onClose }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  const close = () => { setText(''); setError(null); onClose(); };
  const confirm = async () => {
    setBusy(true);
    setError(null);
    const res = await call('requestDeletion', { scope: 'everything', confirm: 'DELETE' });
    if (!res.ok) {
      setBusy(false);
      setError(errorText(res.error)); // nothing is signed out
      return;
    }
    // leave the page first, so the guard does not remember it as somewhere to come back to
    navigate('/', { replace: true });
    toast('Deletion requested');
    await signOutUser();
  };

  return (
    <Dialog open={open} onClose={close} alert busy={busy} title="Delete your Account?"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={close}>Cancel</button>
          <button type="button" className="btn btn-danger" disabled={busy || text !== 'DELETE'} onClick={confirm}>{busy ? 'Deleting…' : 'Delete Account'}</button>
        </>
      )}>
      <div className="stack">
        <p>This can&apos;t be undone. You&apos;ll be logged out and your data deleted within 30 days.</p>
        <Field id="delete-confirm" label="Type DELETE to confirm">
          <input className="input" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
        {error && <p className="error-msg" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}
