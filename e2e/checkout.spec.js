// P01 scripts: QA-S08-08, QA-S09-01 to 08, QA-S10-03 to 08, QA-SYS-03. Needs the api function served in fake provider mode:
//   npx supabase functions serve api --env-file supabase/.env.local --no-verify-jwt
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { captured, clientAs, command, webhook } from './helpers/api.js';
import { readCart, setCart } from './helpers/cart.js';
import { sql } from './helpers/db.js';
import { L, PEOPLE } from './helpers/ids.js';
import { env, seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const A1 = PEOPLE.A1.id;
const A2 = PEOPLE.A2.id;
const A4 = PEOPLE.A4.id;
const B1 = PEOPLE.B1.id;
const B2 = PEOPLE.B2.id;
const ADDRESS = { name: 'Rahul Nair', phone: '9876543210', address: '12 MG Road', city: 'Pune', state: 'Maharashtra', pin: '411001' };

/** The buyer's orders made by the test (the fixtures' O1 to O14 are excluded). */
const newOrders = (buyer, where = 'true') => sql(`select id || '|' || stage from public.orders where buyer_id = '${buyer}' and code not like 'CM-204%' and ${where} order by created_at`)
  .split('\n').filter(Boolean).map((r) => { const [id, stage] = r.split('|'); return { id, stage }; });
const row = (id, cols) => sql(`select ${cols} from public.orders where id = '${id}'`);
const payWindow = (page) => page.getByRole('dialog', { name: 'Test payment window' });
const pay = (page) => page.getByRole('button', { name: /^Pay ₹/ });

/** Answers one api command from the test instead of the server. respond(route, body) */
async function onCommand(page, name, respond) {
  await page.route('**/functions/v1/api', async (route) => {
    const body = route.request().postDataJSON?.();
    if (body?.name === name) return respond(route, body);
    return route.fallback();
  });
}

test.beforeEach(() => seed());

test('QA-S09-01 checkout page and a clean run', async ({ page }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 2, seen: 220000 }, { listingId: L.W1P, qty: 1, seen: 250000 }], note: 'Happy birthday' });
  const before = sql(`select stock || '/' || held from public.listings where id = '${L.W2P}'`);
  await page.goto('/checkout');
  await expect(page.getByRole('list', { name: 'Checkout steps' })).toContainText('Address');
  await expect(page.getByRole('textbox', { name: /Full name/ })).toHaveValue('Ananya Verma');
  await expect(page.getByRole('textbox', { name: /City/ })).toHaveValue('Mumbai');
  await expect(page.getByRole('combobox', { name: /State/ })).toHaveValue('Maharashtra');
  await expect(page.locator('main')).toContainText('Your address is shared with Meera Iyer only after payment');
  await expect(page.getByRole('checkbox', { name: /I agree to the Terms/ })).toBeChecked();
  const summary = page.locator('.checkout-aside:visible, .checkout-summary-inline:visible').first();
  await expect(summary).toContainText('Kolam at Dawn');
  await expect(summary).toContainText('Monsoon Over Marina');
  await expect(summary).toContainText('Items (3)');
  await expect(summary).toContainText('₹6,900');
  await expect(summary.getByRole('link', { name: 'Edit Cart' })).toBeVisible();
  await page.getByRole('textbox', { name: /Landmark/ }).fill('Near the sea face');

  await page.route('**/functions/v1/api', async (route) => { await new Promise((r) => setTimeout(r, 500)); await route.fallback(); });
  await page.getByRole('button', { name: 'Pay ₹6,900' }).click();
  await expect(page.getByRole('button', { name: 'Holding your pieces…' })).toBeVisible();
  await expect(payWindow(page)).toBeVisible({ timeout: 15000 }); // the first call may wake the function
  await expect(page.locator('.checkout-aside:visible, .checkout-summary-inline:visible').getByText('Almost yours')).toBeVisible();
  await expect(page.getByRole('timer').first()).toHaveText(/^1[45]:\d\d$/);
  await expect(page.getByRole('textbox', { name: /Full name/ })).toHaveAttribute('readonly', '');
  await payWindow(page).getByRole('button', { name: 'Pay' }).click();
  await expect(page.getByText('Confirming your payment…')).toBeVisible();
  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+\?placed=1$/, { timeout: 20000 });

  const [order] = newOrders(B1);
  expect(order.stage).toBe('paid');
  expect(row(order.id, "total || '|' || gift_note || '|' || payment_method || '|' || commission_bps || '|' || extract(epoch from ship_by - paid_at)::int"))
    .toBe(`690000|Happy birthday|upi|1000|${7 * 86400}`);
  expect(sql(`select address2 || '|' || landmark from public.order_shipping where order_id = '${order.id}'`)).toBe('Carter Road, Bandra West|Near the sea face');
  const [stock, held] = before.split('/').map(Number);
  expect(sql(`select stock || '/' || held from public.listings where id = '${L.W2P}'`)).toBe(`${stock - 2}/${held}`);
  expect((await readCart(page, 'B1')).items).toEqual([]);
});

test('QA-S09-02 address errors', async ({ page }) => {
  await signInAs(page, 'B2');
  await setCart(page, 'B2', { artistId: A2, items: [{ listingId: L.W6O, qty: 1, seen: 2800000 }] });
  await page.goto('/checkout');
  await pay(page).click();
  const summary = page.getByRole('alert').filter({ hasText: /^Fix \d+ things/ });
  await expect(summary).toContainText('Fix 6 things before paying');
  await expect(summary).toBeFocused();

  await page.getByRole('textbox', { name: /Full name/ }).fill('Rahul Nair');
  await page.getByRole('textbox', { name: /Phone/ }).fill('98765 4321');
  await page.getByRole('textbox', { name: /Address line 1/ }).fill('12 MG Road');
  await page.getByRole('textbox', { name: /PIN code/ }).fill('40005');
  await page.getByRole('textbox', { name: /City/ }).fill('Pune');
  await page.getByRole('checkbox', { name: /I agree/ }).uncheck();
  await pay(page).click();
  await expect(summary).toContainText('Fix 4 things before paying');
  for (const text of ['Enter a 10-digit mobile number.', 'PIN codes have 6 digits.', 'Choose your State.', 'You need to agree to continue.']) await expect(summary).toContainText(text);
  await summary.getByRole('link', { name: 'PIN code' }).click();
  await expect(page.getByRole('textbox', { name: /PIN code/ })).toBeFocused();
  await expect(page.getByRole('textbox', { name: /PIN code/ })).toHaveAttribute('aria-invalid', 'true');
  expect(newOrders(B2)).toEqual([]);
  await expect(page.getByText(/isn.t served/)).toHaveCount(0);

  await page.getByRole('textbox', { name: /Phone/ }).fill('9876543210');
  await page.getByRole('textbox', { name: /PIN code/ }).fill('411001');
  await page.getByRole('combobox', { name: /State/ }).selectOption('Maharashtra');
  await page.getByRole('checkbox', { name: /I agree/ }).check();
  await pay(page).click();
  await expect(payWindow(page)).toBeVisible();
  expect(newOrders(B2).map((o) => o.stage)).toEqual(['hold']);
});

test('QA-S09-02 the server refuses a bad phone with fields', async () => {
  const b1 = await clientAs('B1');
  const res = await command(b1, 'placeOrder', { artistId: A1, lines: [{ listingId: L.W2P, quantity: 1 }], address: { ...ADDRESS, phone: '98765' } });
  expect(res.error).toMatchObject({ code: 'invalid', fields: ['phone'] });
});

test('QA-S09-03 save the address at checkout', async ({ page }) => {
  await signInAs(page, 'B2');
  await setCart(page, 'B2', { artistId: A2, items: [{ listingId: L.W6O, qty: 1, seen: 2800000 }] });
  await page.goto('/checkout');
  await expect(page.getByRole('checkbox', { name: 'Save this address to my profile' })).toBeChecked(); // no saved address yet
  for (const [label, value] of [[/Full name/, 'Rahul Nair'], [/Phone/, '9876543210'], [/Address line 1/, '12 MG Road'], [/PIN code/, '411001'], [/City/, 'Pune']]) {
    await page.getByRole('textbox', { name: label }).fill(value);
  }
  await page.getByRole('combobox', { name: /State/ }).selectOption('Maharashtra');
  await pay(page).click();
  await payWindow(page).getByRole('button', { name: 'Pay' }).click();
  await expect(page).toHaveURL(/\?placed=1$/, { timeout: 20000 });
  expect(sql(`select city from public.saved_addresses where user_id = '${B2}'`)).toBe('Pune');

  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [`cm-cart:${B2}`, JSON.stringify({ artistId: A4, items: [{ listingId: L.W8P, qty: 1, seen: 180000 }] })]);
  await page.goto('/checkout');
  await expect(page.getByRole('textbox', { name: /City/ })).toHaveValue('Pune');
  const save = page.getByRole('checkbox', { name: 'Save this address to my profile' });
  await expect(save).not.toBeChecked(); // an address is saved already
  await page.getByRole('textbox', { name: /City/ }).fill('Nashik');
  await pay(page).click();
  await payWindow(page).getByRole('button', { name: 'Pay' }).click();
  await expect(page).toHaveURL(/\?placed=1$/, { timeout: 20000 });
  expect(sql(`select city from public.saved_addresses where user_id = '${B2}'`)).toBe('Pune');
  const second = newOrders(B2).at(-1);
  expect(sql(`select city from public.order_shipping where order_id = '${second.id}'`)).toBe('Nashik');
});

test('QA-S09-04 refresh during a hold, and resume', async ({ page }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
  await page.goto('/checkout');
  await pay(page).click();
  await payWindow(page).getByRole('button', { name: 'Close' }).last().click();
  await expect(page.getByRole('timer').first()).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0); // a plain close shows no error
  const [hold] = newOrders(B1);

  await page.reload();
  await expect(page.getByRole('timer').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Change address or Cart' })).toBeVisible();
  expect(newOrders(B1)).toEqual([{ id: hold.id, stage: 'hold' }]);

  await page.goto('/cart');
  await page.locator('.cart-line').getByRole('button', { name: 'Increase quantity' }).click();
  await page.goto('/checkout');
  await expect(page.getByRole('button', { name: 'Continue paying for that Order' })).toBeVisible();
  expect(newOrders(B1)).toEqual([{ id: hold.id, stage: 'hold' }]);
  const heldBefore = Number(sql(`select held from public.listings where id = '${L.W2P}'`));
  await page.getByRole('button', { name: 'Cancel it and use my Cart' }).click();
  await expect(page.getByRole('textbox', { name: /Full name/ })).not.toHaveAttribute('readonly', '');
  await expect(page.locator('.checkout-aside:visible, .checkout-summary-inline:visible').first()).toContainText('× 2');
  expect(newOrders(B1)).toEqual([{ id: hold.id, stage: 'hold_expired' }]);
  expect(Number(sql(`select held from public.listings where id = '${L.W2P}'`))).toBe(heldBefore - 1);
});

test('QA-S09-05 the hold expires on the page', async ({ page }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
  await page.goto('/checkout');
  await pay(page).click();
  await payWindow(page).getByRole('button', { name: 'Close' }).last().click();
  const [hold] = newOrders(B1);
  sql(`update public.orders set hold_until = now() + interval '5 seconds' where id = '${hold.id}'`);
  const expired = page.getByRole('alert').filter({ hasText: 'These took too long to pay for' });
  await expect(expired).toBeVisible({ timeout: 20000 });
  await expect(expired.getByRole('link', { name: 'Return to Cart' })).toBeVisible();
  await expect(pay(page)).toBeDisabled();
  expect((await readCart(page, 'B1')).items).toHaveLength(1);
  const heldBefore = Number(sql(`select held from public.listings where id = '${L.W2P}'`));
  sql('select public.sweep()');
  expect(newOrders(B1)).toEqual([{ id: hold.id, stage: 'hold_expired' }]);
  expect(Number(sql(`select held from public.listings where id = '${L.W2P}'`))).toBe(heldBefore - 1);
});

test.describe('QA-S09-06 stock and price races at Pay', () => {
  test('(a) someone else holds the Original', async ({ page }) => {
    await signInAs(page, 'B1');
    await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W1O, qty: 1, seen: 4200000 }] });
    await page.goto('/checkout');
    await expect(pay(page)).toBeEnabled();
    sql(`update public.listings set held = 1 where id = '${L.W1O}'`);
    await pay(page).click();
    const alert = page.getByRole('alert').filter({ hasText: 'Someone else just bought this one.' });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('link', { name: 'Check your Cart' })).toBeVisible();
    expect(newOrders(B1)).toEqual([]);
    expect(sql(`select held from public.listings where id = '${L.W1O}'`)).toBe('1');
  });

  test('(b) the price rises', async ({ page }) => {
    await signInAs(page, 'B1');
    await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W1O, qty: 1, seen: 4200000 }] });
    await page.goto('/checkout');
    await expect(pay(page)).toBeEnabled();
    sql(`update public.listings set price = 4300000 where id = '${L.W1O}'`);
    await pay(page).click();
    await expect(page.getByRole('alert').filter({ hasText: 'A price changed since you added it. Please check your Cart.' })).toBeVisible();
    expect(newOrders(B1)).toEqual([]);
    await page.getByRole('link', { name: 'Check your Cart' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'went from ₹42,000 to ₹43,000' })).toBeVisible();
  });
});

test('QA-S09-08 three open holds', async ({ page }) => {
  // O1 is one; two more with time left
  sql(`insert into public.orders (code, buyer_id, artist_id, total, stage, hold_until) values
    ('QAH2', '${B1}', '${A1}', 100, 'hold', now() + interval '10 minutes'), ('QAH3', '${B1}', '${A1}', 100, 'hold', now() + interval '10 minutes')`);
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
  await page.goto('/checkout');
  await pay(page).click();
  const alert = page.getByRole('alert').filter({ hasText: 'You have a few payments waiting. Finish or wait a few minutes before starting another.' });
  await expect(alert).toBeVisible();
  await expect(alert.getByRole('link', { name: 'My orders' })).toBeVisible();
  expect(Number(sql(`select count(*) from public.orders where buyer_id = '${B1}' and stage = 'hold'`))).toBe(3);
});

test('QA-S10-03 failure and dismissal keep the hold', async ({ page }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
  await page.goto('/checkout');
  await pay(page).click();
  await payWindow(page).getByRole('button', { name: 'Fail' }).click();
  await expect(page.getByRole('timer').first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'didn’t go through' })).toBeVisible();
  await pay(page).click();
  await payWindow(page).getByRole('button', { name: 'Close' }).last().click();
  await expect(page.getByRole('timer').first()).toBeVisible();
  expect(newOrders(B1).map((o) => o.stage)).toEqual(['hold']);
  await pay(page).click();
  await payWindow(page).getByRole('button', { name: 'Pay' }).click();
  await expect(page).toHaveURL(/\?placed=1$/, { timeout: 20000 });
  expect(newOrders(B1).map((o) => o.stage)).toEqual(['paid']);
});

test('QA-S10-04 the webhook arrives after the buyer left', async ({ page, context }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
  await page.goto('/checkout');
  await pay(page).click();
  await payWindow(page).getByRole('button', { name: 'Close' }).last().click();
  const [hold] = newOrders(B1);
  const rz = row(hold.id, 'razorpay_order_id');
  await page.close();

  expect(await webhook(captured(rz))).toBe(200);
  const next = await context.newPage();
  await next.goto('/cart');
  await expect(next.getByRole('heading', { name: 'Your Cart is empty' })).toBeVisible();
  expect(await next.evaluate((k) => localStorage.getItem(k), `cm-pending-order:${B1}`)).toBeNull();
  await next.goto('/orders');
  await expect(next.locator('article').filter({ hasText: row(hold.id, 'code') })).toContainText('Paid');
  expect(sql(`select string_agg(type, ',' order by type) from public.notifications where data->>'orderId' = '${hold.id}'`)).toBe('order_new,order_paid');
});

test('QA-S10-05 / QA-SYS-03 duplicate callback, duplicate event, request replay', async () => {
  const b1 = await clientAs('B1');
  const requestId = randomUUID();
  const placeInput = { requestId, artistId: A1, lines: [{ listingId: L.W2P, quantity: 1 }], address: ADDRESS };
  const [first, concurrent] = await Promise.all([command(b1, 'placeOrder', placeInput), command(b1, 'placeOrder', placeInput)]);
  const placed = first.ok ? first : concurrent;
  expect(placed.ok).toBe(true);
  // the second call at the same moment either waits its turn (in_progress) or replays the first result
  const other = first.ok ? concurrent : first;
  expect(other.ok ? other : other.error).toEqual(other.ok ? placed : { code: 'conflict', reason: 'in_progress' });
  expect(await command(b1, 'placeOrder', placeInput)).toEqual(placed); // replayed byte for byte
  const missing = await fetchWithoutRequestId(b1);
  expect(missing.error).toMatchObject({ code: 'invalid', reason: 'missing' });
  expect(newOrders(B1)).toHaveLength(1);

  const { orderId, razorpayOrderId } = placed.data;
  const stock = Number(sql(`select stock from public.listings where id = '${L.W2P}'`));
  const proof = { orderId, razorpayOrderId, razorpayPaymentId: `pay_fake_ok_${razorpayOrderId}`, signature: 'fake' };
  const confirmId = randomUUID();
  const paid = await command(b1, 'confirmPayment', { ...proof, requestId: confirmId });
  expect(paid.data.stage).toBe('paid');
  expect(await command(b1, 'confirmPayment', { ...proof, requestId: confirmId })).toEqual(paid);
  expect((await command(b1, 'confirmPayment', proof)).data.stage).toBe('paid');
  const eventId = `evt_${randomUUID()}`;
  expect(await webhook(captured(razorpayOrderId), eventId)).toBe(200);
  expect(await webhook(captured(razorpayOrderId), eventId)).toBe(200);
  expect(await webhook({ ...captured(razorpayOrderId), event: 'order.paid' })).toBe(200);
  expect(Number(sql(`select stock from public.listings where id = '${L.W2P}'`))).toBe(stock - 1);
  expect(sql(`select count(*) from public.notifications where type = 'order_paid' and data->>'orderId' = '${orderId}'`)).toBe('1');
  expect(sql(`select count(*) from public.processed_events where event_id = '${eventId}'`)).toBe('1');

  // a pending claim older than a minute is taken over and runs once
  const stale = randomUUID();
  sql(`insert into public.requests (user_id, request_id, created_at) values ('${B1}', '${stale}', now() - interval '2 minutes')`);
  const takeover = await command(b1, 'placeOrder', { ...placeInput, requestId: stale });
  expect(takeover.ok).toBe(true);
  expect(newOrders(B1)).toHaveLength(2);
});

/** POST /api with no requestId at all. */
async function fetchWithoutRequestId(client) {
  const { data: { session } } = await client.auth.getSession();
  const res = await fetch(`${env().VITE_SUPABASE_URL}/functions/v1/api`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ name: 'placeOrder' }),
  });
  return res.json();
}

test.describe('QA-S10-06 captured after the hold expired', () => {
  const holdThenExpire = async (listingId) => {
    const b1 = await clientAs('B1');
    const placed = await command(b1, 'placeOrder', { artistId: listingId === L.W6O ? A2 : A1, lines: [{ listingId, quantity: 1 }], address: ADDRESS });
    sql(`update public.orders set hold_until = now() - interval '1 minute' where id = '${placed.data.orderId}'`);
    sql('select public.sweep()');
    expect(row(placed.data.orderId, 'stage')).toBe('hold_expired');
    return placed.data;
  };

  test('A: stock still free, the late payment is accepted', async ({ page }) => {
    const { orderId, razorpayOrderId } = await holdThenExpire(L.W2P);
    const stock = Number(sql(`select stock from public.listings where id = '${L.W2P}'`));
    expect(await webhook(captured(razorpayOrderId))).toBe(200);
    expect(row(orderId, 'stage')).toBe('paid');
    expect(Number(sql(`select stock from public.listings where id = '${L.W2P}'`))).toBe(stock - 1);
    await signInAs(page, 'B1');
    await page.goto(`/orders/${orderId}`);
    await expect(page.locator('.page-head')).toContainText('Paid');
  });

  test('B: the last unit sold meanwhile, so the payment is refunded once', async ({ page }) => {
    const { orderId, razorpayOrderId } = await holdThenExpire(L.W6O);
    sql(`update public.listings set stock = 0, status = 'sold' where id = '${L.W6O}'`);
    expect(await webhook(captured(razorpayOrderId))).toBe(200);
    expect(row(orderId, "stage || '|' || refund_reason")).toBe('refunded|sold_during_payment');
    expect(sql(`select count(*) || '|' || min(status) || '|' || min(amount) from public.refunds where order_id = '${orderId}'`)).toBe('1|issued|2800000');
    expect(await webhook(captured(razorpayOrderId))).toBe(200); // a second event does not refund again
    expect(sql(`select count(*) from public.refunds where order_id = '${orderId}'`)).toBe('1');
    await signInAs(page, 'B1');
    await page.goto(`/orders/${orderId}`);
    await expect(page.locator('.page-head')).toContainText('Refunded');
    await expect(page.locator('main')).toContainText('It sold while you were paying.');
    await expect(page.locator('main')).toContainText('Your money is being returned');
  });
});

test('QA-S10-07 bad signature, another buyer, wrong amount', async ({ page }) => {
  const b1 = await clientAs('B1');
  const b2 = await clientAs('B2');
  const placed = (await command(b1, 'placeOrder', { artistId: A1, lines: [{ listingId: L.W2P, quantity: 1 }], address: ADDRESS })).data;
  const proof = { orderId: placed.orderId, razorpayOrderId: placed.razorpayOrderId, razorpayPaymentId: `pay_fake_ok_${placed.razorpayOrderId}` };
  expect((await command(b1, 'confirmPayment', { ...proof, signature: 'not-the-signature' })).error).toMatchObject({ code: 'conflict', reason: 'bad_signature' });
  expect((await command(b2, 'confirmPayment', { ...proof, signature: 'fake' })).error).toMatchObject({ code: 'forbidden' });
  // a payment that belongs to another Razorpay order: the provider reports a different order and amount
  const other = (await command(b1, 'placeOrder', { artistId: A1, lines: [{ listingId: L.W1P, quantity: 1 }], address: ADDRESS })).data;
  const wrong = await command(b1, 'confirmPayment', { ...proof, razorpayPaymentId: `pay_fake_ok_${other.razorpayOrderId}`, signature: 'fake' });
  expect(wrong.error).toMatchObject({ code: 'conflict', reason: 'amount_mismatch' });
  expect(row(placed.orderId, 'stage')).toBe('hold');

  // what the buyer sees for such an answer
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
  sql(`update public.orders set stage = 'hold_expired' where buyer_id = '${B1}' and stage = 'hold'`); // room for a new hold
  await onCommand(page, 'confirmPayment', (route, body) => route.fulfill({ json: { ok: false, error: { code: 'conflict', reason: 'bad_signature' }, requestId: body.requestId } }));
  await page.goto('/checkout');
  await pay(page).click();
  await payWindow(page).getByRole('button', { name: 'Pay' }).click();
  await expect(page.getByRole('alert')).toContainText(/We couldn.t confirm that payment\./);
  await expect(page.getByRole('alert')).toContainText('If money left your account, it will be returned.');
});

test.describe('QA-S10-08 the result is uncertain', () => {
  const start = async (page) => {
    await signInAs(page, 'B1');
    await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
    await page.goto('/checkout');
  };

  test('A: three network failures, then success with the same requestId', async ({ page }) => {
    await start(page);
    const ids = [];
    await onCommand(page, 'confirmPayment', (route, body) => {
      ids.push(body.requestId);
      return ids.length <= 3 ? route.abort() : route.fallback();
    });
    await pay(page).click();
    await payWindow(page).getByRole('button', { name: 'Pay' }).click();
    await expect(page.getByText('Confirming your payment…')).toBeVisible();
    await expect(page.getByText(/failed/i)).toHaveCount(0);
    await expect(page).toHaveURL(/\?placed=1$/, { timeout: 30000 });
    expect(new Set(ids).size).toBe(1);
    expect(newOrders(B1).map((o) => o.stage)).toEqual(['paid']);
  });

  test('B: never answers, but the webhook lands and the poll sees Paid', async ({ page }) => {
    await start(page);
    await onCommand(page, 'confirmPayment', (route) => route.abort());
    await pay(page).click();
    await payWindow(page).getByRole('button', { name: 'Pay' }).click();
    await expect(page.getByText('Confirming your payment…')).toBeVisible();
    const [hold] = newOrders(B1);
    await page.waitForTimeout(5000);
    expect(await webhook(captured(row(hold.id, 'razorpay_order_id')))).toBe(200);
    await expect(page).toHaveURL(/\?placed=1$/, { timeout: 20000 });
    await expect(page.getByText(/failed/i)).toHaveCount(0);
  });

  test('C: nothing for 30 seconds adds the reassurance and a link', async ({ page }) => {
    test.setTimeout(90000);
    await start(page);
    await onCommand(page, 'confirmPayment', (route) => route.abort());
    await pay(page).click();
    await payWindow(page).getByRole('button', { name: 'Pay' }).click();
    const slow = page.getByText(/This is taking longer than usual\. Your payment is safe\./);
    await expect(slow).toBeVisible({ timeout: 40000 });
    await expect(page.getByRole('link', { name: 'Go to your Order' })).toBeVisible();
    await expect(page.getByText(/failed/i)).toHaveCount(0);
  });
});

test('QA-S08-08 saved lines never reach checkout', async ({ page }) => {
  sql(`insert into public.saved_cart_items (buyer_id, listing_id, qty) values ('${B1}', '${L.W2P}', 3)`);
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A2, items: [{ listingId: L.W6O, qty: 1, seen: 2800000 }] });
  await page.goto('/checkout');
  await pay(page).click();
  await payWindow(page).getByRole('button', { name: 'Pay' }).click();
  await expect(page).toHaveURL(/\?placed=1$/, { timeout: 20000 });
  const [order] = newOrders(B1);
  expect(sql(`select string_agg(title, ',') from public.order_lines where order_id = '${order.id}'`)).toBe('Brass Heron');
  expect(sql(`select qty from public.saved_cart_items where buyer_id = '${B1}' and listing_id = '${L.W2P}'`)).toBe('3');
});

