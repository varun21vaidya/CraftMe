import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSaved } from '../contexts/SavedContext';
import { nameTaken, wishlistMessage } from '../lib/wishlist';

/** "Add to collection": a small list of the user's collections with ticks, and a way to make a new one. */
export default function CollectionMenu({ artworkId }) {
  const { currentUser } = useAuth();
  const { collections, addTo, removeFrom, create } = useSaved();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const toggleOpen = () => (currentUser ? setOpen((o) => !o) : navigate('/login', { state: { from: pathname } }));
  const flip = async (c) => {
    const inIt = c.collectionWorks.some((w) => w.artworkId === artworkId);
    const res = await (inIt ? removeFrom(c.id, artworkId) : addTo(c.id, artworkId));
    setMsg(res.ok ? '' : wishlistMessage(res));
  };
  const make = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setMsg('Give the collection a name.');
    if (n.length > 60) return setMsg('Keep the name under 60 characters.');
    if (nameTaken(collections, n)) return setMsg('You already have a collection with that name.');
    const res = await create(n);
    if (!res.ok) return setMsg(wishlistMessage(res));
    setName('');
    setMsg('');
    return addTo(res.id, artworkId).then((r) => { if (!r.ok) setMsg(wishlistMessage(r)); });
  };

  return (
    <div className="coll-menu" ref={box}>
      <button type="button" className="btn btn-secondary btn-block" aria-expanded={open} onClick={toggleOpen}>Add to collection…</button>
      {open && (
        <div className="coll-pop panel stack sm" role="group" aria-label="Collections">
          {collections.length === 0 && <p className="small muted">No collections yet. Make your first one below.</p>}
          {collections.map((c) => (
            <label key={c.id} className="row small">
              <input type="checkbox" checked={c.collectionWorks.some((w) => w.artworkId === artworkId)} onChange={() => flip(c)} />
              <span>{c.name}</span>
            </label>
          ))}
          <form className="row" onSubmit={make}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="New collection" aria-label="New collection name" />
            <button className="btn btn-primary btn-sm" type="submit">Add</button>
          </form>
          {msg && <p className="small" role="alert">{msg}</p>}
        </div>
      )}
    </div>
  );
}
