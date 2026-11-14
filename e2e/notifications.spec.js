// P04 scripts: QA-S17-01, 02, 03 and 05 (the e2e halves). QA-S17-04 (every producer) is in supabase/schema.test.mjs, the target unit test in src/lib/notifications.test.js.
import { expect, test } from '@playwright/test';
import { sql } from './helpers/db.js';
import { O, PEOPLE } from './helpers/ids.js';
import { seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const B1 = PEOPLE.B1.id;
const B2 = PEOPLE.B2.id;
const wide = (page) => page.viewportSize().width > 900;
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const add = (uid, type, data, { read = false, ago = '0 minutes' } = {}) => sql(
  `insert into public.notifications (user_id, type, data, read, created_at) values ('${uid}', '${type}', '${JSON.stringify(data)}', ${read}, now() - interval '${ago}')`);
const rows = (page) => page.locator('.notif-row');

/** B1: two unread today (an Order notice and a Review notice) and twenty read ones from days ago (14 Orders, 6 Reviews). */
function fixture() {
  sql(`delete from public.notifications where user_id in ('${B1}', '${B2}')`);
  for (let i = 0; i < 14; i++) add(B1, 'order_shipped', { orderId: O.O2, code: `OLD${i}` }, { read: true, ago: `${2 + i} days` });
  for (let i = 0; i < 6; i++) add(B1, 'review_rejected', { orderId: O.O2, code: `REV${i}` }, { read: true, ago: `${20 + i} days` });
  add(B1, 'order_paid', { orderId: O.O2, code: 'NEW1', amount: 690000 }, { ago: '5 minutes' });
  add(B1, 'review_approved', { orderId: O.O2, code: 'NEW2' }, { ago: '2 hours' });
}

test.describe('QA-S17-01 list, groups, filters, pages', () => {
  test.beforeAll(() => seed());
  test.beforeEach(() => fixture());
  test.afterAll(() => seed());

  test('groups, New badges, chips, pages and a reload', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: 'Notifications', level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Earlier' })).toBeVisible();
    await expect(rows(page)).toHaveCount(20);
    await expect(page.locator('.notif-row .badge', { hasText: 'New' })).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Unread 2' })).toBeVisible();
    await expect(page.getByText('Payment received for NEW1')).toBeVisible();
    await expect(page.getByText('5 min ago')).toBeVisible();
    await expect(page.getByText('2 h ago')).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);

    await page.getByRole('button', { name: 'Unread 2' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Unread 2' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Orders' }).click();
    await expect(rows(page)).toHaveCount(15); // 14 shipped + 1 paid, no Review notice
    await expect(page.getByText(/Your Review|How is your/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Reviews' }).click();
    await expect(rows(page)).toHaveCount(7);
    await expect(page.getByText(/Shipped|Payment received/)).toHaveCount(0);

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.getByRole('button', { name: 'Page 2' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(page).toHaveURL(/page=2/);
    await page.reload();
    await expect(rows(page)).toHaveCount(2); // the page survives the reload
    await page.getByRole('button', { name: 'Reviews' }).click();
    await expect(page).toHaveURL(/filter=reviews/);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Reviews' })).toHaveAttribute('aria-pressed', 'true'); // so does the filter
    await expect(rows(page)).toHaveCount(7);
  });

  test('a failed load says so and recovers', async ({ page }) => {
    await signInAs(page, 'B1');
    let fail = true;
    await page.route('**/rest/v1/notifications?*', (route) => (fail && route.request().method() === 'GET' ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
    await page.goto('/notifications');
    await expect(page.getByRole('alert').filter({ hasText: "We couldn't load your notifications." })).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(rows(page)).toHaveCount(20);
  });
});

test.describe('QA-S17-02 empty states', () => {
  test.beforeAll(() => seed());
  test.afterAll(() => seed());

  test('B2 has nothing; B1 has no Review notices under that filter', async ({ page }) => {
    sql(`delete from public.notifications where user_id = '${B2}'`);
    await signInAs(page, 'B2');
    await page.goto('/notifications');
    await expect(page.getByRole('heading', { name: "You're all caught up." })).toBeVisible();
    await expect(page.getByText('Order updates, Review decisions and refunds appear here.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark all as read' })).toHaveCount(0);
    await page.getByRole('link', { name: 'Browse art' }).first().click();
    await expect(page).toHaveURL(/\/browse$/);

    fixture();
    sql(`delete from public.notifications where user_id = '${B1}' and type in ('review_rejected', 'review_approved')`);
    const other = await page.context().browser().newContext();
    const p1 = await other.newPage();
    await signInAs(p1, 'B1');
    await p1.goto('/notifications?filter=reviews');
    await expect(p1.getByRole('heading', { name: 'Nothing here.' })).toBeVisible();
    await expect(p1.getByRole('heading', { name: "You're all caught up." })).toHaveCount(0);
    await other.close();
  });
});

test.describe('QA-S17-03 read state, mark all, the bell, two devices', () => {
  test.beforeAll(() => seed());
  test.beforeEach(() => fixture());
  test.afterAll(() => seed());

  test('the bell links to the page; a row marks itself read; mark all reaches the other device', async ({ page, browser }) => {
    test.setTimeout(120000);
    add(B2, 'order_paid', { orderId: O.O2, code: 'B2ONLY' }); // someone else's unread notice must stay unread
    // two devices
    const two = await browser.newContext();
    const device2 = await two.newPage();
    await signInAs(device2, 'B1');
    await device2.goto('/');
    await expect(device2.getByRole('button', { name: 'Notifications, 2 unread' })).toBeVisible();

    await signInAs(page, 'B1');
    await page.goto('/');
    await page.getByRole('button', { name: 'Notifications, 2 unread' }).click();
    const menu = page.locator('.menu.notif');
    await expect(menu).toContainText('Payment received for NEW1'); // the bell lists unread items only
    await expect(menu.getByText('OLD0')).toHaveCount(0);
    await menu.getByRole('link', { name: 'See all' }).click();
    await expect(page).toHaveURL(/\/notifications$/);

    // choosing a row marks it read, then navigates
    await page.getByRole('link', { name: /Payment received for NEW1/ }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${O.O2}$`));
    expect(sql(`select read from public.notifications where user_id = '${B1}' and data ->> 'code' = 'NEW1'`)).toBe('t');
    await page.goBack();
    await expect(page.getByText('Payment received for NEW1')).toBeVisible();
    await expect(page.locator('.notif-row .badge', { hasText: 'New' })).toHaveCount(1); // only the Review notice is still New
    await expect(page.getByRole('button', { name: 'Unread 1' })).toBeVisible();

    // mark all fails first: error toast, the badge stays
    await page.route('**/rest/v1/notifications?*', (route) => (route.request().method() === 'PATCH' ? route.fulfill({ status: 500, body: '{}' }) : route.continue()));
    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(page.locator('.toasts [role=alert]')).toContainText('couldn’t mark them all as read');
    await expect(page.locator('.notif-row .badge', { hasText: 'New' })).toHaveCount(1);
    expect(sql(`select count(*) from public.notifications where user_id = '${B1}' and not read`)).toBe('1');
    await page.unroute('**/rest/v1/notifications?*');

    await page.getByRole('button', { name: 'Mark all as read' }).click();
    await expect(page.locator('.notif-row .badge', { hasText: 'New' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mark all as read' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible(); // no count on the bell
    expect(sql(`select count(*) from public.notifications where user_id = '${B1}' and not read`)).toBe('0');
    expect(sql(`select count(*) from public.notifications where user_id = '${B2}' and not read`)).toBe('1');

    // the other device catches up within one poll (20 s)
    await expect(device2.getByRole('button', { name: /^Notifications, \d+ unread$/ })).toHaveCount(0, { timeout: 30000 });
    await two.close();
  });
});

test.describe('QA-S17-05 a notification whose target is gone', () => {
  test.beforeAll(() => seed());
  test.afterAll(() => seed());

  test('an Order that belongs to someone else says so and links to My orders', async ({ page }) => {
    sql(`delete from public.notifications where user_id = '${B1}'`);
    add(B1, 'order_shipped', { orderId: O.O3, code: 'GONE' }); // O3 is B2's Order
    add(B1, 'from_the_future', {});
    await signInAs(page, 'B1');
    await page.goto('/notifications');
    await expect(page.getByText('Update', { exact: true })).toBeVisible(); // unknown type: "Update", no link
    await expect(page.getByRole('link', { name: 'Update' })).toHaveCount(0);
    await page.getByRole('link', { name: /GONE/ }).click();
    await expect(page.getByRole('heading', { name: /We couldn.t find this order/ })).toBeVisible();
    await page.getByRole('link', { name: 'My orders' }).last().click();
    await expect(page).toHaveURL(/\/orders$/);
  });
});
