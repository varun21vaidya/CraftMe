// Damage Reports, Refunds, Reviews and Reports. Rules for windows and amounts come from ../domain.

const yup = require("yup");
const {FieldValue} = require("firebase-admin/firestore");
const {CommandError} = require("../lib/envelope");
const {ALREADY_EXISTS} = require("../lib/notify");
const {owedAfterRefund} = require("../domain/money");
const {advance, touch, allowedActions, isRefundable} = require("../domain/order");

const reportDamage = {
  spec: {
    role: "buyer",
    schema: yup.object({
      orderId: yup.string().required(),
      lineIds: yup.array().of(yup.string().required()).min(1).required(),
      note: yup.string().trim().max(500).required(),
      photoPaths: yup.array().of(yup.string().required()).max(5).default([]),
    }),
  },
  async handler({uid, input, now, db}) {
    // photos must sit in the caller's own folder (the Storage rules enforce the same)
    if (!input.photoPaths.every((p) => p.startsWith(`damage/${uid}/`))) throw new CommandError("invalid", null, {fields: ["photoPaths"]});
    const orderRef = db.doc(`orders/${input.orderId}`);
    try {
      return await db.runTransaction(async (tx) => {
        const order = (await tx.get(orderRef)).data();
        if (!order) throw new CommandError("conflict", "not_found");
        if (order.buyerId !== uid) throw new CommandError("forbidden");
        if (order.stage !== "received") throw new CommandError("conflict", "wrong_stage");
        if (order.damageReported) throw new CommandError("conflict", "already_exists");
        if (!allowedActions(order, "buyer", now).canReportDamage) throw new CommandError("conflict", "window_closed");
        const known = new Set(order.lines.map((l) => l.listingId));
        if (!input.lineIds.every((id) => known.has(id))) throw new CommandError("invalid", null, {fields: ["lineIds"]});
        tx.create(db.doc(`damageReports/${input.orderId}`), {
          orderId: input.orderId, buyerId: uid, artistId: order.artistId, lineIds: input.lineIds,
          photos: input.photoPaths, note: input.note, status: "open", decision: null, createdAt: now,
        });
        tx.update(orderRef, touch(order, {openReport: true, damageReported: true}, now));
        return {reportId: input.orderId};
      });
    } catch (e) {
      if (e.code === ALREADY_EXISTS) throw new CommandError("conflict", "already_exists");
      throw e;
    }
  },
};

const decideDamage = {
  spec: {
    role: "admin",
    schema: yup.object({
      orderId: yup.string().required(),
      decision: yup.string().oneOf(["upheld", "rejected"]).required(),
      note: yup.string().trim().max(500).default(""),
    }),
  },
  async handler({uid, input, now, db}) {
    const reportRef = db.doc(`damageReports/${input.orderId}`);
    const orderRef = db.doc(`orders/${input.orderId}`);
    return db.runTransaction(async (tx) => {
      const [report, order] = await Promise.all([tx.get(reportRef), tx.get(orderRef)]);
      if (!report.exists) throw new CommandError("conflict", "not_found");
      if (report.data().status !== "open") throw new CommandError("conflict", "already_decided");
      tx.update(reportRef, {status: input.decision, decision: input.note, decidedAt: now, decidedBy: uid});
      tx.update(orderRef, touch(order.data(), {openReport: false}, now));
      return {status: input.decision};
    });
  },
};

/**
 * Reserve the Refund in the Order first (so two Admins cannot refund the same lines), call the provider,
 * then confirm. If the provider call fails the reservation stays (status "unknown") until the Admin checks the provider.
 */
const issueRefund = {
  spec: {
    role: "admin",
    schema: yup.object({
      orderId: yup.string().required(),
      lines: yup.array().of(yup.object({lineId: yup.string().required(), quantity: yup.number().integer().min(1).required()}))
          .min(1).required(),
      reason: yup.string().trim().max(300).required(),
    }),
  },
  async handler({input, now, db, ports}) {
    const orderRef = db.doc(`orders/${input.orderId}`);
    const refundRef = db.collection("refunds").doc();

    const reserved = await db.runTransaction(async (tx) => {
      const order = (await tx.get(orderRef)).data();
      if (!order) throw new CommandError("conflict", "not_found");
      if (!isRefundable(order.stage)) throw new CommandError("conflict", "wrong_stage");
      const lines = order.lines.map((l) => ({...l}));
      let amount = 0;
      const refundLines = input.lines.map((r) => {
        const l = lines.find((x) => x.listingId === r.lineId);
        if (!l || r.quantity > l.quantity - (l.refundedQuantity || 0)) throw new CommandError("conflict", "exceeds_paid");
        l.refundedQuantity = (l.refundedQuantity || 0) + r.quantity;
        amount += l.unitPaise * r.quantity;
        return {lineId: r.lineId, quantity: r.quantity, amount: l.unitPaise * r.quantity};
      });
      const refundedBefore = order.refundedTotal || 0;
      if (refundedBefore + amount > order.total) throw new CommandError("conflict", "exceeds_paid");

      const afterPayout = Boolean(order.payoutId);
      const owedDelta = afterPayout ? owedAfterRefund({
        pricePaise: order.total, refundedBeforePaise: refundedBefore, refundPaise: amount, rateBp: order.commissionBps || 0,
      }) : 0;
      let owedSnap = null;
      if (owedDelta) owedSnap = await tx.get(db.doc(`artistPrivate/${order.artistId}`));

      const refundedTotal = refundedBefore + amount;
      const fully = lines.every((l) => (l.refundedQuantity || 0) >= l.quantity);
      const patch = {lines, refundedTotal};
      const update = fully ? advance(order, "refundAll", patch, now) : touch(order, patch, now);
      tx.update(orderRef, update);
      if (owedDelta) {
        const was = owedSnap.data().amountOwed || 0;
        tx.update(owedSnap.ref, {amountOwed: FieldValue.increment(owedDelta), ...(was === 0 ? {owedSince: now} : {})});
      }
      tx.set(refundRef, {
        orderId: input.orderId, buyerId: order.buyerId, artistId: order.artistId, lines: refundLines, amount,
        reason: input.reason, razorpayRefundId: null, status: "pending", afterPayout, createdAt: now,
        undo: {lines: order.lines, refundedTotal: refundedBefore, stage: order.stage},
      });
      return {amount, paymentId: order.razorpayPaymentId, artistId: order.artistId, owedDelta, order};
    });

    let provider;
    try {
      provider = await ports.payments.refund(reserved.paymentId, reserved.amount);
    } catch (e) {
      // A timeout may hide a refund the provider did make, so never undo: keep the reservation (a retry is
      // refused as exceeds_paid) and let the Admin check the provider dashboard.
      await refundRef.update({status: "unknown"});
      throw new CommandError("unavailable", "refund_unknown");
    }
    await refundRef.update({razorpayRefundId: provider.id, status: "issued", undo: FieldValue.delete()});
    return {refundId: refundRef.id, amount: reserved.amount};
  },
};

const submitReview = {
  spec: {
    role: "buyer",
    schema: yup.object({
      orderId: yup.string().required(),
      rating: yup.number().integer().min(1).max(5).required(),
      comment: yup.string().trim().max(500).required(),
    }),
  },
  async handler({uid, claims, input, now, db}) {
    const orderRef = db.doc(`orders/${input.orderId}`);
    try {
      return await db.runTransaction(async (tx) => {
        const order = (await tx.get(orderRef)).data();
        if (!order) throw new CommandError("conflict", "not_found");
        if (order.buyerId !== uid) throw new CommandError("forbidden");
        if (order.stage !== "received") throw new CommandError("conflict", "wrong_stage");
        if (order.reviewed) throw new CommandError("conflict", "already_exists");
        if (!allowedActions(order, "buyer", now).canReview) throw new CommandError("conflict", "window_closed");
        const buyerName = String(claims.name || "").split(" ")[0] || "Buyer";
        tx.create(db.doc(`reviews/${input.orderId}`), {
          artistId: order.artistId, buyerId: uid, buyerName, rating: input.rating, comment: input.comment,
          status: "pending", createdAt: now,
        });
        tx.update(orderRef, touch(order, {reviewed: true}, now));
        return {reviewId: input.orderId};
      });
    } catch (e) {
      if (e.code === ALREADY_EXISTS) throw new CommandError("conflict", "already_exists");
      throw e;
    }
  },
};

const decideReview = {
  spec: {
    role: "admin",
    schema: yup.object({reviewId: yup.string().required(), decision: yup.string().oneOf(["approved", "rejected"]).required()}),
  },
  async handler({uid, input, now, db}) {
    const reviewRef = db.doc(`reviews/${input.reviewId}`);
    return db.runTransaction(async (tx) => {
      const review = (await tx.get(reviewRef)).data();
      if (!review) throw new CommandError("conflict", "not_found");
      if (review.status !== "pending") throw new CommandError("conflict", "already_decided");
      const artistRef = db.doc(`users/${review.artistId}`);
      const artist = input.decision === "approved" ? (await tx.get(artistRef)).data() || {} : null;
      tx.update(reviewRef, {status: input.decision, decidedAt: now, decidedBy: uid});
      if (artist) { // a rejection never touches the average
        const ratingCount = (artist.ratingCount || 0) + 1;
        const ratingSum = (artist.ratingSum || 0) + review.rating;
        tx.set(artistRef, {ratingCount, ratingSum, ratingAvg: Math.round((ratingSum / ratingCount) * 100) / 100}, {merge: true});
      }
      return {status: input.decision};
    });
  },
};

const report = {
  spec: {
    role: "buyer",
    schema: yup.object({
      targetType: yup.string().oneOf(["artwork", "artist"]).required(),
      targetId: yup.string().required(),
      reason: yup.string().trim().max(500).required(),
    }),
  },
  async handler({uid, input, now, db}) {
    const ref = await db.collection("reports").add({...input, reporterId: uid, status: "open", createdAt: now});
    return {reportId: ref.id};
  },
};

module.exports = {commands: {reportDamage, decideDamage, issueRefund, submitReview, decideReview, report}};
