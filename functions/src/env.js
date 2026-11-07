// Builds the real dependencies once per instance. Secrets can only be read inside a running function,
// so nothing here runs at import time.

const admin = require("firebase-admin");
const {SECRETS, makePorts, systemClock} = require("./ports");

let db;
let cached;

/** Firestore only: for jobs that need no secrets (the sweep, listing triggers). */
const getDb = () => {
  if (!admin.apps.length) admin.initializeApp();
  db = db || admin.firestore();
  return db;
};

/** Firestore plus the payment and email ports: only for functions that declare SECRETS. */
const getEnv = () => {
  cached = cached || {db: getDb(), ports: makePorts(), clock: systemClock};
  return cached;
};

module.exports = {getEnv, getDb, SECRETS, clock: systemClock};
