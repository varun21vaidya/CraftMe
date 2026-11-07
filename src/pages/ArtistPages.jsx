import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { call, useArtistInbox } from '../api/gateway';
import { useAuth } from '../contexts/AuthContext';
import { ArtworkUploadForm } from '../components/dashboard/ArtworkUploadForm';
import { errorText, formatDate, formatINR, STAGE_LABEL } from '../lib/format';

export function NewArtwork() {
  const navigate = useNavigate();
  return (
    <main className="wrap page" style={{ maxWidth: 640 }}>
      <div className="page-head"><div><h1>Add an artwork</h1></div></div>
      <div className="panel"><ArtworkUploadForm onSaved={() => navigate('/dashboard/orders')} /></div>
    </main>
  );
}

function ShipForm({ orderId }) {
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTracking] = useState('');
  const [msg, setMsg] = useState(null);
  const send = async (e) => {
    e.preventDefault();
    const res = await call('markShipped', { orderId, courier, trackingNumber });
    setMsg(res.ok ? null : errorText(res.error));
  };
  return (
    <form className="row" onSubmit={send}>
      <input className="input" placeholder="Courier" required value={courier} onChange={(e) => setCourier(e.target.value)} />
      <input className="input" placeholder="Tracking number (optional)" value={trackingNumber} onChange={(e) => setTracking(e.target.value)} />
      <button className="btn btn-primary btn-sm">Mark shipped</button>
      {msg && <span className="error-msg" role="alert">{msg}</span>}
    </form>
  );
}

export function ArtistInbox() {
  const { currentUser } = useAuth();
  const [orders, loading] = useArtistInbox(currentUser.uid);
  return (
    <main className="wrap page">
      <div className="page-head"><div><h1>Orders to ship</h1></div></div>
      {loading && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />}
      {!loading && !orders?.length && <div className="empty"><h3>No orders yet</h3></div>}
      <div className="stack">
        {orders?.map((o) => (
          <div key={o.id} className="panel stack">
            <div className="row between">
              <strong>Order {o.code} · {formatDate(o.createdAt)}</strong>
              <span className="badge">{STAGE_LABEL[o.stage] || o.stage}</span>
            </div>
            <span className="small muted">{o.lines.map((l) => `${l.title} × ${l.quantity}`).join(', ')} · {formatINR(o.total)}</span>
            {o.artistActions?.canShip && <ShipForm orderId={o.id} />}
          </div>
        ))}
      </div>
    </main>
  );
}
