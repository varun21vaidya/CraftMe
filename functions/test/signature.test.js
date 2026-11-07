import {describe, expect, it} from "vitest";
import crypto from "node:crypto";

// ports.js pulls in firebase-functions (heavy), so the two tiny helpers are checked against the same algorithm here.
const hmacHex = (secret, payload) => crypto.createHmac("sha256", secret).update(payload).digest("hex");
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

describe("signature helpers", () => {
  it("accepts the right HMAC and rejects a tampered one", () => {
    const sig = hmacHex("secret", "order_1|pay_1");
    expect(safeEqual(sig, hmacHex("secret", "order_1|pay_1"))).toBe(true);
    expect(safeEqual(sig, hmacHex("secret", "order_1|pay_2"))).toBe(false);
    expect(safeEqual(sig, "short")).toBe(false);
  });
});
