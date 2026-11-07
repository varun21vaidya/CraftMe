// The 5-minute sweep: every time-based rule in one place. Each rule is a bounded, indexed query plus a
// per-document transaction that re-checks the condition, so running twice (or two runs overlapping) is harmless.

const {advance, patches, DAY} = require("./domain/order");
const {expireHold} = require("./lib/hold");
const {notify} = require("./lib/notify");
const {setStanding} = require("./lib/standing");

const BATCH = 200; // per rule per run; the rest waits for the next run
const OWED_LIMIT_MS = 60 * DAY;
const REMINDER_LEAD_MS = 2 * DAY; // Paid + 5 days = ship-by (Paid + 7) minus 2 days

/** Runs fn in a transaction on one order after re-reading it; fn returns true if it changed something. */
const withOrder = (db, id, fn) => db.runTransaction(async (tx) => {
  const ref = db.doc(`orders/${id}`);
  const order = (await tx.get(ref)).data();
  return order ? fn(tx, ref, order) : false;
});

const rules = {
  async expireHolds(db, now) {
    const snap = await db.collection("orders").where("stage", "==", "hold").where("holdUntil", "<=", now).limit(BATCH).get();
    let n = 0;
    for (const d of snap.docs) if (await expireHold(db, d.id, now)) n++;
    return n;
  },

  async shipReminder(db, now) {
    const snap = await db.collection("orders").where("stage", "==", "paid").where("reminded", "==", false)
        .where("shipBy", "<=", now + REMINDER_LEAD_MS).limit(BATCH).get();
    let n = 0;
    for (const d of snap.docs) {
      const changed = await withOrder(db, d.id, (tx, ref, o) => {
        if (o.stage !== "paid" || o.reminded) return false;
        tx.update(ref, {reminded: true});
        return true;
      });
      if (changed) {
        await notify(db, `${d.id}_reminder`, d.data().artistId, "ship_reminder", {orderId: d.id, shipBy: d.data().shipBy}, now);
        n++;
      }
    }
    return n;
  },

  async overdue(db, now) {
    const snap = await db.collection("orders").where("stage", "==", "paid").where("overdue", "==", false)
        .where("shipBy", "<=", now).limit(BATCH).get();
    let n = 0;
    for (const d of snap.docs) {
      const changed = await withOrder(db, d.id, (tx, ref, o) => {
        if (o.stage !== "paid" || o.overdue) return false;
        tx.update(ref, {overdue: true}); // the Admin queue is a query on overdue == true
        return true;
      });
      if (changed) n++;
    }
    return n;
  },

  async autoReceive(db, now) {
    const snap = await db.collection("orders").where("stage", "==", "shipped").where("autoReceiveAt", "<=", now).limit(BATCH).get();
    let n = 0;
    for (const d of snap.docs) {
      const changed = await withOrder(db, d.id, (tx, ref, o) => {
        const update = o.autoReceiveAt <= now && advance(o, "receive", patches.received(now), now);
        if (!update) return false;
        tx.update(ref, update);
        return true;
      });
      if (changed) n++;
    }
    return n;
  },

  async payable(db, now) {
    const snap = await db.collection("orders").where("stage", "==", "received").where("payable", "==", false)
        .where("openReport", "==", false).where("damageWindowEnds", "<=", now).limit(BATCH).get();
    let n = 0;
    for (const d of snap.docs) {
      const changed = await withOrder(db, d.id, (tx, ref, o) => {
        if (o.stage !== "received" || o.payable || o.openReport || o.damageWindowEnds > now) return false;
        tx.update(ref, {payable: true});
        return true;
      });
      if (changed) n++;
    }
    return n;
  },

  async restrictOwed(db, now) {
    // owedSince is null when nothing is owed, so a single range query finds only Artists who owe
    const snap = await db.collection("artistPrivate").where("owedSince", "<=", now - OWED_LIMIT_MS).limit(BATCH).get();
    let n = 0;
    for (const d of snap.docs) {
      if (!(d.data().amountOwed > 0)) continue;
      const user = (await db.doc(`users/${d.id}`).get()).data() || {};
      if (user.restricted) continue;
      await setStanding(db, d.id, true, "owed_60_days");
      n++;
    }
    return n;
  },
};

async function sweep(db, clock) {
  const now = clock.now();
  const counts = {};
  for (const [name, rule] of Object.entries(rules)) {
    try {
      counts[name] = await rule(db, now);
    } catch (e) { // one failing rule must not stop the others
      counts[name] = `error: ${e.message}`;
    }
  }
  await db.doc("system/sweepHeartbeat").set({lastRunAt: now, lastCounts: counts});
  return counts;
}

module.exports = {sweep};
