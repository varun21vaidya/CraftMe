// Order stages and allowed actions. The only place stage rules live. Pure: times are epoch milliseconds.

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const WINDOWS = {
  hold: 15 * MINUTE,
  shipBy: 7 * DAY, // Paid + 7 days, then Overdue
  autoReceive: 14 * DAY, // Shipped + 14 days
  damage: 3 * DAY, // Received + 3 days
  review: 30 * DAY, // Received + 30 days
};

const STAGES = ["hold", "paid", "shipped", "received", "hold_expired", "refunded"];

// stage -> event -> next stage. A missing entry means the move is not allowed.
const TRANSITIONS = {
  none: {place: "hold"},
  hold: {pay: "paid", expire: "hold_expired"},
  hold_expired: {pay: "paid", refundAll: "refunded"}, // late payment: accepted if stock is free, else refunded
  paid: {ship: "shipped", refundAll: "refunded"},
  shipped: {receive: "received", refundAll: "refunded"},
  received: {refundAll: "refunded"},
  refunded: {},
};

/** @returns {string|null} the next stage, or null when the event is not allowed in this stage. */
const next = (stage, event) => TRANSITIONS[stage || "none"]?.[event] ?? null;

const isRefundable = (stage) => ["paid", "shipped", "received"].includes(stage);

/** Booleans the UI shows buttons from. role: "buyer" | "artist". */
const allowedActions = (order, role, now) => {
  if (role === "artist") {
    return {
      canShip: order.stage === "paid",
      canViewAddress: ["paid", "shipped", "received"].includes(order.stage),
    };
  }
  const received = order.stage === "received";
  return {
    canPay: order.stage === "hold" && now < order.holdUntil,
    canConfirmReceived: order.stage === "shipped",
    canReportDamage: received && !order.openReport && !order.damageReported && now <= order.damageWindowEnds,
    canReview: received && !order.reviewed && now <= order.reviewBy,
  };
};

const withActions = (order, now) => ({
  buyerActions: allowedActions(order, "buyer", now),
  artistActions: allowedActions(order, "artist", now),
});

/** A change that keeps the stage but must refresh the stored actions (e.g. a Damage Report opened). */
const touch = (order, patch, now) => ({...patch, ...withActions({...order, ...patch}, now)});

/** Fields set when a stage is entered; shared by the commands and the sweep. */
const patches = {
  paid: (now, extra) => ({paidAt: now, shipBy: now + WINDOWS.shipBy, reminded: false, overdue: false, ...extra}),
  shipped: (now, extra) => ({shippedAt: now, autoReceiveAt: now + WINDOWS.autoReceive, ...extra}),
  received: (now) => ({
    receivedAt: now, damageWindowEnds: now + WINDOWS.damage, reviewBy: now + WINDOWS.review,
    payable: false, openReport: false, damageReported: false, reviewed: false,
  }),
};

/**
 * One call for every stage change: returns the fields to write (stage, patch, fresh actions),
 * or null if the event is not allowed. Commands, the webhook and the sweep all use this.
 */
const advance = (order, event, patch, now) => {
  const stage = next(order.stage, event);
  if (!stage) return null;
  return {...patch, stage, ...withActions({...order, ...patch, stage}, now)};
};

module.exports = {STAGES, WINDOWS, DAY, MINUTE, next, isRefundable, allowedActions, withActions, touch, patches, advance};
