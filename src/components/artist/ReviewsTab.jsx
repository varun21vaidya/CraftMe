import { useState } from 'react';
import { REVIEWS_PAGE, useArtistReviews, useArtistReviewSummary } from '../../api/gateway';
import { formatDate } from '../../lib/format';
import { initials } from '../../lib/artist';
import { Pagination } from '../ui/Pagination';
import { Stars } from '../ui/Stars';

const first = (name) => String(name || 'Buyer').trim().split(/\s+/)[0];

/** Average, histogram and the list of approved Reviews, ten to a page. */
export function ReviewsTab({ artistId, average, count }) {
  const [page, setPage] = useState(0);
  const [summary] = useArtistReviewSummary(artistId);
  const [data, loading, error, reload] = useArtistReviews(artistId, page);
  if (!count) return <div className="empty"><h3>No Reviews yet.</h3></div>;
  const total = summary ? [1, 2, 3, 4, 5].reduce((n, s) => n + (summary[s] || 0), 0) : count;
  return (
    <div className="split rev" style={{ gridTemplateColumns: '280px minmax(0, 1fr)' }}>
      <div className="panel stack" aria-label="Rating summary">
        <div><div className="price" style={{ fontSize: 48 }}>{Number(average).toFixed(1)}</div><Stars value={average} size={20} />
          <p className="small muted" style={{ marginTop: 6 }}>Based on {count} {count === 1 ? 'Review' : 'Reviews'} from Buyers who received their Orders</p></div>
        <ul className="stack sm small" style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Reviews by stars">
          {[5, 4, 3, 2, 1].map((s) => (
            <li key={s} className="row" style={{ flexWrap: 'nowrap' }} aria-label={`${s} stars: ${summary?.[s] ?? 0}`}>
              <span style={{ width: 14 }}>{s}</span>
              <div className="progress grow"><span style={{ width: `${total ? ((summary?.[s] || 0) / total) * 100 : 0}%` }} /></div>
              <span className="mono faint" style={{ width: 24 }}>{summary?.[s] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="stack">
        {loading && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />}
        {error && <div className="alert err" role="alert">We couldn’t load the Reviews. <button className="btn btn-secondary btn-sm" onClick={reload}>Try again</button></div>}
        {data?.rows.map((r) => (
          <article key={r.orderId} className="panel stack sm">
            <div className="row between"><div className="row"><span className="avatar sm" aria-hidden="true">{initials(r.buyerName)}</span><strong>{first(r.buyerName)}</strong><span className="badge ok">Received Order</span></div>
              <span className="xs faint mono">{formatDate(r.createdAt)}</span></div>
            <Stars value={r.rating} />
            <p style={{ overflowWrap: 'anywhere' }}>{r.comment}</p>
          </article>
        ))}
        <Pagination page={page + 1} pages={Math.ceil((data?.count || 0) / REVIEWS_PAGE)} label="Review pages" onPage={(n) => setPage(n - 1)} />
      </div>
    </div>
  );
}
