import { Link } from 'react-router-dom';
import LazyLoadImage from './ui/LazyLoadImage';
import SaveButton from './SaveButton';
import { formatINR, KIND_LABEL } from '../lib/format';

/**
 * One work. The "by <Artist>" link is separate from the work's link (a link can't sit inside a link); hideArtist drops it on the Artist's own page.
 * `kinds` (what can be bought now) comes with Browse results; a work with nothing to buy carries a "Sold" tag.
 */
export default function ArtCard({ art, hideArtist = false }) {
  const by = !hideArtist && art.artist?.displayName;
  const sold = art.available === false;
  const kinds = (art.kinds || []).map((k) => KIND_LABEL[k] || k).join(' · ');
  return (
    <article className="art-card">
      <SaveButton artworkId={art.id} artistId={art.artistId} overlay />
      <Link className="art-link" to={`/artwork/${art.id}`}>
        <div className="mat" style={{ position: 'relative' }}>
          {art.photos?.[0] && <LazyLoadImage src={art.photos[0]} alt={art.title} width="100%" style={{ aspectRatio: '1 / 1', objectFit: 'cover' }} />}
          {sold && <span className="sold-tag">Sold</span>}
        </div>
        <div className="stack sm" style={{ marginTop: 10 }}>
          <strong>{art.title}</strong>
          {kinds && !sold && <span className="small muted">{kinds}</span>}
          <span className="small muted">{sold ? 'Sold' : art.fromPricePaise != null ? `From ${formatINR(art.fromPricePaise)}` : ''}</span>
        </div>
      </Link>
      {by && <Link className="small muted art-by" to={`/artist/${art.artistId}`}>by {by}</Link>}
    </article>
  );
}
