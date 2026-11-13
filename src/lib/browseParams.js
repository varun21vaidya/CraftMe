// Browse filters <-> the address bar. The URL is the one place the filters live, so Back, reload and shared links all rebuild the same view.
// Keys: q, group, cat (comma list), kind (comma list), min, max (rupees), artist, sold=hide, sort, page (from 1). `category` is the old name for cat.
import { CATEGORIES, GROUPS } from './categories';
import { formatINR } from './format';

export const SORTS = { new: 'Newest first', price_asc: 'Price: low to high', price_desc: 'Price: high to low', rating: 'Highest rated Artist' };
export const KIND_LABELS = { original: 'Originals', print: 'Prints', product: 'Ready-made' };
export const PRICE_BANDS = [
  { label: 'Under ₹2,000', min: '', max: 2000 }, { label: '₹2,000 to ₹10,000', min: 2000, max: 10000 }, { label: 'Over ₹10,000', min: 10000, max: '' },
];
export const emptyFilters = { q: '', group: '', categories: [], kinds: [], min: '', max: '', artist: '', hideSold: false, sort: 'new', page: 0 };

const list = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const rupees = (v) => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : ''; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** The group whose every category is in `cats`, if `cats` is exactly that group. */
const wholeGroup = (cats) => Object.keys(GROUPS).find((g) => GROUPS[g].length === cats.length && GROUPS[g].every((c) => cats.includes(c)));

/** URLSearchParams -> filters. Anything unknown or malformed is dropped; reversed price bounds are swapped; page is 0-based here. */
export function readFilters(sp) {
  const group = Object.keys(GROUPS).includes(sp.get('group')) ? sp.get('group') : '';
  const categories = new Set([...list(sp.get('cat')), ...list(sp.get('category'))].filter((c) => CATEGORIES.includes(c)));
  if (group) GROUPS[group].forEach((c) => categories.add(c));
  let min = rupees(sp.get('min'));
  let max = rupees(sp.get('max'));
  if (min !== '' && max !== '' && min > max) [min, max] = [max, min];
  const sort = Object.keys(SORTS).includes(sp.get('sort')) ? sp.get('sort') : 'new';
  const page = Math.max(0, (parseInt(sp.get('page'), 10) || 1) - 1);
  return {
    q: (sp.get('q') || '').trim().slice(0, 100), group, categories: [...categories],
    kinds: list(sp.get('kind')).filter((k) => KIND_LABELS[k]), min, max,
    artist: UUID.test(sp.get('artist') || '') ? sp.get('artist') : '', hideSold: sp.get('sold') === 'hide', sort, page,
  };
}

/** Filters -> URLSearchParams with the defaults left out. A whole group is written as group=, anything else as cat=. */
export function writeFilters(f) {
  const sp = new URLSearchParams();
  if (f.q) sp.set('q', f.q);
  const whole = wholeGroup(f.categories);
  if (whole) sp.set('group', whole);
  else if (f.categories.length) sp.set('cat', f.categories.join(','));
  if (f.kinds.length) sp.set('kind', f.kinds.join(','));
  let { min, max } = f;
  if (min !== '' && max !== '' && min > max) [min, max] = [max, min];
  if (min !== '') sp.set('min', String(min));
  if (max !== '') sp.set('max', String(max));
  if (f.artist) sp.set('artist', f.artist);
  if (f.hideSold) sp.set('sold', 'hide');
  if (f.sort && f.sort !== 'new') sp.set('sort', f.sort);
  if (f.page > 0) sp.set('page', String(f.page + 1));
  return sp;
}

/** What browse_catalogue takes. */
export const toRpc = (f) => ({
  q: f.q, categories: f.categories.length ? f.categories : null, kinds: f.kinds.length ? f.kinds : null,
  minPaise: f.min === '' ? null : Number(f.min) * 100, maxPaise: f.max === '' ? null : Number(f.max) * 100,
  artist: f.artist || null, hideSold: f.hideSold, sort: f.sort, page: f.page,
});

/** A change to the filters always goes back to page 1. */
export const withChange = (f, patch) => ({ ...f, ...patch, page: 0 });

/** One removable chip per active filter: [{ key, label, without }], `without` being the filters with that one removed. */
export function activeChips(f, artistName = 'Artist') {
  const chips = [];
  const left = new Set(f.categories);
  for (const g of Object.keys(GROUPS)) {
    if (GROUPS[g].every((c) => left.has(c))) {
      chips.push({ key: `group:${g}`, label: g, without: withChange(f, { group: '', categories: f.categories.filter((c) => !GROUPS[g].includes(c)) }) });
      GROUPS[g].forEach((c) => left.delete(c));
    }
  }
  for (const c of f.categories.filter((x) => left.has(x))) chips.push({ key: `cat:${c}`, label: c, without: withChange(f, { group: '', categories: f.categories.filter((x) => x !== c) }) });
  for (const k of f.kinds) chips.push({ key: `kind:${k}`, label: KIND_LABELS[k], without: withChange(f, { kinds: f.kinds.filter((x) => x !== k) }) });
  if (f.min !== '' || f.max !== '') {
    const label = f.min !== '' && f.max !== '' ? `${formatINR(f.min * 100)} to ${formatINR(f.max * 100)}` : f.min !== '' ? `From ${formatINR(f.min * 100)}` : `Up to ${formatINR(f.max * 100)}`;
    chips.push({ key: 'price', label, without: withChange(f, { min: '', max: '' }) });
  }
  if (f.q) chips.push({ key: 'q', label: `“${f.q}”`, without: withChange(f, { q: '' }) });
  if (f.artist) chips.push({ key: 'artist', label: artistName, without: withChange(f, { artist: '' }) });
  if (f.hideSold) chips.push({ key: 'sold', label: 'Hide Sold Originals', without: withChange(f, { hideSold: false }) });
  return chips;
}
