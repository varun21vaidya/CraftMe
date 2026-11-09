import {describe, expect, it, vi} from "vitest";
import {createRequire} from "node:module";

const require = createRequire(import.meta.url);
const {markPaid} = require("../src/lib/paid.js");
const {commands: payouts} = require("../src/commands/payouts.js");
const {commands: trust} = require("../src/commands/trust.js");

// A tiny in-memory Firestore: paths map to plain objects, transactions run straight through.
const fakeDb = (docs) => {
  const ref = (path) => ({
    path,
    get: async () => ({exists: path in docs, data: () => docs[path], ref: ref(path)}),
    update: async (p) => Object.assign(docs[path], p),
    set: async (p) => { docs[path] = p; },
  });
  const tx = {get: (r) => r.get(), update: (r, p) => r.update(p), set: (r, p) => r.set(p)};
  return {doc: ref, collection: () => ({doc: () => ref("refunds/r1")}), runTransaction: (fn) => fn(tx)};
};

describe("money writes", () => {
  it("markPaid on a refunded order does not refund again", async () => {
    const db = fakeDb({"orders/o1": {stage: "refunded"}});
    const ports = {payments: {fetchPayment: vi.fn(), refund: vi.fn()}};
    expect(await markPaid({db, ports, now: 1}, "o1", "pay_1")).toEqual({stage: "refunded"});
    expect(ports.payments.refund).not.toHaveBeenCalled();
  });

  it("recordPayout refuses a draft made stale by a later refund", async () => {
    const order = {total: 100000, refundedTotal: 0, gatewayFee: 0, commissionBps: 1000, payoutId: null};
    const docs = {
      "payouts/p1": {status: "draft", artistId: "a1", orderIds: ["o1"], net: 90000, owedLeft: 0},
      "artistPrivate/a1": {verifiedByAdminAt: 1, amountOwed: 0},
      "orders/o1": order,
    };
    const run = (db) => payouts.recordPayout.handler({input: {payoutId: "p1", reference: "utr"}, now: 2, db});
    order.refundedTotal = 40000; // refund after the draft was built
    await expect(run(fakeDb(docs))).rejects.toMatchObject({message: expect.stringContaining("rebuild")});
    order.refundedTotal = 0; // numbers match again
    expect(await run(fakeDb(docs))).toEqual({status: "sent"});
  });

  it("issueRefund keeps the reservation when the provider call fails", async () => {
    const docs = {
      "orders/o1": {
        stage: "paid", total: 50000, refundedTotal: 0, razorpayPaymentId: "pay_1", buyerId: "b", artistId: "a1",
        lines: [{listingId: "l1", quantity: 1, unitPaise: 50000}],
      },
    };
    const ports = {payments: {refund: vi.fn().mockRejectedValue(new Error("timeout"))}};
    const input = {orderId: "o1", lines: [{lineId: "l1", quantity: 1}], reason: "damaged"};
    await expect(trust.issueRefund.handler({input, now: 3, db: fakeDb(docs), ports}))
        .rejects.toMatchObject({message: expect.stringContaining("refund_unknown")});
    expect(docs["refunds/r1"].status).toBe("unknown");
    expect(docs["orders/o1"].refundedTotal).toBe(50000); // not undone, so a retry cannot refund twice
  });
});
