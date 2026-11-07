import { Link } from 'react-router-dom';
import { useMyOrders } from '../api/gateway';
import { useAuth } from '../contexts/AuthContext';
import { formatDate, formatINR, STAGE_LABEL } from '../lib/format';

export default function OrdersPage() {
  const { currentUser } = useAuth();
  const [orders, loading] = useMyOrders(currentUser.uid);
  return (
    <main className="wrap page">
      <div className="page-head"><div><h1>My orders</h1></div></div>
      {loading && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />}
      {!loading && !orders?.length && <div className="empty"><h3>No orders yet</h3><Link className="btn btn-primary" to="/browse">Browse art</Link></div>}
      <div className="stack">
        {orders?.map((o) => (
          <Link key={o.id} to={`/orders/${o.id}`} className="panel row between" style={{ color: 'inherit', textDecoration: 'none' }}>
            <span className="stack sm">
              <strong>Order {o.code}</strong>
              <span className="small muted">{o.lines.map((l) => l.title).join(', ')} · {formatDate(o.createdAt)}</span>
            </span>
            <span className="stack sm" style={{ textAlign: 'right' }}>
              <span className="price sm">{formatINR(o.total)}</span>
              <span className="badge">{STAGE_LABEL[o.stage] || o.stage}</span>
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
