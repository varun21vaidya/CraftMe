import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { call, upload, useOrder } from '../api/gateway';
import { useAuth } from '../contexts/AuthContext';
import { ReviewForm } from '../components/reviews/ReviewForm';
import { isBadId } from '../lib/artist';
import { errorText, formatClock, formatDate, formatINR, STAGE_LABEL } from '../lib/format';
import { useCountdown } from '../lib/useCountdown';

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

export default function OrderPage() {
  const { id } = useParams();
  const [order, loading, error, reload] = useOrder(id);
  const [msg, setMsg] = useState(null);
  const holdLeft = useCountdown(order?.stage === 'hold' ? order.holdUntil : 0);

  if (loading) return <main className="wrap page"><div className="skeleton" style={{ height: 200 }} aria-busy="true" /></main>;
  if (error && !order && !isBadId(error)) return <main className="wrap page"><div className="empty" role="alert"><h3>We couldn’t load this page</h3><button className="btn btn-primary" onClick={reload}>Try again</button></div></main>;
  if (!order) return <main className="wrap page"><div className="empty"><h3>We couldn’t find this order</h3><Link className="btn btn-primary" to="/orders">My orders</Link></div></main>;

  const can = order.buyerActions || {}; // the backend decides which buttons exist
  const receive = async () => {
    const res = await call('confirmReceived', { orderId: order.id });
    setMsg(res.ok ? null : errorText(res.error));
  };

  return (
    <main className="wrap page">
      <div className="page-head"><div><h1>Order {order.code}</h1><p>{STAGE_LABEL[order.stage] || order.stage} · placed {formatDate(order.createdAt)}</p></div></div>
      <div className="stack">
        {order.stage === 'hold' && holdLeft > 0 && <p className="alert info">Waiting for your payment. We’re keeping your items for {formatClock(holdLeft)}.</p>}
        <div className="panel stack">
          {order.lines.map((l) => (
            <div className="sum-row" key={l.listingId}><span>{l.title} × {l.quantity}</span><span className="num">{formatINR(l.unitPaise * l.quantity)}</span></div>
          ))}
          <div className="sum-row total"><span>Total</span><span className="num">{formatINR(order.total)}</span></div>
          {order.refundedTotal > 0 && <div className="sum-row"><span>Refunded</span><span className="num">{formatINR(order.refundedTotal)}</span></div>}
          {order.trackingNumber && <p className="small muted">Tracking: {order.courier} {order.trackingNumber}</p>}
        </div>
        {msg && <p className="error-msg" role="alert">{msg}</p>}
        {can.canConfirmReceived && <button className="btn btn-primary" onClick={receive}>I received it</button>}
        {can.canReview && <div className="panel stack"><h3>How was it?</h3><ReviewForm orderId={order.id} /></div>}
        {can.canReportDamage && <DamageForm order={order} />}
      </div>
    </main>
  );
}
