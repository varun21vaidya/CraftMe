import {describe, expect, it} from "vitest";
import money from "../src/domain/money.js";

const {orderTotal, commissionOf, payoutLine, payoutRun, owedAfterRefund} = money;

describe("money", () => {
  it("totals lines in paise and rejects fractions", () => {
    expect(orderTotal([{unitPaise: 220000, qty: 2}, {unitPaise: 250000, qty: 1}])).toBe(690000);
    expect(() => orderTotal([{unitPaise: 10.5, qty: 1}])).toThrow();
  });

  it("charges Commission on price minus Refunds and the full gateway fee: Rs1000, Rs400 back, 10%, Rs30 fee", () => {
    const l = payoutLine({pricePaise: 100000, refundsPaise: 40000, gatewayFeePaise: 3000, rateBp: 1000});
    expect(l).toEqual({commission: 6000, net: 51000});
  });

  it("floors Commission so the Artist gets the odd paisa", () => {
    expect(commissionOf(999, 1000)).toBe(99);
  });

  it("deducts Amount Owed and never pays below zero", () => {
    const line = {pricePaise: 100000, refundsPaise: 0, gatewayFeePaise: 3000, rateBp: 1000}; // net 87000
    expect(payoutRun([line], 20000)).toMatchObject({net: 67000, owedDeducted: 20000, owedLeft: 0});
    expect(payoutRun([line], 100000)).toMatchObject({net: 0, owedDeducted: 87000, owedLeft: 13000});
  });

  it("turns a fully refunded Order's fee into Amount Owed", () => {
    const refunded = {pricePaise: 100000, refundsPaise: 100000, gatewayFeePaise: 3000, rateBp: 1000};
    expect(payoutRun([refunded], 0)).toMatchObject({net: 0, owedLeft: 3000});
  });

  it("reconciles: parts add up to the net to the paisa", () => {
    const lines = [
      {pricePaise: 123457, refundsPaise: 0, gatewayFeePaise: 2915, rateBp: 1250},
      {pricePaise: 99999, refundsPaise: 33333, gatewayFeePaise: 2360, rateBp: 1250},
    ];
    const r = payoutRun(lines, 0);
    expect(r.gross - r.refunds - r.commission - r.fees).toBe(r.net);
  });

  it("owes the Refund minus the Commission no longer due when a Refund lands after Payout", () => {
    // Rs1000 paid out with 10% commission; Rs400 refunded later: Artist owes 400 - 40 commission back = 360
    expect(owedAfterRefund({pricePaise: 100000, refundedBeforePaise: 0, refundPaise: 40000, rateBp: 1000})).toBe(36000);
  });
});
