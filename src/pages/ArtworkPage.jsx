import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useArtist, useArtwork, useListings } from '../api/gateway';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import LazyLoadImage from '../components/ui/LazyLoadImage';
import { formatINR } from '../lib/format';

const kindLabel = { original: 'Original', print: 'Print', product: 'Ready-made' };

export default function ArtworkPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const cart = useCart();
  const [art, loadingArt] = useArtwork(id);
  const [listings, loadingListings] = useListings(id);
  const [artist] = useArtist(art?.artistId);
  const [pickedId, setPicked] = useState(null);

  if (loadingArt || loadingListings) return <main className="wrap page"><div className="skeleton" style={{ height: 320 }} aria-busy="true" /></main>;
  if (!art) return <main className="wrap page"><div className="empty"><h3>We couldn’t find this artwork</h3></div></main>;

  const options = (listings || []).slice().sort((a, b) => a.price - b.price);
  const picked = options.find((l) => l.id === pickedId) || options.find((l) => l.status === 'live') || options[0];
  const left = picked ? (picked.stock || 0) - (picked.held || 0) : 0;
  const canBuy = picked?.status === 'live' && left > 0;
  const own = currentUser?.uid === art.artistId;

  const add = () => {
    if (!currentUser) return navigate('/login', { state: { from: `/artwork/${id}` } });
    cart.add(art.artistId, picked.id);
    return navigate('/cart');
  };

  return (
    <main className="wrap page">
      <div className="split">
        <section className="stack">
          {art.photos?.map((src, i) => (
            <div className="mat" key={src}><LazyLoadImage src={src} alt={`${art.title}, photo ${i + 1}`} width="100%" /></div>
          ))}
        </section>
        <aside className="panel stack sticky">
          <h1>{art.title}</h1>
          {artist && <p className="small">By <Link to={`/artist/${art.artistId}`}>{artist.displayName}</Link></p>}
          <p className="muted">{art.description}</p>
          {options.length === 0 && <p className="alert info">Not on sale right now.</p>}
          <div className="stack sm" role="radiogroup" aria-label="Choose a version">
            {options.map((l) => (
              <button key={l.id} role="radio" aria-checked={picked?.id === l.id} className={`btn btn-block ${picked?.id === l.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPicked(l.id)} disabled={l.status !== 'live'}>
                {kindLabel[l.kind] || l.kind}{l.size ? ` · ${l.size}` : ''} — {l.status === 'sold' ? 'Sold' : formatINR(l.price)}
              </button>
            ))}
          </div>
          {picked && <div className="price">{formatINR(picked.price)} <span className="small muted">shipping within India included</span></div>}
          {own && <p className="alert info">This is your own work, so it can’t be added to a Cart.</p>}
          <button className="btn btn-primary btn-lg btn-block" disabled={!canBuy || own} onClick={add}>
            {canBuy ? 'Add to Cart' : 'Sold'}
          </button>
        </aside>
      </div>
    </main>
  );
}
