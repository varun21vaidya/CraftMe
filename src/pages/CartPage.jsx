import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useArtist, useListingsByIds } from '../api/gateway';
import { useCart } from '../contexts/CartContext';
import { cartChanges, MAX_QTY, NOTE_MAX } from '../contexts/cart';
import LazyLoadImage from '../components/ui/LazyLoadImage';
import { Icon } from '../components/common/Icon';
import { Field } from '../components/ui/Field';
import { QtyStepper } from '../components/ui/QtyStepper';
import { useToast } from '../components/ui/Toast';
import { initials, ratingText } from '../lib/artist';
import { formatINR, KIND_LABEL } from '../lib/format';
import { RULES } from '../lib/rules';

const KIND = KIND_LABEL;
/** "Kolam at Dawn (Print)": how the Cart names a line in sentences. */
export const lineName = (listing) => `${listing?.artwork?.title || 'A work'}${listing?.kind ? ` (${KIND[listing.kind] || listing.kind})` : ''}`;
const free = (l) => (l?.stock || 0) - (l?.held || 0);

function CartLine({ item, listing, change, busy, onQty, onRemove }) {
  const art = listing?.artwork;
  const original = listing?.kind === 'original';
  const name = art?.title || 'A work';
  return (
    <article className="cart-line">
      <Link className="mat" to={art ? `/artwork/${art.id}` : '/browse'} tabIndex={-1} aria-hidden="true">
        {art?.photos?.[0] && <LazyLoadImage src={art.photos[0]} alt="" width="100%" />}
      </Link>
      <div className="stack sm">
        {art ? <Link to={`/artwork/${art.id}`} style={{ color: 'var(--ink)', textDecoration: 'none', font: '600 18px var(--font-display)' }}>{name}</Link> : <strong>{name}</strong>}
        <span className="meta mono small faint">{[KIND[listing?.kind] || listing?.kind, listing?.size, listing?.medium].filter(Boolean).join(' · ').toUpperCase()}</span>
        <span className="row" style={{ gap: 6 }}>
          {busy
            ? <span className="badge warn">Being bought by someone else right now</span>
            : <span className="badge ok">{original ? 'Only 1 available' : `${free(listing)} in stock`}</span>}
          {change && <span className="badge warn">Price changed</span>}
        </span>
        <div className="row">
          {!original && (
            <QtyStepper value={item.qty} max={Math.max(1, Math.min(free(listing), MAX_QTY))} onChange={onQty} label={`Quantity of ${name}`} />
          )}
          <button type="button" className="btn-link small" onClick={onRemove}><Icon name="trash" size={14} /> Remove</button>
        </div>
      </div>
      <div className="right">
        <div className="price">{formatINR(listing.price * item.qty)}</div>
        {change
          ? <div className="small"><span className="strike">{formatINR(change.from)}</span> {formatINR(change.to)} each</div>
          : <div className="small faint">{formatINR(listing.price)} each</div>}
      </div>
    </article>
  );
}

function SavedCart() {
  const { saved, savedLoading, savedError, reloadSaved, restore, locked, retry, message, cart } = useCart();
  const groups = new Map();
  for (const row of saved || []) {
    const key = row.listing?.artistId || null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const available = ({ listing }) => listing?.status === 'live' && listing.stock > listing.held;
  return (
    <section className="stack" style={{ marginTop: 32 }} aria-labelledby="saved-cart-title">
      <h2 id="saved-cart-title">Saved for later</h2>
      {savedLoading && <p role="status">Loading saved items…</p>}
      {savedError && <p className="alert err" role="alert">Could not load saved items. <button type="button" className="btn btn-secondary btn-sm" onClick={reloadSaved}>Try again</button></p>}
      {!savedLoading && !savedError && !groups.size && <p className="muted">No items saved for later.</p>}
      {!cart.conflict && message && <p className="alert warn" role="status">{message} {retry && <button type="button" className="btn btn-secondary btn-sm" onClick={retry}>Try again</button>}</p>}
      {!cart.conflict && retry && !message && <button type="button" className="btn btn-secondary btn-sm" onClick={retry}>Retry cart switch</button>}
      {Array.from(groups, ([artist, rows]) => (
        <div className="panel stack" key={artist || 'unavailable'}>
          <div className="row between">
            <h3>{rows[0].listing?.artist?.displayName || 'Unavailable works'}</h3>
            {artist && <button type="button" className="btn btn-secondary btn-sm" disabled={locked || !rows.every(available)}
              onClick={() => restore(rows)}>Restore cart</button>}
          </div>
          {rows.map((row) => (
            <div className="row between" key={row.listingId}>
              <span>{row.listing ? lineName(row.listing) : 'Unavailable work'} · Qty {row.qty}
                {available(row) ? ` · ${formatINR(row.listing.price)} each` : ' · Unavailable'}</span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={locked || !available(row)}
                onClick={() => restore([row])}>Move to cart</button>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function ArtistGroup({ artistId, children }) {
  const [artist] = useArtist(artistId);
  const rating = artist && ratingText(artist.ratingAvg, artist.ratingCount);
  return (
    <div className="panel flush">
      <div className="panel-head row">
        <span className="avatar" aria-hidden="true">{initials(artist?.displayName)}</span>
        <div className="grow"><strong>{artist?.displayName || 'Artist'}</strong><br />
          <span className="small muted">ships within {RULES.shipDays} days{rating ? ` · ${rating}` : ''}</span></div>
        <Link className="btn btn-ghost btn-sm" to={`/artist/${artistId}`}>View Artist</Link>
      </div>
      <div style={{ padding: '0 20px' }}>{children}</div>
    </div>
  );
}

export default function CartPage() {
  const { cart, setQty, remove, removeMany, acceptPrices, setNote, locked } = useCart();
  const toast = useToast();
  const [listings, loading, error, reload] = useListingsByIds(cart.items.map((i) => i.listingId));
  const [removed, setRemoved] = useState([]); // names of lines that sold or went away, for the alert
  const changes = cartChanges(cart.items, listings);
  const goneKey = changes.gone.join(',');
  const lastGone = useRef('');

  // a line that sold or was taken down leaves the Cart, and the alert says which
  useEffect(() => {
    if (!goneKey || goneKey === lastGone.current) return;
    lastGone.current = goneKey;
    const ids = goneKey.split(',');
    setRemoved((r) => [...r, ...ids.map((id) => ({ id, name: lineName(listings[id]), sold: listings[id]?.status === 'sold' }))]);
    removeMany(ids);
  }, [goneKey, listings, removeMany]);

  if (!cart.items.length) {
    return (
      <main className="wrap page">
        <div className="page-head"><div><h1>Your Cart</h1></div></div>
        {removed.length > 0 && <RemovedAlert removed={removed} changed={[]} listings={listings} />}
        <div className="empty">
          <div className="ic-wrap"><Icon name="cart" size={26} /></div>
          <h3>Your Cart is empty</h3><p>Find something you love and add it here.</p>
          <Link className="btn btn-primary" to="/browse">Browse art</Link>
        </div>
        <SavedCart />
      </main>
    );
  }

  const loaded = cart.items.every((i) => listings[i.listingId] !== undefined) && !loading;
  const shown = cart.items.filter((i) => listings[i.listingId]?.status === 'live');
  const count = shown.reduce((n, i) => n + i.qty, 0);
  const total = shown.reduce((sum, i) => sum + listings[i.listingId].price * i.qty, 0);
  const ready = !locked && loaded && !error && !changes.changed.length && !changes.busy.length && !changes.gone.length;
  const accept = () => {
    acceptPrices(Object.fromEntries(changes.changed.map((c) => [c.listingId, c.to])));
    setRemoved([]);
    toast('New prices accepted');
  };

  return (
    <main className="wrap page">
      <div className="page-head">
        <div><h1>Your Cart</h1><p>{count} {count === 1 ? 'item' : 'items'} from one Artist. Prices include shipping within India.</p></div>
        <Link className="tag-link" to="/browse"><Icon name="arrow-left" size={16} />Keep browsing</Link>
      </div>
      <div className="split">
        <section className="stack" aria-label="Cart items">
          {(changes.changed.length > 0 || removed.length > 0) && (
            <RemovedAlert removed={removed} changed={changes.changed} listings={listings} onAccept={changes.changed.length ? accept : null} />
          )}
          {error && !loaded && (
            <div className="alert err" role="alert"><Icon name="alert" /><div>We couldn&apos;t load your Cart. <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Try again</button></div></div>
          )}
          <ArtistGroup artistId={cart.artistId}>
            {cart.items.map((i) => (listings[i.listingId] === undefined
              ? <div key={i.listingId} className="skeleton" style={{ height: 96, margin: '16px 0' }} aria-busy="true" />
              : listings[i.listingId]?.status === 'live' && (
                <CartLine key={i.listingId} item={i} listing={listings[i.listingId]}
                  change={changes.changed.find((c) => c.listingId === i.listingId)} busy={changes.busy.includes(i.listingId)}
                  onQty={(q) => setQty(i.listingId, q)} onRemove={() => { remove(i.listingId); toast('Removed from Cart'); }} />
              )))}
          </ArtistGroup>
          <div className="callout small"><strong>One Artist per Cart.</strong> Each Order is one parcel from one Artist. To buy from someone else, check out first or start a new Cart.</div>
        </section>
        <aside className="panel stack sticky" aria-label="Order summary">
          <h3>Summary</h3>
          <div>
            <div className="sum-row"><span>Items ({count})</span><span className="num">{formatINR(total)}</span></div>
            <div className="sum-row"><span>Shipping within India</span><span className="ok-t">Included</span></div>
            <div className="sum-row total"><span>Total</span><span className="num">{formatINR(total)}</span></div>
          </div>
          <Link className="btn btn-primary btn-lg btn-block" to="/checkout" aria-disabled={!ready} tabIndex={ready ? undefined : -1}
            onClick={(e) => !ready && e.preventDefault()}>Checkout <Icon name="arrow-right" /></Link>
          <ul className="list small muted">
            <li><Icon name="clock" size={18} /> Pay by card, UPI or netbanking.</li>
            <li><Icon name="shield" size={18} /> Arrives damaged? You get your money back.</li>
          </ul>
          <Field id="gift-note" label="Gift note" optional hint="Shown on the packing slip" counter={{ value: cart.note, max: NOTE_MAX }}>
            <input className="input" maxLength={NOTE_MAX} value={cart.note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </aside>
      </div>
      <SavedCart />
    </main>
  );
}

function RemovedAlert({ removed, changed, listings, onAccept }) {
  return (
    <div className="alert warn" role="alert">
      <Icon name="alert" />
      <div className="stack sm">
        <strong>Some things changed since you added them</strong>
        {changed.map((c) => <span key={c.listingId}>{lineName(listings[c.listingId])} went from {formatINR(c.from)} to {formatINR(c.to)}.</span>)}
        {removed.map((r) => <span key={r.id}>{r.name} {r.sold ? 'was Sold to another Buyer' : 'is no longer for sale'} and was removed.</span>)}
        {onAccept && <div><button type="button" className="btn btn-secondary btn-sm" onClick={onAccept}>Accept new prices</button></div>}
      </div>
    </div>
  );
}
