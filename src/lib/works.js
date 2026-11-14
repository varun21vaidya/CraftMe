// What an Artist's Artworks and Listings look like on their own pages: kinds, status words, and what stops a publish.

// What is being sold. An original is one of a kind (stock 1); the other two are stocked.
export const KINDS = [
  { value: 'original', label: 'One-of-a-kind original' },
  { value: 'print', label: 'Print (many copies)' },
  { value: 'product', label: 'Ready-made item in stock' },
];
export const KIND_SHORT = { original: 'Original', print: 'Print', product: 'Ready-made item' };

/**
 * 'published' while a Listing is live; 'sold' when published with none live but one sold; 'ended' when no Listing is open and one was
 * ended; otherwise 'draft'. Pure: the work carries its Listings.
 */
export const workStatus = (work) => {
  const listings = work.listings || [];
  const has = (s) => listings.some((l) => l.status === s);
  if (work.status === 'published') {
    if (has('live')) return 'published';
    if (has('sold')) return 'sold';
    return has('ended') ? 'ended' : 'draft'; // a published work whose Listings were all ended (older data)
  }
  return has('ended') ? 'ended' : 'draft';
};
export const STATUS_BADGE = { published: ['Published', 'ok'], sold: ['Sold', 'info'], draft: ['Draft', 'warn'], ended: ['Ended', ''] };
export const TABS = [['all', 'All'], ['published', 'Published'], ['draft', 'Drafts'], ['sold', 'Sold'], ['ended', 'Ended']];

/** "Original ₹42,000 · 1 left" style line pieces for one Listing: [label, price paise, note]. */
export const listingLine = (l) => {
  const left = Math.max(0, (l.stock || 0) - (l.held || 0));
  const note = l.status === 'sold' ? 'Sold' : l.status === 'ended' ? 'Ended' : l.kind === 'original' ? `${left} left` : `${l.stock || 0} in stock`;
  return [KIND_SHORT[l.kind] || l.kind, l.price, note];
};

/** The gaps that stop a publish (the database refuses the same three): 'title', 'photos', 'listings'. Format limits are checked as typed. */
export const publishProblems = (work, listings) => {
  const out = [];
  if (!String(work.title || '').trim()) out.push('title');
  if (!(work.photos || []).length) out.push('photos');
  if (!(listings || []).some((l) => l.status === 'draft' || l.status === 'live')) out.push('listings');
  return out;
};

export const PROBLEM_TEXT = {
  title: 'Add a title. It shows on the wall label.',
  photos: 'Add at least one photo.',
  listings: 'Add at least one Listing with a price.',
};

const THIS_YEAR = () => new Date().getFullYear();
/** {field: message} for what is typed in the details (not what is missing to publish). Empty when every filled field is acceptable. */
export function validateDetails(v, year = THIS_YEAR()) {
  const e = {};
  if (v.title.length > 100) e.title = 'Use 100 characters or fewer.';
  if (v.description.length > 1000) e.description = 'Use 1000 characters or fewer.';
  if (v.year !== '' && !(/^\d{4}$/.test(String(v.year)) && Number(v.year) >= 1900 && Number(v.year) <= year)) e.year = `Enter a year from 1900 to ${year}.`;
  if (v.medium.length > 100) e.medium = 'Use 100 characters or fewer.';
  return e;
}

/** What a Listing dialog's values must be: {field: message}; price in whole rupees, stock 1 to 1000 (an Original is fixed at 1). */
export function validateListing(v, { held = 0 } = {}) {
  const e = {};
  if (!v.size.trim()) e.size = 'Enter the size.'; else if (v.size.trim().length > 60) e.size = 'Use 60 characters or fewer.';
  if (!v.medium.trim()) e.medium = 'Enter the medium and finish.'; else if (v.medium.trim().length > 60) e.medium = 'Use 60 characters or fewer.';
  const price = Number(v.price);
  if (v.price === '' || !Number.isInteger(price) || price < 1 || price > 10_000_000) e.price = 'Enter a price of at least ₹1.';
  if (v.kind !== 'original') {
    const stock = Number(v.stock);
    if (v.stock === '' || !Number.isInteger(stock) || stock < 1 || stock > 1000) e.stock = 'Enter how many you have, from 1 to 1000.';
    else if (stock < held) e.stock = `${held} are in someone’s checkout right now.`;
  }
  return e;
}

/** The storage path ("artworks/<uid>/<file>") of one of our own public URLs, or null for anything else (a pasted link). */
export const storagePath = (url, bucket) => {
  const marker = `/object/public/${bucket}/`;
  const i = (url || '').indexOf(marker);
  return i < 0 ? null : `${bucket}/${url.slice(i + marker.length)}`;
};
