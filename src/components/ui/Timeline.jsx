import { formatStamp } from '../../lib/format';

const CLASS = { done: 'done', now: 'now', failed: 'bad', future: 'todo' };

/** items: [{ label, at?, note?, state: 'done' | 'now' | 'failed' | 'future', detail? }], in the order to draw. */
export function Timeline({ items, label }) {
  return (
    <ol className="timeline" aria-label={label}>
      {items.map((t, i) => (
        <li key={i} className={CLASS[t.state] || ''}>
          <div className="tt">{t.label}</div>
          {(t.at || t.note) && <div className="ts">{[t.at && formatStamp(t.at), t.note].filter(Boolean).join(' · ')}</div>}
          {t.detail && <div className="small muted">{t.detail}</div>}
        </li>
      ))}
    </ol>
  );
}
