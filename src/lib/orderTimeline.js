// What happened to an Order, newest first, for the order page. Pure: every date comes from the order row.
import { formatDay, formatINR, methodLabel } from './format';

const first = (name) => String(name || 'the Artist').trim().split(/\s+/)[0];

/** Received by the sweep, not the buyer: the 14-day mark had passed (0019 keeps no separate column). */
export const receivedAutomatically = (o) => Boolean(o.receivedAt && o.autoReceiveAt && o.receivedAt >= o.autoReceiveAt);

/**
 * items: { label, at?, note?, state: 'done' | 'now' | 'failed' }. Dated events are sorted by time; the one "now" entry
 * (what the order is waiting for) is always the newest.
 */
export function orderTimeline(o) {
  const artist = first(o.artist?.displayName);
  const events = [];
  if (o.paidAt) events.push({ label: `Paid ${formatINR(o.total)}`, at: o.paidAt, note: methodLabel(o.paymentMethod), state: 'done' });
  if (o.shippedAt) events.push({ label: `Shipped by ${artist}${o.trackingNumber ? `, tracking ${o.trackingNumber}` : ''}`, at: o.shippedAt, state: 'done' });
  if (o.receivedAt) {
    events.push({ label: 'Received', at: o.receivedAt, note: receivedAutomatically(o) ? 'marked Received automatically' : 'you confirmed', state: 'done' });
  }
  for (const d of o.damageReports || []) {
    events.push({ label: 'You told us it arrived damaged', at: d.createdAt, state: 'done' });
    if (d.decidedAt) {
      events.push({ label: d.status === 'upheld' ? 'CraftMe agreed to refund you' : 'CraftMe looked at your report', at: d.decidedAt, state: 'done' });
    }
  }
  for (const r of o.refunds || []) {
    const issued = r.status === 'issued';
    events.push({ label: issued ? `Refund of ${formatINR(r.amount)} issued` : `Refund of ${formatINR(r.amount)} being processed`, at: r.createdAt, state: issued ? 'done' : 'now' });
  }
  events.sort((a, b) => a.at - b.at);

  if (o.stage === 'paid') events.push({ label: `Waiting for ${artist} to ship`, note: o.shipBy ? `deadline ${formatDay(o.shipBy)}` : '', state: o.overdue ? 'failed' : 'now' });
  if (o.stage === 'shipped') events.push({ label: 'Waiting for you to confirm it arrived', note: o.autoReceiveAt ? `auto-received ${formatDay(o.autoReceiveAt)}` : '', state: 'now' });
  if (o.stage === 'hold') events.push({ label: 'Waiting for your payment', state: 'now' });
  if (o.stage === 'hold_expired') events.push({ label: 'The time to pay ran out', state: 'failed' });
  return events.reverse();
}
