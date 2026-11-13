import { Link } from 'react-router-dom';
import { useArtistReviews } from '../../api/gateway';
import { formatDate } from '../../lib/format';
import { initials } from '../../lib/artist';
import { Stars } from '../ui/Stars';

const first = (name) => String(name || 'the Artist').trim().split(/\s+/)[0];

/** The three newest approved Reviews of the Artist, with a link to all of them. Draws nothing when there are none. */
export function ReviewsPreview({ artistId, artistName }) {
  const [data] = useArtistReviews(artistId, 0, 3);
  if (!data?.count) return null;
  return (
    <section className="stack" aria-labelledby="rev-h">
      <div className="row between"><h2 id="rev-h" style={{ fontSize: 22 }}>What Buyers say about {first(artistName)}</h2>
        <Link to={`/artist/${artistId}?tab=reviews`}>All {data.count} Reviews</Link></div>
      {data.rows.map((r) => (
        <article key={r.orderId} className="panel stack sm">
          <div className="row between"><div className="row"><span className="avatar sm" aria-hidden="true">{initials(r.buyerName)}</span><strong>{r.buyerName}</strong></div>
            <span className="xs faint mono">{formatDate(r.createdAt)}</span></div>
          <Stars value={r.rating} />
          <p>{r.comment}</p>
        </article>
      ))}
    </section>
  );
}
