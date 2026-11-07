const {FieldValue} = require("firebase-admin/firestore");
const {advance} = require("../domain/order");

/** Ends a Checkout Hold: stage -> hold_expired and the held stock goes back. Safe to run twice. */
async function expireHold(db, orderId, now) {
  const ref = db.doc(`orders/${orderId}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const order = snap.data();
    if (!order || order.stage !== "hold") return false;
    const update = advance(order, "expire", {}, now);
    order.lines.forEach((l) => tx.update(db.doc(`listings/${l.listingId}`), {held: FieldValue.increment(-l.quantity)}));
    tx.update(ref, update);
    return true;
  });
}

module.exports = {expireHold};
