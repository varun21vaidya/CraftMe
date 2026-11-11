import { Link } from 'react-router-dom';
import LazyLoadImage from './ui/LazyLoadImage';
import { formatINR } from '../lib/format';

/** One work. The "by <Artist>" link is separate from the work's link (a link can't sit inside a link); hideArtist drops it on the Artist's own page. */
export default function ArtCard({ art, hideArtist = false }) {
  const by = !hideArtist && art.artist?.displayName;
  return (
    <article className="art-card">
      <Link className="art-link" to={`/artwork/${art.id}`}>
        <div className="mat">
          {art.photos?.[0] && <LazyLoadImage src={art.photos[0]} alt={art.title} width="100%" style={{ aspectRatio: '1 / 1', objectFit: 'cover' }} />}
        </div>
        <div className="stack sm" style={{ marginTop: 10 }}>
          <strong>{art.title}</strong>
          <span className="small muted">
            {art.available === false ? 'Sold' : art.fromPricePaise != null ? `From ${formatINR(art.fromPricePaise)}` : ''}
          </span>
        </div>
      </Link>
      {by && <Link className="small muted art-by" to={`/artist/${art.artistId}`}>by {by}</Link>}
    </article>
  );
}
