import { useState } from 'react';
import { call, signOutUser } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { TERMS_VERSION } from '../../content/legal/version';
import { Dialog } from '../ui/Dialog';

/** True while the signed-in profile has not accepted the current Terms (never before the profile has loaded). */
export const needsTerms = (profile) => Boolean(profile) && (!profile.termsAcceptedAt || profile.termsVersion !== TERMS_VERSION);

/** S05.i.06 (PD21): drawn by the guards on the first guarded screen. Not dismissible. */
export function TermsGate() {
  const { profile, reloadProfile } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);

  const accept = async () => {
    setBusy(true);
    setError(false);
    const res = await call('acceptTerms', { version: TERMS_VERSION });
    setBusy(false);
    if (!res.ok) { setError(true); return; }
    setSaved(true);
    reloadProfile();
  };

  const open = needsTerms(profile) && !saved;
  return (
    <Dialog open={open} onClose={() => {}} alert busy={busy} title="Before you continue"
      footer={(
        <>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => signOutUser()}>Log out</button>
          <button type="button" className="btn btn-primary" disabled={!agreed || busy} onClick={accept}>{busy ? 'Saving…' : 'Continue'}</button>
        </>
      )}>
      <div className="stack">
        <label className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 4 }} />
          <span>I agree to the <a href="/legal/terms" target="_blank" rel="noreferrer">Terms</a>, <a href="/legal/privacy" target="_blank" rel="noreferrer">Privacy policy</a> and{' '}
            <a href="/legal/refunds" target="_blank" rel="noreferrer">Refund policy</a>.</span>
        </label>
        {error && <p className="error-msg" role="alert">We couldn&apos;t save that. Try again.</p>}
      </div>
    </Dialog>
  );
}
