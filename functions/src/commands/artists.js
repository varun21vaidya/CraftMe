// Becoming an Artist: Verification, the Onboarding Fee, the role. Admin checks come later (markVerified).

const yup = require("yup");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {CommandError} = require("../lib/envelope");

const payoutMethod = yup.object({
  type: yup.string().oneOf(["upi", "bank"]).required(),
  upi: yup.string().when("type", {
    is: "upi", then: (s) => s.matches(/^[\w.-]{2,}@[\w]{2,}$/).required(), otherwise: (s) => s.strip(),
  }),
  account: yup.string().when("type", {
    is: "bank", then: (s) => s.matches(/^\d{9,18}$/).required(), otherwise: (s) => s.strip(),
  }),
  ifsc: yup.string().when("type", {
    is: "bank", then: (s) => s.matches(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(), otherwise: (s) => s.strip(),
  }),
}).required();

const submitVerification = {
  spec: {
    role: "buyer",
    schema: yup.object({
      legalName: yup.string().trim().max(100).required(),
      pan: yup.string().matches(/^[A-Z]{5}\d{4}[A-Z]$/).required(),
      payoutMethod,
    }),
  },
  async handler({uid, claims, input, now, db}) {
    const ref = db.doc(`artistPrivate/${uid}`);
    const exists = (await ref.get()).exists;
    await ref.set({
      ...(exists ? {} : {amountOwed: 0, owedSince: null, onboardingPaidAt: null, restrictedReasons: []}),
      legalName: input.legalName, pan: input.pan, payoutMethod: input.payoutMethod,
      phoneVerified: Boolean(claims.phone_number), // set by Firebase phone sign-in, never by the client
      verifiedByAdminAt: null, // any edit re-opens the Admin's check
      submittedAt: now,
    }, {merge: true});
    return {};
  },
};

const payOnboardingFee = {
  spec: {role: "buyer", schema: yup.object({})},
  async handler({uid, db, ports}) {
    const ref = db.doc(`artistPrivate/${uid}`);
    const priv = (await ref.get()).data();
    if (!priv || !priv.legalName) throw new CommandError("conflict", "verification_missing");
    if (priv.onboardingPaidAt) throw new CommandError("conflict", "already_paid");
    const fee = ((await db.doc("settings/business").get()).data() || {}).onboardingFee;
    if (!Number.isInteger(fee) || fee <= 0) throw new CommandError("conflict", "fee_not_set");
    let order;
    try {
      order = await ports.payments.createOrder(fee, `fee_${uid}`);
    } catch (e) {
      throw new CommandError("unavailable", "payments_down");
    }
    await ref.update({onboardingOrderId: order.id, onboardingAmount: fee});
    return {razorpayOrderId: order.id, keyId: ports.payments.keyId, amount: fee};
  },
};

const becomeArtist = {
  spec: {role: "buyer", schema: yup.object({})},
  async handler({uid, db}) {
    // The fee is recorded by the payment webhook; the client waits for it before calling this.
    const priv = (await db.doc(`artistPrivate/${uid}`).get()).data();
    if (!priv || !priv.legalName || !priv.pan || !priv.phoneVerified || !priv.onboardingPaidAt) {
      throw new CommandError("conflict", "verification_or_fee_missing");
    }
    const user = await admin.auth().getUser(uid);
    await admin.auth().setCustomUserClaims(uid, {...(user.customClaims || {}), artist: true});
    await db.doc(`users/${uid}`).set({roles: FieldValue.arrayUnion("artist")}, {merge: true});
    return {roles: ["artist"]};
  },
};

const markVerified = {
  spec: {role: "admin", schema: yup.object({uid: yup.string().required()})},
  async handler({uid, input, now, db}) {
    const ref = db.doc(`artistPrivate/${input.uid}`);
    if (!(await ref.get()).exists) throw new CommandError("conflict", "not_found");
    await ref.update({verifiedByAdminAt: now, verifiedBy: uid});
    return {};
  },
};

module.exports = {commands: {submitVerification, payOnboardingFee, becomeArtist, markVerified}};
