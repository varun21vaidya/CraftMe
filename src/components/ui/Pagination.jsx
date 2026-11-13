import { Icon } from '../common/Icon';

/** The page numbers to draw: all of them up to seven, otherwise the ends, the neighbours of `page` and gaps ('…'). */
export function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const out = [];
  [...keep].sort((a, b) => a - b).forEach((n, i, all) => {
    if (i && n - all[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

/** Numbered pages; the ends are real disabled buttons so they cannot be focused. Pages count from 1. */
export function Pagination({ page, pages, onPage, label = 'Pagination' }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label={label}>
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="chevron-left" size={16} /></button>
      {pageList(page, pages).map((n, i) => (n === '…'
        ? <span key={`gap${i}`} className="gap" aria-hidden="true">…</span>
        : <button key={n} type="button" aria-current={n === page ? 'page' : undefined} aria-label={`Page ${n}`} onClick={() => onPage(n)}>{n}</button>))}
      <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><Icon name="chevron-right" size={16} /></button>
    </nav>
  );
}
