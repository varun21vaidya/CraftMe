// Small pure helpers for the public Artist page.

/** Up to two initials from a display name; "A" when the name is empty. */
export const initials = (name) => {
  const letters = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => Array.from(w)[0].toUpperCase());
  return letters.join('') || 'A';
};

/** The photo only when it is an https address; anything else falls back to initials. */
export const safePhoto = (url) => (typeof url === 'string' && /^https:\/\//i.test(url) ? url : '');

/** "4.5 ★ · 2 reviews", or '' until the first approved review. */
export const ratingText = (avg, count) => {
  const n = Number(count) || 0;
  if (n < 1) return '';
  return `${Number(avg).toFixed(1)} ★ · ${n} ${n === 1 ? 'review' : 'reviews'}`;
};

/** An id Postgres can't parse as a uuid (error 22P02) means "no such Artist", not "the network failed". */
export const isBadId = (error) => error?.code === '22P02';
