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
      <div className="mat">{art?.photos?.[0] && <LazyLoadImage src={art.photos[0]} alt={art.title} width="100%" />}</div>
      <div className="stack sm">
        <strong>{art?.title || (loading ? '…' : 'No longer available')}</strong>
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

export default function CartPage() {
  const { cart, setQty, remove } = useCart();
  const listings = useListingsByIds(cart.items.map((i) => i.listingId));

  if (!cart.items.length) {
    return (
      <main className="wrap page">
        <div className="empty">
          <h3>Your Cart is empty</h3><p>Find something you love and add it here.</p>
          <Link className="btn btn-primary" to="/browse">Browse art</Link>
        </div>
      </main>
    );
  }

  const live = cart.items.filter((i) => listings[i.listingId]?.status === 'live');
  const preview = live.reduce((sum, i) => sum + listings[i.listingId].price * i.qty, 0);
  const ready = live.length === cart.items.length; // every line is still on sale

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
    </main>
  );
}
