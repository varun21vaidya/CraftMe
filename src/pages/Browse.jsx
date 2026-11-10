import { useState } from 'react';

import { useArtworks } from '../api/gateway';
import ArtCard from '../components/ArtCard';
import { GROUPS } from '../lib/categories';
import { errorText } from '../lib/format';

export default function Browse() {
  const [group, setGroup] = useState('');
  const [category, setCategory] = useState('');
  const [cursors, setCursors] = useState([null]); // one entry per page already visited
  const cursor = cursors[cursors.length - 1];
  const categories = category ? [category] : group ? GROUPS[group] : undefined;
  const [items, loading, error] = useArtworks({ categories }, cursor);

  const pick = (g, c = '') => { setGroup(g); setCategory(c); setCursors([null]); };
  const chip = (label, on, onClick) => (
    <button key={label} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>{label}</button>
  );

  return (
    <main className="wrap page">
      <div className="page-head"><div><h1>Browse</h1></div></div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: group ? 8 : 20 }}>
        {chip('All', !group, () => pick(''))}
        {Object.keys(GROUPS).map((g) => chip(g, group === g, () => pick(g)))}
      </div>
      {group && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {chip(`All ${group}`, !category, () => pick(group))}
          {GROUPS[group].map((c) => chip(c, category === c, () => pick(group, c)))}
        </div>
      )}

      {error && <p className="alert err" role="alert">{errorText({ code: 'unavailable' })}</p>}
      {loading && (
        <div className="grid g3" aria-busy="true" aria-label="Loading artworks">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '1 / 1.1' }} />)}
        </div>
      )}
      {!loading && !error && items?.length === 0 && (
        <div className="empty"><h3>Nothing here yet</h3><p>Try another category.</p></div>
      )}
      {!loading && items?.length > 0 && <div className="grid g3">{items.map((a) => <ArtCard key={a.id} art={a} />)}</div>}

      <nav className="row" style={{ justifyContent: 'center', marginTop: 24 }} aria-label="Pages">
        <button className="btn btn-secondary btn-sm" disabled={cursors.length === 1} onClick={() => setCursors((c) => c.slice(0, -1))}>Previous</button>
        <button className="btn btn-secondary btn-sm" disabled={!items || items.length < 24}
          onClick={() => setCursors((c) => [...c, items[items.length - 1].createdAt])}>Next</button>
      </nav>
    </main>
  );
}
