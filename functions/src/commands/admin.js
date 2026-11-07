const yup = require("yup");
const admin = require("firebase-admin");
const {FieldValue} = require("firebase-admin/firestore");
const {CommandError} = require("../lib/envelope");
const {setStanding} = require("../lib/standing");

const restrictArtist = {
  spec: {
    role: "admin",
    schema: yup.object({
      artistId: yup.string().required(),
      restricted: yup.boolean().required(),
      reason: yup.string().trim().max(300).when("restricted", {is: true, then: (s) => s.required(), otherwise: (s) => s.default("")}),
    }),
  },
  async handler({input, db}) {
    await setStanding(db, input.artistId, input.restricted, input.reason);
    return {};
  },
};

const setRole = {
  spec: {
    role: "admin",
    schema: yup.object({
      uid: yup.string().required(),
      role: yup.string().oneOf(["admin", "artist"]).required(),
      value: yup.boolean().required(),
    }),
  },
  async handler({uid, input, db}) {
    if (uid === input.uid && input.role === "admin" && !input.value) throw new CommandError("conflict", "self_demote");
    const user = await admin.auth().getUser(input.uid);
    const claims = {...(user.customClaims || {})};
    if (input.value) claims[input.role] = true; else delete claims[input.role];
    await admin.auth().setCustomUserClaims(input.uid, claims);
    await db.doc(`users/${input.uid}`).set({
      roles: input.value ? FieldValue.arrayUnion(input.role) : FieldValue.arrayRemove(input.role),
    }, {merge: true});
    return {};
  },
};

module.exports = {commands: {restrictArtist, setRole}};
