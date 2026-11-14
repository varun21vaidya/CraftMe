import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { bumpView, useArtist, useArtwork, useListings, useReel } from '../api/gateway';
import { RelatedWorks } from '../components/artwork/RelatedWorks';
import { ReviewsPreview } from '../components/artwork/ReviewsPreview';
import { WallLabel } from '../components/artwork/WallLabel';
import CollectionMenu from '../components/CollectionMenu';
import { Icon } from '../components/common/Icon';
import Gallery from '../components/Gallery';
import ReportDialog from '../components/ReportDialog';
import SaveButton from '../components/SaveButton';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { QtyStepper } from '../components/ui/QtyStepper';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { isBadId } from '../lib/artist';
import { formatINR, KIND_LABEL } from '../lib/format';
import { RULES } from '../lib/rules';

const Shell = ({ children }) => <main className="wrap page">{children}</main>;
const stockText = (l, left) => (l.status !== 'live' || left <= 0 ? 'Sold' : left === 1 ? 'Only 1 available' : `${left} in stock`);

export default function ArtworkPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { currentUser } = useAuth();
  const [query] = useSearchParams();
  const cart = useCart();
  const [art, loadingArt, error, reload] = useArtwork(id);
  const [listings, loadingListings] = useListings(id);
  const [artist] = useArtist(art?.artistId);
  const [reel] = useReel(art?.reelId);
  const [pickedId, setPicked] = useState(null);
  const [qty, setQty] = useState(1);
  const [reporting, setReporting] = useState(false);

  // one visit counts once per browser session, never the owner's own
  useEffect(() => {
    if (!art?.id || (currentUser && currentUser.uid === art.artistId)) return;
    try {
      const key = `cm-viewed:${art.id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch { /* storage blocked: count it */ }
    bumpView(art.id);
  }, [art?.id, art?.artistId, currentUser?.uid]); // eslint-disable-line react-hooks/exhaustive-deps -- currentUser itself changes shape on every token refresh

  if (loadingArt || loadingListings) return <Shell><div className="skeleton" style={{ height: 320 }} aria-busy="true" /></Shell>;
  if (error && !isBadId(error)) return <Shell><div className="empty" role="alert"><h3>We couldn’t load this page.</h3><button className="btn btn-primary" onClick={reload}>Try again</button></div></Shell>;
  const preview = query.get('preview') === '1' && currentUser?.uid === art?.artistId; // the owner may look at a draft
  if (!art || (art.status !== 'published' && !preview)) return <Shell><div className="empty"><h3>We couldn’t find this Artwork. It may have been taken down.</h3><Link className="btn btn-primary" to="/browse">Browse art</Link></div></Shell>;

  const options = (listings || []).slice().sort((a, b) => a.price - b.price);
  const leftOf = (l) => (l.stock || 0) - (l.held || 0);
  const buyable = (l) => l.status === 'live' && leftOf(l) > 0;
  const picked = options.find((l) => l.id === pickedId && buyable(l)) || options.find(buyable);
  const anyBuyable = options.some(buyable);
  const original = picked?.kind === 'original';
  const max = picked ? Math.min(leftOf(picked), RULES.maxQty) : 1;
  const count = original ? 1 : Math.min(Math.max(qty, 1), Math.max(max, 1));
  const own = currentUser?.uid === art.artistId;
  const soldOriginal = options.some((l) => l.kind === 'original' && !buyable(l));
  const inCart = picked && cart.cart.items.some((i) => i.listingId === picked.id);
  const artistName = artist?.displayName || 'the Artist';

  const signIn = () => navigate('/login', { state: { from: pathname } });
  // with another Artist's work in the Cart the "Start a new Cart?" dialog opens and the Buyer stays here
  const add = () => {
    if (!currentUser) return signIn();
    const result = cart.add(art.artistId, picked.id, { qty: count, price: picked.price });
    if (result === 'added') toast('Added to your Cart');
    return undefined;
  };
  const buyNow = () => (currentUser ? cart.buyNow(art.artistId, artistName, picked) : signIn());
  const report = () => (currentUser ? setReporting(true) : signIn());

  return (
    <Shell>
      {preview && <div className="alert info" role="status"><Icon name="eye" /><div><strong>Preview.</strong> Buyers can’t see this until you publish.</div></div>}
      <Breadcrumbs items={[{ to: '/', label: 'Home' }, { to: '/browse', label: 'Browse' }, { to: `/browse?cat=${encodeURIComponent(art.category)}`, label: art.category }, { label: art.title }]} />
      <div className="split">
        <section style={{ position: 'relative' }}>
          <Gallery key={art.id} photos={art.photos || []} title={art.title} reel={reel} video={art.video} />
          {!anyBuyable && options.length > 0 && <span className="sold-tag big">Sold</span>}
        </section>
        <aside className="panel stack sticky" aria-label="Buy">
          <p className="eyebrow small muted">{[art.category, art.year, art.medium].filter(Boolean).join(' · ')}</p>
          <h1>{art.title}</h1>
          {artist && (
            <p className="small">By <Link to={`/artist/${art.artistId}`}>{artist.displayName}</Link>
              {artist.city && <span className="muted"> · {artist.city}</span>}
              {Number(artist.ratingCount) > 0 && <span className="muted"> · {Number(artist.ratingAvg).toFixed(1)} ★</span>}</p>
          )}
          {options.length === 0 && <p className="alert info">Not on sale right now.</p>}
          {options.length > 0 && (
            <fieldset className="stack sm" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label">Choose a version</legend>
              {options.map((l) => (
                <label key={l.id} className="option-card" aria-disabled={!buyable(l)}>
                  <input type="radio" name="version" disabled={!buyable(l)} checked={picked?.id === l.id} onChange={() => { setPicked(l.id); setQty(1); }} />
                  <span className="grow"><strong>{KIND_LABEL[l.kind] || l.kind}</strong> · {stockText(l, leftOf(l))}<br />
                    <span className="small muted">{[l.size, l.medium].filter(Boolean).join(' · ') || ' '}</span></span>
                  <span className="num">{buyable(l) ? formatINR(l.price) : ''}</span>
                </label>
              ))}
            </fieldset>
          )}
          {soldOriginal && anyBuyable && <p className="small muted">This Original has found a home. Prints of this Artwork are still available.</p>}
          {picked && !own && (original
            ? <p className="small muted">Originals are always 1.</p>
            : <QtyStepper value={count} min={1} max={max} onChange={(n) => setQty(Math.min(Math.max(n, 1), max))} label={`Quantity of ${art.title}`} />)}
          {picked && <div className="sum-row total"><span>Total, shipping included</span><span className="num">{formatINR(picked.price * count)}</span></div>}
          {own ? (
            <div className="alert info"><Icon name="info" /><div><strong>This is your Artwork.</strong> Artists can’t buy their own Listings.<br />
              <Link className="btn btn-secondary btn-sm" to={`/dashboard/artworks/${art.id}`}>Edit in dashboard</Link></div></div>
          ) : anyBuyable ? (
            <>
              <button className="btn btn-primary btn-lg btn-block" onClick={add}>{inCart ? 'In your Cart' : 'Add to Cart'}</button>
              <button className="btn btn-secondary btn-lg btn-block" disabled={cart.locked} onClick={buyNow}>Buy now</button>
              {inCart && <Link className="btn btn-ghost btn-block" to="/cart">View Cart</Link>}
            </>
          ) : options.length > 0 && <button className="btn btn-primary btn-lg btn-block" disabled>Sold</button>}
          {!own && <><SaveButton artworkId={art.id} artistId={art.artistId} label /><CollectionMenu artworkId={art.id} /></>}
          <ul className="list small">
            <li><Icon name="truck" size={18} />Shipped by {artistName}, within {RULES.shipDays} days of payment. Shipping within India is included.</li>
            <li><Icon name="clock" size={18} />Yours while you pay. Nobody else can buy it while you check out.</li>
            <li><Icon name="shield" size={18} />Arrives safely or you get your money back. If it is damaged, tell us within {RULES.damageDays} days.</li>
          </ul>
          {!own && <button type="button" className="btn btn-ghost btn-sm" onClick={report}>Report this Artwork</button>}
        </aside>
      </div>

      <div className="stack lg" style={{ marginTop: 32 }}>
        <section className="stack" aria-labelledby="about-h">
          <h2 id="about-h" style={{ fontSize: 22 }}>About this piece</h2>
          {art.description && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{art.description}</p>}
          <WallLabel art={art} artist={artist} listings={listings} />
        </section>
        <ReviewsPreview artistId={art.artistId} artistName={artistName} />
        <RelatedWorks title={`More from ${artistName}`} filter={{ artist: art.artistId }} exclude={art.id} hideArtist />
        <RelatedWorks title={`More ${art.category}`} filter={{ categories: [art.category] }} exclude={art.id} />
      </div>
      <ReportDialog open={reporting} onClose={() => setReporting(false)} targetType="artwork" targetId={art.id} />
    </Shell>
  );
}
