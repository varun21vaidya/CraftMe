// Builds draft Payouts for every verified Artist with Payable Orders. Safe to run twice on the same day:
// the draft id is run date + Artist, a draft is rebuilt, a sent Payout is never touched.

const {payoutRun} = require("../domain/money");
const {istDay} = require("./time");

const MAX_ORDERS_PER_RUN = 500; // shortcut: one run handles 500 Orders, run again if more are Payable

async function buildRun(db, now) {
  const runDate = istDay(now);
  const snap = await db.collection("orders").where("payable", "==", true).where("payoutId", "==", null)
      .limit(MAX_ORDERS_PER_RUN).get();
  const byArtist = new Map();
  snap.docs.forEach((d) => {
    const list = byArtist.get(d.data().artistId) || [];
    list.push({id: d.id, ...d.data()});
    byArtist.set(d.data().artistId, list);
  });

  const created = [];
  const blocked = [];
  for (const [artistId, orders] of byArtist) {
    const priv = (await db.doc(`artistPrivate/${artistId}`).get()).data() || {};
    if (!priv.verifiedByAdminAt) {
      blocked.push(artistId);
      continue;
    }
    const ref = db.doc(`payouts/${runDate}_${artistId}`);
    if ((await ref.get()).data()?.status === "sent") continue;
    const run = payoutRun(orders.map((o) => ({
      pricePaise: o.total, refundsPaise: o.refundedTotal || 0, gatewayFeePaise: o.gatewayFee || 0, rateBp: o.commissionBps || 0,
    })), priv.amountOwed || 0);
    await ref.set({
      artistId, runDate, orderIds: orders.map((o) => o.id), gross: run.gross, refunds: run.refunds,
      commission: run.commission, gatewayFees: run.fees, owedDeducted: run.owedDeducted, net: run.net,
      owedLeft: run.owedLeft, method: priv.payoutMethod || null, reference: null, sentAt: null,
      status: "draft", createdAt: now,
    });
    created.push(ref.id);
  }
  return {created, blocked};
}

module.exports = {buildRun};
