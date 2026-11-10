// Reel links an Artist pastes. Must match the database check in migrations/0008_reels.sql.
const REEL = /^https:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)\/?(?:\?.*)?$/;

/** The short code of a reel link, or null when the link is not an Instagram reel. */
export const reelCode = (url) => REEL.exec((url || '').trim())?.[1] ?? null;

/** Embed page for a reel (loaded only after a visitor taps). */
export const reelEmbedUrl = (code) => `https://www.instagram.com/reel/${code}/embed/`;
