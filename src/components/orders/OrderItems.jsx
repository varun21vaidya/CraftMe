import { Link } from 'react-router-dom';
import { formatINR, KIND_LABEL } from '../../lib/format';
import LazyLoadImage from '../ui/LazyLoadImage';

/** The lines of an Order with their prices; a refunded line says how much of it came back. */
export function OrderItems({ order, totalLabel = 'Total paid', compact = false }) {
  return (
    <>
      {order.lines.map((l) => {
        const refunded = l.refundedQuantity || 0;
        return (
          <div key={l.id || l.listingId} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
            <div className="mat" style={{ width: compact ? 64 : 72, padding: compact ? 5 : 6, flex: 'none' }}>
              {l.artwork?.photos?.[0] && <LazyLoadImage src={l.artwork.photos[0]} alt="" width="100%" />}
            </div>
            <div className="grow">
              {l.artworkId ? <Link to={`/artwork/${l.artworkId}`}><strong>{l.title}</strong></Link> : <strong>{l.title}</strong>}<br />
              <span className="small muted">{KIND_LABEL[l.kind] || l.kind} · × {l.quantity}{compact ? '' : ` · ${formatINR(l.unitPaise)} each`}</span>
              {refunded > 0 && <><br /><span className="badge err">Refunded {formatINR(l.unitPaise * refunded)} · {refunded} of {l.quantity}</span></>}
            </div>
            <span className="num">{refunded === l.quantity ? <span className="strike">{formatINR(l.unitPaise * l.quantity)}</span> : formatINR(l.unitPaise * l.quantity)}</span>
          </div>
        );
      })}
      <hr />
      <div className="sum-row total"><span>{totalLabel}</span><span className="num">{formatINR(order.total)}</span></div>
      {order.refundedTotal > 0 && <div className="sum-row"><span>Refunded</span><span className="num err-t">−{formatINR(order.refundedTotal)}</span></div>}
    </>
  );
}

/** The ship-to lines, one per row. */
export function ShipTo({ s }) {
  if (!s) return null;
  return (
    <p className="small">
      {s.name}<br />{s.address}<br />
      {s.address2 && <>{s.address2}<br /></>}
      {s.landmark && <>{s.landmark}<br /></>}
      {s.city} {s.pin}, {s.state}<br />
      <span className="mono">+91 {s.phone}</span>
    </p>
  );
}
