// Fixed ids from supabase/seed_qa.sql. Keys follow QA/README.md: people B1.., works W1.., orders O2.
export const PEOPLE = {
  B1: { id: 'b1000000-0000-4000-8000-000000000001', email: 'b1@craftme.test' },
  B2: { id: 'b2000000-0000-4000-8000-000000000002', email: 'b2@craftme.test' },
  A1: { id: 'a1000000-0000-4000-8000-000000000001', email: 'a1@craftme.test' },
  A2: { id: 'a2000000-0000-4000-8000-000000000002', email: 'a2@craftme.test' },
  A3: { id: 'a3000000-0000-4000-8000-000000000003', email: 'a3@craftme.test' },
  A4: { id: 'a4000000-0000-4000-8000-000000000004', email: 'a4@craftme.test' },
  AD1: { id: 'ad000000-0000-4000-8000-000000000001', email: 'ad1@craftme.test' },
  AD2: { id: 'ad000000-0000-4000-8000-000000000002', email: 'ad2@craftme.test' },
};
const work = (n) => `c1000000-0000-4000-8000-00000000000${n}`;
export const W = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`W${n}`, work(n)]));
const order = (n) => `e0000000-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
export const O = { O2: 'e2000000-0000-4000-8000-000000000002', ...Object.fromEntries([1, 3, 4, 5, 6, 7, 8, 9, 10, 14].map((n) => [`O${n}`, order(n)])) };
// listings: L.W1P is the W1 Print, L.W1O the W1 Original, and so on
export const L = {
  W1O: 'd1000000-0000-4000-8000-000000000001', W1P: 'd1000000-0000-4000-8000-000000000002',
  W2O: 'd2000000-0000-4000-8000-000000000001', W2P: 'd2000000-0000-4000-8000-000000000002',
  W6O: 'd6000000-0000-4000-8000-000000000001', W8P: 'd8000000-0000-4000-8000-000000000001', W8F: 'd8000000-0000-4000-8000-000000000002',
  F01: 'df000000-0000-4000-8000-000000000001',
};
export const F01 = 'cf000000-0000-4000-8000-000000000001';
