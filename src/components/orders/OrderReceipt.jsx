import { Link } from 'react-router-dom';
import { formatDate, methodLabel } from '../../lib/format';
import { OrderItems, ShipTo } from './OrderItems';

/** /orders/:id/receipt: a print-styled order summary (PD08). Not a tax invoice. */
export function OrderReceipt({ order }) {
  return (
    <main className="wrap mid page">
      <article className="panel stack receipt" aria-labelledby="receipt-title">
        <div className="row between">
          <div><strong className="logo" style={{ fontSize: 22 }}>CraftMe</strong><h1 id="receipt-title" style={{ fontSize: 24 }}>Order summary</h1></div>
          <div className="no-print row"><button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print</button>
            <Link className="btn btn-ghost" to={`/orders/${order.id}`}>Back to the Order</Link></div>
        </div>
        <dl className="kv">
          <dt>Order</dt><dd className="mono">{order.code}</dd>
          <dt>Placed</dt><dd>{formatDate(order.createdAt)}</dd>
          {order.paidAt && <><dt>Paid</dt><dd>{formatDate(order.paidAt)}</dd></>}
          <dt>From</dt><dd>{order.artist?.displayName || 'Artist'}</dd>
        </dl>
        <OrderItems order={order} />
        <dl className="kv">
          <dt>Shipping</dt><dd>Included</dd>
          {order.paymentMethod && <><dt>Method</dt><dd>{methodLabel(order.paymentMethod)}</dd></>}
          {order.razorpayPaymentId && <><dt>Payment reference</dt><dd className="mono">{order.razorpayPaymentId}</dd></>}
        </dl>
        <section><h4>Ship to</h4><ShipTo s={order.orderShipping} /></section>
        <p className="xs faint">Prices in Indian rupees, shipping within India included.</p>
      </article>
    </main>
  );
}
