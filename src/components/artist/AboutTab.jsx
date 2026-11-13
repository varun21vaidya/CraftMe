import { RULES } from '../../lib/rules';

const month = (ms) => new Date(ms).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

/** Based in, Joined, Verified, Ships. */
export function AboutTab({ artist }) {
  const place = [artist.city, artist.state].filter(Boolean).join(', ');
  return (
    <dl className="kv panel">
      {place && <><dt>Based in</dt><dd>{place}</dd></>}
      <dt>Joined</dt><dd>{month(artist.createdAt)}</dd>
      <dt>Verified</dt><dd>{artist.verified ? 'Identity and payout details checked by CraftMe' : 'Checks in progress'}</dd>
      <dt>Ships</dt><dd>Within {RULES.shipDays} days, India only</dd>
    </dl>
  );
}
