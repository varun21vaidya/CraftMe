import { describe, expect, it } from 'vitest';
import { fakeRz, providerMode } from './providers.ts';

const env = (vars) => (k) => vars[k];
// a stand-in for the service-role client: .from(table).select().eq().maybeSingle()
const admin = (rows) => ({
  from: (table) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: rows[table] ?? null }) }) }) }),
});

describe('provider mode (QA-SYS-02)', () => {
  it('is live unless PROVIDER_MODE=fake', () => {
    expect(providerMode(env({}))).toBe('live');
    expect(providerMode(env({ APP_ENV: 'production' }))).toBe('live');
  });
  it('is fake outside production', () => {
    expect(providerMode(env({ PROVIDER_MODE: 'fake', APP_ENV: 'local' }))).toBe('fake');
  });
  it('refuses fake mode in production', () => {
    expect(() => providerMode(env({ PROVIDER_MODE: 'fake', APP_ENV: 'production' }))).toThrow('fake_mode_in_production');
  });
});

describe('fakeRz', () => {
  it('creates fake Razorpay orders', async () => {
    const o = await fakeRz(null, '/orders', 'POST', { amount: 5000 });
    expect(o.id).toMatch(/^order_fake_/);
  });
  it('captures an ok payment for the amount of the order that owns it, with a 2.36% fee', async () => {
    const p = await fakeRz(admin({ orders: { total: '690000' } }), '/payments/pay_fake_ok_order_fake_1', 'GET');
    expect(p).toMatchObject({ status: 'captured', amount: 690000, order_id: 'order_fake_1', method: 'upi', fee: 16284 });
  });
  it('uses the onboarding fee when no order owns the Razorpay order', async () => {
    const p = await fakeRz(admin({ artist_private: { onboarding_amount: 49900 } }), '/payments/pay_fake_ok_order_fake_2', 'GET');
    expect(p.amount).toBe(49900);
  });
  it('fails a declined payment', async () => {
    const p = await fakeRz(admin({ orders: { total: '100' } }), '/payments/pay_fake_declined_order_fake_3', 'GET');
    expect(p.status).toBe('failed');
  });
  it('refunds, and times out for pay_fake_timeout_', async () => {
    expect((await fakeRz(null, '/payments/pay_fake_ok_order_fake_1/refund', 'POST', { amount: 1 })).id).toMatch(/^rfnd_fake_/);
    await expect(fakeRz(null, '/payments/pay_fake_timeout_order_fake_1/refund', 'POST', { amount: 1 })).rejects.toThrow();
  });
});
