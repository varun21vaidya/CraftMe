// P05 scripts: QA-S18-01, 02, 04 to 09 (QA-S18-03 is the real WhatsApp message: sandbox, listed for Gate B). Needs the api function served in fake provider mode:
//   npx supabase functions serve api --env-file supabase/.env.local --no-verify-jwt
// and the local stack started with the phone test code of supabase/config.toml ([auth.sms.test_otp]: 919000000001 = 123456).
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { captured, clientAs, command, webhook } from './helpers/api.js';
import { sql } from './helpers/db.js';
import { PEOPLE } from './helpers/ids.js';
import { seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const B1 = PEOPLE.B1.id;
const PHONE = '9000000001';
const payWindow = (page) => page.getByRole('dialog', { name: 'Test payment window' });
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const artistRow = (cols) => sql(`select ${cols} from public.artist_private where profile_id = '${B1}'`);
const feeRows = () => Number(sql(`select count(*) from public.fee_orders where profile_id = '${B1}'`));
const isArtistNow = () => sql(`select (raw_app_meta_data ->> 'artist') from auth.users where id = '${B1}'`) === 'true';

/** B1 with the details form done (step 2), the phone verified (step 3), or the fee recorded too (finishing). */
function stage(step) {
  sql(`insert into public.artist_private (profile_id, legal_name, pan, payout_method, specialties, agreed_own_work_at, agreed_terms_at, submitted_at)
       values ('${B1}', 'Ananya Verma', 'ABCDE1234F', '{"type":"upi","upi":"ananya@okhdfc"}', '{Art}', now(), now(), now())`);
  sql(`update public.profiles set city = 'Mumbai', state = 'Maharashtra', bio = 'Small paintings.' where id = '${B1}'`);
  if (step === 'phone' || step === 'fee') sql(`update public.artist_private set phone_verified = true, phone = '+91${PHONE}' where profile_id = '${B1}'`);
  if (step === 'fee') {
    sql(`update public.artist_private set onboarding_paid_at = now(), onboarding_amount = 49900, onboarding_payment_id = 'pay_fake_ok_order_fake_first', onboarding_order_id = 'order_fake_first' where profile_id = '${B1}'`);
  }
}

async function fillDetails(page, { method = 'upi' } = {}) {
  await page.getByLabel('Legal name').fill('Ananya Verma');
  await page.getByLabel(/^PAN/).fill('abcde1234f');
  await page.getByLabel('City').fill('Mumbai');
  await page.getByLabel('State').selectOption('Maharashtra');
  if (method === 'upi') await page.locator('#ob-upi').fill('ananya@okhdfc');
  await page.getByLabel('Short bio').fill('Small paintings.');
  await page.getByRole('button', { name: 'Art', exact: true }).click();
  await page.getByLabel('Everything I sell is my own work.').check();
  await page.getByLabel(/I am 18 or older/).check();
}

test.beforeEach(() => seed());
test.afterAll(() => seed());

test('QA-S18-01 details step: required fields, upper-cased PAN, saved private details', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto('/become-artist');
  await expect(page.getByRole('heading', { name: 'Become an Artist', level: 1 })).toBeVisible();
  await expect(page.getByText('Private to you.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How selling works' })).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);

  await page.getByRole('button', { name: 'Continue to phone check' }).click();
  const summary = page.getByRole('alert').filter({ hasText: 'Please check these fields.' });
  await expect(summary).toBeFocused();
  for (const f of ['Legal name', 'PAN', 'City', 'State', 'UPI ID', 'Short bio', 'What do you make?', 'Own work', 'Artist agreement']) await expect(summary).toContainText(f);
  await expect(page.getByLabel('Legal name')).toHaveAttribute('aria-invalid', 'true');
  expect(sql(`select count(*) from public.artist_private where profile_id = '${B1}'`)).toBe('0');

  await fillDetails(page);
  await expect(page.getByLabel(/^PAN/)).toHaveValue('ABCDE1234F');
  await page.getByRole('button', { name: 'Continue to phone check' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
  expect(artistRow(`legal_name || '|' || pan || '|' || (payout_method ->> 'upi') || '|' || specialties::text || '|' || (verified_at is null) || '|' || phone_verified`))
    .toBe('Ananya Verma|ABCDE1234F|ananya@okhdfc|{Art}|true|false');
  expect(artistRow('(agreed_own_work_at is not null and agreed_terms_at is not null and submitted_at is not null)')).toBe('t');
  expect(sql(`select city || '|' || state || '|' || bio from public.profiles where id = '${B1}'`)).toBe('Mumbai|Maharashtra|Small paintings.');
  expect(isArtistNow()).toBe(false);
});

test('QA-S18-02 bank details: validation, upper-case IFSC, the UPI field is hidden', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto('/become-artist');
  await fillDetails(page, { method: 'bank' });
  await page.getByRole('radio', { name: /Bank account/ }).check();
  await expect(page.locator('#ob-upi')).toHaveCount(0);
  await page.getByLabel('Account holder name').fill('Ananya Verma');
  await page.getByLabel('IFSC').fill('hdfc0001234');
  await expect(page.getByLabel('IFSC')).toHaveValue('HDFC0001234');
  await page.getByLabel(/^Account number/).fill('1234567');
  await page.getByLabel('Confirm account number').fill('12345678');
  await page.getByRole('button', { name: 'Continue to phone check' }).click();
  await expect(page.getByText('Account numbers have 9 to 18 digits.').first()).toBeVisible();
  await expect(page.getByText('The two account numbers don’t match.').first()).toBeVisible();
  await page.getByLabel(/^Account number/).fill('123456789012');
  await page.getByLabel('Confirm account number').fill('123456789012');
  await page.getByRole('button', { name: 'Continue to phone check' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
  expect(artistRow(`payout_method::jsonb @> '{"type":"bank","account":"123456789012","ifsc":"HDFC0001234","holder":"Ananya Verma"}'`)).toBe('t');
  expect(artistRow('holder_name')).toBe('Ananya Verma');
});

test('QA-S18-02 the server refuses a bank method with no holder and a bad IFSC', async () => {
  const b1 = await clientAs('B1');
  const { error } = await b1.rpc('submit_verification', { p_legal_name: 'A B', p_pan: 'ABCDE1234F', p_method: { type: 'bank', account: '123456789', ifsc: 'bad' }, p_profile: null });
  expect(JSON.parse(error.message).fields).toEqual(expect.arrayContaining(['holder', 'ifsc']));
});

test.describe('QA-S18-04 code entry', () => {
  test('wrong code, paste, change number, rate limit, then verify', async ({ page }) => {
    test.setTimeout(120000);
    stage('details');
    await page.clock.install();
    await signInAs(page, 'B1');
    await page.goto('/become-artist');
    await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
    await page.getByLabel(/^Phone/).fill(PHONE);
    await page.getByRole('button', { name: 'Send code on WhatsApp' }).click();
    await expect(page.getByText(`We sent a 6-digit code on WhatsApp to +91 ${PHONE}. It works for 10 minutes.`)).toBeVisible();
    await expect(page.getByText(/Resend in 1:00|Resend in 0:5\d/)).toBeVisible();

    await page.getByLabel('Digit 1').fill('1');
    for (const [i, d] of [['2', '1'], ['3', '1'], ['4', '1'], ['5', '1'], ['6', '1']]) await page.getByLabel(`Digit ${i}`).fill(d);
    await page.getByRole('button', { name: 'Verify and continue' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'That code isn’t right. Check it and try again.' })).toBeVisible();
    await expect(page.getByLabel('Digit 1')).toBeFocused();
    for (let i = 1; i <= 6; i++) await expect(page.getByLabel(`Digit ${i}`)).toHaveValue('');
    expect(artistRow('phone_verified')).toBe('f');

    await page.getByLabel('Digit 1').evaluate((el) => { // paste a whole code into the first box
      const data = new DataTransfer(); data.setData('text', '123456');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    });
    for (let i = 1; i <= 6; i++) await expect(page.getByLabel(`Digit ${i}`)).toHaveValue(String(i));
    await page.getByLabel('Digit 3').press('Backspace');
    await page.getByLabel('Digit 3').press('Backspace'); // an empty box moves back and clears the one before
    await expect(page.getByLabel('Digit 2')).toHaveValue('');
    await expect(page.getByLabel('Digit 2')).toBeFocused();

    await page.getByRole('button', { name: 'Change number' }).click();
    await expect(page.getByLabel(/^Phone/)).toHaveValue(PHONE);
    await page.getByRole('button', { name: 'Send code on WhatsApp' }).click(); // the same number again, within the minute: the server may refuse
    await expect(page.getByText(`We sent a 6-digit code on WhatsApp to +91 ${PHONE}.`).or(page.getByText('Too many tries. Wait a minute, then try again.'))).toBeVisible();
  });

  test('a send the server refuses says "Too many tries"; the real limit refuses the second send in a row', async ({ page }) => {
    stage('details');
    await signInAs(page, 'B1');
    // the limit itself, at the Auth service
    const b1 = await clientAs('B1');
    await b1.auth.updateUser({ phone: `+91${PHONE}` });
    const quick = await b1.auth.resend({ type: 'phone_change', phone: `+91${PHONE}` });
    expect(quick.error?.code).toBe('over_sms_send_rate_limit');
    // and the page's wording for it
    await page.route('**/auth/v1/user', (route) => (route.request().method() === 'PUT'
      ? route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ code: 'over_sms_send_rate_limit', message: 'rate' }) }) : route.continue()));
    await page.goto('/become-artist');
    await page.getByLabel(/^Phone/).fill(PHONE);
    await page.getByRole('button', { name: 'Send code on WhatsApp' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Too many tries. Wait a minute, then try again.' })).toBeVisible();
  });

  test('verify with the local test code; phone_verified only after it', async ({ page }) => {
    stage('details');
    await signInAs(page, 'B1');
    await page.goto('/become-artist');
    await page.getByLabel(/^Phone/).fill(PHONE);
    await page.getByRole('button', { name: 'Send code on WhatsApp' }).click();
    await expect(page.getByLabel('Digit 1')).toBeVisible();
    expect(artistRow('phone_verified')).toBe('f');
    await page.getByLabel('Digit 1').fill('123456');
    for (let i = 1; i <= 6; i++) await expect(page.getByLabel(`Digit ${i}`)).toHaveValue(String(i));
    await page.getByRole('button', { name: 'Verify and continue' }).click();
    await expect(page.getByRole('heading', { name: 'Open your shop' })).toBeVisible();
    expect(artistRow('phone_verified || \'|\' || phone')).toBe(`t|+91${PHONE}`);
    expect(sql(`select (phone_confirmed_at is not null) from auth.users where id = '${B1}'`)).toBe('t');
  });

  test('other failures: a number on another account, the hook down, and a verified number that could not be saved', async ({ page }) => {
    stage('details');
    await signInAs(page, 'B1');
    await page.route('**/auth/v1/user', (route) => (route.request().method() === 'PUT'
      ? route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ code: 'phone_exists', message: 'taken' }) }) : route.continue()));
    await page.goto('/become-artist');
    await page.getByLabel(/^Phone/).fill(PHONE);
    await page.getByRole('button', { name: 'Send code on WhatsApp' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'That number is already used on another CraftMe account.' })).toBeVisible();
    await page.unroute('**/auth/v1/user');
    await page.route('**/auth/v1/user', (route) => (route.request().method() === 'PUT'
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'sms_send_failed', message: 'hook' }) }) : route.continue()));
    await page.getByRole('button', { name: 'Send code on WhatsApp' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Phone checks aren’t working right now. Please try again later.' })).toBeVisible();
    await page.unroute('**/auth/v1/user');

    // the code is accepted but confirmPhone fails: only that call is repeated
    let failSave = true;
    await page.route('**/functions/v1/api', (route) => (failSave && route.request().postData()?.includes('"confirmPhone"')
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'unavailable' } }) }) : route.continue()));
    await page.getByRole('button', { name: 'Send code on WhatsApp' }).click();
    await page.getByLabel('Digit 1').fill('123456');
    await page.getByRole('button', { name: 'Verify and continue' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Your number is verified.' })).toContainText('We couldn’t save that yet.');
    expect(artistRow('phone_verified')).toBe('f');
    failSave = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'Open your shop' })).toBeVisible();
    expect(artistRow('phone_verified')).toBe('t');
  });

  test('the browser cannot set phone_verified, and confirmPhone refuses an unverified number', async () => {
    stage('details');
    const b1 = await clientAs('B1');
    const direct = await b1.from('artist_private').update({ phone_verified: true }).eq('profile_id', B1).select();
    expect(direct.data?.length ?? 0).toBe(0);
    expect(artistRow('phone_verified')).toBe('f');
    expect(await command(b1, 'confirmPhone')).toMatchObject({ ok: false, error: { code: 'conflict', reason: 'phone_not_verified' } });
  });
});

test.describe('QA-S18-05 to 07 the fee', () => {
  test('QA-S18-05 / 06 pay, confirm, Done, role without a reload', async ({ page }) => {
    test.setTimeout(120000);
    stage('phone');
    await signInAs(page, 'B1');
    await page.goto('/become-artist');
    await expect(page.getByRole('heading', { name: 'Open your shop' })).toBeVisible();
    await expect(page.getByText('₹499').first()).toBeVisible();
    await expect(page.getByText('A small share of each sale. Nothing monthly.')).toBeVisible();
    await page.getByRole('button', { name: /Open my shop for ₹499/ }).click();
    await expect(page.getByText('Tick the box to continue.')).toBeVisible();
    expect(feeRows()).toBe(0);
    await page.getByLabel('I understand this payment isn’t refunded.').check();
    await page.getByRole('button', { name: /Open my shop for ₹499/ }).click();
    await payWindow(page).getByRole('button', { name: 'Pay' }).click();
    await expect(page.getByRole('heading', { name: 'You’re an Artist on CraftMe' })).toBeVisible({ timeout: 30000 });
    expect(sql(`select (paid_at is not null) || '|' || payment_id from public.fee_orders where profile_id = '${B1}'`)).toMatch(/^true\|pay_fake_ok_order_fake_/);
    expect(artistRow('onboarding_amount || \'|\' || (onboarding_paid_at is not null)')).toBe('49900|t');
    expect(isArtistNow()).toBe(true);
    expect(sql(`select roles::text from public.profiles where id = '${B1}'`)).toContain('artist');

    // QA-S18-06
    const done = page.getByRole('status').filter({ hasText: 'Your shop is ready for its first piece.' });
    await expect(done.getByText('Open your shop')).toBeVisible();
    await expect(done.getByRole('link', { name: 'Add your first Artwork' })).toHaveAttribute('href', '/dashboard/artworks/new');
    await expect(done.getByRole('link', { name: 'Connect Instagram' })).toHaveAttribute('href', '/dashboard/instagram');
    await expect(done.getByText('We’re checking your details so you can be paid')).toBeVisible();
    await done.getByRole('link', { name: 'Go to my dashboard' }).click();
    await expect(page).toHaveURL(/\/dashboard\/orders$/); // the claims were refreshed: no bounce to /
    await page.goto('/become-artist');
    await expect(page.getByRole('heading', { name: 'You’re an Artist on CraftMe' })).toBeVisible();
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Artist dashboard' })).toBeVisible();
  });

  test('QA-S18-07 closed window, reused order, a failed confirm then the webhook, a repeat, and a second payment', async ({ page }) => {
    test.setTimeout(180000);
    stage('phone');
    const b1 = await clientAs('B1');
    await signInAs(page, 'B1');
    await page.goto('/become-artist');
    await page.getByLabel('I understand this payment isn’t refunded.').check();
    await page.getByRole('button', { name: /Open my shop for ₹499/ }).click();
    await payWindow(page).getByRole('button', { name: 'Close' }).last().click();
    await expect(page.getByRole('heading', { name: 'Open your shop' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0); // closing the window shows nothing
    expect(feeRows()).toBe(1);
    await page.getByRole('button', { name: /Open my shop for ₹499/ }).click();
    await payWindow(page).getByRole('button', { name: 'Close' }).last().click();
    expect(feeRows()).toBe(1); // the same order again within 15 minutes
    const rz = sql(`select razorpay_order_id from public.fee_orders where profile_id = '${B1}'`);

    await page.route('**/functions/v1/api', (route) => (route.request().postData()?.includes('"confirmFeePayment"')
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'unavailable' } }) }) : route.continue()));
    await page.getByRole('button', { name: /Open my shop for ₹499/ }).click();
    await payWindow(page).getByRole('button', { name: 'Pay' }).click();
    await expect(page.getByRole('heading', { name: 'Confirming your payment…' })).toBeVisible();
    expect(await webhook(captured(rz))).toBe(200);
    await expect(page.getByRole('heading', { name: 'You’re an Artist on CraftMe' })).toBeVisible({ timeout: 60000 });
    const eventId = `evt_${randomUUID()}`;
    expect(await webhook(captured(rz), eventId)).toBe(200);
    expect(await webhook(captured(rz), eventId)).toBe(200);
    expect(await webhook({ ...captured(rz), event: 'order.paid' })).toBe(200);
    expect(sql(`select count(*) from public.fee_orders where profile_id = '${B1}' and paid_at is not null and refunded_at is null`)).toBe('1');
    const first = artistRow('onboarding_payment_id');

    // a second, older fee order is paid too: refunded, nothing else changes
    sql(`insert into public.fee_orders (razorpay_order_id, profile_id, amount, created_at) values ('order_fake_older', '${B1}', 49900, now() - interval '1 day')`);
    const second = await command(b1, 'confirmFeePayment', { razorpayOrderId: 'order_fake_older', razorpayPaymentId: 'pay_fake_ok_order_fake_older', signature: 'fake' });
    expect(second).toMatchObject({ ok: true, data: { duplicate: true } });
    expect(sql(`select (paid_at is not null) || '|' || (refunded_at is not null) from public.fee_orders where razorpay_order_id = 'order_fake_older'`)).toBe('true|true');
    expect(artistRow('onboarding_payment_id')).toBe(first);
    const again = await command(b1, 'confirmFeePayment', { razorpayOrderId: 'order_fake_older', razorpayPaymentId: 'pay_fake_ok_order_fake_older', signature: 'fake' });
    expect(again).toMatchObject({ ok: true, data: { duplicate: true } });
    // someone else's order is refused
    sql(`insert into public.fee_orders (razorpay_order_id, profile_id, amount) values ('order_fake_b2', '${PEOPLE.B2.id}', 49900)`);
    expect(await command(b1, 'confirmFeePayment', { razorpayOrderId: 'order_fake_b2', razorpayPaymentId: 'pay_fake_ok_order_fake_b2', signature: 'fake' })).toMatchObject({ ok: false, error: { code: 'forbidden' } });
  });

  test('QA-S18-07 the page says so when the confirm reports a second payment', async ({ page }) => {
    stage('phone');
    await signInAs(page, 'B1');
    await page.route('**/functions/v1/api', (route) => (route.request().postData()?.includes('"confirmFeePayment"')
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: { duplicate: true } }) }) : route.continue()));
    await page.goto('/become-artist');
    await page.getByLabel('I understand this payment isn’t refunded.').check();
    await page.getByRole('button', { name: /Open my shop for ₹499/ }).click();
    await payWindow(page).getByRole('button', { name: 'Pay' }).click();
    await expect(page.getByText('You were charged twice. The second payment is being returned.')).toBeVisible();
  });

  test('a payment that fails or never opens stays on the fee step', async ({ page }) => {
    stage('phone');
    await signInAs(page, 'B1');
    await page.goto('/become-artist');
    await page.getByLabel('I understand this payment isn’t refunded.').check();
    await page.getByRole('button', { name: /Open my shop for ₹499/ }).click();
    await payWindow(page).getByRole('button', { name: 'Fail' }).click();
    await expect(page.getByText('That payment didn’t go through. You can try again.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Open my shop for ₹499/ })).toBeEnabled();
  });
});

test.describe('QA-S18-08 resume after a reload', () => {
  test('details, phone, then paid with the role not yet set', async ({ page }) => {
    test.setTimeout(120000);
    await signInAs(page, 'B1');
    await page.goto('/become-artist');
    await fillDetails(page);
    await page.getByRole('button', { name: 'Continue to phone check' }).click();
    await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible(); // after the details step: phone

    await page.getByRole('button', { name: 'Back' }).click(); // ?step=1 edits the details, prefilled
    await expect(page).toHaveURL(/step=1/);
    await expect(page.getByLabel('Legal name')).toHaveValue('Ananya Verma');
    await expect(page.getByLabel('Short bio')).toHaveValue('Small paintings.');
    await page.getByRole('link', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/profile$/);

    sql(`update public.artist_private set phone_verified = true, phone = '+91${PHONE}' where profile_id = '${B1}'`);
    await page.goto('/become-artist');
    await expect(page.getByRole('heading', { name: 'Open your shop' })).toBeVisible(); // after the phone step: fee

    sql(`update public.artist_private set onboarding_paid_at = now(), onboarding_amount = 49900, onboarding_payment_id = 'pay_fake_ok_order_fake_x', onboarding_order_id = 'order_fake_x' where profile_id = '${B1}'`);
    let failures = 1;
    await page.route('**/functions/v1/api', (route) => (failures-- > 0 && route.request().postData()?.includes('"becomeArtist"')
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'unavailable' } }) }) : route.continue()));
    await page.goto('/become-artist');
    const alert = page.getByRole('alert').filter({ hasText: 'Your payment is recorded.' });
    await expect(alert).toContainText('We couldn’t open your shop yet.');
    await page.reload();
    await page.route('**/functions/v1/api', (route) => route.continue());
    await expect(page.getByRole('heading', { name: 'You’re an Artist on CraftMe' }).or(alert)).toBeVisible(); // a reload lands on the same finishing state
    if (await alert.isVisible()) await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'You’re an Artist on CraftMe' })).toBeVisible();
    expect(isArtistNow()).toBe(true);
    expect(sql(`select count(*) from public.fee_orders where profile_id = '${B1}'`)).toBe('0'); // no second payment
  });
});

test.describe('QA-S18-09 closed, fee not set, payments not set up', () => {
  const links = (page) => page.getByRole('link', { name: /Sell your art|Become an Artist|Start selling/ });

  test('run 1: acceptArtists off', async ({ page }) => {
    sql(`update public.settings set switches = switches || '{"acceptArtists": false}'::jsonb`);
    await signInAs(page, 'B1');
    await page.goto('/become-artist');
    await expect(page.getByText('CraftMe isn’t taking new Artists right now.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse art' })).toBeVisible();
    await expect(page.getByLabel('Legal name')).toHaveCount(0);
    for (const url of ['/', '/profile', '/browse']) {
      await page.goto(url);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expect(links(page)).toHaveCount(0);
    }
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Become an Artist' })).toHaveCount(0);
    stage('phone');
    expect(await command(await clientAs('B1'), 'payOnboardingFee')).toMatchObject({ ok: false, error: { code: 'conflict', reason: 'artists_closed' } });
  });

  test('with the switch on the entries appear: header, footer, account menu', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto('/browse');
    await expect(page.locator('header').getByRole('link', { name: 'Sell your art' })).toHaveAttribute('href', '/become-artist');
    await expect(page.locator('footer').getByRole('link', { name: 'Sell your art' })).toHaveAttribute('href', '/become-artist');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Become an Artist' })).toHaveAttribute('href', '/become-artist');
  });

  test('run 2: the fee is not set', async ({ page }) => {
    sql('update public.settings set onboarding_fee_paise = 0');
    stage('phone');
    await signInAs(page, 'B1');
    await page.goto('/become-artist');
    await expect(page.getByText('The fee to open a shop isn’t set yet. Please check back soon.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Open my shop/ })).toHaveCount(0);
    expect(await command(await clientAs('B1'), 'payOnboardingFee')).toMatchObject({ ok: false, error: { code: 'conflict', reason: 'fee_not_set' } });
  });

  test('run 3: payments not set up (the answer is simulated; the server half needs the function served without keys)', async ({ page }) => {
    stage('phone');
    await signInAs(page, 'B1');
    await page.route('**/functions/v1/api', (route) => (route.request().postData()?.includes('"payOnboardingFee"')
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: { code: 'unavailable', reason: 'payments_not_configured' } }) }) : route.continue()));
    await page.goto('/become-artist');
    await page.getByLabel('I understand this payment isn’t refunded.').check();
    await page.getByRole('button', { name: /Open my shop for ₹499/ }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Payments aren’t set up on this site yet.' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open my shop for ₹499/ })).toBeDisabled();
  });

  test('an existing Artist who opens /become-artist sees the Done view, even with the switch off', async ({ page }) => {
    sql(`update public.settings set switches = switches || '{"acceptArtists": false}'::jsonb`);
    await signInAs(page, 'A1');
    await page.goto('/become-artist');
    await expect(page.getByRole('heading', { name: 'You’re an Artist on CraftMe' })).toBeVisible();
    await expect(links(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Artist dashboard' })).toBeVisible(); // the public header has no Artist links (P06); the account menu does
  });
});
