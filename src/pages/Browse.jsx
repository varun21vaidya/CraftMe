import { useState } from 'react';

import { Link, useSearchParams } from 'react-router-dom';
import { useArtworks, useCatalogueSearch } from '../api/gateway';
import ArtCard from '../components/ArtCard';
import { GROUPS } from '../lib/categories';
import { errorText } from '../lib/format';

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') || '').trim();
  const group = Object.keys(GROUPS).find((name) => name === params.get('group')) || '';
  const category = GROUPS[group]?.find((name) => name === params.get('category')) || '';
  const artists = params.get('type') === 'artists';
  const update = (values) => {
    const next = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setParams(next);
  };
  if (query) return <SearchResults key={params.toString()} {...{ query, group, category, artists, update }} />;
  return <BrowseCatalogue key={params.toString()} {...{ group, category, update }} />;
}

function SearchResults({ query, group, category, artists, update }) {
  const [page, setPage] = useState(0);
  return <SearchPage key={page} {...{ query, group, category, artists, update, page, setPage }} />;
}

function SearchPage({ query, group, category, artists, update, page, setPage }) {
  const [items, loading, error, retry] = useCatalogueSearch(query, artists, category ? [category] : GROUPS[group], page);
  return (
    <main className="wrap page stack">
      <h1>Results for “{query}”</h1>
      <div className="row" aria-label="Result type">
        <button className="chip" aria-pressed={!artists} onClick={() => update({ type: '' })}>Artworks</button>
        <button className="chip" aria-pressed={artists} onClick={() => update({ type: 'artists' })}>Artists</button>
      </div>
      {!artists && <label className="stack sm">Category
        <select value={category || group} onChange={(e) => {
          const value = e.target.value;
          update({ group: Object.keys(GROUPS).find((name) => name === value || GROUPS[name].includes(value)), category: GROUPS[value] ? '' : value });
        }}>
          <option value="">All categories</option>
          {Object.entries(GROUPS).map(([name, entries]) => <optgroup key={name} label={name}>
            <option value={name}>All {name}</option>
            {entries.map((entry) => <option key={entry}>{entry}</option>)}
          </optgroup>)}
        </select>
      </label>}
      {loading && <p role="status">Searching…</p>}
      {error && <div role="alert">Search is unavailable. <button className="btn btn-secondary" onClick={retry}>Try again</button></div>}
      {!loading && !error && items?.length === 0 && <p>No matches. Try a different search or category.</p>}
      {!loading && !error && <div className="grid">
        {items?.slice(0, 24).map((item) => artists
          ? <Link key={item.id} className="panel" to={`/artist/${item.id}`}>{item.displayName}</Link>
          : <ArtCard key={item.id} art={item} />)}
      </div>}
      <nav className="row" aria-label="Search pages">
        <button className="btn btn-secondary" disabled={!page || loading} onClick={() => setPage(page - 1)}>Previous</button>
        <button className="btn btn-secondary" disabled={loading || error || items?.length !== 25} onClick={() => setPage(page + 1)}>Next</button>
      </nav>
    </main>
  );
}

function BrowseCatalogue({ group, category, update }) {
  const [cursors, setCursors] = useState([null]); // one entry per page already visited
  const cursor = cursors[cursors.length - 1];
  const categories = category ? [category] : group ? GROUPS[group] : undefined;
  const [items, loading, error] = useArtworks({ categories }, cursor);

  const pick = (g, c = '') => update({ group: g, category: c });
  const chip = (label, on, onClick) => (
    <button key={label} className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>{label}</button>
  );

  return (
    <main className="wrap page">
      <div className="page-head"><div><h1>Browse art</h1></div></div>
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
