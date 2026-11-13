import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { formatDay, formatINR, methodLabel } from '../../lib/format';
import { RULES } from '../../lib/rules';
import { Icon } from '../common/Icon';
import { CopyButton } from '../ui/CopyButton';
import { Stepper } from '../ui/Stepper';
import { Timeline } from '../ui/Timeline';
import { OrderItems } from './OrderItems';

const first = (name) => String(name || '').trim().split(/\s+/)[0];

/** /orders/:id?placed=1 once the Order is Paid (S11). No sentence about email until the emails switch exists (P11). */
export function OrderPlaced({ order }) {
  const { currentUser } = useAuth();
  const artist = order.artist?.displayName || 'The Artist';
  const name = first(currentUser?.displayName) || first(order.orderShipping?.name);
  const s = order.orderShipping;
  const steps = [
    { label: 'Payment received', at: order.paidAt, note: `${formatINR(order.total)}${order.paymentMethod ? ` via ${methodLabel(order.paymentMethod)}` : ''}`, state: 'done' },
    { label: `${first(artist)} packs and posts your Order`, state: 'now', detail: order.shipBy ? `They have until ${formatDay(order.shipBy)} to ship it.` : '' },
    { label: 'It arrives', state: 'future', detail: `Tap “I’ve received it” on your Order. After ${RULES.autoReceiveDays} days with no action we mark it Received for you.` },
    { label: `Review ${first(artist)}`, state: 'future', detail: `You can review for ${RULES.reviewDays} days after it’s Received.` },
  ];
  return (
    <main className="wrap mid page">
      <div style={{ maxWidth: 520, margin: '0 auto', width: '100%' }}><Stepper label="Checkout steps" steps={['Address', 'Pay', 'Done']} current={3} /></div>
      <section className="stack center" style={{ justifyItems: 'center' }} role="status">
        <div className="avatar xl" style={{ background: 'var(--ok-soft)', color: 'var(--ok)', borderColor: 'transparent' }} aria-hidden="true"><Icon name="check" size={40} /></div>
        <h1>Thank you{name ? `, ${name}` : ''}. Your Order is Paid.</h1>
        <p className="lead">{artist} has been told to pack it. You’ll see a tracking number on your Order when they ship.</p>
        <div className="row" style={{ justifyContent: 'center' }}><span className="badge ok dot">Paid</span><span className="mono">Order {order.code}</span><CopyButton text={order.code} /></div>
      </section>
      <div className="split wide">
        <section className="panel stack">
          <h3>What happens next</h3>
          <Timeline items={steps} label="What happens next" />
        </section>
        <aside className="panel stack" aria-label="Order recap">
          <h3>Your Order</h3>
          <OrderItems order={order} totalLabel="Paid" compact />
          <dl className="kv">
            {s && <><dt>Ship to</dt><dd>{s.name}<br />{[s.address, s.address2, s.landmark, `${s.city} ${s.pin}`].filter(Boolean).join(', ')}</dd></>}
            <dt>From</dt><dd>{artist}</dd>
          </dl>
          <Link className="btn btn-primary btn-block" to={`/orders/${order.id}`}>View Order</Link>
          <Link className="btn btn-secondary btn-block" to="/browse">Keep browsing</Link>
        </aside>
      </div>
    </main>
  );
}
