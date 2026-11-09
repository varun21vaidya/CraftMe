const yup = require("yup");
const {CommandError} = require("../lib/envelope");
const {buildRun, runFor} = require("../lib/payoutRun");

const buildPayoutRun = {
  spec: {role: "admin", schema: yup.object({})},
  handler: ({now, db}) => buildRun(db, now),
};

/** Marks one Artist's draft as sent. One transaction, so an Order can never be paid out twice. */
const recordPayout = {
  spec: {
    role: "admin",
    schema: yup.object({payoutId: yup.string().required(), reference: yup.string().trim().max(100).required()}),
  },
  async handler({input, now, db}) {
    const payoutRef = db.doc(`payouts/${input.payoutId}`);
    return db.runTransaction(async (tx) => {
      const payout = (await tx.get(payoutRef)).data();
      if (!payout) throw new CommandError("conflict", "not_found");
      if (payout.status !== "draft") throw new CommandError("conflict", "already_sent");
      const artistRef = db.doc(`artistPrivate/${payout.artistId}`);
      const [artist, ...orders] = await Promise.all([tx.get(artistRef), ...payout.orderIds.map((id) => tx.get(db.doc(`orders/${id}`)))]);
      if (!artist.data()?.verifiedByAdminAt) throw new CommandError("conflict", "artist_unverified");
      if (orders.some((o) => !o.exists || o.data().payoutId)) throw new CommandError("conflict", "already_sent");
      // The draft may be stale (a refund or new debt since it was built): recompute, and refuse if the money changed.
      const run = runFor(orders.map((o) => o.data()), artist.data().amountOwed || 0);
      if (run.net !== payout.net) throw new CommandError("conflict", "rebuild");
      orders.forEach((o) => tx.update(o.ref, {payoutId: input.payoutId}));
      tx.update(payoutRef, {status: "sent", reference: input.reference, sentAt: now});
      tx.update(artistRef, {amountOwed: run.owedLeft, ...(run.owedLeft === 0 ? {owedSince: null} : {})});
      return {status: "sent"};
    });
  },
};

module.exports = {commands: {buildPayoutRun, recordPayout}};
