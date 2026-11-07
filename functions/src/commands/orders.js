// Ordering and fulfilment commands. Stage and money rules come from ../domain; this file orchestrates.

const yup = require("yup");
const {FieldValue} = require("firebase-admin/firestore");
const {CommandError} = require("../lib/envelope");
const {orderTotal} = require("../domain/money");
const {advance, patches, WINDOWS} = require("../domain/order");
const {markPaid} = require("../lib/paid");
const {expireHold} = require("../lib/hold");

const MAX_OPEN_HOLDS = 3; // one Buyer cannot lock many Originals

const address = yup.object({
  name: yup.string().trim().max(100).required(),
  phone: yup.string().matches(/^[6-9]\d{9}$/).required(),
  address: yup.string().trim().max(300).required(),
  city: yup.string().trim().max(80).required(),
  state: yup.string().trim().max(80).required(),
  pin: yup.string().matches(/^\d{6}$/).required(),
}).required();

const line = yup.object({
  listingId: yup.string().required(),
  quantity: yup.number().integer().min(1).max(10).required(),
  // the price the Buyer was shown: used only to notice a change, never to charge
  seenUnitPaise: yup.number().integer().min(0),
});

const placeOrder = {
  spec: {
    role: "buyer",
    schema: yup.object({
      artistId: yup.string().required(),
      lines: yup.array().of(line).min(1).max(20).required()
          .test("unique", "duplicate listing", (ls) => new Set(ls.map((l) => l.listingId)).size === ls.length),
      address,
    }),
  },
  async handler({uid, input, now, db, ports}) {
    if (uid === input.artistId) throw new CommandError("conflict", "own_listing");

    const open = await db.collection("orders").where("buyerId", "==", uid).where("stage", "==", "hold").limit(10).get();
    if (open.docs.filter((d) => d.data().holdUntil > now).length >= MAX_OPEN_HOLDS) {
      throw new CommandError("rate_limited", "too_many_holds");
    }

    const orderRef = db.collection("orders").doc();
    const holdUntil = now + WINDOWS.hold;
    const total = await db.runTransaction(async (tx) => {
      const snaps = await Promise.all(input.lines.map((l) => tx.get(db.doc(`listings/${l.listingId}`))));
      const lines = [];
      const changed = [];
      input.lines.forEach((l, i) => {
        const x = snaps[i].data();
        if (!x || x.status !== "live") throw new CommandError("conflict", "sold", {listingId: l.listingId});
        if (x.artistId !== input.artistId) throw new CommandError("conflict", "mixed_artists");
        if (x.artistOpen !== true) throw new CommandError("conflict", "artist_restricted");
        if ((x.stock || 0) - (x.held || 0) < l.quantity) throw new CommandError("conflict", "sold", {listingId: l.listingId});
        if (l.seenUnitPaise !== undefined && l.seenUnitPaise !== x.price) {
          changed.push({listingId: l.listingId, unitPaise: x.price});
        }
        lines.push({
          listingId: l.listingId, artworkId: x.artworkId, title: x.title || "", kind: x.kind,
          unitPaise: x.price, quantity: l.quantity, refundedQuantity: 0,
        });
      });
      if (changed.length) throw new CommandError("conflict", "price_changed", {changedLines: changed});

      const sum = orderTotal(lines.map((l) => ({unitPaise: l.unitPaise, qty: l.quantity})));
      const order = {
        buyerId: uid, artistId: input.artistId, code: orderRef.id.slice(0, 6).toUpperCase(), lines, total: sum,
        stage: "hold", holdUntil, createdAt: now, gatewayFee: 0, refundedTotal: 0, payable: false, payoutId: null,
        openReport: false, razorpayOrderId: null,
      };
      lines.forEach((l, i) => tx.update(snaps[i].ref, {held: FieldValue.increment(l.quantity)}));
      tx.set(orderRef, {...order, ...advance({...order, stage: null}, "place", {}, now)});
      tx.set(orderRef.collection("private").doc("shipping"), input.address);
      return sum;
    });

    let rz;
    try {
      rz = await ports.payments.createOrder(total, orderRef.id);
    } catch {
      await expireHold(db, orderRef.id, now); // release the stock; the Buyer can try again
      throw new CommandError("unavailable", "payments_down");
    }
    await orderRef.update({razorpayOrderId: rz.id});
    return {orderId: orderRef.id, razorpayOrderId: rz.id, keyId: ports.payments.keyId, amount: total, holdUntil};
  },
};

const confirmPayment = {
  spec: {
    role: "buyer",
    schema: yup.object({
      orderId: yup.string().required(),
      razorpayOrderId: yup.string().required(),
      razorpayPaymentId: yup.string().required(),
      signature: yup.string().required(),
    }),
  },
  async handler(ctx) {
    const {uid, input, db, ports} = ctx;
    const order = (await db.doc(`orders/${input.orderId}`).get()).data();
    if (!order) throw new CommandError("conflict", "not_found");
    if (order.buyerId !== uid) throw new CommandError("forbidden");
    if (input.razorpayOrderId !== order.razorpayOrderId || !ports.payments.verifySignature(input)) {
      throw new CommandError("conflict", "bad_signature");
    }
    return markPaid(ctx, input.orderId, input.razorpayPaymentId);
  },
};

/** Load the Order inside a transaction, check who may act, move the stage. One shape for ship and receive. */
const move = (event, who, patchFor) => async ({uid, input, now, db}) => {
  const ref = db.doc(`orders/${input.orderId}`);
  return db.runTransaction(async (tx) => {
    const order = (await tx.get(ref)).data();
    if (!order) throw new CommandError("conflict", "not_found");
    if (order[who] !== uid) throw new CommandError("forbidden");
    const update = advance(order, event, patchFor(now, input), now);
    if (!update) throw new CommandError("conflict", "wrong_stage");
    tx.update(ref, update);
    return {stage: update.stage, ...(update.reviewBy ? {reviewBy: update.reviewBy} : {})};
  });
};

const markShipped = {
  spec: {
    role: "artist",
    schema: yup.object({
      orderId: yup.string().required(),
      courier: yup.string().trim().max(60).required(),
      trackingNumber: yup.string().trim().max(60).default(""),
    }),
  },
  handler: move("ship", "artistId", (now, i) => patches.shipped(now, {courier: i.courier, trackingNumber: i.trackingNumber})),
};

const confirmReceived = {
  spec: {role: "buyer", schema: yup.object({orderId: yup.string().required()})},
  handler: move("receive", "buyerId", (now) => patches.received(now)),
};

module.exports = {commands: {placeOrder, confirmPayment, markShipped, confirmReceived}};
