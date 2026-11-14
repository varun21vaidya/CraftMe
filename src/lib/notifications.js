import { formatDay, formatINR } from './format';

const code = (d) => d?.code || 'your Order';
const by = (iso) => (iso && !Number.isNaN(Date.parse(iso)) ? formatDay(Date.parse(iso)) : '');

// Wording per type: the data only carries ids and numbers. category feeds the Orders and Reviews chips;
// "shop" notices show under All and Unread only.
const TEXT = {
  order_paid: (d) => ({ title: `Payment received for ${code(d)}`, detail: d.amount ? `${formatINR(d.amount)} paid. The Artist will ship it soon.` : 'The Artist will ship it soon.', icon: 'check', category: 'orders' }),
  order_shipped: (d) => ({ title: `Your Order ${code(d)} was Shipped`, detail: 'It is on its way to you.', icon: 'package', category: 'orders' }),
  review_prompt: (d) => ({
    title: d.auto ? `${code(d)} was marked Received` : `How is your Order ${code(d)}?`,
    detail: by(d.reviewBy) ? `Write a Review by ${by(d.reviewBy)}.` : 'Write a Review.', icon: 'star', category: 'reviews',
  }),
  refund_issued: (d) => ({ title: `Refund of ${formatINR(d.amount)} issued for ${code(d)}`, detail: 'It goes back to the way you paid.', icon: 'receipt', category: 'orders' }),
  damage_upheld: (d) => ({ title: `Your Damage Report for ${code(d)} was decided`, detail: 'CraftMe upheld your report.', icon: 'alert', category: 'orders' }),
  damage_rejected: (d) => ({ title: `Your Damage Report for ${code(d)} was decided`, detail: 'CraftMe did not uphold your report.', icon: 'alert', category: 'orders' }),
  review_approved: () => ({ title: 'Your Review is now public', detail: 'Thank you for helping other buyers.', icon: 'star', category: 'reviews' }),
  review_rejected: () => ({ title: 'Your Review wasn’t published', detail: 'It didn’t meet our Review rules.', icon: 'star', category: 'reviews' }),
  order_new: (d) => ({ title: `New Order ${code(d)} to ship`, detail: 'Pack it and add the tracking details.', icon: 'package', category: 'orders' }),
  ship_reminder: () => ({ title: 'An Order is waiting to be shipped', detail: 'Ship it before the date shown on the Order.', icon: 'clock', category: 'orders' }),
  order_received: (d) => ({ title: `Order ${code(d)} was Received`, detail: 'The buyer has it.', icon: 'check', category: 'orders' }),
  damage_reported: (d) => ({ title: `Damage Report on ${code(d)}`, detail: 'CraftMe will look at the photos and decide.', icon: 'alert', category: 'orders' }),
  damage_decided: (d) => ({ title: `Damage Report for ${code(d)} was decided`, detail: 'Open the Order to see the decision.', icon: 'alert', category: 'orders' }),
  review_new: () => ({ title: 'You have a new Review', detail: 'It is now on your page.', icon: 'star', category: 'reviews' }),
  payout_sent: (d) => ({ title: `${formatINR(d.net)} was paid to you`, detail: d.reference ? `Reference ${d.reference}.` : 'Your payout was sent.', icon: 'receipt', category: 'shop' }),
  artist_verified: () => ({ title: 'CraftMe verified your shop', detail: 'Payouts can now be sent to you.', icon: 'check', category: 'shop' }),
  shop_restricted: () => ({ title: 'Your shop is paused', detail: 'Buyers can’t order your work for now. Open settings to see why.', icon: 'alert', category: 'shop' }),
  shop_reinstated: () => ({ title: 'Your shop is open again', detail: 'Buyers can order your work.', icon: 'check', category: 'shop' }),
  instagram_reconnect: () => ({ title: 'Reconnect Instagram to keep your posts showing', detail: 'The link to Instagram needs renewing.', icon: 'info', category: 'shop' }),
  order_refunded: (d) => ({ title: `Your Order ${code(d)} was refunded`, detail: 'This notice is from before refunds showed amounts.', icon: 'receipt', category: 'orders' }), // old rows only
};

/** What a notification says: { title, detail, icon, category }. An unknown type reads "Update". */
export const notificationText = (type, data) => (TEXT[type] || (() => ({ title: 'Update', detail: '', icon: 'bell', category: 'shop' })))(data || {});

/** The notification types that belong to one category ('orders', 'reviews', 'shop'), for filtering on the server. */
export const notificationTypes = (category) => Object.keys(TEXT).filter((t) => TEXT[t]({}).category === category);

// Until P07 builds the Artist's Order page and payouts, their notices open the Orders list.
const ARTIST_ORDERS = '/dashboard/orders';

/**
 * Where a clicked notification goes, or null when there is nowhere sensible to go (an unknown type).
 * A missing id falls back to the list page for its kind. `me` is the reader's own id, for their Artist page.
 */
export const notificationTarget = (type, data, me) => {
  const id = data?.orderId;
  switch (type) {
    case 'order_paid':
    case 'order_shipped':
    case 'refund_issued':
    case 'order_refunded':
      return id ? `/orders/${id}` : '/orders';
    case 'review_prompt':
    case 'review_approved':
    case 'review_rejected':
      return id ? `/orders/${id}/review` : '/orders';
    case 'damage_upheld':
    case 'damage_rejected':
      return id ? `/orders/${id}/damage` : '/orders';
    case 'order_new':
    case 'ship_reminder':
    case 'order_received':
    case 'damage_reported':
    case 'damage_decided':
    case 'payout_sent':
      return ARTIST_ORDERS;
    case 'review_new':
      return me ? `/artist/${me}?tab=reviews` : ARTIST_ORDERS;
    case 'artist_verified':
    case 'shop_restricted':
    case 'shop_reinstated':
    case 'instagram_reconnect': // the existing test pins this to settings, where the Instagram card sits for now
      return '/dashboard/settings';
    default:
      return null;
  }
};
