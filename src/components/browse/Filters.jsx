import { useEffect, useState } from 'react';
import { useArtistSearch } from '../../api/gateway';
import { GROUPS } from '../../lib/categories';
import { KIND_LABELS, PRICE_BANDS } from '../../lib/browseParams';

const useWide = () => {
  const query = '(min-width: 1001px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
};

/** Typing waits 300 ms before it reaches the address bar. */
function SearchBox({ value, onChange }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text.trim() === value) return undefined;
    const t = setTimeout(() => onChange(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text, value, onChange]);
  return (
    <div className="field">
      <label htmlFor="f-q">Search</label>
      <input id="f-q" type="search" className="input" maxLength={100} value={text} placeholder="Title, Artist or medium" onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

function PriceFields({ min, max, onApply }) {
  const [lo, setLo] = useState(String(min));
  const [hi, setHi] = useState(String(max));
  useEffect(() => { setLo(String(min)); setHi(String(max)); }, [min, max]);
  const apply = () => {
    const a = lo === '' ? '' : Math.max(0, Math.floor(Number(lo)) || 0);
    const b = hi === '' ? '' : Math.max(0, Math.floor(Number(hi)) || 0);
    onApply(a !== '' && b !== '' && a > b ? { min: b, max: a } : { min: a, max: b });
  };
  // moving from one price box to the other is not done yet: applying now would swap half-typed numbers
  const leave = (e) => { if (!e.currentTarget.parentElement.contains(e.relatedTarget)) apply(); };
  const key = (e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } };
  return (
    <fieldset className="stack sm" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label">Price (₹)</legend>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="number" inputMode="numeric" min="0" className="input" aria-label="Minimum price in rupees" placeholder="Min" value={lo} onChange={(e) => setLo(e.target.value)} onBlur={leave} onKeyDown={key} />
        <input type="number" inputMode="numeric" min="0" className="input" aria-label="Maximum price in rupees" placeholder="Max" value={hi} onChange={(e) => setHi(e.target.value)} onBlur={leave} onKeyDown={key} />
      </div>
      <div className="chips">{PRICE_BANDS.map((b) => <button key={b.label} type="button" className="chip" onClick={() => onApply({ min: b.min, max: b.max })}>{b.label}</button>)}</div>
    </fieldset>
  );
}

function ArtistPicker({ artistId, artistName, onPick }) {
  const [term, setTerm] = useState('');
  const [focus, setFocus] = useState(false);
  const [found] = useArtistSearch(term.trim());
  const options = term.trim() && found ? found.slice(0, 6) : [];
  return (
    <div className="field" style={{ position: 'relative' }}>
      <label htmlFor="f-artist">Artist</label>
      {artistId ? (
        <div className="row"><span className="badge accent">{artistName || 'Artist'}</span><button type="button" className="btn btn-ghost btn-sm" onClick={() => onPick('')}>Change</button></div>
      ) : (
        <>
          <input id="f-artist" type="search" className="input" autoComplete="off" placeholder="Type an Artist’s name" value={term}
            onChange={(e) => setTerm(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)} />
          {focus && options.length > 0 && (
            <ul className="list suggest" role="listbox" aria-label="Artists">
              {options.map((a) => (
                <li key={a.id} role="option" aria-selected="false"><button type="button" className="btn btn-ghost btn-block" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(a.id, a.displayName); setTerm(''); }}>{a.displayName}</button></li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The filter panel. On wide screens it is always open; under 1000 px it is a closed <details> called "Filters" with the active count.
 * onChange(patch) is called with just the keys that changed; the page resets to 1.
 */
export function Filters({ filters, count, artistName, onChange, onClear }) {
  const wide = useWide();
  const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const groupToggle = (g) => {
    const all = GROUPS[g].every((c) => filters.categories.includes(c));
    onChange({ group: '', categories: all ? filters.categories.filter((c) => !GROUPS[g].includes(c)) : [...new Set([...filters.categories, ...GROUPS[g]])] });
  };
  return (
    <details className="filters" key={String(wide)} open={wide}>
      <summary>Filters <span className="badge" aria-label={`${count} active`}>{count}</span></summary>
      <div className="filters-body stack lg">
        <SearchBox value={filters.q} onChange={(q) => onChange({ q }, true)} />
        <fieldset className="stack sm" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label">Category</legend>
          {Object.keys(GROUPS).map((g) => {
            const picked = GROUPS[g].filter((c) => filters.categories.includes(c)).length;
            return (
              <details key={g} className="fgroup" open={picked > 0}>
                <summary>
                  <label className="check" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={picked === GROUPS[g].length} ref={(el) => { if (el) el.indeterminate = picked > 0 && picked < GROUPS[g].length; }} onChange={() => groupToggle(g)} /> {g}
                  </label>
                </summary>
                <div className="stack sm" style={{ paddingLeft: 12, marginTop: 6 }}>
                  {GROUPS[g].map((c) => (
                    <label key={c} className="check"><input type="checkbox" checked={filters.categories.includes(c)} onChange={() => onChange({ group: '', categories: toggle(filters.categories, c) })} /> {c}</label>
                  ))}
                </div>
              </details>
            );
          })}
        </fieldset>
        <fieldset className="stack sm" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label">Type</legend>
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <label key={k} className="check"><input type="checkbox" checked={filters.kinds.includes(k)} onChange={() => onChange({ kinds: toggle(filters.kinds, k) })} /> {label}</label>
          ))}
        </fieldset>
        <PriceFields min={filters.min} max={filters.max} onApply={onChange} />
        <ArtistPicker artistId={filters.artist} artistName={artistName} onPick={(artist) => onChange({ artist })} />
        <label className="check"><input type="checkbox" checked={filters.hideSold} onChange={(e) => onChange({ hideSold: e.target.checked })} /> Hide Sold Originals</label>
        <button type="button" className="btn btn-secondary btn-block" onClick={onClear}>Clear all</button>
      </div>
    </details>
  );
}
