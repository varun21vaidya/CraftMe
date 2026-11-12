import { Link } from 'react-router-dom';
import { useArtwork, useListingsByIds } from '../api/gateway';
import { useCart } from '../contexts/CartContext';
import LazyLoadImage from '../components/ui/LazyLoadImage';
import { Icon } from '../components/common/Icon';
import { formatINR } from '../lib/format';

function CartLine({ item, listing, onQty, onRemove }) {
  const [art] = useArtwork(listing?.artworkId);
  const gone = listing === null || (listing && listing.status !== 'live');
  const loading = listing === undefined;
  return (
    <article className="cart-line">
      <Link className="mat" to={art ? `/artwork/${art.id}` : "/browse"} tabIndex={-1} aria-hidden="true">{art?.photos?.[0] && <LazyLoadImage src={art.photos[0]} alt="" width="100%" />}</Link>
      <div className="stack sm">
        {art ? <Link to={`/artwork/${art.id}`} style={{ color: 'inherit' }}><strong>{art.title}</strong></Link> : <strong>{loading ? '…' : 'No longer available'}</strong>}
        {gone && <span className="badge warn">No longer available. Please remove it.</span>}
        <div className="row">
          <div className="qty">
            <button type="button" aria-label="Decrease quantity" onClick={() => onQty(item.qty - 1)}><Icon name="minus" size={16} /></button>
            <input readOnly value={item.qty} aria-label="Quantity" />
            <button type="button" aria-label="Increase quantity" onClick={() => onQty(item.qty + 1)} disabled={gone}><Icon name="plus" size={16} /></button>
          </div>
          <button className="btn-link small" onClick={onRemove}><Icon name="trash" size={14} /> Remove</button>
        </div>
      </div>
      <div className="right">
        {listing && !gone && <div className="price">{formatINR(listing.price * item.qty)}</div>}
        {listing && !gone && <div className="small faint">{formatINR(listing.price)} each</div>}
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
      {savedError && <p role="alert">Could not load saved items. <button onClick={reloadSaved}>Try again</button></p>}
      {!savedLoading && !savedError && !groups.size && <p className="muted">No items saved for later.</p>}
      {!cart.conflict && message && <p role="status">{message} {retry && <button onClick={retry}>Try again</button>}</p>}
      {!cart.conflict && retry && !message && <button onClick={retry}>Retry cart switch</button>}
      {Array.from(groups, ([artist, rows]) => (
        <div className="panel stack" key={artist || 'unavailable'}>
          <div className="row between">
            <h3>{rows[0].listing?.artist?.displayName || 'Unavailable works'}</h3>
            {artist && <button className="btn btn-secondary btn-sm" disabled={locked || !rows.every(available)}
              onClick={() => restore(rows)}>Restore cart</button>}
          </div>
          {rows.map((row) => (
            <div className="row between" key={row.listingId}>
              <span>{row.listing?.title || 'Unavailable work'} · Qty {row.qty}
                {available(row) ? ` · ${formatINR(row.listing.price)} each` : ' · Unavailable'}</span>
              <button className="btn btn-secondary btn-sm" disabled={locked || !available(row)}
                onClick={() => restore([row])}>Move to cart</button>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

export default function CartPage() {
  const { cart, setQty, remove, locked } = useCart();
  const listings = useListingsByIds(cart.items.map((i) => i.listingId));

  if (!cart.items.length) {
    return (
      <main className="wrap page">
        <div className="empty">
          <h3>Your Cart is empty</h3><p>Find something you love and add it here.</p>
          <Link className="btn btn-primary" to="/browse">Browse art</Link>
        </div>
        <SavedCart />
      </main>
    );
  }

  const live = cart.items.filter((i) => listings[i.listingId]?.status === 'live');
  const preview = live.reduce((sum, i) => sum + listings[i.listingId].price * i.qty, 0);
  const ready = !locked && live.length === cart.items.length;

  return (
    <main className="wrap page">
      <div className="page-head"><div><h1>Your Cart</h1><p>Prices include shipping within India.</p></div></div>
      <div className="split">
        <section className="stack" aria-label="Cart items">
          <div className="panel flush"><div style={{ padding: '0 20px' }}>
            {cart.items.map((i) => (
              <CartLine key={i.listingId} item={i} listing={listings[i.listingId]}
                onQty={(q) => setQty(i.listingId, q)} onRemove={() => remove(i.listingId)} />
            ))}
          </div></div>
          <div className="callout small"><strong>One Artist per Cart.</strong> Each order is one parcel from one Artist.</div>
        </section>
        <aside className="panel stack sticky" aria-label="Order summary">
          <h3>Summary</h3>
          <div>
            <div className="sum-row"><span>Items</span><span className="num">{formatINR(preview)}</span></div>
            <div className="sum-row"><span>Shipping within India</span><span className="ok-t">Included</span></div>
            <div className="sum-row total"><span>Total</span><span className="num">{formatINR(preview)}</span></div>
          </div>
          <Link className={`btn btn-primary btn-lg btn-block${ready ? '' : ' is-disabled'}`} to="/checkout" aria-disabled={!ready}
            onClick={(e) => !ready && e.preventDefault()}>Checkout <Icon name="arrow-right" /></Link>
          <ul className="list small muted">
            <li><Icon name="clock" size={18} /> Pay by card, UPI or netbanking.</li>
            <li><Icon name="shield" size={18} /> Arrives damaged? You get your money back.</li>
          </ul>
        </aside>
      </div>
      <SavedCart />
    </main>
  );
}
