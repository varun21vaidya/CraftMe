// Signature helpers kept free of Firebase imports so tests can use the real code.
const crypto = require("crypto");

const hmacHex = (secret, payload) => crypto.createHmac("sha256", secret).update(payload).digest("hex");

/** Constant-time compare that also tolerates different lengths. */
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

module.exports = {hmacHex, safeEqual};
