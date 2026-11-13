import { Link } from 'react-router-dom';
import { formatINR, KIND_LABEL as KIND } from '../../lib/format';
import { initials } from '../../lib/artist';
import LazyLoadImage from '../ui/LazyLoadImage';

/** "Your Order" beside the checkout form. lines: [{ listingId, qty, listing }]. */
export function OrderSummary({ artistName, lines, editable = true }) {
  const count = lines.reduce((n, l) => n + l.qty, 0);
  const total = lines.reduce((s, l) => s + (l.listing?.price || 0) * l.qty, 0);
  return (
    <div className="panel stack">
      <div className="row between"><h3>Your Order</h3>{editable && <Link className="small" to="/cart">Edit Cart</Link>}</div>
      <div className="row" style={{ flexWrap: 'nowrap' }}><span className="avatar sm" aria-hidden="true">{initials(artistName)}</span><span className="small">From <strong>{artistName}</strong></span></div>
      {lines.map((l) => (
        <div key={l.listingId} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <div className="mat" style={{ width: 64, padding: 5, flex: 'none' }}>{l.listing?.artwork?.photos?.[0] && <LazyLoadImage src={l.listing.artwork.photos[0]} alt="" width="100%" />}</div>
          <div className="grow"><strong>{l.listing?.artwork?.title || 'A work'}</strong><br />
            <span className="small muted">{[KIND[l.listing?.kind], l.listing?.size].filter(Boolean).join(' · ')} · × {l.qty}</span></div>
          <span className="num">{formatINR((l.listing?.price || 0) * l.qty)}</span>
        </div>
      ))}
      <hr />
      <div>
        <div className="sum-row"><span>Items ({count})</span><span className="num">{formatINR(total)}</span></div>
        <div className="sum-row"><span>Shipping</span><span className="ok-t">Included</span></div>
        <div className="sum-row total"><span>Total</span><span className="num">{formatINR(total)}</span></div>
      </div>
      <p className="xs faint">Prices in Indian rupees.</p>
    </div>
  );
}
