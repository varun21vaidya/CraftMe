import { Icon } from '../common/Icon';

/** One removable chip per active filter. chips: activeChips(...) from lib/browseParams. */
export function ActiveFilters({ chips, onRemove }) {
  if (!chips.length) return null;
  return (
    <ul className="chips" aria-label="Active filters" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {chips.map((c) => (
        <li key={c.key}>
          <span className="chip" style={{ gap: 4 }}>{c.label}
            <button type="button" className="iconbtn" style={{ width: 22, height: 22 }} aria-label={`Remove ${c.label}`} onClick={() => onRemove(c.without)}><Icon name="x" size={14} /></button>
          </span>
        </li>
      ))}
    </ul>
  );
}
