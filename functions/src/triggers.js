// Reactions to data changes and the scheduled jobs. Every write here is idempotent (retried events are normal).

const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {onDocumentCreated, onDocumentWritten} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const v1 = require("firebase-functions/v1");
const logger = require("firebase-functions/logger");
const {getDb, getEnv, SECRETS, clock} = require("./env");
const {notify, ALREADY_EXISTS} = require("./lib/notify");
const {istDay} = require("./lib/time");
const {sweep} = require("./sweep");
const {buildRun} = require("./lib/payoutRun");
const ig = require("./lib/instagram");
const {DAY} = require("./domain/order");

const TZ = "Asia/Kolkata";

// stage entered -> who is told. Nothing is sent when an Order is created in "hold".
const TELL = {
  paid: [["buyerId", "order_paid"], ["artistId", "order_new"]],
  shipped: [["buyerId", "order_shipped"]],
  received: [["artistId", "order_received"]],
  refunded: [["buyerId", "order_refunded"]],
};

const onOrderWritten = onDocumentWritten({document: "orders/{orderId}", secrets: SECRETS}, async (event) => {
  const after = event.data.after.data();
  if (!after || event.data.before.data()?.stage === after.stage) return;
  const {db, ports, clock: clk} = getEnv();
  const orderId = event.params.orderId;
  const now = clk.now();
  for (const [who, type] of TELL[after.stage] || []) {
    await notify(db, `${orderId}_${after.stage}_${who}`, after[who], type, {orderId, code: after.code, amount: after.total}, now);
  }
  if (after.stage !== "paid") return;

  // once per Order: today's totals (India day) and the confirmation email
  try {
    await db.doc(`processedEvents/paid_${orderId}`).create({at: now});
  } catch (e) {
    if (e.code === ALREADY_EXISTS) return;
    throw e;
  }
  await db.doc(`analytics_daily/${istDay(now)}`).set({
    orders: FieldValue.increment(1), sales: FieldValue.increment(after.total),
  }, {merge: true});
  try {
    const buyer = await admin.auth().getUser(after.buyerId);
    if (buyer.email) {
      await ports.messaging.send("order_confirmation", buyer.email, {orderId, code: after.code, total: after.total / 100}, `paid_${orderId}`);
    }
  } catch (e) { // the in-app notification already exists
    logger.warn("confirmation email failed", {orderId, error: String(e)});
  }
});

/** Browse reads one Artwork document: keep its "from price" and availability in step with its Listings. */
const onListingWritten = onDocumentWritten("listings/{listingId}", async (event) => {
  const artworkId = (event.data.after.data() || event.data.before.data() || {}).artworkId;
  if (!artworkId) return;
  const db = getDb();
  const artRef = db.doc(`artworks/${artworkId}`);
  const [art, listings] = await Promise.all([artRef.get(), db.collection("listings").where("artworkId", "==", artworkId).get()]);
  if (!art.exists) return;
  const live = listings.docs.map((d) => d.data()).filter((l) => l.status === "live" && l.artistOpen !== false);
  const fromPricePaise = live.length ? Math.min(...live.map((l) => l.price)) : null;
  const available = live.some((l) => (l.stock || 0) - (l.held || 0) > 0);
  const cur = art.data();
  if (cur.fromPricePaise !== fromPricePaise || cur.available !== available) {
    await artRef.update({fromPricePaise, available});
  }
});

/** New Artworks and Listings start open unless the Artist is Restricted (the client cannot set artistOpen). */
const startOpen = (collection, extra) => onDocumentCreated(`${collection}/{id}`, async (event) => {
  const data = event.data.data();
  const user = (await getDb().doc(`users/${data.artistId}`).get()).data() || {};
  await event.data.ref.update({artistOpen: user.restricted !== true, ...extra});
});
const onArtworkCreated = startOpen("artworks", {hasSales: false, views: 0});
const onListingCreated = startOpen("listings", {held: 0});

const onUserCreated = v1.region("asia-south1").auth.user().onCreate(async (user) => {
  await getDb().doc(`users/${user.uid}`).set({
    displayName: user.displayName || "", photoURL: user.photoURL || "", bio: "", roles: [], restricted: false,
    ratingSum: 0, ratingCount: 0, ratingAvg: 0, showcase: [], createdAt: clock.now(),
  }, {merge: true});
});

const sweepJob = onSchedule({schedule: "every 5 minutes", timeZone: TZ}, async () => {
  logger.info("sweep", await sweep(getDb(), clock));
});

const payoutRunJob = onSchedule({schedule: "0 9 1,15 * *", timeZone: TZ}, async () => {
  logger.info("payout run", await buildRun(getDb(), clock.now()));
});

/** Daily: refresh Instagram tokens with under 10 days left (a token must be 24 h old to refresh). */
const refreshInstagramTokens = onSchedule({schedule: "every day 03:00", timeZone: TZ, secrets: SECRETS}, async () => {
  const db = getDb();
  const now = clock.now();
  const due = await db.collection("instagramTokens").where("expiresAt", "<=", now + 10 * DAY).limit(200).get();
  for (const d of due.docs) {
    const t = d.data();
    if (t.refreshedAt > now - DAY) continue;
    try {
      const fresh = await ig.refresh(t.accessToken);
      await d.ref.update({accessToken: fresh.token, expiresAt: now + fresh.expiresInMs, refreshedAt: now});
      await db.doc(`artistPrivate/${d.id}`).set({instagram: {tokenExpiresAt: now + fresh.expiresInMs}}, {merge: true});
    } catch (e) {
      await notify(db, `${d.id}_ig_${istDay(now)}`, d.id, "instagram_reconnect", {}, now);
    }
  }
});

module.exports = {
  onOrderWritten, onListingWritten, onArtworkCreated, onListingCreated, onUserCreated,
  sweep: sweepJob, buildPayoutRunScheduled: payoutRunJob, refreshInstagramTokens,
};
