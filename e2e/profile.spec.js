// P04 scripts: QA-S16-01 to QA-S16-06 (QA-S16-04 is in supabase/schema.test.mjs; QA-S16-07 waits for P09).
// Needs the local stack, the seed and the api function served for the deletion job:
//   npx supabase functions serve api --env-file supabase/.env.local --no-verify-jwt
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientAs } from './helpers/api.js';
import { setCart } from './helpers/cart.js';
import { sql } from './helpers/db.js';
import { L, O, PEOPLE } from './helpers/ids.js';
import { env, seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const B1 = PEOPLE.B1.id;
const B2 = PEOPLE.B2.id;
const A1 = PEOPLE.A1.id;
const cronSecret = () => (fs.readFileSync('supabase/.env.local', 'utf8').match(/^CRON_SECRET=(.*)$/m) || [])[1]?.trim();
const cron = async (job) => (await fetch(`${env().VITE_SUPABASE_URL}/functions/v1/api/cron?job=${job}`, {
  method: 'POST', headers: { 'x-cron-secret': cronSecret(), apikey: env().VITE_SUPABASE_PUBLISHABLE_KEY },
})).json();
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
// a real 1x1 PNG, padded with bytes after IEND (ignored by decoders) to the size a test needs
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const png = (name, kb = 200) => ({ name, mimeType: 'image/png', buffer: Buffer.concat([PNG, Buffer.alloc(kb * 1024, 0)]) });
const avatars = () => Number(sql(`select count(*) from storage.objects where bucket_id = 'avatars' and name like '${B1}/%'`));
const toastText = (page, text) => page.locator('.toasts').getByText(text);

test.describe('QA-S16-01 profile page and saving', () => {
  test.beforeAll(() => seed());
  test.afterAll(() => seed());

  test('the page, its shortcuts, validation and saving', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Your profile' })).toBeVisible();
    await expect(page.getByLabel('Email')).toHaveValue('b1@craftme.test');
    await expect(page.getByLabel('Email')).toHaveAttribute('readonly', '');
    await expect(page.getByText('Signed in with Google. Email can’t be changed here.')).toBeVisible();
    await expect(page.getByText('You sign in with Google, so there is no CraftMe password.')).toBeVisible();
    await expect(page.locator('input[type=password]')).toHaveCount(0);
    const roles = page.getByRole('complementary', { name: 'Your roles and shortcuts' });
    await expect(roles).toContainText('Buyer');
    await expect(roles.getByRole('link', { name: 'Become an Artist' })).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);

    await page.getByLabel('Name').fill('');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Add your name.')).toBeVisible();
    expect(sql(`select display_name from public.profiles where id = '${B1}'`)).toBe('Ananya Verma');

    await page.getByLabel('Name').fill('Ananya V');
    await page.getByLabel('Short bio').fill('b'.repeat(201));
    await expect(page.getByText('200/200')).toBeVisible(); // the counter blocks at 200: the 201st character is not accepted
    expect(await page.getByLabel('Short bio').inputValue()).toHaveLength(200);
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(toastText(page, 'Profile saved')).toBeVisible();
    expect(sql(`select display_name || '|' || length(bio) from public.profiles where id = '${B1}'`)).toBe('Ananya V|200');
    expect(sql(`select count(*) from public.profiles where display_name = 'Ananya V'`)).toBe('1'); // B1 only

    // the shortcuts work
    await roles.getByRole('link', { name: 'My orders' }).click();
    await expect(page).toHaveURL(/\/orders$/);
    await page.goBack();
    await roles.getByRole('link', { name: 'Notifications' }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await page.goBack();
    await roles.getByRole('link', { name: 'Privacy policy' }).click();
    await expect(page).toHaveURL(/\/legal\/privacy$/);
  });

  test('a longer bio saved earlier is refused until it is cut', async ({ page }) => {
    sql(`update public.profiles set bio = '${'c'.repeat(300)}' where id = '${B1}'`);
    await signInAs(page, 'B1');
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Use 200 characters or fewer.')).toBeVisible();
    expect(sql(`select length(bio) from public.profiles where id = '${B1}'`)).toBe('300');
  });

  test('a failed load says so and recovers', async ({ page }) => {
    await signInAs(page, 'B1');
    let fail = true;
    await page.route('**/rest/v1/profiles?*id=eq.*', (route) => (fail && route.request().method() === 'GET' ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
    await page.goto('/profile');
    await expect(page.getByRole('alert').filter({ hasText: "We couldn't load your profile." })).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByLabel('Name')).toBeVisible();
  });
});

test.describe('QA-S16-02 photo upload, bad file, partial failure', () => {
  test.beforeAll(() => seed());
  test.afterAll(() => seed());

  test('wrong files change nothing; a good one saves; a failed save leaves no file; Remove clears it', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto('/profile');
    const about = page.getByRole('form', { name: 'About you' });
    const pick = (file) => page.getByLabel('Choose a photo').setInputFiles(file);
    const bad = page.getByText('Use a JPEG or PNG up to 5 MB.');
    const avatar = page.getByRole('img', { name: 'Your photo' });
    await expect(avatar).toHaveCount(0);

    await pick({ name: 'big.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(6 * 1024 * 1024, 1) });
    await expect(bad).toBeVisible();
    await pick({ name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await expect(bad).toBeVisible();
    await expect(avatar).toHaveCount(0);
    expect(avatars()).toBe(0);

    await pick(png('one.png'));
    await expect(bad).toBeHidden();
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(toastText(page, 'Profile saved')).toBeVisible();
    await expect(avatar).toHaveAttribute('src', /\/object\/public\/avatars\//);
    const saved = sql(`select photo_url from public.profiles where id = '${B1}'`);
    expect(saved).toContain(`/avatars/${B1}/`);
    expect(avatars()).toBe(1);

    // the profile update fails after the file went up
    await page.route('**/rest/v1/profiles?*', (route) => (route.request().method() === 'PATCH' ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
    await pick(png('two.png'));
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /Something went wrong|couldn/ })).toBeVisible();
    await expect.poll(avatars).toBe(1); // the failed attempt's file was removed again
    expect(sql(`select photo_url from public.profiles where id = '${B1}'`)).toBe(saved);
    await page.unroute('**/rest/v1/profiles?*');

    await about.getByRole('button', { name: 'Remove' }).click(); // drops the picked-but-unsaved file
    await expect(avatar).toHaveAttribute('src', saved);
    await about.getByRole('button', { name: 'Remove' }).click();
    await expect(page.locator('.avatar.xl')).toHaveText('AV');
    await expect(avatar).toHaveCount(0);
    expect(sql(`select photo_url from public.profiles where id = '${B1}'`)).toBe('');
    await expect.poll(avatars).toBe(0);
  });
});

test.describe('QA-S16-03 saved address', () => {
  test.beforeAll(() => seed());
  test.afterAll(() => seed());

  test('validation, saving, checkout prefill, Orders untouched, remove', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto('/profile');
    const panel = page.getByRole('region', { name: 'Saved address' });
    await expect(panel.getByTestId('saved-address')).toContainText('Ananya Verma');
    await panel.getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit saved address' });
    await dialog.getByLabel('PIN code').fill('40005');
    await dialog.getByRole('button', { name: 'Save address' }).click();
    await expect(dialog.getByText('PIN codes have 6 digits.')).toBeVisible();
    await expect(dialog.getByLabel('PIN code')).toBeFocused();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('PIN code').fill('400051');
    await dialog.getByRole('button', { name: 'Save address' }).click();
    await expect(toastText(page, 'Address saved')).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(panel.getByTestId('saved-address')).toContainText('400051');
    expect(sql(`select pin from public.saved_addresses where user_id = '${B1}'`)).toBe('400051');
    expect(sql(`select pin from public.order_shipping where order_id = '${O.O2}'`)).toBe('400050');

    await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
    await page.goto('/checkout');
    await expect(page.getByLabel('PIN code')).toHaveValue('400051');
    await page.goto(`/orders/${O.O2}`);
    await expect(page.getByText('400050').first()).toBeVisible();

    // remove asks once
    await page.goto('/profile');
    await panel.getByRole('button', { name: 'Remove' }).click();
    const confirm = page.getByRole('alertdialog', { name: 'Remove your saved address?' });
    await confirm.getByRole('button', { name: 'Cancel' }).click();
    expect(sql(`select count(*) from public.saved_addresses where user_id = '${B1}'`)).toBe('1');
    await panel.getByRole('button', { name: 'Remove' }).click();
    await confirm.getByRole('button', { name: 'Remove address' }).click();
    await expect(panel.getByText('No saved address yet.')).toBeVisible();
    expect(sql(`select count(*) from public.saved_addresses where user_id = '${B1}'`)).toBe('0');
    await expect(panel.getByRole('button', { name: 'Add' })).toBeVisible();
  });

  test('a first address can be added; a refused save keeps the dialog open with the values', async ({ page }) => {
    sql(`delete from public.saved_addresses where user_id = '${B1}'`);
    await signInAs(page, 'B1');
    await page.goto('/profile');
    const panel = page.getByRole('region', { name: 'Saved address' });
    await panel.getByRole('button', { name: 'Add' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add an address' });
    await dialog.getByLabel('Full name').fill('Ananya Verma');
    await dialog.getByLabel('Phone').fill('9876543210');
    await dialog.getByLabel('Address line 1').fill('12 Carter Road');
    await dialog.getByLabel('PIN code').fill('400050');
    await dialog.getByLabel('City').fill('Mumbai');
    await dialog.getByLabel('State').selectOption('Maharashtra');
    await page.route('**/rest/v1/saved_addresses*', (route) => (route.request().method() === 'POST' ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
    await dialog.getByRole('button', { name: 'Save address' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(dialog.getByLabel('City')).toHaveValue('Mumbai');
    await page.unroute('**/rest/v1/saved_addresses*');
    await dialog.getByRole('button', { name: 'Save address' }).click();
    await expect(toastText(page, 'Address saved')).toBeVisible();
    expect(sql(`select pin from public.saved_addresses where user_id = '${B1}'`)).toBe('400050');
  });
});

test.describe('QA-S16-05 delete account dialog', () => {
  // B2 has no open orders in this run: O3 and O10 belong to another buyer
  test.beforeEach(() => { seed(); sql(`update public.orders set buyer_id = '${B1}' where buyer_id = '${B2}'`); });
  test.afterAll(() => seed());

  test('DELETE must be typed exactly; the request signs the person out', async ({ page }) => {
    await signInAs(page, 'B2');
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Delete my Account' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete your Account?' });
    await expect(dialog).toContainText("This can't be undone. You'll be logged out and your data deleted within 30 days.");
    const go = dialog.getByRole('button', { name: 'Delete Account' });
    await expect(go).toBeDisabled();
    await dialog.getByLabel('Type DELETE to confirm').fill('delete');
    await expect(go).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: 'Delete my Account' }).click();
    await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
    await expect(go).toBeEnabled();
    await go.click();
    await expect(page).toHaveURL(/\/\/[^/]+\/$/);
    expect(new URL(page.url()).pathname).toBe('/');
    await expect(toastText(page, 'Deletion requested')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
    expect(sql(`select scope || '|' || status || '|' || cardinality(blockers) from public.deletion_requests where user_id = '${B2}'`)).toBe('everything|pending|0');
    expect(await page.evaluate(() => sessionStorage.getItem('cm-return'))).toBeNull(); // the guard did not remember /profile
  });

  test('a failed request signs nobody out and the dialog says why', async ({ page }) => {
    await signInAs(page, 'B2');
    await page.route('**/rest/v1/rpc/request_deletion', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Delete my Account' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete your Account?' });
    await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
    await dialog.getByRole('button', { name: 'Delete Account' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/profile$/);
    expect(sql(`select count(*) from public.deletion_requests where user_id = '${B2}'`)).toBe('0');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
  });
});

test.describe('QA-S16-06 deletion waits, then anonymises', () => {
  test.beforeAll(() => seed());
  test.afterAll(() => seed());

  test('waiting, the banner, keeping the Account, then the job', async ({ page }) => {
    // B1 has open Orders (O2, O4 ...)
    await signInAs(page, 'B1');
    await page.goto('/profile');
    await page.getByRole('button', { name: 'Delete my Account' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete your Account?' });
    await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
    await dialog.getByRole('button', { name: 'Delete Account' }).click();
    await expect(toastText(page, 'Deletion requested')).toBeVisible();
    expect(sql(`select status from public.deletion_requests where user_id = '${B1}'`)).toBe('waiting');
    expect(sql(`select 'buyer_open_orders' = any (blockers) from public.deletion_requests where user_id = '${B1}'`)).toBe('t');

    // signs in again: the banner, then keeps the Account
    const second = await page.context().browser().newContext();
    const again = await second.newPage();
    await signInAs(again, 'B1');
    await again.goto('/orders');
    const banner = again.getByRole('status').filter({ hasText: 'Your Account is set to be deleted.' });
    await expect(banner).toContainText("We can’t finish yet: you have open Orders.");
    await banner.getByRole('button', { name: 'Keep my Account' }).click();
    await expect(banner).toBeHidden();
    expect(sql(`select status from public.deletion_requests where user_id = '${B1}'`)).toBe('cancelled');
    await again.reload();
    await expect(banner).toBeHidden(); // gone for good
    await second.close();

    // asks again; the Orders get settled; the job runs
    const client = await clientAs('B1');
    expect((await client.rpc('request_deletion', { p_scope: 'everything', p_confirm: 'DELETE' })).data.status).toBe('waiting');
    const orders = Number(sql(`select count(*) from public.orders where buyer_id = '${B1}'`));
    const lines = Number(sql(`select count(*) from public.order_lines where order_id in (select id from public.orders where buyer_id = '${B1}')`));
    const refunds = Number(sql(`select count(*) from public.refunds where buyer_id = '${B1}'`));
    const payouts = sql(`select coalesce(sum(net), 0) || '|' || count(*) from public.payouts where artist_id = '${A1}'`);
    sql(`update public.orders set stage = 'hold_expired', hold_until = now() - interval '1 hour' where buyer_id = '${B1}' and stage = 'hold'`);
    sql(`update public.orders set stage = 'received', received_at = now() - interval '10 days', damage_window_ends = now() - interval '7 days', open_report = false
         where buyer_id = '${B1}' and stage in ('paid', 'shipped')`);
    sql(`update public.orders set damage_window_ends = now() - interval '7 days', open_report = false where buyer_id = '${B1}' and stage = 'received'`);
    const reviews = Number(sql(`select count(*) from public.reviews where buyer_id = '${B1}'`));
    const ran = await cron('deletions');
    expect(ran.ok).toBe(true);
    expect(ran.data.finished).toBe(1);
    expect(ran.data.failed).toBe(0);

    expect(sql(`select status from public.deletion_requests where user_id = '${B1}'`)).toBe('done');
    expect(sql(`select display_name || '|' || photo_url || '|' || bio from public.profiles where id = '${B1}'`)).toBe('Deleted user||');
    for (const t of ['saved_addresses', 'notifications', 'saved_works']) expect(sql(`select count(*) from public.${t} where user_id = '${B1}'`)).toBe('0');
    expect(sql(`select count(*) from public.reviews where buyer_id = '${B1}' and buyer_name <> 'Buyer'`)).toBe('0');
    expect(Number(sql(`select count(*) from public.reviews where buyer_id = '${B1}'`))).toBe(reviews);
    expect(Number(sql(`select count(*) from public.orders where buyer_id = '${B1}'`))).toBe(orders);
    expect(Number(sql(`select count(*) from public.order_lines where order_id in (select id from public.orders where buyer_id = '${B1}')`))).toBe(lines);
    expect(Number(sql(`select count(*) from public.refunds where buyer_id = '${B1}'`))).toBe(refunds);
    expect(sql(`select coalesce(sum(net), 0) || '|' || count(*) from public.payouts where artist_id = '${A1}'`)).toBe(payouts);
    expect(sql(`select count(*) from auth.users where id = '${B1}'`)).toBe('0');
    await expect(clientAs('B1')).rejects.toBeTruthy(); // can no longer sign in

    // a second run has nothing to do
    expect((await cron('deletions')).data.finished).toBe(0);
  });

  test('the job refuses a caller without the secret', async () => {
    const res = await fetch(`${env().VITE_SUPABASE_URL}/functions/v1/api/cron?job=deletions`, { method: 'POST', headers: { apikey: env().VITE_SUPABASE_PUBLISHABLE_KEY } });
    expect(res.status).toBe(403);
  });
});
