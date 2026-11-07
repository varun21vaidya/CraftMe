// Fakes for the ports and the idempotency store. No emulator needed.

export const fixedClock = (ms = 1_700_000_000_000) => {
  let t = ms;
  return {now: () => t, set: (v) => {
 t = v;
}, advance: (d) => {
 t += d;
}};
};

export const memoryStore = () => {
  const m = new Map();
  return {
    claim: async (key) => {
      const e = m.get(key);
      if (!e) {
 m.set(key, {state: "pending"}); return {state: "new"};
}
      return e.envelope ? {state: "done", envelope: e.envelope} : {state: "pending"};
    },
    finish: async (key, envelope) => {
 m.set(key, {state: "done", envelope});
},
    release: async (key) => {
 m.delete(key);
},
    size: () => m.size,
  };
};

export const fakePayments = (over = {}) => {
  const calls = {createOrder: [], refund: []};
  return {
    keyId: "rzp_test_fake",
    calls,
    createOrder: async (amount, receipt) => {
 calls.createOrder.push({amount, receipt}); return {id: `order_${calls.createOrder.length}`};
},
    verifySignature: ({signature}) => signature === "good",
    verifyWebhook: (_raw, signature) => signature === "good",
    fetchPayment: async () => ({amount: 0, fee: 0, status: "captured", orderId: "order_1"}),
    refund: async (paymentId, amount) => {
 calls.refund.push({paymentId, amount}); return {id: `rfnd_${calls.refund.length}`};
},
    ...over,
  };
};

export const fakeMessaging = () => {
  const sent = [];
  return {sent, send: async (template, to, data, dedupeKey) => {
 sent.push({template, to, data, dedupeKey});
}};
};
