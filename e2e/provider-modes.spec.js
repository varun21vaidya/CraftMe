// Scripts that need the api function served in another mode. Each block runs only when QA_FUNCTIONS_MODE names it:
//   production-fake  PROVIDER_MODE=fake APP_ENV=production                  -> QA-SYS-02
//   unconfigured     no PROVIDER_MODE, no Razorpay keys                       -> QA-S09-07
//   live-keys        no PROVIDER_MODE, any Razorpay test-looking keys         -> QA-SYS-02 (a "fake" signature is refused)
// e.g. npx supabase functions serve api --env-file <file> --no-verify-jwt, then QA_FUNCTIONS_MODE=unconfigured npx playwright test e2e/provider-modes.spec.js
/* global process */
import { expect, test } from '@playwright/test';
import { captured, clientAs, command, webhook } from './helpers/api.js';
import { setCart } from './helpers/cart.js';
import { sql } from './helpers/db.js';
import { L, O, PEOPLE } from './helpers/ids.js';
import { seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const MODE = process.env.QA_FUNCTIONS_MODE;
const A1 = PEOPLE.A1.id;
const B1 = PEOPLE.B1.id;
const ADDRESS = { name: 'Ananya Verma', phone: '9876543210', address: '1 Road', city: 'Mumbai', state: 'Maharashtra', pin: '400050' };
const orderCount = () => Number(sql(`select count(*) from public.orders where buyer_id = '${B1}'`));
const held = () => sql(`select held from public.listings where id = '${L.W2P}'`);

test.beforeEach(() => seed());

test.describe('QA-SYS-02 fake provider mode cannot run in production', () => {
  test.skip(MODE !== 'production-fake', 'serve the function with PROVIDER_MODE=fake APP_ENV=production');

  test('every command and the webhook answer unavailable / fake_mode_in_production', async () => {
    const b1 = await clientAs('B1');
    const before = orderCount();
    const place = await command(b1, 'placeOrder', { artistId: A1, lines: [{ listingId: L.W2P, quantity: 1 }], address: ADDRESS });
    expect(place.error).toEqual({ code: 'unavailable', reason: 'fake_mode_in_production' });
    const confirm = await command(b1, 'confirmPayment', { orderId: O.O1, razorpayOrderId: 'order_fake_qa_cm-20401', razorpayPaymentId: 'pay_fake_ok_order_fake_qa_cm-20401', signature: 'fake' });
    expect(confirm.error).toEqual({ code: 'unavailable', reason: 'fake_mode_in_production' });
    expect(await webhook(captured('order_fake_qa_cm-20401'))).toBe(503);
    expect(orderCount()).toBe(before);
    expect(sql(`select stage from public.orders where id = '${O.O1}'`)).toBe('hold');
  });
});

test.describe('QA-SYS-02 without fake mode a "fake" signature is refused', () => {
  test.skip(MODE !== 'live-keys', 'serve the function without PROVIDER_MODE and with any Razorpay keys');

  test('bad_signature', async () => {
    const b1 = await clientAs('B1');
    const res = await command(b1, 'confirmPayment', { orderId: O.O1, razorpayOrderId: 'order_fake_qa_cm-20401', razorpayPaymentId: 'pay_fake_ok_order_fake_qa_cm-20401', signature: 'fake' });
    expect(res.error).toMatchObject({ code: 'conflict', reason: 'bad_signature' });
    expect(sql(`select stage from public.orders where id = '${O.O1}'`)).toBe('hold');
  });
});

test.describe('QA-S09-07 payments not configured', () => {
  test.skip(MODE !== 'unconfigured', 'serve the function without PROVIDER_MODE and without Razorpay keys');

  test('the command refuses before holding anything', async () => {
    const b1 = await clientAs('B1');
    const before = [orderCount(), held()];
    const res = await command(b1, 'placeOrder', { artistId: A1, lines: [{ listingId: L.W2P, quantity: 1 }], address: ADDRESS });
    expect(res.error).toEqual({ code: 'unavailable', reason: 'payments_not_configured' });
    expect([orderCount(), held()]).toEqual(before);
  });

  test('the page says so and Pay is disabled', async ({ page }) => {
    await signInAs(page, 'B1');
    await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
    await page.goto('/checkout');
    await page.getByRole('button', { name: /^Pay ₹/ }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Payments aren’t set up on this site yet.' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pay ₹/ })).toBeDisabled();
  });
});
