import { useRef, useState } from 'react';
import { useSaved } from '../contexts/SavedContext';
import { nameTaken, wishlistMessage } from '../lib/wishlist';

export default function NewCollectionForm({ onCreated }) {
  const { collections, create } = useSaved();
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (busy.current) return;
    const value = name.trim();
    if (!value || value.length > 60) return setMessage('Use 1 to 60 characters.');
    if (nameTaken(collections, value)) return setMessage('You already have a collection with that name.');
    busy.current = true;
    setPending(true);
    setMessage('');
    try {
      const result = await create(value);
      if (!result.ok) return setMessage(wishlistMessage(result));
      setName('');
      await onCreated(result.id, value);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <form className="panel stack sm" onSubmit={submit}>
      <h3>New collection</h3>
      <label className="stack sm">
        Collection name
        <input value={name} maxLength={60} required disabled={pending}
          onChange={(event) => setName(event.target.value)} placeholder="e.g. Gifts for Mom" />
      </label>
      <button className="btn btn-primary" disabled={pending}>{pending ? 'Creating…' : 'Create collection'}</button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
