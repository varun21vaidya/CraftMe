import { useState } from 'react';
import { Link } from 'react-router-dom';
import { sellArtwork, setListingPrice, setWorkOnSale, useMyWorks } from '../api/gateway';
import { KINDS } from '../components/dashboard/ArtworkUploadForm';
import { useAuth } from '../contexts/AuthContext';
import { errorText, formatINR } from '../lib/format';

const kindName = (k) => KINDS.find((x) => x.value === k)?.label || k;
/** Whole rupees from a text box, or null when it isn't one. */
const rupees = (text, min, max) => {
  const n = Number(text);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** A work without a price yet: choose what it is, set the price, put it on sale. */
function SellForm({ work, onDone }) {
  const { currentUser } = useAuth();
  const [kind, setKind] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const p = rupees(price, 1, 10_000_000);
    const s = kind === 'original' ? 1 : rupees(stock, 1, 1000);
    if (!kind) return setMsg('Choose what you are selling.');
    if (p === null) return setMsg('Enter the price in whole rupees, at least 1.');
    if (s === null) return setMsg('Enter how many you have, from 1 to 1000.');
    setBusy(true);
    const res = await sellArtwork(currentUser.uid, work.id, work.title, { kind, size: '', medium: '', price: p * 100, stock: s });
    setBusy(false);
    if (!res.ok) return setMsg(errorText(res.error));
    return onDone();
  };

  return (
    <form className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={submit} noValidate>
      <label className="field" style={{ flex: '1 1 180px' }}>
        <span className="small">What is it?</span>
        <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">Choose…</option>
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </label>
      <label className="field" style={{ flex: '0 1 120px' }}>
        <span className="small">Price (₹)</span>
        <input className="input" type="number" inputMode="numeric" min="1" step="1" value={price} onChange={(e) => setPrice(e.target.value)} />
      </label>
      {kind && kind !== 'original' && (
        <label className="field" style={{ flex: '0 1 100px' }}>
          <span className="small">How many</span>
          <input className="input" type="number" inputMode="numeric" min="1" max="1000" step="1" value={stock} onChange={(e) => setStock(e.target.value)} />
        </label>
      )}
      <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? 'Publishing…' : 'Put on sale'}</button>
      {msg && <span className="error-msg" role="alert" style={{ flexBasis: '100%' }}>{msg}</span>}
    </form>
  );
}

/** One price line of a work, with its price editable. Stock changes only through orders. */
function ListingLine({ listing, onDone }) {
  const [price, setPrice] = useState(String(listing.price / 100));
  const [msg, setMsg] = useState(null);
  const left = (listing.stock || 0) - (listing.held || 0);

  const save = async (e) => {
    e.preventDefault();
    const p = rupees(price, 1, 10_000_000);
    if (p === null) return setMsg('Whole rupees, at least 1.');
    if (p * 100 === listing.price) return setMsg(null);
    const res = await setListingPrice(listing.id, p * 100);
    setMsg(res.ok ? 'Saved.' : errorText(res.error));
    return res.ok && onDone();
  };

  return (
    <form className="row small" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }} onSubmit={save}>
      <span style={{ flex: '1 1 160px' }}>
        {kindName(listing.kind)}{listing.size ? ` · ${listing.size}` : ''} · {listing.status === 'sold' ? 'Sold' : `${left} left`}
      </span>
      {listing.status === 'sold'
        ? <span>{formatINR(listing.price)}</span>
        : (
          <>
            <label className="row" style={{ gap: 4, alignItems: 'center' }}>₹
              <input className="input" aria-label="Price in rupees" style={{ width: 110 }} type="number" min="1" step="1"
                value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <button className="btn btn-secondary btn-sm">Save price</button>
          </>
        )}
      {msg && <span role="status">{msg}</span>}
    </form>
  );
}

function WorkRow({ work, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const listings = work.listings || [];
  const onSale = work.status === 'published' && listings.some((l) => l.status === 'live');
  const state = listings.length === 0 ? 'Needs a price' : onSale ? 'On sale' : work.status === 'published' ? 'Sold out' : 'Taken down';

  const toggle = async () => {
    if (onSale && !window.confirm('Take this work down? Buyers won’t see it until you put it back.')) return;
    setBusy(true);
    const res = await setWorkOnSale(work.id, !onSale);
    setBusy(false);
    if (!res.ok) return setMsg(errorText(res.error));
    return onChanged();
  };

  return (
    <article className="panel stack sm">
      <div className="row" style={{ gap: 12, alignItems: 'center' }}>
        {work.photos?.[0]
          ? <img src={work.photos[0]} alt="" width="64" height="64" loading="lazy" style={{ objectFit: 'cover', borderRadius: 8 }} />
          : <span className="skeleton" style={{ width: 64, height: 64, borderRadius: 8, display: 'inline-block' }} aria-hidden="true" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong>{work.title}</strong>
          <div className="small muted">{state}</div>
        </div>
        {work.status === 'published' && <Link className="btn btn-ghost btn-sm" to={`/artwork/${work.id}`}>View</Link>}
        {listings.length > 0 && listings.some((l) => l.status !== 'sold') && (
          <button className={`btn btn-sm ${onSale ? 'btn-secondary' : 'btn-primary'}`} onClick={toggle} disabled={busy}>
            {onSale ? 'Take down' : 'Put back on sale'}
          </button>
        )}
      </div>
      {listings.length === 0
        ? <SellForm work={work} onDone={onChanged} />
        : listings.map((l) => <ListingLine key={l.id} listing={l} onDone={onChanged} />)}
      {msg && <p className="error-msg" role="alert">{msg}</p>}
    </article>
  );
}

export default function MyWorks() {
  const { currentUser } = useAuth();
  const [works, loading, error, reload] = useMyWorks(currentUser.uid);

  return (
    <main className="wrap page" style={{ maxWidth: 760 }}>
      <div className="page-head">
        <div><h1>My works</h1></div>
        <Link className="btn btn-primary btn-sm" to="/dashboard/artworks/new">Add artwork</Link>
      </div>
      {loading && <div className="skeleton" style={{ height: 120 }} aria-busy="true" />}
      {error && <p className="alert err" role="alert">{errorText({ code: 'unavailable' })}</p>}
      {!loading && !error && !works?.length && <div className="empty"><h3>No works yet</h3><p>Add your first artwork to start selling.</p></div>}
      <div className="stack">{works?.map((w) => <WorkRow key={w.id} work={w} onChanged={reload} />)}</div>
    </main>
  );
}
