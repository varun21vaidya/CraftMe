import { Link } from 'react-router-dom';
import { Icon } from '../common/Icon';

/** items: [{ to, label }, …, { label }]; the last one is the current page. */
export function Breadcrumbs({ items }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={i} style={{ display: 'contents' }}>
          {i > 0 && <Icon name="chevron-right" size={14} />}
          {c.to ? <Link to={c.to}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
        </span>
      ))}
    </nav>
  );
}
