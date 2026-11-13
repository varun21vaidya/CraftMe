/** Read-only stars for a value from 0 to 5 (decimals fill part of a star). */
export function Stars({ value, size = 16 }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className="stars" role="img" aria-label={`${Number(v.toFixed(1))} of 5 stars`} style={{ fontSize: size }}>
      <span className="stars-bg" aria-hidden="true">★★★★★</span>
      <span className="stars-fg" aria-hidden="true" style={{ width: `${(v / 5) * 100}%` }}>★★★★★</span>
    </span>
  );
}
