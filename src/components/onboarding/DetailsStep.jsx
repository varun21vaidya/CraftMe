import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { call } from '../../api/gateway';
import { Icon } from '../common/Icon';
import { Field } from '../ui/Field';
import { STATES } from '../../lib/address';
import { GROUPS } from '../../lib/categories';
import { errorText } from '../../lib/format';
import { BIO_MAX, cleanIfsc, cleanPan, digits, FIELDS, toPayload, validateDetails } from '../../lib/onboarding';

const LABEL = Object.fromEntries(FIELDS);
const MESSAGE = { account: 'Account numbers have 9 to 18 digits.', ifsc: 'IFSC has 11 characters, like HDFC0001234.', payoutMethod: 'Choose how you want to be paid.' };

/** Step 1: who you are, where to pay you, your shop. `initial` is what is already saved; onSaved runs after the server accepted it. */
export function DetailsStep({ initial, onSaved }) {
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState({});
  const [summary, setSummary] = useState(false);
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const alertRef = useRef(null);
  const set = (patch) => setV((x) => ({ ...x, ...patch }));
  useEffect(() => { if (summary) alertRef.current?.focus(); }, [summary]);

  const submit = async (e) => {
    e.preventDefault();
    const found = validateDetails(v);
    setErrors(found);
    setProblem('');
    setSummary(Object.keys(found).length > 0);
    if (Object.keys(found).length) return;
    setBusy(true);
    const res = await call('submitVerification', toPayload(v));
    setBusy(false);
    if (res.ok) { onSaved(); return; }
    const fields = (res.error?.fields || []).filter((f) => f in LABEL || f === 'payoutMethod');
    if (fields.length) {
      setErrors(Object.fromEntries(fields.map((f) => [f, MESSAGE[f] || 'Check this field.'])));
      setSummary(true);
    } else setProblem(errorText(res.error));
  };

  const order = FIELDS.map(([k]) => k).filter((k) => errors[k]);
  const toggle = (g) => set({ specialties: v.specialties.includes(g) ? v.specialties.filter((x) => x !== g) : [...v.specialties, g] });

  return (
    <div className="split">
      <form className="stack lg" onSubmit={submit} noValidate aria-label="Artist details">
        {summary && order.length > 0 && (
          <div className="alert err" role="alert" tabIndex={-1} ref={alertRef}>
            <Icon name="alert" />
            <div>
              <strong>Please check these fields.</strong>
              <ul className="list small">{order.map((k) => <li key={k}><a href={`#ob-${k}`} onClick={(e) => { e.preventDefault(); document.getElementById(`ob-${k}`)?.focus(); }}>{LABEL[k] || k}: {errors[k]}</a></li>)}</ul>
            </div>
          </div>
        )}
        {problem && <div className="alert err" role="alert"><Icon name="alert" /><div>{problem}</div></div>}

        <section className="panel stack" aria-labelledby="ob-who">
          <h3 id="ob-who">Who you are</h3>
          <div className="alert info"><Icon name="shield" /><div><strong>Private to you.</strong>Buyers never see this. We use it to pay you.</div></div>
          <div className="form-grid">
            <Field id="ob-legalName" label="Legal name" required hint="Exactly as on your PAN card." error={errors.legalName}>
              <input className="input" value={v.legalName} autoComplete="name" onChange={(e) => set({ legalName: e.target.value })} />
            </Field>
            <Field id="ob-pan" label="PAN" required hint="10 characters, like ABCDE1234F." error={errors.pan}>
              <input className="input mono" value={v.pan} maxLength={10} autoComplete="off" onChange={(e) => set({ pan: cleanPan(e.target.value) })} />
            </Field>
            <Field id="ob-city" label="City" required error={errors.city}>
              <input className="input" value={v.city} autoComplete="address-level2" onChange={(e) => set({ city: e.target.value })} />
            </Field>
            <Field id="ob-state" label="State" required error={errors.state}>
              <select className="select" value={v.state} onChange={(e) => set({ state: e.target.value })}>
                <option value="">Choose…</option>
                {STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="panel stack" aria-labelledby="ob-pay">
          <h3 id="ob-pay">Where should we pay you?</h3>
          <p className="small muted">You’re paid twice a month, on the 1st and 15th.</p>
          <div className="grid g2" role="radiogroup" aria-label="Payout method">
            <label className="option-card"><input type="radio" name="method" checked={v.method === 'upi'} onChange={() => set({ method: 'upi' })} /><span><strong>UPI ID</strong><br /><span className="small muted">Fastest. Instant transfer.</span></span></label>
            <label className="option-card"><input type="radio" name="method" checked={v.method === 'bank'} onChange={() => set({ method: 'bank' })} /><span><strong>Bank account</strong><br /><span className="small muted">Paid to your account.</span></span></label>
          </div>
          {v.method === 'upi' ? (
            <Field id="ob-upi" label="UPI ID" required error={errors.upi}>
              <input className="input mono" value={v.upi} autoComplete="off" onChange={(e) => set({ upi: e.target.value })} />
            </Field>
          ) : (
            <div className="form-grid">
              <Field id="ob-holder" label="Account holder name" required error={errors.holder}>
                <input className="input" value={v.holder} autoComplete="off" onChange={(e) => set({ holder: e.target.value })} />
              </Field>
              <Field id="ob-ifsc" label="IFSC" required error={errors.ifsc}>
                <input className="input mono" value={v.ifsc} maxLength={11} autoComplete="off" onChange={(e) => set({ ifsc: cleanIfsc(e.target.value) })} />
              </Field>
              <Field id="ob-account" label="Account number" required error={errors.account}>
                <input className="input mono" value={v.account} inputMode="numeric" autoComplete="off" onChange={(e) => set({ account: digits(e.target.value) })} />
              </Field>
              <Field id="ob-confirmAccount" label="Confirm account number" required error={errors.confirmAccount}>
                <input className="input mono" value={v.confirmAccount} inputMode="numeric" autoComplete="off" onChange={(e) => set({ confirmAccount: digits(e.target.value) })} />
              </Field>
            </div>
          )}
        </section>

        <section className="panel stack" aria-labelledby="ob-shop">
          <h3 id="ob-shop">Your shop</h3>
          <Field id="ob-bio" label="Short bio" required error={errors.bio} counter={{ value: v.bio, max: BIO_MAX }}>
            <textarea className="textarea" value={v.bio} maxLength={BIO_MAX} onChange={(e) => set({ bio: e.target.value })} />
          </Field>
          <div className="field">
            <span className="label" id="ob-specialties-l">What do you make? <span className="req" aria-hidden="true">*</span></span>
            <div className="chips" role="group" aria-labelledby="ob-specialties-l" id="ob-specialties" tabIndex={-1}>
              {Object.keys(GROUPS).map((g) => <button key={g} type="button" className="chip" aria-pressed={v.specialties.includes(g)} onClick={() => toggle(g)}>{g}</button>)}
            </div>
            {errors.specialties && <span className="error-msg"><Icon name="alert" size={14} />{errors.specialties}</span>}
          </div>
          <div className="stack sm">
            <label className="check"><input id="ob-ownWork" type="checkbox" checked={v.ownWork} onChange={(e) => set({ ownWork: e.target.checked })} /><span>Everything I sell is my own work.</span></label>
            {errors.ownWork && <span className="error-msg"><Icon name="alert" size={14} />{errors.ownWork}</span>}
            <label className="check"><input id="ob-agreement" type="checkbox" checked={v.agreement} onChange={(e) => set({ agreement: e.target.checked })} /><span>I am 18 or older and I accept the <Link to="/legal/artist" target="_blank">Artist agreement</Link>.</span></label>
            {errors.agreement && <span className="error-msg"><Icon name="alert" size={14} />{errors.agreement}</span>}
          </div>
        </section>

        <div className="row end">
          <Link className="btn btn-ghost" to="/profile">Cancel</Link>
          <button className="btn btn-primary btn-lg" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Continue to phone check'}</button>
        </div>
      </form>

      <aside className="stack sticky">
        <section className="panel stack">
          <h4>How selling works</h4>
          <ul className="list small">
            <li><Icon name="package" size={18} /><span>You list Artworks and Listings (an Original, Prints, or both).</span></li>
            <li><Icon name="receipt" size={18} /><span>Buyers pay CraftMe. You ship within 7 days.</span></li>
            <li><Icon name="clock" size={18} /><span>You’re paid on the 1st and 15th.</span></li>
            <li><Icon name="info" size={18} /><span>You only pay when you sell.</span></li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
