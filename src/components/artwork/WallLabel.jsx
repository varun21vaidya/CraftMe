import { CopyButton } from '../ui/CopyButton';

const SIGNED = { back: 'Signed on the back', front: 'Signed on the front', unsigned: 'Unsigned' };

/** The key and value list under the picture. A row with no value is left out. */
export function WallLabel({ art, artist, listings }) {
  const sizes = [...new Set((listings || []).map((l) => l.size).filter(Boolean))].join(', ');
  const code = String(art.id).slice(0, 8).toUpperCase();
  const rows = [
    ['Artist', artist?.displayName], ['Title', art.title], ['Year', art.year], ['Medium', art.medium], ['Size', sizes], ['Category', art.category],
    ['Signed', SIGNED[art.signed]], ['Ships from', [artist?.city, artist?.state].filter(Boolean).join(', ')],
  ].filter(([, v]) => v);
  return (
    <dl className="kv" aria-label="Wall label">
      {rows.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}
      <dt>Item code</dt><dd><span className="mono">{code}</span> <CopyButton text={code} label="Copy" /></dd>
    </dl>
  );
}
