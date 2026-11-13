import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSavedWorks } from '../api/gateway';
import LazyLoadImage from '../components/ui/LazyLoadImage';
import { useAuth } from '../contexts/AuthContext';
import { groupMessage, useCart } from '../contexts/CartContext';
import { useSaved } from '../contexts/SavedContext';
import { formatINR } from '../lib/format';
import { cartAction, groupByArtist, nameTaken, wishlistMessage } from '../lib/wishlist';
import CollectionMenu from '../components/CollectionMenu';
import NewCollectionForm from '../components/NewCollectionForm';

const PAGE = 24;

function Item({ s, collectionId, artistName }) {
  const { cart, add } = useCart();
  const { toggle, removeFrom } = useSaved();
  const [note, setNote] = useState('');
  const art = s.artwork;
  const action = cartAction(art);
  const inCart = action.kind === 'add' && cart.items.some((i) => i.listingId === action.listing.id);
  const remove = async () => {
    const res = collectionId ? await removeFrom(collectionId, s.artworkId) : await toggle(s.artworkId);
    if (!res.ok) setNote(wishlistMessage(res));
  };
  return (
    <article className="art-card wish-item">
      <Link className="art-link" to={`/artwork/${art.id}`}>
        <div className="mat">{art.photos?.[0] && <LazyLoadImage src={art.photos[0]} alt={art.title} width="100%" style={{ aspectRatio: '1 / 1', objectFit: 'cover' }} />}</div>
        <div className="stack sm" style={{ marginTop: 10 }}>
          <strong>{art.title}</strong>
          <span className="small muted">By {artistName}</span>
          <span className="small muted">{action.kind === 'gone' ? 'Not available right now' : art.fromPricePaise != null ? `${action.kind === 'choose' ? 'From ' : ''}${formatINR(action.kind === 'add' ? action.listing.price : art.fromPricePaise)}` : ''}</span>
        </div>
      </Link>
      <div className="stack sm" style={{ marginTop: 8 }}>
        {action.kind === 'add' && (inCart
          ? <Link className="btn btn-secondary btn-sm btn-block" to="/cart">In your Cart</Link>
          : <button type="button" className="btn btn-primary btn-sm btn-block" onClick={() => add(art.artistId, action.listing.id, action.listing.price)}>Add to Cart</button>)}
        {action.kind === 'choose' && <Link className="btn btn-primary btn-sm btn-block" to={`/artwork/${art.id}`}>Choose a version</Link>}
        {action.kind === 'gone' && <span className="badge warn">Not available</span>}
        <CollectionMenu artworkId={s.artworkId} />
        <button type="button" className="btn-link small" onClick={remove}>{collectionId ? 'Remove from collection' : 'Remove'}</button>
        {note && <span className="small" role="alert">{note}</span>}
      </div>
    </article>
  );
}

export default function WishlistPage() {
  const { collectionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { cart, addMany, status } = useCart();
  const { has, collections, rename, remove } = useSaved();
  const [limit, setLimit] = useState(PAGE);
  const [saved, loading, error, reload] = useSavedWorks(currentUser.uid, query || collectionId ? 500 : limit);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [msg, setMsg] = useState('');
  const [skipped, setSkipped] = useState('');
  const [creating, setCreating] = useState(false);

  const col = collectionId ? collections.find((c) => c.id === collectionId) : null;
  const members = col ? new Set(col.collectionWorks.map((w) => w.artworkId)) : null;
  // has(): a work you just removed leaves the list at once; a collection shows only its own works
  const scope = (saved || []).filter((s) => has(s.artworkId) && (!members || members.has(s.artworkId)));
  const needle = query.trim().toLocaleLowerCase();
  const list = scope.filter((s) => !needle || [s.artwork?.title, s.artwork?.artist?.displayName].some((value) => value?.toLocaleLowerCase().includes(needle)));
  const { groups, gone } = groupByArtist(list);

  // D07: one dialog and one switch for the whole group; the server reports anything that sold meanwhile
  const addAll = (g) => {
    const todo = g.items.map((s) => ({ s, a: cartAction(s.artwork) }))
      .filter(({ a }) => a.kind === 'add' && !cart.items.some((i) => i.listingId === a.listing.id))
      .map(({ s, a }) => ({ id: a.listing.id, price: a.listing.price, title: s.artwork.title }));
    if (!todo.length) { setSkipped(groupMessage(0, g.items.length)); return; }
    setSkipped('');
    addMany(g.artistId, g.name, todo, { works: g.items.length });
  };

  const submitRename = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || n.length > 60) return setMsg('Use 1 to 60 characters.');
    if (nameTaken(collections, n, col.id)) return setMsg('You already have a collection with that name.');
    const res = await rename(col.id, n);
    if (!res.ok) return setMsg(wishlistMessage(res));
    setEditing(false);
    return setMsg('');
  };
  const del = async () => {
    const res = await remove(col.id);
    if (res.ok) navigate('/wishlist');
    else setMsg(wishlistMessage(res));
  };

  if (collectionId && !loading && collections.length && !col) {
    return <main className="wrap page"><div className="empty"><h3>We couldn’t find that collection</h3><Link className="btn btn-primary" to="/wishlist">Back to wish list</Link></div></main>;
  }

  return (
    <main className="wrap page">
      <div className="page-head"><div><h1>{col ? col.name : 'Wish list'}</h1><p className="muted">{col ? 'A collection of your saved works.' : 'Works you saved. Only you can see this.'}</p></div></div>

      <nav className="tabs" aria-label="Collections">
        <Link className="tab" aria-selected={!col} to="/wishlist">All saved</Link>
        {collections.map((c) => (
          <Link key={c.id} className="tab" aria-selected={col?.id === c.id} to={`/wishlist/${c.id}`}>
            {c.name} <span className="faint">{c.collectionWorks.length}</span>
          </Link>
        ))}
      </nav>

      <label className="stack sm" style={{ margin: '16px 0' }}>
        <span>Search saved works</span>
        <input type="search" value={query} onChange={(e) => {
          const next = new URLSearchParams(searchParams);
          if (e.target.value) next.set('q', e.target.value); else next.delete('q');
          setSearchParams(next, { replace: true });
        }} placeholder="Search by artwork or artist" />
      </label>

      {col && (
        <div className="row" style={{ marginBottom: 16 }}>
          {editing ? (
            <form className="row" onSubmit={submitRename}>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Collection name" />
              <button className="btn btn-primary btn-sm" type="submit">Save</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setEditing(false); setMsg(''); }}>Cancel</button>
            </form>
          ) : (
            <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setName(col.name); setEditing(true); }}>Rename</button>
          )}
          {confirmDel ? (
            <span className="row small">
              Delete this collection? Your saved works stay in your wish list.
              <button className="btn btn-primary btn-sm" type="button" onClick={del}>Delete</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirmDel(false)}>Keep</button>
            </span>
          ) : <button className="btn btn-ghost btn-sm" type="button" onClick={() => setConfirmDel(true)}>Delete collection</button>}
        </div>
      )}
      {msg && <p className="alert" role="alert">{msg}</p>}
      {(skipped || status) && <p className="alert info" role="status">{skipped || status}</p>}

      {loading && <div className="skeleton" style={{ height: 200 }} aria-busy="true" />}
      {error && !loading && <div className="empty"><h3>We couldn’t load your wish list</h3><button className="btn btn-primary" onClick={reload}>Try again</button></div>}
      {!loading && !error && list.length === 0 && (
        <div className="empty">
          <h3>{needle && scope.length ? 'No matching works' : col ? 'Nothing in this collection yet' : 'Nothing saved yet'}</h3>
          <p>{needle && scope.length ? 'Try a different search.' : col ? 'Open a work and use “Add to collection”.' : 'Tap the heart on any work to keep it here.'}</p>
          <Link className="btn btn-primary" to="/browse">Browse art</Link>
        </div>
      )}

      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
        {groups.filter((g) => g.items.length > 1).map((g) => (
          <button key={g.artistId} type="button" className="btn btn-secondary btn-sm" onClick={() => addAll(g)}>Add all by {g.name} to Cart</button>
        ))}
      </div>
      <div className="grid wishlist-grid">
        {groups.flatMap((g) => g.items.map((s) => <Item key={s.artworkId} s={s} collectionId={col?.id} artistName={g.name} />))}
      </div>

      {gone.length > 0 && (
        <section className="stack" aria-label="No longer available">
          <h2 className="h3">No longer available</h2>
          {gone.map((s) => <GoneRow key={s.artworkId} s={s} collectionId={col?.id} />)}
        </section>
      )}

      {!query && !collectionId && !loading && saved?.length === limit && <button type="button" className="btn btn-secondary" onClick={() => setLimit((n) => n + PAGE)}>Show more</button>}

      {!col && !loading && (
        <div className="stack" style={{ marginTop: 24 }}>
          <button className="btn btn-secondary" aria-expanded={creating} onClick={() => setCreating(!creating)}>
            {creating ? 'Cancel' : 'New collection'}
          </button>
          {creating && <NewCollectionForm onCreated={(id) => { setCreating(false); navigate(`/wishlist/${id}`); }} />}
        </div>
      )}
    </main>
  );
}

function GoneRow({ s, collectionId }) {
  const { toggle, removeFrom } = useSaved();
  return (
    <div className="panel row between">
      <span className="muted">This work was taken down or is no longer visible.</span>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => (collectionId ? removeFrom(collectionId, s.artworkId) : toggle(s.artworkId))}>Remove</button>
    </div>
  );
}
