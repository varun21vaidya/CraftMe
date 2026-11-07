// Inbound HTTPS endpoints: the payment webhook and Instagram's deauthorise / data-deletion callbacks.
// Each verifies the signature first, dedupes, then calls the same code the Buyer-facing path uses.

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {getEnv, SECRETS} = require("./env");
const {markPaid, markFeePaid} = require("./lib/paid");
const ig = require("./lib/instagram");
const {INSTAGRAM_APP_SECRET} = require("./ports");
const {ALREADY_EXISTS} = require("./lib/notify");

/** Acts on one verified Razorpay event. */
async function dispatch(env, event, now) {
  if (event.event !== "payment.captured" && event.event !== "order.paid") return; // refunds are written by issueRefund
  const payment = event.payload?.payment?.entity;
  if (!payment) return;
  const orders = await env.db.collection("orders").where("razorpayOrderId", "==", payment.order_id).limit(1).get();
  const ctx = {db: env.db, ports: env.ports, now};
  if (orders.empty) await markFeePaid(ctx, payment.order_id, payment.id);
  else await markPaid(ctx, orders.docs[0].id, payment.id);
}

const razorpayWebhook = onRequest({secrets: SECRETS}, async (req, res) => {
  const env = getEnv();
  if (!env.ports.payments.verifyWebhook(req.rawBody, req.get("X-Razorpay-Signature") || "")) {
    res.status(400).end();
    return;
  }
  const eventId = req.get("X-Razorpay-Event-Id");
  if (!eventId) {
    res.status(400).end();
    return;
  }
  const now = env.clock.now();
  const claim = env.db.doc(`processedEvents/${eventId}`);
  try {
    await claim.create({at: now});
  } catch (e) {
    if (e.code !== ALREADY_EXISTS) throw e;
    res.status(200).end(); // replay: nothing to do
    return;
  }
  try {
    await dispatch(env, JSON.parse(req.rawBody.toString("utf8")), now);
  } catch (e) {
    if (e.name === "CommandError") { // a bad reference will never succeed: log it and acknowledge
      logger.warn("webhook event ignored", {eventId, code: e.code, reason: e.reason});
    } else { // transient: free the claim and answer non-2xx so Razorpay retries
      logger.error("webhook failed", {eventId, error: String((e && e.stack) || e)});
      await claim.delete();
      res.status(500).end();
      return;
    }
  }
  res.status(200).end();
});

const instagramUserFrom = (req) => {
  const payload = ig.parseSignedRequest(req.body?.signed_request, INSTAGRAM_APP_SECRET.value());
  return payload ? String(payload.user_id) : null;
};

async function removeByInstagramId(db, igUserId) {
  const found = await db.collection("instagramTokens").where("igUserId", "==", igUserId).get();
  for (const d of found.docs) await ig.removeInstagram(db, d.id);
  return found.size;
}

const instagramDeauthorize = onRequest({secrets: SECRETS}, async (req, res) => {
  const igUserId = instagramUserFrom(req);
  if (!igUserId) {
    res.status(400).end();
    return;
  }
  await removeByInstagramId(getEnv().db, igUserId);
  res.status(200).end();
});

const instagramDataDeletion = onRequest({secrets: SECRETS}, async (req, res) => {
  const igUserId = instagramUserFrom(req);
  if (!igUserId) {
    res.status(400).end();
    return;
  }
  await removeByInstagramId(getEnv().db, igUserId);
  res.json({url: process.env.DATA_DELETION_STATUS_URL || "", confirmation_code: igUserId});
});

module.exports = {razorpayWebhook, instagramDeauthorize, instagramDataDeletion};
