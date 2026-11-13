import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMyReview, useOrder } from '../api/gateway';
import { Icon } from '../components/common/Icon';
import { ReviewForm } from '../components/reviews/ReviewForm';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { useToast } from '../components/ui/Toast';
import { initials, isBadId } from '../lib/artist';
import { formatDate, formatDay } from '../lib/format';

const DAY = 86400000;
const REVIEW_BADGE = { pending: ['Waiting for approval', 'warn'], approved: ['Published', 'ok'], rejected: ['Not published', 'err'] };

const Shell = ({ order, id, artist, children, lead }) => (
  <main className="wrap narrow page">
    <Breadcrumbs items={[{ to: '/orders', label: 'My orders' }, { to: `/orders/${id}`, label: order?.code || 'Order' }, { label: 'Review' }]} />
    <div className="page-head"><div><h1>{artist ? `Review ${artist}` : 'Review'}</h1>{lead && <p>{lead}</p>}</div></div>
    {children}
  </main>
);

const Stars = ({ value }) => (
  <span className="rate-input" role="img" aria-label={`${value} of 5 stars`}>
    {[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ padding: 2, lineHeight: 0, color: value >= n ? '#d98a00' : 'var(--line-2)' }}><Icon name="star" size={22} /></span>)}
  </span>
);

const closesIn = (ms) => {
  if (new Date(ms).toDateString() === new Date().toDateString()) return 'today';
  const n = Math.ceil((ms - Date.now()) / DAY);
  return `in ${n} day${n === 1 ? '' : 's'}`;
};

export default function ReviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [order, loading, error, reload] = useOrder(id);
  const [review, reviewLoading, , reloadReview] = useMyReview(id);
  const [forced, setForced] = useState(null);
  const [opened, setOpened] = useState(false); // an open form stays open when the poll passes the cut-off; the server answers on Send

  if (loading || (reviewLoading && order)) return <Shell id={id}><div className="skeleton" style={{ height: 320 }} aria-busy="true" /></Shell>;
  if (error && !order && !isBadId(error)) {
    return <Shell id={id}><div className="empty" role="alert"><h3>We couldn’t load this Order</h3><button className="btn btn-primary" onClick={reload}>Try again</button></div></Shell>;
  }
  if (!order || forced === 'notfound') {
    return <Shell id={id}><div className="empty"><h3>We couldn’t find this order</h3><Link className="btn btn-primary" to="/orders">My orders</Link></div></Shell>;
  }

  const artist = order.artist?.displayName || 'the Artist';
  const done = ({ status }) => {
    if (status === 'sent') {
      toast('Thanks. Your Review will appear once CraftMe approves it.');
      navigate('/orders');
      return;
    }
    setForced(status);
    reload();
    reloadReview();
  };
  const back = <Link className="btn btn-secondary btn-sm" to={`/orders/${id}`}>Back to Order</Link>;
  const closed = forced === 'closed' || (!opened && order.stage === 'received' && Date.now() > order.reviewBy);

  if (review) {
    const [badge, tone] = REVIEW_BADGE[review.status] || REVIEW_BADGE.pending;
    return (
      <Shell order={order} id={id} artist={null}>
        <section className="panel stack" aria-labelledby="mine">
          <div className="row between"><h2 id="mine" style={{ fontSize: 20 }}>You reviewed {artist}</h2><span className={`badge ${tone} dot`}>{badge}</span></div>
          <Stars value={review.rating} />
          <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{review.comment}</p>
          <p className="small muted">Sent {formatDate(review.createdAt)}</p>
          {review.status === 'pending' && <p className="small muted">It appears on {artist}’s profile after CraftMe approves it.</p>}
          {review.status === 'rejected' && <p className="small muted">CraftMe didn’t publish this Review, so it isn’t on {artist}’s profile.</p>}
          <div className="row">{back}</div>
        </section>
      </Shell>
    );
  }
  if (forced === 'reviewed') return <Shell order={order} id={id}><div className="skeleton" style={{ height: 200 }} aria-busy="true" /></Shell>;
  if (order.stage === 'refunded') {
    return <Shell order={order} id={id}><div className="alert info" role="status"><Icon name="info" /><div><strong>This Order was refunded in full, so it can’t be reviewed.</strong>{back}</div></div></Shell>;
  }
  if (forced === 'stage' || (!opened && order.stage !== 'received')) {
    return <Shell order={order} id={id}><div className="alert info" role="status"><Icon name="clock" /><div><strong>You can review {artist} once the Order is Received.</strong>{back}</div></div></Shell>;
  }
  if (closed) {
    return (
      <Shell order={order} id={id}>
        <div className="alert err" role="status"><Icon name="clock" /><div><strong>The Review window has closed</strong>
          Reviews can be written for 30 days after an Order is Received. This one closed on {formatDay(order.reviewBy)}.<br />{back}</div></div>
      </Shell>
    );
  }
  return (
    <Shell order={order} id={id} artist={artist} lead="Reviews rate the Artist as a seller: the work as described, the packing, how they kept in touch. One Review per Order.">
      <div className="stack lg">
        <section className="panel row" style={{ gap: 16, flexWrap: 'nowrap' }}><span className="avatar lg" aria-hidden="true">{initials(artist)}</span>
          <div><strong>{artist}</strong><br /><span className="small muted">Order {order.code} · Received {formatDate(order.receivedAt)} · Window closes {closesIn(order.reviewBy)}</span></div></section>
        <ReviewForm order={order} artist={artist} onDone={done} onOpen={() => setOpened(true)} />
      </div>
    </Shell>
  );
}
