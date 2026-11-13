import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { call, upload, useOrder } from '../api/gateway';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { ConfirmingPayment } from '../components/checkout/ConfirmingPayment';
import { Icon } from '../components/common/Icon';
import { ConfirmReceivedDialog } from '../components/orders/ConfirmReceivedDialog';
import { OrderItems, ShipTo } from '../components/orders/OrderItems';
import { OrderPlaced } from '../components/orders/OrderPlaced';
import { OrderReceipt } from '../components/orders/OrderReceipt';
import { StageTracker } from '../components/orders/StageTracker';
import { ReviewForm } from '../components/reviews/ReviewForm';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { CopyButton } from '../components/ui/CopyButton';
import { Timeline } from '../components/ui/Timeline';
import { isBadId } from '../lib/artist';
import { errorText, formatClock, formatDate, formatDay, formatINR, methodLabel, REFUND_STATUS_LABEL, STAGE_BADGE } from '../lib/format';
import { orderTimeline } from '../lib/orderTimeline';
import { useCountdown } from '../lib/useCountdown';

const first = (name) => String(name || 'the Artist').trim().split(/\s+/)[0];
const PAID_OR_LATER = ['paid', 'shipped', 'received', 'refunded'];

// The inline damage form stays until P02 ships the Damage Report page at /orders/:id/damage.
function DamageForm({ order }) {
  const { currentUser } = useAuth();
  const [note, setNote] = useState('');
  const [files, setFiles] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ups = await Promise.all(files.map((f) => upload('damage', f, currentUser.uid)));
    const bad = ups.find((u) => !u.ok);
    const res = bad ? bad : await call('reportDamage', {
      orderId: order.id, lineIds: order.lines.map((l) => l.listingId), note, photoPaths: ups.map((u) => u.path),
    });
    setBusy(false);
    setMsg(res.ok ? 'Thanks. We’ll look at your photos and get back to you.' : errorText(res.error));
  };

  return (
    <form className="panel stack" onSubmit={send}>
      <h3>Something wrong with your order?</h3>
      <div className="field"><label htmlFor="note">What happened?</label>
        <textarea id="note" className="input" rows={3} required maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></div>
      <div className="field"><label htmlFor="dphotos">Photos <span className="opt">up to 5</span></label>
        <input id="dphotos" type="file" multiple accept="image/jpeg,image/png" onChange={(e) => setFiles([...e.target.files].slice(0, 5))} /></div>
      {msg && <p role="status">{msg}</p>}
      <button className="btn btn-secondary" disabled={busy || !note.trim()}>Send</button>
    </form>
  );
}

/** The one sentence that says where the Order stands. */
function StageMessage({ order, onFinishPaying }) {
  const artist = order.artist?.displayName || 'The Artist';
  const holdLeft = useCountdown(order.stage === 'hold' ? order.holdUntil : 0);
  const refund = (order.refunds || []).at(-1);
  if (order.stage === 'hold') {
    return holdLeft > 0 ? (
      <div className="alert info" role="status"><Icon name="clock" /><div><strong>Waiting for your payment.</strong> We’re keeping your pieces for {formatClock(holdLeft)}.<br />
        <button type="button" className="btn btn-primary btn-sm" onClick={onFinishPaying}>Finish paying</button></div></div>
    ) : (
      <div className="alert err" role="status"><Icon name="clock" /><div><strong>The time to pay ran out.</strong> Your pieces went back on the wall.<br />
        <Link className="btn btn-secondary btn-sm" to="/cart">Return to Cart</Link></div></div>
    );
  }
  if (order.stage === 'hold_expired') {
    return <div className="alert err"><Icon name="clock" /><div><strong>The time to pay ran out.</strong> Your pieces went back on the wall.<br /><Link className="btn btn-secondary btn-sm" to="/cart">Return to Cart</Link></div></div>;
  }
  if (refund?.reason === 'sold_during_payment') {
    return <div className="alert err"><Icon name="undo" /><div><strong>It sold while you were paying.</strong> Your money is being returned{refund.status === 'issued' ? `: ${formatINR(refund.amount)} was refunded on ${formatDate(refund.createdAt)}` : ''}.</div></div>;
  }
  if (refund && (order.stage === 'refunded' || order.refundedTotal > 0 || refund.status !== 'issued')) {
    return refund.status === 'issued'
      ? <div className="alert err"><Icon name="undo" /><div><strong>Your {formatINR(refund.amount)} refund was issued on {formatDate(refund.createdAt)}.</strong> It goes back to your original payment method.</div></div>
      : <div className="alert warn"><Icon name="undo" /><div><strong>Your {formatINR(refund.amount)} refund is being processed.</strong> We’ll update this page.</div></div>;
  }
  if (order.stage === 'paid') {
    return order.overdue
      ? <div className="alert warn"><Icon name="clock" /><div><strong>This Order is late.</strong> CraftMe is reviewing it. Late Orders are usually refunded in full.</div></div>
      : <div className="alert info"><Icon name="clock" /><div><strong>{artist} is preparing your Order.</strong> They have until {formatDay(order.shipBy)} to ship it. If they don’t, CraftMe reviews the Order and usually refunds you in full.</div></div>;
  }
  if (order.stage === 'shipped') {
    return <div className="alert info"><Icon name="truck" /><div><strong>On its way, shipped {formatDay(order.shippedAt)}.</strong> Tap “I’ve received it” when it arrives. If you don’t, we’ll mark it Received on {formatDay(order.autoReceiveAt)}.</div></div>;
  }
  if (order.stage === 'received') {
    return (
      <div className="alert ok"><Icon name="check" /><div><strong>It arrived. Enjoy it.</strong>
        {order.buyerActions.canReportDamage && <> Something not right? Tell us by {formatDay(order.damageWindowEnds)}.</>}</div></div>
    );
  }
  return null;
}

export default function OrderPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setPendingOrder } = useCart();
  const [order, loading, error, reload] = useOrder(id);
  const [receiving, setReceiving] = useState(false);
  const view = pathname.endsWith('/receipt') ? 'receipt' : pathname.endsWith('/damage') ? 'damage' : pathname.endsWith('/review') ? 'review' : 'order';

  if (loading) return <main className="wrap page"><div className="skeleton" style={{ height: 200 }} aria-busy="true" /></main>;
  if (error && !order && !isBadId(error)) {
    return <main className="wrap page"><div className="empty" role="alert"><h3>We couldn’t load this Order</h3><button className="btn btn-primary" onClick={reload}>Try again</button></div></main>;
  }
  // a missing id and someone else's Order look the same, so nothing is revealed
  if (!order) return <main className="wrap page"><div className="empty"><h3>We couldn’t find this order</h3><Link className="btn btn-primary" to="/orders">My orders</Link></div></main>;

  if (view === 'receipt') return <OrderReceipt order={order} />;
  if (params.get('placed') === '1') {
    if (order.stage === 'hold') return <main className="wrap mid page"><ConfirmingPayment orderId={order.id} /></main>;
    if (PAID_OR_LATER.includes(order.stage) && order.stage !== 'refunded') return <OrderPlaced order={order} />;
  }

  const can = order.buyerActions;
  const artist = order.artist?.displayName || 'Artist';
  const [badge, tone] = STAGE_BADGE[order.stage] || [order.stage, ''];
  const ship = order.orderShipping;
  const finishPaying = () => { setPendingOrder(order.id); navigate('/checkout'); };

  return (
    <main className="wrap page">
      <Breadcrumbs items={[{ to: '/orders', label: 'My orders' }, { label: order.code }]} />
      <div className="page-head">
        <div><div className="row"><h1 className="mono" style={{ fontSize: 32 }}>{order.code}</h1><span className={`badge ${tone} dot`}>{badge}</span></div>
          <p>Placed {formatDate(order.createdAt)} · From <Link to={`/artist/${order.artistId}`}>{artist}</Link></p></div>
        {PAID_OR_LATER.includes(order.stage) && <Link className="btn btn-secondary" to={`/orders/${order.id}/receipt`}><Icon name="receipt" />Receipt</Link>}
      </div>
      {PAID_OR_LATER.includes(order.stage) && <StageTracker order={order} />}
      <StageMessage order={order} onFinishPaying={finishPaying} />

      <div className="split">
        <div className="stack lg">
          {view === 'damage' && can.canReportDamage && <DamageForm order={order} />}
          {view === 'review' && can.canReview && <div className="panel stack"><h3>How was it?</h3><ReviewForm orderId={order.id} onDone={reload} /></div>}
          <section className="panel stack"><h3>Items</h3><OrderItems order={order} /></section>
          {order.shippedAt && (
            <section className="panel stack"><h3>Shipment</h3>
              <dl className="kv"><dt>Courier</dt><dd>{order.courier}</dd>
                {order.trackingNumber && <><dt>Tracking</dt><dd><span className="mono">{order.trackingNumber}</span> <CopyButton text={order.trackingNumber} label="Copy tracking number" /></dd></>}
                <dt>Shipped</dt><dd>{formatDate(order.shippedAt)}</dd></dl>
            </section>
          )}
          {(order.refunds || []).map((r) => (
            <section key={r.id} className="panel stack"><h3>Refund</h3>
              <dl className="kv"><dt>Reason</dt><dd>{r.reason === 'sold_during_payment' ? 'It sold while you were paying' : r.reason}</dd>
                <dt>Amount</dt><dd>{formatINR(r.amount)}{(r.lines || []).length > 0 && ` for ${r.lines.map((x) => `${order.lines.find((l) => l.id === x.lineId || l.listingId === x.lineId)?.title || 'a work'} ×${x.quantity}`).join(', ')}`}</dd>
                <dt>{r.status === 'issued' ? 'Issued' : 'Status'}</dt><dd>{r.status === 'issued' ? formatDate(r.createdAt) : REFUND_STATUS_LABEL[r.status]}</dd></dl>
            </section>
          ))}
          <section className="panel"><h3 style={{ marginBottom: 16 }}>Timeline</h3><Timeline items={orderTimeline(order)} label="Order timeline" /></section>
        </div>

        <aside className="stack sticky">
          <section className="panel stack" aria-label="Actions">
            <h3>What you can do</h3>
            {can.canConfirmReceived && <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => setReceiving(true)}><Icon name="check" />I&apos;ve received it</button>}
            {can.canReportDamage && view !== 'damage' && <Link className="btn btn-secondary btn-block" to={`/orders/${order.id}/damage`}><Icon name="alert" />Something not right?</Link>}
            {can.canReview && view !== 'review' && <Link className="btn btn-primary btn-block" to={`/orders/${order.id}/review`}><Icon name="star" />Review {first(artist)}</Link>}
            {can.canPay && <button type="button" className="btn btn-primary btn-block" onClick={finishPaying}>Finish paying</button>}
            {order.stage === 'paid' && (
              <>
                <button type="button" className="btn btn-secondary btn-block" disabled aria-describedby="no-cancel"><Icon name="x" />Cancel Order</button>
                <p id="no-cancel" className="xs faint">Orders can’t be cancelled once Paid. If you need a change, contact CraftMe and we’ll ask {first(artist)}.</p>
              </>
            )}
          </section>
          {ship && <section className="panel stack"><h4>Ship to</h4><ShipTo s={ship} /></section>}
          {(order.paymentMethod || order.razorpayPaymentId) && (
            <section className="panel stack"><h4>Payment</h4><dl className="kv">
              {order.paymentMethod && <><dt>Method</dt><dd>{methodLabel(order.paymentMethod)}</dd></>}
              {order.razorpayPaymentId && <><dt>Reference</dt><dd className="mono" style={{ overflowWrap: 'anywhere' }}>{order.razorpayPaymentId}</dd></>}
            </dl></section>
          )}
        </aside>
      </div>
      <ConfirmReceivedDialog order={order} open={receiving} onClose={() => setReceiving(false)} onDone={reload} />
    </main>
  );
}
