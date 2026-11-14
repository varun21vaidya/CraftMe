// P06 scripts: QA-SH-05 (the Artist shell), QA-S22-01 to 05. Needs the local stack and the api function (fake provider mode).
import { expect, test } from '@playwright/test';
import { clientAs } from './helpers/api.js';
import { sql } from './helpers/db.js';
import { PEOPLE, W } from './helpers/ids.js';
import { seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const A1 = PEOPLE.A1.id;
const B1 = PEOPLE.B1.id;
const row = (page, id) => page.locator(`[data-work="${id}"]:visible`);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const listingStatus = (art) => sql(`select string_agg(kind || ':' || status, ',' order by kind) from public.listings where artwork_id = '${art}'`);
const makeArtist = (id) => sql(`update auth.users set raw_app_meta_data = raw_app_meta_data || '{"artist": true}' where id = '${id}'`);

test.beforeEach(() => seed());
test.afterAll(() => seed());

test('QA-SH-05 the Artist shell: sidebar, badge, current page, shop link', async ({ page }) => {
  await signInAs(page, 'A1');
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard\/artworks$/); // Overview is P07: until then /dashboard goes to Artworks
  const side = page.getByRole('navigation', { name: 'Artist dashboard' });
  for (const name of ['Overview', 'Artworks', 'Orders', 'Payouts', 'Instagram', 'Settings']) await expect(side.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible();
  await expect(side.getByRole('link', { name: /^Artworks/ })).toHaveAttribute('aria-current', 'page');
  await expect(side.getByLabel('2 to ship')).toHaveText('2'); // O2 and O3 are paid and not yet shipped
  await expect(page.getByRole('link', { name: 'View my shop' })).toHaveAttribute('href', `/artist/${A1}`);
  expect(await noSideScroll(page)).toBe(true);
  for (const [name, url] of [['Orders', /\/dashboard\/orders$/], ['Payouts', /\/dashboard\/payouts$/], ['Instagram', /\/dashboard\/instagram$/], ['Settings', /\/dashboard\/settings$/]]) {
    await side.getByRole('link', { name: new RegExp(`^${name}`) }).click();
    await expect(page).toHaveURL(url);
    await expect(side.getByRole('link', { name: new RegExp(`^${name}`) })).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Back to CraftMe' })).toBeVisible();
  // the public header no longer carries Artist links; the account menu does
  await page.goto('/browse');
  await expect(page.locator('header').getByRole('link', { name: 'Artist dashboard' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('menuitem', { name: 'Artist dashboard' })).toBeVisible();
});

test('QA-SH-05 / SH-06 a Buyer and a visitor cannot open the dashboard', async ({ page }) => {
  await page.goto('/dashboard/artworks');
  await expect(page).toHaveURL(/\/login/);
  await signInAs(page, 'B1');
  await page.goto('/dashboard/artworks');
  await expect(page).toHaveURL(/localhost:5173\/$/);
});

test.describe('QA-S22-01 list, tabs, search, pages', () => {
  test('counts, listing lines, actions, search, reload on a tab', async ({ page }) => {
    await signInAs(page, 'A1');
    await page.goto('/dashboard/artworks');
    await expect(page.getByRole('heading', { name: 'My Artworks', level: 1 })).toBeVisible();
    await expect(page.getByText('An Artwork is what Buyers browse. Its Listings are what they buy.')).toBeVisible();
    const count = (name) => page.getByRole('tab', { name: new RegExp(`^${name}`) });
    // A1 also owns the P03 filler works, so the counts are checked against the database and the fixture rows by their own tab
    const total = sql(`select count(*) from public.artworks where artist_id = '${A1}' and status <> 'removed'`);
    await expect(count('All')).toContainText(total);
    await expect(count('Sold')).toContainText('1'); // W3
    await expect(count('Ended')).toContainText('1'); // W5
    await count('Published').click();
    await expect(row(page, W.W1)).toBeVisible();
    await expect(row(page, W.W2)).toBeVisible();
    await expect(row(page, W.W3)).toHaveCount(0);
    await count('Drafts').click();
    await expect(row(page, W.W4)).toBeVisible();
    await count('All').click();
    await expect(row(page, W.W1)).toContainText('Original ₹42,000 · 1 left');
    await expect(row(page, W.W1)).toContainText('Print ₹2,500 · 50 in stock');
    await expect(row(page, W.W4)).toContainText('No Listings yet');
    await expect(row(page, W.W4).getByRole('link', { name: 'Finish' })).toBeVisible();
    await expect(row(page, W.W5).getByRole('button', { name: 'Reopen' })).toBeVisible();
    await expect(row(page, W.W3)).toContainText('Sold');
    await expect(row(page, W.W1)).toContainText('Paintings · 2024');
    await expect(row(page, W.W1).getByRole('link', { name: 'Edit' })).toHaveAttribute('href', `/dashboard/artworks/${W.W1}`);
    expect(await noSideScroll(page)).toBe(true);

    await count('Sold').click();
    await expect(page).toHaveURL(/tab=sold/);
    await expect(page.locator('[data-work]:visible')).toHaveCount(1);
    await count('Ended').click();
    await page.reload();
    await expect(count('Ended')).toHaveAttribute('aria-selected', 'true');
    await expect(row(page, W.W5)).toBeVisible();
    await count('All').click();

    await page.getByLabel('Search my Artworks').fill('kolam');
    await expect(page.locator('[data-work]:visible')).toHaveCount(1);
    await expect(row(page, W.W2)).toBeVisible();
    await page.getByLabel('Search my Artworks').fill('zzzz');
    await expect(page.getByRole('heading', { name: 'Nothing here.' })).toBeVisible();
    await page.getByLabel('Search my Artworks').fill('');
    await expect(row(page, W.W1)).toBeVisible();
  });

  test('twenty to a page', async ({ page }) => {
    const have = Number(sql(`select count(*) from public.artworks where artist_id = '${A1}' and status <> 'removed'`));
    sql(`insert into public.artworks (artist_id, title, category, status) select '${A1}', 'Extra ' || g, 'Paintings', 'draft' from generate_series(1, ${25 - have}) g`); // 25 works: 20 and 5
    await signInAs(page, 'A1');
    await page.goto('/dashboard/artworks');
    await expect(page.locator('[data-work]:visible')).toHaveCount(20);
    await page.getByRole('button', { name: 'Page 2' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator('[data-work]:visible')).toHaveCount(5);
    await page.reload();
    await expect(page.locator('[data-work]:visible')).toHaveCount(5);
  });

  test('a failed load says so and recovers', async ({ page }) => {
    await signInAs(page, 'A1');
    let fail = true;
    await page.route('**/rest/v1/artworks?*', (route) => (fail && route.request().method() === 'GET' ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
    await page.goto('/dashboard/artworks');
    await expect(page.getByRole('alert').filter({ hasText: 'We couldn’t load your Artworks.' })).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(row(page, W.W1)).toBeVisible();
  });
});

test('QA-S22-02 end and reopen', async ({ page, browser }) => {
  await signInAs(page, 'A1');
  await page.goto('/dashboard/artworks');
  await row(page, W.W2).getByRole('button', { name: 'End' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'End all Listings of this Artwork?' });
  await expect(dialog).toContainText('Paid Orders aren’t affected');
  await dialog.getByRole('button', { name: 'Keep selling' }).click();
  expect(listingStatus(W.W2)).toBe('original:sold,print:live');

  await row(page, W.W2).getByRole('button', { name: 'End' }).click();
  await dialog.getByRole('button', { name: 'End Listings' }).click();
  await expect(page.locator('.toasts')).toContainText('Listings ended');
  await page.getByRole('tab', { name: /^Ended/ }).click();
  await expect(row(page, W.W2)).toBeVisible();
  expect(listingStatus(W.W2)).toBe('original:sold,print:ended');
  expect(sql(`select status from public.artworks where id = '${W.W2}'`)).toBe('draft');

  const guest = await browser.newContext();
  const g = await guest.newPage();
  await g.goto(`/artwork/${W.W2}`);
  await expect(g.getByText(/couldn’t find this Artwork/)).toBeVisible();
  await g.goto('/browse');
  await expect(g.getByText('Kolam at Dawn')).toHaveCount(0);
  await guest.close();

  await page.getByRole('tab', { name: /^Ended/ }).click();
  await row(page, W.W2).getByRole('button', { name: 'Reopen' }).click();
  await expect(page.locator('.toasts')).toContainText('Listings reopened');
  expect(listingStatus(W.W2)).toBe('original:sold,print:live'); // the sold Original stays sold
  expect(sql(`select stage from public.orders where id = 'e2000000-0000-4000-8000-000000000002'`)).toBe('paid'); // O2 is untouched

  sql(`update public.listings set stock = 0 where artwork_id = '${W.W5}'`);
  await page.getByRole('tab', { name: /^Ended/ }).click();
  await row(page, W.W5).getByRole('button', { name: 'Reopen' }).click();
  await expect(page.locator('.toasts [role=alert]')).toContainText('Nothing left to sell. Add stock to a Listing first.');
});

test('QA-S22-03 delete rules', async ({ page }) => {
  await signInAs(page, 'A1');
  await page.goto('/dashboard/artworks');
  await expect(row(page, W.W3)).toContainText('Artworks with sales can’t be deleted');
  await expect(row(page, W.W3).getByRole('button', { name: 'Delete' })).toBeDisabled();

  await row(page, W.W4).getByRole('button', { name: 'Delete' }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Delete this Artwork?' });
  await dialog.getByRole('button', { name: 'Keep it' }).click();
  expect(sql(`select status from public.artworks where id = '${W.W4}'`)).toBe('draft');
  await row(page, W.W4).getByRole('button', { name: 'Delete' }).click();
  await dialog.getByRole('button', { name: 'Delete Artwork' }).click();
  await expect(page.locator('.toasts')).toContainText('Artwork deleted');
  await expect(row(page, W.W4)).toHaveCount(0);
  expect(sql(`select status from public.artworks where id = '${W.W4}'`)).toBe('removed');

  await page.goto(`/dashboard/artworks/${W.W1}`);
  await expect(page.getByRole('button', { name: 'Delete Artwork' })).toHaveCount(0);
  await expect(page.getByText('This Artwork has sales, so it can’t be deleted. End its Listings instead.')).toBeVisible();
  const a1 = await clientAs('A1');
  expect((await a1.rpc('delete_artwork', { p_artwork: W.W1 })).error.message).toContain('has_sales');

  // an unsold work in another buyer's open hold
  const w = sql(`insert into public.artworks (artist_id, title, category, status, photos) values ('${A1}', 'Held work', 'Paintings', 'published', '{/demo/a.jpg}') returning id`).split('\n')[0];
  const l = sql(`insert into public.listings (artwork_id, artist_id, kind, price, stock, status) values ('${w}', '${A1}', 'print', 100000, 3, 'live') returning id`).split('\n')[0];
  sql(`update public.listings set held = 1 where id = '${l}'`);
  sql(`insert into public.orders (code, buyer_id, artist_id, total, stage) values ('P06HOLD', '${B1}', '${A1}', 100000, 'hold') returning id`);
  sql(`insert into public.order_lines (order_id, listing_id, artwork_id, title, kind, unit_paise, quantity) select id, '${l}', '${w}', 'Held work', 'print', 100000, 1 from public.orders where code = 'P06HOLD'`);
  expect((await a1.rpc('delete_artwork', { p_artwork: w })).error.message).toContain('has_sales');
});

test('QA-S22-04 a restricted Artist', async ({ page }) => {
  sql(`update public.listings set status = 'ended' where artwork_id = 'c1000000-0000-4000-8000-000000000007'`);
  await signInAs(page, 'A3');
  for (const url of ['/dashboard/artworks', '/dashboard/orders']) {
    await page.goto(url);
    await expect(page.getByRole('alert').filter({ hasText: 'Your shop is paused.' })).toContainText('Buyers can’t see your pieces');
  }
  await page.goto('/dashboard/artworks');
  await page.locator('[data-work="c1000000-0000-4000-8000-000000000007"]:visible').getByRole('button', { name: 'Reopen' }).click();
  await expect(page.locator('.toasts [role=alert]')).toContainText('Your shop is paused, so Listings can’t be reopened.');
  await page.getByRole('link', { name: 'Add Artwork' }).click();
  await expect(page.locator('#ed-title')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Publish Artwork' })).toBeDisabled();
  const a3 = await clientAs('A3');
  expect((await a3.rpc('publish_artwork', { p_artwork: 'c1000000-0000-4000-8000-000000000007' })).error.message).toContain('artist_restricted');
  const insert = await a3.from('artworks').insert({ artist_id: PEOPLE.A3.id, title: 'x', category: 'Paintings' });
  expect(insert.error).not.toBeNull();
});

test('QA-S22-05 empty wall', async ({ page }) => {
  makeArtist(B1); // a new Artist with no works
  await signInAs(page, 'B1');
  await page.goto('/dashboard/artworks');
  await expect(page.getByRole('heading', { name: 'Your wall is empty.' })).toBeVisible();
  await expect(page.getByText('Add your first Artwork with photos, then create a Listing for the Original, a Print, or both.')).toBeVisible();
  await page.getByRole('link', { name: 'Add your first Artwork' }).click();
  await expect(page).toHaveURL(/\/dashboard\/artworks\/new$/);
});
