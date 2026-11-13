import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ORDERS_PAGE, useMyOrderCounts, useMyOrders, useOpenHolds } from '../api/gateway';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { Icon } from '../components/common/Icon';
import { ConfirmReceivedDialog } from '../components/orders/ConfirmReceivedDialog';
import LazyLoadImage from '../components/ui/LazyLoadImage';
import { Pagination } from '../components/ui/Pagination';
import { Tabs } from '../components/ui/Tabs';
import { formatDate, formatDay, formatINR, STAGE_BADGE } from '../lib/format';

const TABS = [
  { id: 'all', label: 'All' }, { id: 'paid', label: 'To be shipped', tone: 'warn' }, { id: 'shipped', label: 'Shipped', tone: 'info' },
  { id: 'received', label: 'Received' }, { id: 'refunded', label: 'Refunded' },
];
const first = (name) => String(name || 'the Artist').trim().split(/\s+/)[0];

/** The short line under an order's items: what the buyer is waiting for, by stage. */
function hint(o) {
  if (o.refundedTotal > 0) return <span>{formatINR(o.refundedTotal)} refunded</span>;
  if (o.stage === 'paid') return <span>{first(o.artist?.displayName)} has until {formatDay(o.shipBy)} to ship</span>;
  if (o.stage === 'shipped') return o.trackingNumber ? <span>Tracking <span className="mono">{o.trackingNumber}</span></span> : <span>Shipped {formatDay(o.shippedAt)}</span>;
  if (o.stage === 'received') return o.reviewed ? <span className="ok-t">Reviewed</span> : <span>Received {formatDay(o.receivedAt)}</span>;
  return null;
}

function OrderRow({ o, onReceive }) {
  const [label, tone] = STAGE_BADGE[o.stage] || [o.stage, ''];
  const photo = o.lines.find((l) => l.artwork?.photos?.[0])?.artwork.photos[0];
  return (
    <article className="panel flush">
      <div className="panel-head">
        <div className="row"><strong className="mono">{o.code}</strong><span className={`badge ${tone} dot`}>{label}</span><span className="small muted">Placed {formatDate(o.createdAt)}</span></div>
        <span className="price sm">{o.stage === 'refunded' ? <span className="strike">{formatINR(o.total)}</span> : formatINR(o.total)}</span>
      </div>
      <div className="row" style={{ padding: '16px 20px', gap: 16 }}>
        <div className="mat" style={{ width: 64, padding: 5, flex: 'none' }}>{photo && <LazyLoadImage src={photo} alt="" width="100%" />}</div>
        <div className="grow"><strong>{o.lines.map((l) => `${l.title} ×${l.quantity}`).join(', ')}</strong><br />
          <span className="small muted">From {o.artist?.displayName || 'Artist'} · {hint(o)}</span></div>
        <Link className="btn btn-secondary btn-sm" to={`/orders/${o.id}`}>View Order</Link>
        {o.buyerActions.canConfirmReceived && <button type="button" className="btn btn-primary btn-sm" onClick={() => onReceive(o)}>Mark Received</button>}
        {o.buyerActions.canReview && <Link className="btn btn-primary btn-sm" to={`/orders/${o.id}/review`}>Write a Review</Link>}
      </div>
    </article>
  );
}

export default function OrdersPage() {
  const { currentUser } = useAuth();
  const { setPendingOrder } = useCart();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'all';
  const page = Math.max(1, Number.parseInt(params.get('page'), 10) || 1);
  const [list, loading, error, reload] = useMyOrders(currentUser.uid, { tab, page });
  const [counts, , , reloadCounts] = useMyOrderCounts(currentUser.uid);
  const [holds] = useOpenHolds(currentUser.uid);
  const [receiving, setReceiving] = useState(null);

  const go = (next) => setParams((p) => {
    const q = new URLSearchParams(p);
    Object.entries(next).forEach(([k, v]) => (v ? q.set(k, v) : q.delete(k)));
    return q;
  });
  const finishPaying = (h) => { setPendingOrder(h.id); navigate('/checkout'); };
  const empty = counts && counts.all === 0 && !holds?.length;
  const pages = list ? Math.max(1, Math.ceil(list.count / ORDERS_PAGE)) : 1;

  return (
    <main className="wrap mid page">
      <div className="page-head"><div><h1>My orders</h1><p>Every Order is one parcel from one Artist.</p></div></div>
      {holds?.map((h) => (
        <div key={h.id} className="alert warn" role="status"><Icon name="clock" /><div><strong>Order {h.code} is waiting for payment</strong>
          {formatINR(h.total)}. Your pieces are kept for a few more minutes.<br />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => finishPaying(h)}>Finish paying</button></div></div>
      ))}
      {empty ? (
        <div className="empty"><div className="ic-wrap"><Icon name="package" size={26} /></div><h3>No Orders yet</h3>
          <p>When you buy a piece, it appears here with its tracking and your Review.</p>
          <Link className="btn btn-primary" to="/browse">Browse art</Link></div>
      ) : (
        <div className="stack lg">
          <Tabs label="Order filters" controls="order-list" value={tab} onChange={(id) => go({ tab: id === 'all' ? null : id, page: null })}
            tabs={TABS.map((t) => ({ ...t, count: counts ? counts[t.id] ?? 0 : undefined }))} />
          <div id="order-list" role="tabpanel" aria-labelledby={`tab-${tab}`} className="stack">
            {loading && !list && [0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 120 }} aria-busy="true" />)}
            {error && !list && (
              <div className="alert err" role="alert"><Icon name="alert" /><div>We couldn&apos;t load your Orders.{' '}
                <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Try again</button></div></div>
            )}
            {list && !list.rows.length && <div className="empty"><h3>Nothing in this stage.</h3></div>}
            {list?.rows.map((o) => <OrderRow key={o.id} o={o} onReceive={setReceiving} />)}
          </div>
          <Pagination page={page} pages={pages} onPage={(n) => go({ page: n > 1 ? String(n) : null })} />
        </div>
      )}
      <ConfirmReceivedDialog order={receiving} open={Boolean(receiving)} onClose={() => setReceiving(null)}
        onDone={() => { reload(); reloadCounts(); }} />
    </main>
  );
}
