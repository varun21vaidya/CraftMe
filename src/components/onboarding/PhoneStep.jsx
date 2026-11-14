import { useEffect, useRef, useState } from 'react';
import { confirmPhone, resendPhoneCode, startPhoneCheck, useSavedAddress, verifyPhoneCode } from '../../api/gateway';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../common/Icon';
import { CodeInput } from '../ui/CodeInput';
import { Field } from '../ui/Field';
import { errorText, formatClock } from '../../lib/format';
import { cleanPhone } from '../../lib/address';
import { validPhone } from '../../lib/onboarding';

const RESEND_SECONDS = 60;
const CODE_LIFE_MS = 10 * 60 * 1000;

/** Step 2: Supabase Auth sends a 6-digit code on WhatsApp (the Send SMS Hook); the Edge command confirmPhone copies the verified number. */
export function PhoneStep({ onBack, onVerified }) {
  const { currentUser } = useAuth();
  const [saved] = useSavedAddress(currentUser?.uid);
  const [view, setView] = useState('send'); // 'send' | 'code'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [busy, setBusy] = useState('');
  const [unsaved, setUnsaved] = useState(false); // the code was right but confirmPhone failed
  const [left, setLeft] = useState(0);
  const sentAt = useRef(0);
  const boxes = useRef(null);
  const typed = useRef(false);

  useEffect(() => { if (!typed.current && saved?.phone) setPhone(cleanPhone(saved.phone)); }, [saved?.phone]);
  useEffect(() => {
    if (left <= 0) return undefined;
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  const sent = () => { sentAt.current = Date.now(); setLeft(RESEND_SECONDS); setCode(''); setError(''); setUnsaved(false); setView('code'); };

  const send = async (e) => {
    e?.preventDefault();
    if (!validPhone(phone)) { setFieldError('Enter a 10-digit mobile number.'); return; }
    setFieldError(''); setError(''); setBusy('send');
    const res = await startPhoneCheck(phone);
    setBusy('');
    if (res.ok) sent(); else setError(errorText(res.error));
  };

  const resend = async () => {
    setBusy('resend'); setError('');
    const res = await resendPhoneCode(phone);
    setBusy('');
    if (res.ok) sent(); else setError(errorText(res.error));
  };

  const verify = async (e) => {
    e?.preventDefault();
    if (code.length !== 6) return;
    setBusy('verify'); setError('');
    const res = await verifyPhoneCode(phone, code);
    setBusy('');
    if (res.ok) { onVerified(); return; }
    if (res.verified) { setUnsaved(true); return; }
    // Supabase Auth answers the same way for a wrong and an expired code, so the age of the code decides which words to use.
    setError(res.error?.reason === 'wrong_code' && Date.now() - sentAt.current > CODE_LIFE_MS ? errorText({ reason: 'code_expired' }) : errorText(res.error));
    setCode('');
    requestAnimationFrame(() => boxes.current?.focus());
  };

  const retrySave = async () => {
    setBusy('save');
    const res = await confirmPhone();
    setBusy('');
    if (res.ok) onVerified(); else setError(errorText(res.error));
  };

  if (view === 'send') {
    return (
      <form className="panel stack" style={{ maxWidth: 560, margin: '0 auto', width: '100%' }} onSubmit={send} noValidate>
        <div className="stack sm"><h3>Verify your phone</h3><p className="muted">We’ll send a 6-digit code on WhatsApp. It proves the number is yours.</p></div>
        {error && <div className="alert err" role="alert"><Icon name="alert" /><div>{error}</div></div>}
        <Field id="ob-phone" label="Phone" required error={fieldError}>
          <div className="input-group"><span className="addon">+91</span><input className="input" type="tel" inputMode="numeric" autoComplete="tel-national" value={phone} maxLength={14}
            onChange={(e) => { typed.current = true; setPhone(cleanPhone(e.target.value)); }} /></div>
        </Field>
        <div className="row end">
          <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy === 'send'}>{busy === 'send' ? 'Sending…' : 'Send code on WhatsApp'}</button>
        </div>
      </form>
    );
  }

  return (
    <form className="panel stack" style={{ maxWidth: 560, margin: '0 auto', width: '100%' }} onSubmit={verify} noValidate>
      <div className="stack sm">
        <h3>Verify your phone</h3>
        <p className="muted">We sent a 6-digit code on WhatsApp to <strong className="mono">+91 {phone}</strong>. It works for 10 minutes.</p>
      </div>
      {unsaved ? (
        <div className="alert warn" role="alert"><Icon name="alert" /><div><strong>Your number is verified.</strong>We couldn’t save that yet.<br />
          <button type="button" className="btn btn-secondary btn-sm" onClick={retrySave} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Try again'}</button></div></div>
      ) : (
        <>
          {error && <div className="alert err" role="alert"><Icon name="alert" /><div>{error}</div></div>}
          <CodeInput ref={boxes} value={code} onChange={setCode} invalid={Boolean(error)} disabled={busy === 'verify'} />
          <div className="row between">
            <span className="small muted">
              {left > 0
                ? <>Didn’t get it? Resend in <span className="countdown">{formatClock(left * 1000)}</span></>
                : <button type="button" className="btn-link small" onClick={resend} disabled={busy === 'resend'}>Resend code</button>}
            </span>
            <button type="button" className="btn-link small" onClick={() => { setView('send'); setError(''); }}>Change number</button>
          </div>
        </>
      )}
      <div className="row end">
        <button type="button" className="btn btn-ghost" onClick={onBack}>Back</button>
        {!unsaved && <button className="btn btn-primary btn-lg" type="submit" disabled={code.length !== 6 || busy === 'verify'}>{busy === 'verify' ? 'Checking…' : 'Verify and continue'}</button>}
      </div>
    </form>
  );
}
