// Binds a handler to a Firebase callable through runCommand (see run.js for the rules).

const {onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {runCommand} = require("./run");

const PENDING_STALE_MS = 60 * 1000;
const ALREADY_EXISTS = 6; // gRPC code from Firestore create()

/** Idempotency over Firestore: create() claims the key atomically, so two identical requests never both run. */
const firestoreStore = (db) => ({
  async claim(key) {
    const ref = db.doc(`requests/${key}`);
    try {
      await ref.create({state: "pending", at: Date.now()});
      return {state: "new"};
    } catch (e) {
      if (e.code !== ALREADY_EXISTS) throw e;
      const d = (await ref.get()).data() || {};
      if (d.envelope) return {state: "done", envelope: d.envelope};
      if (Date.now() - d.at > PENDING_STALE_MS) { // a crashed run left it pending
        await ref.set({state: "pending", at: Date.now()});
        return {state: "new"};
      }
      return {state: "pending"};
    }
  },
  finish: (key, envelope) => db.doc(`requests/${key}`).set({state: "done", envelope, at: Date.now()}),
  release: (key) => db.doc(`requests/${key}`).delete(),
});

/** Environment is built lazily so secrets resolve at run time, not at deploy analysis. */
function command(spec, handler) {
  const {getEnv, SECRETS} = require("../env");
  return onCall({secrets: SECRETS}, async (request) => {
    const env = getEnv();
    return runCommand(
        {uid: request.auth?.uid, claims: request.auth?.token, data: request.data},
        spec, handler, {...env, store: firestoreStore(env.db), log: logger.error},
    );
  });
}

module.exports = {command, firestoreStore};
