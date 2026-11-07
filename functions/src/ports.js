// Ports: the only things tests must fake. Payments (Razorpay), Messaging (SendGrid), Clock.
// Firestore, Storage and Instagram are called directly from one module each.

const {defineSecret} = require("firebase-functions/params");
const {hmacHex, safeEqual} = require("./lib/hmac");

const RAZORPAY_KEY_ID = defineSecret("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const SENDGRID_API_KEY = defineSecret("SENDGRID_API_KEY");
const INSTAGRAM_APP_ID = defineSecret("INSTAGRAM_APP_ID");
const INSTAGRAM_APP_SECRET = defineSecret("INSTAGRAM_APP_SECRET");
const SECRETS = [
  RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, SENDGRID_API_KEY,
  INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET,
];

/**
 * @typedef {{keyId:string,
 *  createOrder(amountPaise:number, receipt:string):Promise<{id:string}>,
 *  verifySignature(p:{razorpayOrderId:string,razorpayPaymentId:string,signature:string}):boolean,
 *  verifyWebhook(rawBody:Buffer, signature:string):boolean,
 *  fetchPayment(id:string):Promise<{amount:number,fee:number,status:string,orderId:string}>,
 *  refund(paymentId:string, amountPaise:number):Promise<{id:string}>}} PaymentsPort
 */
const razorpayPayments = () => {
  const Razorpay = require("razorpay");
  const keyId = RAZORPAY_KEY_ID.value();
  const keySecret = RAZORPAY_KEY_SECRET.value();
  const rz = new Razorpay({key_id: keyId, key_secret: keySecret});
  return {
    keyId,
    createOrder: async (amountPaise, receipt) => {
      const o = await rz.orders.create({amount: amountPaise, currency: "INR", receipt});
      return {id: o.id};
    },
    verifySignature: ({razorpayOrderId, razorpayPaymentId, signature}) =>
      safeEqual(hmacHex(keySecret, `${razorpayOrderId}|${razorpayPaymentId}`), signature),
    verifyWebhook: (rawBody, signature) => safeEqual(hmacHex(RAZORPAY_WEBHOOK_SECRET.value(), rawBody), signature),
    fetchPayment: async (id) => {
      const p = await rz.payments.fetch(id);
      return {amount: p.amount, fee: p.fee ?? 0, status: p.status, orderId: p.order_id};
    },
    refund: async (paymentId, amountPaise) => {
      const r = await rz.payments.refund(paymentId, {amount: amountPaise});
      return {id: r.id};
    },
  };
};

/** @typedef {{send(template:string,to:string,data:object,dedupeKey:string):Promise<void>}} MessagingPort */
const sendgridMessaging = () => {
  const sg = require("@sendgrid/mail");
  sg.setApiKey(SENDGRID_API_KEY.value());
  return {
    async send(template, to, data, dedupeKey) {
      const templateId = process.env[`SENDGRID_TEMPLATE_${template.toUpperCase()}`];
      if (!templateId) return; // template not configured yet: the in-app notification still exists
      await sg.send({
        to, from: process.env.EMAIL_FROM || "orders@craftme.example", templateId,
        dynamicTemplateData: data, customArgs: {dedupeKey},
      });
    },
  };
};

/** @typedef {{now():number}} ClockPort epoch milliseconds */
const systemClock = {now: () => Date.now()};

const makePorts = () => ({payments: razorpayPayments(), messaging: sendgridMessaging()});

module.exports = {SECRETS, INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, makePorts, systemClock};
