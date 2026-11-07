import {describe, expect, it} from "vitest";
import order from "../src/domain/order.js";

const {next, advance, allowedActions, WINDOWS, DAY} = order;

describe("order stages", () => {
  it("walks the happy path and refuses everything else", () => {
    expect(next(null, "place")).toBe("hold");
    expect(next("hold", "pay")).toBe("paid");
    expect(next("paid", "ship")).toBe("shipped");
    expect(next("shipped", "receive")).toBe("received");
    expect(next("shipped", "pay")).toBeNull();
    expect(next("paid", "receive")).toBeNull();
    expect(next("hold_expired", "pay")).toBe("paid");
    expect(next("refunded", "ship")).toBeNull();
    expect(next("nonsense", "pay")).toBeNull();
  });

  it("advance returns the new stage with fresh actions, or null", () => {
    const o = {stage: "paid", holdUntil: 0};
    const u = advance(o, "ship", {shippedAt: 5}, 10);
    expect(u).toMatchObject({stage: "shipped", shippedAt: 5, buyerActions: {canConfirmReceived: true}, artistActions: {canShip: false}});
    expect(advance(o, "receive", {}, 10)).toBeNull();
  });

  it("shows Buyer buttons only inside their windows", () => {
    const t = 1_000_000;
    const received = {stage: "received", damageWindowEnds: t + 3 * DAY, reviewBy: t + 30 * DAY};
    expect(allowedActions(received, "buyer", t)).toMatchObject({canReportDamage: true, canReview: true});
    expect(allowedActions(received, "buyer", t + 4 * DAY)).toMatchObject({canReportDamage: false, canReview: true});
    expect(allowedActions({...received, reviewed: true}, "buyer", t).canReview).toBe(false);
    expect(allowedActions({stage: "hold", holdUntil: t + WINDOWS.hold}, "buyer", t).canPay).toBe(true);
    expect(allowedActions({stage: "hold", holdUntil: t}, "buyer", t).canPay).toBe(false);
  });

  it("lets the Artist ship only a paid Order", () => {
    expect(allowedActions({stage: "paid"}, "artist", 0).canShip).toBe(true);
    expect(allowedActions({stage: "shipped"}, "artist", 0).canShip).toBe(false);
  });
});
