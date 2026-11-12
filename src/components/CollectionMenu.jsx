import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSaved } from '../contexts/SavedContext';
import { wishlistMessage } from '../lib/wishlist';
import NewCollectionForm from './NewCollectionForm';

export default function CollectionMenu({ artworkId }) {
  const { currentUser } = useAuth();
  const { collections, addTo, removeFrom } = useSaved();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dialog = useRef(null);
  const trigger = useRef(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(null);
  const [selected, setSelected] = useState({});

  async function change(id, want, created = false) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setMessage('');
    const result = await (want ? addTo(id, artworkId) : removeFrom(id, artworkId));
    if (result.ok) {
      setSelected((old) => ({ ...old, [id]: want }));
      setRetry(null);
    } else {
      setMessage(wishlistMessage(result));
      if (created) setRetry(id);
    }
    busy.current = false;
    setPending(false);
  }

  return (
    <>
      <button ref={trigger} type="button" className="btn btn-secondary btn-block" aria-haspopup="dialog"
        onClick={() => {
          if (!currentUser) return navigate('/login', { state: { from: pathname } });
          setSelected({});
          dialog.current.showModal();
        }}>Add to collection…</button>
      <dialog ref={dialog} className="collection-dialog panel" aria-label="Add to collection"
        onClose={() => trigger.current?.focus()}>
        <div className="stack">
          <div className="row between">
            <h2>Add to collection</h2>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => dialog.current.close()}>Done</button>
          </div>
          {collections.length === 0 && <p className="muted">Create your first collection below.</p>}
          <div className="collection-tiles">
            {collections.map((collection) => {
              const checked = selected[collection.id] ?? collection.collectionWorks.some((work) => work.artworkId === artworkId);
              const preview = collection.collectionWorks.find((work) => work.artwork?.photos?.[0])?.artwork.photos[0];
              return (
                <label key={collection.id} className="panel stack sm collection-tile">
                  {preview && <img src={preview} alt="" loading="lazy" />}
                  <span className="row">
                    <input type="checkbox" checked={checked} disabled={pending}
                      onChange={() => change(collection.id, !checked)} />
                    <strong>{collection.name}</strong>
                  </span>
                  <span className="small muted">{collection.collectionWorks.length} works</span>
                </label>
              );
            })}
          </div>
          {message && <p role="alert">{message}</p>}
          {retry && <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => change(retry, true, true)}>Retry adding artwork</button>}
          <NewCollectionForm onCreated={(id) => change(id, true, true)} />
        </div>
      </dialog>
    </>
  );
}
