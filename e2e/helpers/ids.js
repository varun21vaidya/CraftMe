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
export const O = { O2: 'e2000000-0000-4000-8000-000000000002' };
