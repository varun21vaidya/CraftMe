import {describe, expect, it} from "vitest";
import hmac from "../src/lib/hmac.js";

const {hmacHex, safeEqual} = hmac;

describe("signature helpers", () => {
  it("accepts the right HMAC and rejects a tampered one", () => {
    const sig = hmacHex("secret", "order_1|pay_1");
    expect(safeEqual(sig, hmacHex("secret", "order_1|pay_1"))).toBe(true);
    expect(safeEqual(sig, hmacHex("secret", "order_1|pay_2"))).toBe(false);
    expect(safeEqual(sig, "short")).toBe(false);
  });
});
