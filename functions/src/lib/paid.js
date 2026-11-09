// "A payment arrived": shared by the Buyer's callback and the provider webhook, so there is one rule.
// Both are idempotent: running again for an Order that is already paid changes nothing.

const {FieldValue} = require("firebase-admin/firestore");
const {CommandError} = require("./envelope");
const {advance, patches} = require("../domain/order");

const DEFAULT_COMMISSION_BPS = 1000; // placeholder until the Admin sets settings/business.commissionBps
// "refunded" counts as done: a late retry must never refund the same payment twice.
const PAID_OR_LATER = ["paid", "shipped", "received", "refunded"];

async function markPaid({db, ports, now}, orderId, paymentId) {
  const orderRef = db.doc(`orders/${orderId}`);
  const pre = (await orderRef.get()).data();
  if (!pre) throw new CommandError("conflict", "not_found");
  if (PAID_OR_LATER.includes(pre.stage)) return {stage: pre.stage};

  // Never trust the client or the event alone: ask the provider what was really paid.
  const payment = await ports.payments.fetchPayment(paymentId);
  if (payment.status !== "captured" || payment.amount !== pre.total || payment.orderId !== pre.razorpayOrderId) {
    throw new CommandError("conflict", "amount_mismatch");
  }
  const settings = (await db.doc("settings/business").get()).data() || {};
  const commissionBps = Number.isInteger(settings.commissionBps) ? settings.commissionBps : DEFAULT_COMMISSION_BPS;

  const outcome = await db.runTransaction(async (tx) => {
    const order = (await tx.get(orderRef)).data();
    if (PAID_OR_LATER.includes(order.stage)) return {stage: order.stage};
    const listings = await Promise.all(order.lines.map((l) => tx.get(db.doc(`listings/${l.listingId}`))));
    const wasHeld = order.stage === "hold";
    if (!wasHeld) { // the hold had expired: accept only if the stock is still free
      const short = order.lines.some((l, i) => {
        const x = listings[i].data();
        return !x || (x.stock || 0) - (x.held || 0) < l.quantity;
      });
      if (short) return {oversold: true};
    }
    const update = advance(order, "pay", patches.paid(now, {
      razorpayPaymentId: paymentId, gatewayFee: payment.fee, commissionBps,
    }), now);
    if (!update) throw new CommandError("conflict", "wrong_stage");
    order.lines.forEach((l, i) => {
      const stock = (listings[i].data().stock || 0) - l.quantity;
      tx.update(listings[i].ref, {
        stock,
        ...(wasHeld ? {held: FieldValue.increment(-l.quantity)} : {}),
        ...(stock <= 0 ? {status: "sold"} : {}),
      });
      tx.update(db.doc(`artworks/${l.artworkId}`), {hasSales: true});
    });
    tx.update(orderRef, update);
    return {stage: "paid"};
  });

  if (outcome.oversold) { // sold to someone else while this payment was in flight: the only automatic Refund
    const refund = await ports.payments.refund(paymentId, pre.total);
    const lines = pre.lines.map((l) => ({...l, refundedQuantity: l.quantity}));
    await orderRef.update(advance(pre, "refundAll", {
      razorpayPaymentId: paymentId, refundedTotal: pre.total, refundReason: "sold_during_payment", lines,
    }, now));
    await db.collection("refunds").add({
      orderId, buyerId: pre.buyerId, artistId: pre.artistId, amount: pre.total, reason: "sold_during_payment",
      lines: lines.map((l) => ({lineId: l.listingId, quantity: l.quantity, amount: l.unitPaise * l.quantity})),
      razorpayRefundId: refund.id, afterPayout: false, createdAt: now,
    });
    throw new CommandError("conflict", "sold_during_payment");
  }
  return outcome;
}

/** The Onboarding Fee payment arrived: record it on the Artist's private record. */
async function markFeePaid({db, ports, now}, razorpayOrderId, paymentId) {
  const found = await db.collection("artistPrivate").where("onboardingOrderId", "==", razorpayOrderId).limit(1).get();
  if (found.empty) return {ignored: true};
  const ref = found.docs[0].ref;
  const priv = found.docs[0].data();
  if (priv.onboardingPaidAt) return {paid: true};
  const payment = await ports.payments.fetchPayment(paymentId);
  if (payment.status !== "captured" || payment.amount !== priv.onboardingAmount || payment.orderId !== razorpayOrderId) {
    throw new CommandError("conflict", "amount_mismatch");
  }
  await ref.update({onboardingPaidAt: now, onboardingPaymentId: paymentId});
  return {paid: true};
}

module.exports = {markPaid, markFeePaid};
