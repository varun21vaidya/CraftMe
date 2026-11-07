import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useArtworks } from '../api/gateway';
import LazyLoadImage from '../components/ui/LazyLoadImage';
import { errorText, formatINR } from '../lib/format';

const CATEGORIES = ['Painting', 'Drawing', 'Print', 'Photography', 'Sculpture', 'Textile', 'Digital'];

function ArtCard({ art }) {
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

export default function Browse() {
  const [category, setCategory] = useState('');
  const [cursors, setCursors] = useState([null]); // one entry per page already visited
  const cursor = cursors[cursors.length - 1];
  const [items, loading, error] = useArtworks({ category: category || undefined }, cursor);

  const pick = (c) => { setCategory(c); setCursors([null]); };

  return (
    <main className="wrap page">
      <div className="page-head"><div><h1>Browse art</h1></div></div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {['', ...CATEGORIES].map((c) => (
          <button key={c || 'all'} className={`chip${category === c ? ' on' : ''}`} aria-pressed={category === c} onClick={() => pick(c)}>
            {c || 'All'}
          </button>
        ))}
      </div>

      {error && <p className="alert err" role="alert">{errorText({ code: 'unavailable' })}</p>}
      {loading && (
        <div className="grid g3" aria-busy="true" aria-label="Loading artworks">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '1 / 1.1' }} />)}
        </div>
      )}
      {!loading && !error && items?.length === 0 && (
        <div className="empty"><h3>Nothing here yet</h3><p>Try another category.</p></div>
      )}
      {!loading && items?.length > 0 && <div className="grid g3">{items.map((a) => <ArtCard key={a.id} art={a} />)}</div>}

      <nav className="row" style={{ justifyContent: 'center', marginTop: 24 }} aria-label="Pages">
        <button className="btn btn-secondary btn-sm" disabled={cursors.length === 1} onClick={() => setCursors((c) => c.slice(0, -1))}>Previous</button>
        <button className="btn btn-secondary btn-sm" disabled={!items || items.length < 24}
          onClick={() => setCursors((c) => [...c, items[items.length - 1].createdAt])}>Next</button>
      </nav>
    </main>
  );
}
