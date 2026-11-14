// Display helpers. Money arrives as whole paise and is formatted only here.

export const formatINR = (paise) => {
  const rupees = (paise || 0) / 100;
  return '₹' + rupees.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
    maximumFractionDigits: 2,
  });
};

export const formatClock = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const formatDate = (ms) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** "Just now", "5 min ago", "2 h ago", then a date: the age of a notification. */
export const formatAgo = (ms, now = Date.now()) => {
  const minutes = Math.floor((now - ms) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return formatDate(ms);
};

/** "3 Nov" for deadlines inside a sentence. */
export const formatDay = (ms) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

/** "3 NOV · 11:42" for timeline entries. */
export const formatStamp = (ms) => {
  const d = new Date(ms);
  return `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase()} · ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
};

// Labels for the order stages, in the customer's words.
export const STAGE_LABEL = {
  hold: 'Waiting for payment', hold_expired: 'Expired', paid: 'Paid, being packed', shipped: 'On its way',
  received: 'Received', refunded: 'Refunded',
};

/** The short badge on order rows and the order page: [label, badge class]. */
export const STAGE_BADGE = {
  hold: ['Waiting for payment', 'warn'], hold_expired: ['Expired', ''], paid: ['Paid', 'ok'], shipped: ['Shipped', 'info'],
  received: ['Received', 'ok'], refunded: ['Refunded', 'err'],
};

export const KIND_LABEL = { original: 'Original', print: 'Print', product: 'Ready-made' };

export const REFUND_STATUS_LABEL = { issued: 'Issued', pending: 'Processing', unknown: 'Processing' };

/** Razorpay's payment method codes in the buyer's words. */
export const methodLabel = (m) => ({ upi: 'UPI', card: 'Card', netbanking: 'Netbanking', wallet: 'Wallet', emi: 'EMI', paylater: 'Pay later' }[m] || m || '');

// The backend sends codes and reasons, never wording. All customer-facing text for them lives here.
const reasonText = {
  sold: 'Someone else just bought this one.',
  mixed_artists: 'A Cart holds one Artist’s work at a time. Check out first, or start a new Cart.',
  price_changed: 'A price changed since you added it. Please check your Cart.',
  own_listing: 'You can’t buy your own work.',
  artist_restricted: 'This Artist isn’t selling right now.',
  too_many_holds: 'You have a few payments waiting. Finish or wait a few minutes before starting another.',
  payments_down: 'Payments aren’t available right now. Please try again in a moment.',
  payments_not_configured: 'Payments aren’t set up on this site yet.',
  fake_mode_in_production: 'Payments aren’t set up on this site yet.',
  hold_over: 'The time to pay for that Order ran out.',
  bad_signature: 'We couldn’t confirm that payment. If money left your account, it will be returned.',
  amount_mismatch: 'We couldn’t confirm that payment. If money left your account, it will be returned.',
  sold_during_payment: 'It sold while you were paying. Your money is being returned.',
  window_closed: 'The time for this has passed.',
  wrong_stage: 'This can’t be done at this stage of the order.',
  already_exists: 'You’ve already done this.',
  already_decided: 'That has already been decided.',
  in_progress: 'Still working on your last request.',
  not_found: 'We couldn’t find that.',
  disabled: 'This isn’t available yet.',
  personal_account: 'Only Business or Creator Instagram accounts can be connected.',
  verification_or_fee_missing: 'Finish your details and the joining fee first.',
  verification_missing: 'Add your details first.',
  artists_closed: 'CraftMe isn’t taking new Artists right now.',
  phone_not_verified: 'Your number isn’t verified yet.',
  fee_not_set: 'The fee to open a shop isn’t set yet. Please check back soon.',
  already_paid: 'Your joining fee is already paid.',
  wrong_code: 'That code isn’t right. Check it and try again.',
  code_expired: 'That code has expired. Send a new one.',
  phone_rate: 'Too many tries. Wait a minute, then try again.',
  phone_taken: 'That number is already used on another CraftMe account.',
  phone_down: 'Phone checks aren’t working right now. Please try again later.',
};
const codeText = {
  unauthenticated: 'Please log in to continue.',
  forbidden: 'You don’t have access to do that.',
  invalid: 'Please check what you entered.',
  rate_limited: 'Too many tries. Please wait a little.',
  unavailable: 'We couldn’t reach CraftMe. Please try again.',
};

/** What each field the server can name (the `fields` of an `invalid` result) means to the buyer. */
export const FIELD_TEXT = {
  lineIds: 'Choose at least one item.', kind: 'Choose the type of damage.', note: 'Describe what happened.', photoPaths: 'Add at least 2 photos.',
  rating: 'Pick a rating.', comment: 'Write a few words.',
};

export const errorText = (error) => reasonText[error?.reason] || codeText[error?.code] || 'Something went wrong. Please try again.';
