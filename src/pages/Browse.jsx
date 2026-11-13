import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useArtist, useBrowse, useCatalogueSearch } from '../api/gateway';
import ArtCard from '../components/ArtCard';
import { ActiveFilters } from '../components/browse/ActiveFilters';
import { Filters } from '../components/browse/Filters';
import { Icon } from '../components/common/Icon';
import { Pagination } from '../components/ui/Pagination';
import { activeChips, readFilters, SORTS, toRpc, withChange, writeFilters } from '../lib/browseParams';

const PAGE = 24;

/** The Artists view of a header search (KD02): names containing the text, unrestricted Artists only. */
function ArtistResults({ query }) {
  const [page, setPage] = useState(0);
  const [items, loading, error, retry] = useCatalogueSearch(query, true, null, page);
  return (
    <section aria-label="Artists">
      {loading && <p role="status">Searching…</p>}
      {error && <div className="alert err" role="alert">Search is unavailable. <button className="btn btn-secondary btn-sm" onClick={retry}>Try again</button></div>}
      {!loading && !error && items?.length === 0 && <div className="empty"><h3>No Artists match “{query}”</h3></div>}
      {!loading && !error && (
        <ul className="list">
          {items?.slice(0, PAGE).map((a) => <li key={a.id}><Link to={`/artist/${a.id}`}><strong>{a.displayName}</strong></Link></li>)}
        </ul>
      )}
      <nav className="row" aria-label="Artist pages" style={{ marginTop: 16 }}>
        <button className="btn btn-secondary btn-sm" disabled={!page || loading} onClick={() => setPage(page - 1)}>Previous</button>
        <button className="btn btn-secondary btn-sm" disabled={loading || !!error || items?.length !== PAGE + 1} onClick={() => setPage(page + 1)}>Next</button>
      </nav>
    </section>
  );
}

export default function Browse() {
  const [sp, setSp] = useSearchParams();
  const filters = readFilters(sp);
  const type = sp.get('type') === 'artists' ? 'artists' : '';
  const [artist] = useArtist(filters.artist || null);
  const [data, loading, error, reload] = useBrowse(toRpc(filters));

  const go = (next, replace = false) => {
    const params = writeFilters(next);
    if (type) params.set('type', type);
    setSp(params, { replace });
  };
  const change = (patch, replace = false) => go(withChange(filters, patch), replace === true);
  const chips = activeChips(filters, artist?.displayName || 'Artist');
  const clear = () => setSp(new URLSearchParams());
  const pages = Math.max(1, Math.ceil((data?.total || 0) / PAGE));
  const searching = Boolean(filters.q);

  const setType = (value) => {
    const params = writeFilters({ ...filters, page: 0 });
    if (value) params.set('type', value);
    setSp(params);
  };

  return (
    <main className="wrap page">
      <div className="page-head"><div><h1>{searching ? <>Results for “{filters.q}”</> : 'Browse art'}</h1></div></div>
      {searching && (
        <div className="chips" role="group" aria-label="Result type" style={{ marginBottom: 16 }}>
          <button type="button" className="chip" aria-pressed={!type} onClick={() => setType('')}>Artworks</button>
          <button type="button" className="chip" aria-pressed={!!type} onClick={() => setType('artists')}>Artists</button>
        </div>
      )}
      {type && searching ? <ArtistResults query={filters.q} /> : (
        <div className="browse">
          <Filters filters={filters} count={chips.length} artistName={artist?.displayName} onChange={change} onClear={clear} />
          <section aria-label="Results" className="stack">
            <div className="row between">
              <p className="muted" role="status" aria-live="polite">
                {loading ? 'Searching…' : error ? '' : data.total === 0 ? 'No Artworks match your filters.' : `${data.total} ${data.total === 1 ? 'Artwork matches' : 'Artworks match'} your filters.`}
              </p>
              <label className="row" style={{ gap: 8 }}>Sort
                <select className="select" value={filters.sort} onChange={(e) => change({ sort: e.target.value })}>
                  {Object.entries(SORTS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </label>
            </div>
            <ActiveFilters chips={chips} onRemove={(next) => go(next)} />
            {error && (
              <div className="alert err" role="alert"><Icon name="alert" /><div><strong>We couldn’t load the catalogue.</strong><br />
                <button type="button" className="btn btn-secondary btn-sm" onClick={reload}>Try again</button></div></div>
            )}
            {loading && (
              <div className="grid g3" aria-busy="true" aria-label="Loading artworks">
                {Array.from({ length: 12 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '1 / 1.1' }} />)}
              </div>
            )}
            {!loading && !error && data.total === 0 && (
              <div className="empty">
                <h3>Nothing matches those filters.</h3>
                <p>Try removing a Category or widening the price range.</p>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button type="button" className="btn btn-primary" onClick={() => setSp(new URLSearchParams())}>Clear all filters</button>
                  <Link className="btn btn-secondary" to="/browse" onClick={() => setSp(new URLSearchParams())}>Browse everything</Link>
                </div>
              </div>
            )}
            {!loading && !error && data.total > 0 && data.items.length === 0 && <p className="muted">There are no Artworks on this page.</p>}
            {!loading && !error && data.items.length > 0 && <div className="grid g3">{data.items.map((a) => <ArtCard key={a.id} art={a} />)}</div>}
            {!loading && !error && <Pagination page={filters.page + 1} pages={pages} label="Result pages" onPage={(n) => go({ ...filters, page: n - 1 })} />}
          </section>
        </div>
      )}
    </main>
  );
}
