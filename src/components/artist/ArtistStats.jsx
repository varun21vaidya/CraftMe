/** "2.4 days", "under a day", or a dash when nobody has been shipped to yet. */
export const shipTime = (hours) => (hours == null ? '—' : hours < 24 ? 'under a day' : `${(hours / 24).toFixed(1)} days`);

/** Artworks, Orders shipped and the average time to ship. Draws nothing without stats (a restricted Artist). */
export function ArtistStats({ stats }) {
  if (!stats) return null;
  const items = [['Artworks', stats.artworks], ['Orders shipped', stats.ordersShipped], ['Avg. time to ship', shipTime(stats.avgShipHours)]];
  return (
    <dl className="grid g3 artist-stats" aria-label="Artist stats">
      {items.map(([label, value]) => <div key={label} className="stat"><dd className="v" style={{ margin: 0 }}>{value}</dd><dt className="l">{label}</dt></div>)}
    </dl>
  );
}
