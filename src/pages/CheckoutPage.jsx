import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { call, useArtist, useListingsByIds, useOrder, useSavedAddress } from '../api/gateway';
import { payWithRazorpay } from '../api/checkout';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { AddressFields } from '../components/checkout/AddressFields';
import { ConfirmingPayment } from '../components/checkout/ConfirmingPayment';
import { HoldTimer } from '../components/checkout/HoldTimer';
import { OrderSummary } from '../components/checkout/OrderSummary';
import { Icon } from '../components/common/Icon';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { Stepper } from '../components/ui/Stepper';
import { ADDRESS_FIELDS, cleanAddress, emptyAddress, LABEL, serverFieldError, validateAddress } from '../lib/address';
import { errorText, formatINR } from '../lib/format';

// form -> placing -> held <-> paying -> confirming; held -> expired; on load a stored hold may give resuming -> held | choice
const STEP = { form: 0, placing: 0, resuming: 0, choice: 0, held: 1, paying: 1, expired: 1, confirming: 1 };

/** The server's hold, with its deadline moved to device time so a wrong device clock does not matter. */
const toHold = (d) => ({ ...d, skew: d.serverNow - Date.now(), deadline: d.holdUntil - d.serverNow + Date.now() });

const sameLines = (cartItems, lines) => cartItems.length === lines.length
  && cartItems.every((i) => lines.some((l) => l.listingId === i.listingId && l.quantity === i.qty));

export default function CheckoutPage() {
  const { currentUser } = useAuth();
  const { cart, locked, pendingOrder, setPendingOrder } = useCart();
  const [listings, listingsLoading] = useListingsByIds(cart.items.map((i) => i.listingId));
  const [artist] = useArtist(cart.artistId);
  const [saved, savedLoading] = useSavedAddress(currentUser.uid);
  const [values, setValues] = useState(emptyAddress);
  const touched = useRef(false);
  const [save, setSave] = useState(true);
  const [consent, setConsent] = useState(true);
  const [errors, setErrors] = useState({});
  const [summary, setSummary] = useState(null); // field names listed in the "Fix N things" alert
  const summaryRef = useRef(null);
  const [phase, setPhase] = useState(() => (pendingOrder() ? 'resuming' : 'form'));
  const [hold, setHold] = useState(null);
  const [resumable, setResumable] = useState(null);
  const [proof, setProof] = useState(null);
  const [problem, setProblem] = useState(null); // { text, link }
  const [notConfigured, setNotConfigured] = useState(false);
  const [windowNote, setWindowNote] = useState('');
  const requestId = useRef(null); // one per attempt; reused when the network left the answer unknown
  // while held, the server's row is the truth: an Admin or the sweep may end the hold early
  const [live] = useOrder(hold && phase !== 'confirming' ? hold.orderId : null);
  const deadline = hold && (live?.holdUntil ? live.holdUntil - hold.skew : hold.deadline);

  // prefill from the saved address once, unless the Buyer already typed
  useEffect(() => {
    if (savedLoading || touched.current) return;
    if (saved) setValues({ ...emptyAddress, ...Object.fromEntries(ADDRESS_FIELDS.map(([k]) => [k, saved[k] ?? ''])) });
    setSave(!saved);
  }, [saved, savedLoading]);

  // back after a reload: is there still a hold, and is it this Cart?
  useEffect(() => {
    const orderId = pendingOrder();
    if (!orderId) return;
    call('resumeHold', { orderId }).then((res) => {
      if (!res.ok) { setPendingOrder(null); setPhase('form'); return; }
      const h = toHold(res.data);
      if (sameLines(cart.items, h.lines)) {
        setHold(h);
        if (h.address) setValues({ ...emptyAddress, ...Object.fromEntries(ADDRESS_FIELDS.map(([k]) => [k, h.address[k] ?? ''])) });
        setPhase('held');
      } else {
        setResumable(h);
        setPhase('choice');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on arrival
  }, []);

  useEffect(() => {
    if (live?.stage === 'hold_expired') { setPendingOrder(null); setPhase((p) => (p === 'held' || p === 'paying' ? 'expired' : p)); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setPendingOrder is rebuilt every render
  }, [live?.stage]);

  if (!cart.items.length && !hold && !resumable && phase !== 'confirming' && phase !== 'resuming') return <Navigate to="/cart" replace />;

  const lines = cart.items.map((i) => ({ ...i, listing: listings[i.listingId] }));
  const cartTotal = lines.reduce((s, l) => s + (l.listing?.price || 0) * l.qty, 0);
  const artistName = artist?.displayName || 'the Artist';
  const readOnly = Boolean(hold) || phase === 'placing';

  const change = (name, value) => {
    touched.current = true;
    setValues((v) => ({ ...v, [name]: value }));
    if (errors[name]) setErrors((e) => ({ ...e, [name]: undefined }));
  };

  const openWindow = async (h) => {
    setPhase('paying');
    setWindowNote('');
    const res = await payWithRazorpay({
      keyId: h.keyId, razorpayOrderId: h.razorpayOrderId, amount: h.amount, description: `Order ${h.code}`,
      prefill: { name: values.name || currentUser.displayName || '', email: currentUser.email || '', contact: `+91${cleanAddress(values).phone}` },
    });
    if (res.ok) { setProof(res); setPhase('confirming'); return; }
    setPhase((p) => (p === 'paying' ? 'held' : p)); // the timer may have run out meanwhile
    if (res.failed) setWindowNote('That payment didn’t go through. You can try again.');
    else if (!res.dismissed) setWindowNote('We couldn’t open the payment window. Check your connection and try again.');
  };

  const place = async (e) => {
    e.preventDefault();
    if (hold) return openWindow(hold);
    const found = validateAddress(values, { consent });
    setErrors(found);
    if (Object.keys(found).length) {
      setSummary(Object.keys(found));
      requestAnimationFrame(() => summaryRef.current?.focus());
      return undefined;
    }
    setSummary(null);
    setProblem(null);
    setPhase('placing');
    requestId.current ||= crypto.randomUUID();
    const res = await call('placeOrder', {
      requestId: requestId.current, artistId: cart.artistId, note: cart.note, saveAddress: save, address: cleanAddress(values),
      lines: cart.items.map((i) => ({ listingId: i.listingId, quantity: i.qty, seenUnitPaise: i.seen ?? listings[i.listingId]?.price })),
    });
    if (!(res.error?.code === 'unavailable' && !res.error.reason)) requestId.current = null; // a definite answer ends this attempt
    if (!res.ok) {
      setPhase('form');
      const { code, reason, fields } = res.error || {};
      if (reason === 'payments_not_configured' || reason === 'fake_mode_in_production') return setNotConfigured(true);
      if (code === 'invalid' && fields?.length) {
        const marked = Object.fromEntries(fields.filter((f) => LABEL[f]).map((f) => [f, serverFieldError(f)]));
        setErrors(marked);
        setSummary(Object.keys(marked));
        requestAnimationFrame(() => summaryRef.current?.focus());
        return undefined;
      }
      const link = reason === 'too_many_holds' ? { to: '/orders', label: 'My orders' }
        : ['sold', 'price_changed', 'mixed_artists', 'artist_restricted'].includes(reason) ? { to: '/cart', label: 'Check your Cart' } : null;
      return setProblem({ text: errorText(res.error), link });
    }
    const h = toHold(res.data);
    setPendingOrder(h.orderId);
    setHold(h);
    return openWindow(h);
  };

  const cancelHold = async (h, then) => {
    await call('cancelHold', { orderId: h.orderId });
    setPendingOrder(null);
    setHold(null);
    setResumable(null);
    setPhase(then);
  };

  const expire = () => {
    setPendingOrder(null);
    setPhase((p) => (p === 'held' || p === 'paying' ? 'expired' : p));
  };

  const payLabel = phase === 'placing' ? 'Holding your pieces…' : phase === 'paying' ? 'Waiting for payment window…'
    : `Pay ${formatINR(hold?.amount ?? cartTotal)}`;
  const payDisabled = locked || notConfigured || ['placing', 'paying', 'expired', 'resuming', 'choice'].includes(phase) || (!hold && listingsLoading);
  const summaryPanel = <OrderSummary artistName={artistName} lines={lines} editable={!hold} />;

  return (
    <main className="wrap page">
      <Breadcrumbs items={[{ to: '/cart', label: 'Cart' }, { label: 'Checkout' }]} />
      <div className="page-head"><div><h1>Checkout</h1><p>Where should {artistName} send it? Shipping is included, India only.</p></div></div>
      <div style={{ maxWidth: 520 }}><Stepper label="Checkout steps" steps={['Address', 'Pay', 'Done']} current={STEP[phase]} /></div>

      {phase === 'expired' && (
        <div className="alert err" role="alert"><Icon name="clock" /><div><strong>These took too long to pay for</strong>
          The pieces went back on the wall. They’re still in your Cart. Check they’re available, then pay.<br />
          <Link className="btn btn-secondary btn-sm" to="/cart">Return to Cart</Link></div></div>
      )}
      {phase === 'choice' && resumable && (
        <div className="alert info" role="alert"><Icon name="info" /><div><strong>You have an Order waiting for payment</strong>
          Order {resumable.code} for {formatINR(resumable.amount)} holds different pieces from your Cart.
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setHold(resumable); setResumable(null); setPhase('held'); }}>Continue paying for that Order</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => cancelHold(resumable, 'form')}>Cancel it and use my Cart</button>
          </div></div></div>
      )}
      {notConfigured && <div className="alert err" role="alert"><Icon name="alert" /><div>Payments aren’t set up on this site yet.</div></div>}
      {problem && (
        <div className="alert err" role="alert"><Icon name="alert" /><div>{problem.text}
          {problem.link && <> <Link to={problem.link.to}>{problem.link.label}</Link></>}</div></div>
      )}
      {summary && (
        <div className="alert err" role="alert" tabIndex={-1} ref={summaryRef}><Icon name="alert" /><div>
          <strong>Fix {summary.length} {summary.length === 1 ? 'thing' : 'things'} before paying</strong>
          <ul className="list small">{summary.map((f) => (
            <li key={f}><a href={`#${f === 'consent' ? 'consent' : `ship-${f}`}`} onClick={(e) => {
              e.preventDefault();
              document.getElementById(f === 'consent' ? 'consent' : `ship-${f}`)?.focus();
            }}>{LABEL[f]}</a>: {errors[f]}</li>
          ))}</ul></div></div>
      )}

      {phase === 'confirming' ? <ConfirmingPayment orderId={hold.orderId} proof={proof} /> : (
        <div className="split">
          <form className="stack lg" noValidate aria-label="Shipping address" onSubmit={place}>
            <section className="panel stack">
              <h3>Shipping address</h3>
              <AddressFields values={values} errors={errors} onChange={change} readOnly={readOnly} />
              {!hold && <label className="check"><input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Save this address to my profile</label>}
              <div className="alert info"><Icon name="info" /><div>CraftMe delivers within India only. Your address is shared with {artistName} only after payment, to post your parcel.</div></div>
            </section>
            <section className="panel stack">
              <h3>Payment</h3>
              <p className="muted">Pay by card, UPI, netbanking or wallet in Razorpay’s secure window.</p>
              <div className="row" aria-label="Payment methods"><span className="badge">Card</span><span className="badge">UPI</span><span className="badge">Netbanking</span><span className="badge">Wallet</span></div>
            </section>
            {!hold && (
              <div className={`field${errors.consent ? ' has-error' : ''}`}>
                <label className="check"><input id="consent" type="checkbox" checked={consent} aria-invalid={errors.consent ? true : undefined}
                  aria-describedby={errors.consent ? 'consent-err' : undefined} onChange={(e) => { setConsent(e.target.checked); setErrors((x) => ({ ...x, consent: undefined })); }} />
                  <span>I agree to the <Link to="/legal/terms">Terms</Link> and <Link to="/legal/refunds">Refund policy</Link>.</span></label>
                {errors.consent && <span className="error-msg" id="consent-err"><Icon name="alert" size={14} />{errors.consent}</span>}
              </div>
            )}
            <div className="checkout-summary-inline">{hold && <HoldTimer deadline={deadline} onExpire={expire} />}{summaryPanel}</div>
            {windowNote && <p className="alert warn" role="status">{windowNote}</p>}
            <button className="btn btn-primary btn-lg" type="submit" disabled={payDisabled}>{payLabel}</button>
            {hold && phase !== 'expired' && (
              <button type="button" className="btn btn-secondary" disabled={phase === 'paying'} onClick={() => cancelHold(hold, 'form')}>Change address or Cart</button>
            )}
          </form>
          <aside className="stack sticky checkout-aside" aria-label="Order summary">
            {hold && <HoldTimer deadline={deadline} onExpire={expire} />}
            {summaryPanel}
          </aside>
        </div>
      )}
    </main>
  );
}
