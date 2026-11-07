// Fakes for the idempotency store and the clock. No emulator needed.

export const fixedClock = (ms = 1_700_000_000_000) => ({now: () => ms});

export const memoryStore = () => {
  const m = new Map();
  return {
    claim: async (key) => {
      const e = m.get(key);
      if (!e) {
        m.set(key, {state: "pending"});
        return {state: "new"};
      }
      return e.envelope ? {state: "done", envelope: e.envelope} : {state: "pending"};
    },
    finish: async (key, envelope) => m.set(key, {state: "done", envelope}),
    release: async (key) => m.delete(key),
  };
};
