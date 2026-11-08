import { Link } from 'react-router-dom';
import LazyLoadImage from './ui/LazyLoadImage';
import { formatINR } from '../lib/format';

export default function ArtCard({ art }) {
  return (
    <Link className="art-card" to={`/artwork/${art.id}`}>
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
  );
}
