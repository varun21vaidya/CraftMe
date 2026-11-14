import { useState } from 'react';
import { Link } from 'react-router-dom';
import { call } from '../../api/gateway';
import { DeleteAccountDialog } from '../../components/account/DeleteAccountDialog';
import { Dialog } from '../../components/ui/Dialog';
import { Field } from '../../components/ui/Field';
import { useAuth } from '../../contexts/AuthContext';
import { errorText } from '../../lib/format';

// Explains deletion and holds the request form. The explanation is CraftMe's own wording and still needs its review (XD03).
export const title = 'Delete my data';
export const tab = 'Delete my data';
export const updated = '2026-11-14';
export const draft = true;

function Form() {
  const { currentUser, isArtist } = useAuth();
  const [scope, setScope] = useState('everything');
  const [account, setAccount] = useState(false);
  const [instagram, setInstagram] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  if (!currentUser) return <p><Link className="btn btn-primary" to="/login" state={{ from: '/legal/deletion' }}>Log in to request deletion</Link></p>;

  const request = () => {
    setDone(false);
    setError(null);
    if (scope === 'everything') setAccount(true); else setInstagram(true);
  };
  const deleteInstagram = async () => {
    setBusy(true);
    const res = await call('instagramDeleteMyData');
    setBusy(false);
    setInstagram(false);
    if (res.ok) setDone(true); else setError(errorText(res.error));
  };

  return (
    <div className="stack" style={{ maxWidth: 420 }}>
      <Field id="delete-scope" label="What should we delete?">
        <select className="select" value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="everything">Everything</option>
          {isArtist && <option value="instagram">Only my Instagram data</option>}
        </select>
      </Field>
      <div><button type="button" className="btn btn-danger" onClick={request}>Request deletion</button></div>
      {done && <p className="alert ok" role="status">Your Instagram data was deleted.</p>}
      {error && <p className="error-msg" role="alert">{error}</p>}
      <DeleteAccountDialog open={account} onClose={() => setAccount(false)} />
      <Dialog open={instagram} onClose={() => setInstagram(false)} alert busy={busy} title="Delete your Instagram data?"
        footer={(
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setInstagram(false)}>Cancel</button>
            <button type="button" className="btn btn-danger" disabled={busy} onClick={deleteInstagram}>{busy ? 'Deleting…' : 'Delete Instagram data'}</button>
          </>
        )}>
        <p>This removes your connection to Instagram and every reel imported from it. Links you pasted yourself stay. Your Account is not affected.</p>
      </Dialog>
    </div>
  );
}

export function Body() {
  return (
    <>
      <h2>Deleting your Account</h2>
      <p>You can delete your Account yourself on your <Link to="/profile">profile page</Link>, or request it below. Your name, photo, bio, saved address, notifications and wish lists are removed. Orders, refunds and Reviews stay without your name, because CraftMe&apos;s money records must still add up. If you have Orders or payouts in progress, we finish once they are settled.</p>
      <h2>Deleting your Instagram data</h2>
      <p>Artists can disconnect Instagram on the <Link to="/dashboard/instagram">Instagram page</Link> of their dashboard. Choose &ldquo;Only my Instagram data&rdquo; below to also delete the reels imported from it. If Instagram sent us a deletion request, you can check it on the <Link to="/instagram-deletion">deletion status page</Link> with your confirmation code.</p>
      <h2>Request deletion</h2>
      <Form />
    </>
  );
}
