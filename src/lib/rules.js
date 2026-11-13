// The one place the UI reads shop rules from. supabase/schema.test.mjs ties these numbers to the SQL.
export const RULES = {
  holdMinutes: 15, shipDays: 7, autoReceiveDays: 14, damageDays: 3, reviewDays: 30,
  owedRestrictDays: 60, payoutDays: [1, 15], maxQty: 10, maxOpenHolds: 3,
};
