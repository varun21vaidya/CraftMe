import { useEffect, useRef, useState } from 'react';
import { call, useOnboarding, useOnboardingFee } from '../../api/gateway';
import { payWithRazorpay } from '../../api/checkout';
import { useAuth } from '../../contexts/AuthContext';
import { Icon } from '../common/Icon';
import { Timeline } from '../ui/Timeline';
import { errorText, formatINR } from '../../lib/format';

const RETRY_MS = [2000, 4000, 8000, 8000];

/** After the window returned a proof: ask the server to record it (same requestId on every retry) while also watching the row, since the webhook may win. */
function ConfirmingFee({ proof, onPaid, onTwice }) {
  const { currentUser } = useAuth();
  const [row] = useOnboarding(currentUser.uid, 4000);
  const requestId = useRef(crypto.randomUUID());
  const [note, setNote] = useState('');
  const done = useRef(false);
  const finish = (twice) => { if (twice) onTwice(); if (!done.current) { done.current = true; onPaid(); } };

  useEffect(() => { if (row?.feePaidAt) finish(false); }); // eslint-disable-line react-hooks/exhaustive-deps -- finish only acts once
  useEffect(() => {
    let live = true;
    const timers = [];
    const attempt = async (n) => {
      const res = await call('confirmFeePayment', { ...proof, requestId: requestId.current });
      if (!live) return;
      if (res.ok) { finish(res.data?.duplicate === true); return; }
      if (['bad_signature', 'amount_mismatch'].includes(res.error?.reason) || res.error?.code === 'forbidden') {
        setNote('We couldn’t confirm that payment. If money left your account, it will be returned.');
        return;
      }
      if (n < RETRY_MS.length) timers.push(setTimeout(() => attempt(n + 1), RETRY_MS[n])); // unavailable, internal, in_progress: the row poll still decides
    };
    attempt(0);
    return () => { live = false; timers.forEach(clearTimeout); };
  }, [proof]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="panel stack" role="status" aria-live="polite">
      <h3>Confirming your payment…</h3>
      <p className="muted">This usually takes a few seconds. Please keep this page open.</p>
      {note && <div className="alert warn"><Icon name="info" /><div>{note}</div></div>}
    </div>
  );
}

/** Step 3: the joining fee. The amount comes from onboarding_fee(); the server fixes it again when the order is made. */
export function FeeStep({ onPaid, onTwice }) {
  const { currentUser } = useAuth();
  const [fee, feeLoading, feeError, reloadFee] = useOnboardingFee();
  const [agree, setAgree] = useState(false);
  const [agreeError, setAgreeError] = useState('');
  const [phase, setPhase] = useState('idle'); // idle | starting | paying | confirming
  const [problem, setProblem] = useState('');
  const [note, setNote] = useState('');
  const [proof, setProof] = useState(null);
  const [changed, setChanged] = useState(null); // the fee changed between the page and the click: ask again

  const open = async (d) => {
    setPhase('paying'); setNote(''); setChanged(null);
    const res = await payWithRazorpay({
      keyId: d.keyId, razorpayOrderId: d.razorpayOrderId, amount: d.amount, description: 'CraftMe joining fee',
      prefill: { name: currentUser.displayName || '', email: currentUser.email || '' },
    });
    if (res.ok) { setProof({ razorpayOrderId: res.razorpayOrderId, razorpayPaymentId: res.razorpayPaymentId, signature: res.signature }); setPhase('confirming'); return; }
    setPhase('idle');
    if (res.failed) setNote('That payment didn’t go through. You can try again.');
    else if (!res.dismissed) setNote('We couldn’t open the payment window. Check your connection and try again.');
  };

  const pay = async () => {
    if (!agree) { setAgreeError('Tick the box to continue.'); return; }
    setAgreeError(''); setProblem(''); setPhase('starting');
    const res = await call('payOnboardingFee');
    if (!res.ok) {
      setPhase('idle');
      if (res.error?.reason === 'already_paid') { onPaid(); return; }
      setProblem(errorText(res.error));
      return;
    }
    if (res.data.amount !== fee) { setPhase('idle'); setChanged(res.data); return; }
    await open(res.data);
  };

  if (phase === 'confirming') return <ConfirmingFee proof={proof} onPaid={onPaid} onTwice={onTwice} />;
  if (feeLoading) return <div className="panel" aria-busy="true"><p className="muted">Loading…</p></div>;
  if (feeError) return <div className="alert err" role="alert"><Icon name="alert" /><div>We couldn’t load the fee.<br /><button className="btn btn-secondary btn-sm" onClick={reloadFee}>Try again</button></div></div>;

  const notSet = !fee || problem === errorText({ reason: 'fee_not_set' });
  const unconfigured = problem === errorText({ reason: 'payments_not_configured' });
  return (
    <div className="split">
      <section className="panel stack">
        <h3>Open your shop</h3>
        {notSet ? (
          <div className="alert info" role="status"><Icon name="info" /><div>The fee to open a shop isn’t set yet. Please check back soon.</div></div>
        ) : (
          <>
            <p className="muted">One small payment, once, to open your shop.</p>
            <div className="callout row between"><div><span className="eyebrow">To open your shop</span><div className="price" style={{ fontSize: 36 }}>{formatINR(fee)}</div></div></div>
            <ul className="list small">
              <li><Icon name="check" size={18} />Your public Artist profile and Instagram Showcase</li>
              <li><Icon name="check" size={18} />Unlimited Artworks and Listings</li>
              <li><Icon name="check" size={18} />Order inbox, Payouts twice a month, Reviews</li>
            </ul>
            <div className="alert info"><Icon name="info" /><div><strong>You only pay when you sell</strong>A small share of each sale. Nothing monthly.</div></div>
            {problem && !unconfigured && <div className="alert err" role="alert"><Icon name="alert" /><div>{problem}</div></div>}
            {unconfigured && <div className="alert warn" role="alert"><Icon name="alert" /><div>{problem}</div></div>}
            {note && <div className="alert warn" role="status"><Icon name="info" /><div>{note}</div></div>}
            {changed && (
              <div className="alert warn" role="alert"><Icon name="alert" /><div>The fee is now {formatINR(changed.amount)}.<br />
                <button className="btn btn-primary btn-sm" onClick={() => open(changed)}>Pay {formatINR(changed.amount)}</button></div></div>
            )}
            <div className="stack sm">
              <label className="check"><input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); setAgreeError(''); }} aria-describedby={agreeError ? 'fee-agree-err' : undefined} /><span>I understand this payment isn’t refunded.</span></label>
              {agreeError && <span className="error-msg" id="fee-agree-err"><Icon name="alert" size={14} />{agreeError}</span>}
            </div>
            <button className="btn btn-primary btn-lg" onClick={pay} disabled={phase !== 'idle' || unconfigured}>
              <Icon name="shield" />{phase === 'starting' || phase === 'paying' ? 'Opening payment…' : `Open my shop for ${formatINR(fee)}`}
            </button>
          </>
        )}
      </section>
      <aside className="stack sticky">
        <section className="panel stack">
          <h4>What happens after</h4>
          <Timeline label="What happens after" items={[
            { label: 'You open your shop', state: 'done' },
            { label: 'You become an Artist', state: 'now', detail: 'You can add Artworks and Listings straight away.' },
            { label: 'CraftMe checks your details', state: 'future', detail: 'A quick check so you can be paid.' },
          ]} />
        </section>
      </aside>
    </div>
  );
}
