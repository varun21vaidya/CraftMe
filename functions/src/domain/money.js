// Pure money rules. Everything is whole paise (integers); rates are basis points. No I/O.

const assertInt = (n, name) => {
  if (!Number.isInteger(n)) throw new Error(`${name} must be whole paise, got ${n}`);
  return n;
};

/** Sum of unit price x quantity. The only place an Order total is computed. */
const orderTotal = (lines) => lines.reduce((sum, l) => {
  assertInt(l.unitPaise, "unitPaise");
  assertInt(l.qty, "qty");
  return sum + l.unitPaise * l.qty;
}, 0);

/** Commission is charged on what the Buyer finally paid (price minus Refunds); floor favours the Artist. */
const commissionOf = (netPaise, rateBp) => Math.floor((assertInt(netPaise, "net") * assertInt(rateBp, "rateBp")) / 10000);

/** One Order: price - Refunds - Commission - the full gateway fee. May be negative (fee on a fully refunded Order). */
const payoutLine = ({pricePaise, refundsPaise, gatewayFeePaise, rateBp}) => {
  const kept = assertInt(pricePaise, "price") - assertInt(refundsPaise, "refunds");
  const commission = commissionOf(kept, rateBp);
  return {commission, net: kept - commission - assertInt(gatewayFeePaise, "fee")};
};

/**
 * One Artist's run. lines: [{pricePaise, refundsPaise, gatewayFeePaise, rateBp}], owedPaise: Amount Owed so far.
 * A negative subtotal pays nothing and grows what is owed.
 */
const payoutRun = (lines, owedPaise) => {
  const t = {gross: 0, refunds: 0, commission: 0, fees: 0, subtotal: 0};
  for (const l of lines) {
    const p = payoutLine(l);
    t.gross += l.pricePaise;
    t.refunds += l.refundsPaise;
    t.commission += p.commission;
    t.fees += l.gatewayFeePaise;
    t.subtotal += p.net;
  }
  const payable = Math.max(t.subtotal, 0);
  const owedDeducted = Math.min(assertInt(owedPaise, "owed"), payable);
  return {
    gross: t.gross,
    refunds: t.refunds,
    commission: t.commission,
    fees: t.fees,
    owedDeducted,
    net: payable - owedDeducted,
    owedLeft: owedPaise - owedDeducted + Math.max(-t.subtotal, 0),
  };
};

/** Extra Amount Owed when a Refund lands after the Order was paid out: the Refund minus the Commission no longer due. */
const owedAfterRefund = ({pricePaise, refundedBeforePaise, refundPaise, rateBp}) => {
  const keptBefore = pricePaise - refundedBeforePaise;
  const commissionBack = commissionOf(keptBefore, rateBp) - commissionOf(keptBefore - refundPaise, rateBp);
  return refundPaise - commissionBack;
};

module.exports = {orderTotal, commissionOf, payoutLine, payoutRun, owedAfterRefund};
