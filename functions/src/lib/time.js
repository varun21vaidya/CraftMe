const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Calendar day in India Standard Time as yyyy-mm-dd. Business days (analytics, Payout runs) use this, never UTC. */
const istDay = (ms) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

module.exports = {istDay};
