// P01 scripts: QA-S11-01 to 03, QA-S12-01 to 04, QA-S13-01 to 08 and 10.
import { expect, test } from '@playwright/test';
import { clientAs } from './helpers/api.js';
import { sql } from './helpers/db.js';
import { O, PEOPLE } from './helpers/ids.js';
import { seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const B1 = PEOPLE.B1.id;
const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const at = (id, col) => sql(`select ${col} from public.orders where id = '${id}'`);
const head = (page) => page.locator('.page-head');
const actions = (page) => page.getByRole('region', { name: 'Actions' });

test.beforeEach(() => seed());

test.describe('QA-S11 order placed', () => {
  test('QA-S11-01 confirmation page', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signInAs(page, 'B1');
    await page.goto(`/orders/${O.O2}?placed=1`);
    await expect(page.getByRole('heading', { name: 'Thank you, Ananya. Your Order is Paid.' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Checkout steps' }).locator('li.done')).toHaveCount(3);
    await expect(page.locator('main')).toContainText('Order CM-20402');
    const next = page.locator('section').filter({ hasText: 'What happens next' });
    await expect(next).toContainText(`They have until ${day(at(O.O2, 'ship_by'))} to ship it.`);
    await expect(next).toContainText('After 14 days with no action');
    await expect(next).toContainText('30 days after it’s Received');
    const recap = page.getByRole('complementary', { name: 'Order recap' });
    await expect(recap).toContainText('Kolam at Dawn');
    await expect(recap).toContainText('Monsoon Over Marina');
    await expect(recap).toContainText('₹6,900');
    await expect(recap).toContainText('Ship to');
    await expect(recap).toContainText('Meera Iyer');
    await expect(page.locator('main')).not.toContainText(/email/i);

    await page.getByRole('button', { name: 'Copy' }).click();
    await expect(page.locator('.toast').first()).toContainText(/CM-20402/);
    await recap.getByRole('link', { name: 'View Order' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${O.O2}$`));
  });

  test('QA-S11-02 refresh, a new tab, and another buyer', async ({ page, context, browser }) => {
    await signInAs(page, 'B1');
    await page.goto(`/orders/${O.O2}?placed=1`);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Your Order is Paid/ })).toBeVisible();
    const tab = await context.newPage();
    await tab.goto(`/orders/${O.O2}?placed=1`);
    await expect(tab.getByRole('heading', { name: /Your Order is Paid/ })).toBeVisible();
    const other = await browser.newPage({ baseURL: 'http://localhost:5173' });
    await signInAs(other, 'B2');
    await other.goto(`/orders/${O.O2}?placed=1`);
    await expect(other.getByRole('heading', { name: /We couldn.t find this order/ })).toBeVisible();
    await other.close();
  });

  test('QA-S11-03 no success header unless Paid', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto(`/orders/${O.O1}?placed=1`);
    await expect(page.getByText('Confirming your payment…')).toBeVisible();
    sql(`update public.orders set stage = 'hold_expired' where id = '${O.O1}'`);
    await page.reload();
    await expect(page.locator('main')).toContainText('The time to pay ran out.');
    await expect(page.getByText(/Thank you/)).toHaveCount(0);
    await page.goto(`/orders/${O.O9}?placed=1`);
    await expect(head(page)).toContainText('Refunded');
    await expect(page.getByText(/Thank you/)).toHaveCount(0);
  });
});

test.describe('QA-S12 my orders', () => {
  test('QA-S12-01 tabs, counts, rows, keyboard and reload', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto('/orders');
    const tabs = page.getByRole('tablist', { name: 'Order filters' });
    const counts = { All: 8, 'To be shipped': 1, Shipped: 2, Received: 4, Refunded: 1 };
    for (const [name, n] of Object.entries(counts)) await expect(tabs.getByRole('tab', { name: new RegExp(`^${name}`) })).toContainText(String(n));
    await expect(page.getByRole('status').filter({ hasText: 'CM-20401 is waiting for payment' }).getByRole('button', { name: 'Finish paying' })).toBeVisible();
    const list = page.getByRole('tabpanel');
    await expect(list.locator('article')).toHaveCount(8);
    await expect(list.locator('article').filter({ hasText: 'CM-20401' })).toHaveCount(0); // a hold is not a row
    await expect(list.locator('article').filter({ hasText: 'CM-20402' })).toContainText(`has until ${day(at(O.O2, 'ship_by'))} to ship`);
    await expect(list.locator('article').filter({ hasText: 'CM-20404' })).toContainText('Tracking DT4830012IN');
    await expect(list.locator('article').filter({ hasText: 'CM-20407' })).toContainText('Reviewed');
    await expect(list.locator('article').filter({ hasText: 'CM-20408' })).toContainText('₹2,200 refunded');
    await expect(list.locator('article').filter({ hasText: 'CM-20409' })).toContainText('₹2,500 refunded');

    // keyboard: one tab in the tab order, arrows move, Home and End jump (QA-S36-05)
    const all = tabs.getByRole('tab', { name: /^All/ });
    await all.focus();
    await expect(tabs.locator('[tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press('ArrowRight');
    await expect(tabs.getByRole('tab', { name: /^To be shipped/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(tabs.getByRole('tab', { name: /^Refunded/ })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(all).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(tabs.getByRole('tab', { name: /^Refunded/ })).toHaveAttribute('aria-selected', 'true');

    await tabs.getByRole('tab', { name: /^Shipped/ }).click();
    await expect(page).toHaveURL(/\?tab=shipped$/);
    await expect(list.locator('article')).toHaveCount(2);
    await page.reload();
    await expect(page.getByRole('tab', { name: /^Shipped/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel').locator('article')).toHaveCount(2);
  });

  test('QA-S12-01 my_order_counts as B2 counts only B2', async () => {
    const b2 = await clientAs('B2');
    const { data } = await b2.rpc('my_order_counts');
    expect(data).toEqual({ paid: 1, shipped: 0, received: 1, refunded: 0, all: 2 });
  });

  test('QA-S12-02 row actions', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto('/orders?tab=shipped');
    const o4 = page.getByRole('tabpanel').locator('article').filter({ hasText: 'CM-20404' });
    await o4.getByRole('button', { name: 'Mark Received' }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirm it arrived?' });
    await dialog.getByRole('button', { name: 'Not yet' }).click();
    await expect(dialog).toBeHidden();
    expect(at(O.O4, 'stage')).toBe('shipped');
    await o4.getByRole('button', { name: 'Mark Received' }).click();
    await dialog.getByRole('button', { name: 'Yes, it arrived' }).click();
    await expect(o4).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /^Shipped/ })).toContainText('1');
    expect(at(O.O4, "stage || '|' || extract(epoch from damage_window_ends - received_at)::int || '|' || extract(epoch from review_by - received_at)::int"))
      .toBe(`received|${3 * 86400}|${30 * 86400}`);

    await page.getByRole('tab', { name: /^Received/ }).click();
    const panel = page.getByRole('tabpanel');
    await expect(panel.locator('article').filter({ hasText: 'CM-20407' }).getByRole('link', { name: 'Write a Review' })).toHaveCount(0);
    await panel.locator('article').filter({ hasText: 'CM-20406' }).getByRole('link', { name: 'Write a Review' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${O.O6}/review$`));
    await expect(page.getByRole('heading', { name: 'How was it?' })).toBeVisible();
  });

  test('QA-S12-03 empty, loading, error', async ({ page }) => {
    await signInAs(page, 'AD1');
    await page.goto('/orders');
    await expect(page.getByRole('heading', { name: 'No Orders yet' })).toBeVisible();
    await expect(page.locator('main').getByRole('link', { name: 'Browse art' })).toBeVisible();
  });

  test('QA-S12-03 loading skeletons and a failing request with Try again', async ({ page }) => {
    await signInAs(page, 'B1');
    let mode = 'slow';
    await page.route(/\/rest\/v1\/orders\?select=\*%2Corder_lines/, async (route) => {
      if (mode === 'slow') { await new Promise((r) => setTimeout(r, 1500)); return route.fallback(); }
      if (mode === 'fail') return route.abort();
      return route.fallback();
    });
    await page.goto('/orders');
    await expect(page.locator('.skeleton')).toHaveCount(3);
    await expect(page.getByRole('tabpanel').locator('article').first()).toBeVisible();
    mode = 'fail';
    await page.goto('/orders?tab=received');
    const alert = page.getByRole('alert').filter({ hasText: /We couldn.t load your Orders/ });
    await expect(alert).toBeVisible({ timeout: 20000 }); // supabase-js retries three times first
    mode = 'ok';
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('tabpanel').locator('article')).toHaveCount(4);
  });

  test('QA-S12-04 paging', async ({ page }) => {
    sql(`insert into public.orders (code, buyer_id, artist_id, total, stage, created_at, paid_at, shipped_at, received_at)
      select 'QP' || lpad(n::text, 3, '0'), '${B1}', '${PEOPLE.A1.id}', 10000, 'received', now() - (n || ' days')::interval - interval '100 days',
        now() - interval '100 days', now() - interval '100 days', now() - interval '100 days' from generate_series(1, 45) n`);
    await signInAs(page, 'B1');
    await page.goto('/orders');
    const seen = [];
    for (let p = 1; p <= 3; p += 1) {
      const rows = page.getByRole('tabpanel').locator('article strong.mono');
      await expect(rows.first()).toBeVisible();
      if (p > 1) await expect(rows.first()).not.toHaveText(seen.at(-20)); // the previous page stays up until this one arrives
      if (p < 3) await expect(rows).toHaveCount(20);
      seen.push(...await rows.allTextContents());
      const nav = page.getByRole('navigation', { name: 'Pagination' });
      await expect(nav.getByRole('button', { name: `Page ${p}` })).toHaveAttribute('aria-current', 'page');
      if (p === 1) await expect(nav.getByRole('button', { name: 'Previous page' })).toBeDisabled();
      if (p < 3) await nav.getByRole('button', { name: 'Next page' }).click();
      else await expect(nav.getByRole('button', { name: 'Next page' })).toBeDisabled();
    }
    expect(seen).toHaveLength(53);
    expect(new Set(seen).size).toBe(53);
    expect(seen.at(-1)).toBe('QP045'); // the oldest is last
  });
});

test.describe('QA-S13 order detail', () => {
  test('QA-S13-01 Paid', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto(`/orders/${O.O2}`);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('My orders');
    await expect(head(page)).toContainText('Paid');
    await expect(page.getByRole('list', { name: 'Order stages' }).locator('li.done')).toHaveText(['done Paid']);
    const ship = day(at(O.O2, 'ship_by'));
    await expect(page.locator('main')).toContainText(`Meera Iyer is preparing your Order. They have until ${ship} to ship it. If they don’t, CraftMe reviews the Order and usually refunds you in full.`);
    const timeline = page.getByRole('list', { name: 'Order timeline' });
    await expect(timeline).toContainText('Paid ₹6,900');
    await expect(timeline).toContainText('Waiting for Meera to ship');
    await expect(timeline).toContainText(`deadline ${ship}`);
    await expect(page.locator('main')).toContainText('12 Carter Road');
    await expect(page.locator('main')).toContainText('+91 9876543210');
    await expect(page.locator('main')).toContainText('UPI');
    await expect(actions(page).getByRole('button', { name: 'Cancel Order' })).toBeDisabled();
    await expect(actions(page)).toContainText('Orders can’t be cancelled once Paid.');
    await expect(page.locator('main')).not.toContainText(/refunds? (you )?automatically/i);
  });

  test('QA-S13-01 a late Order', async ({ page }) => {
    await signInAs(page, 'B2');
    await page.goto(`/orders/${O.O3}`);
    await expect(page.locator('main')).toContainText('This Order is late. CraftMe is reviewing it. Late Orders are usually refunded in full.');
  });

  test('QA-S13-02 Shipped, and confirming receipt', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await signInAs(page, 'B1');
    await page.goto(`/orders/${O.O4}`);
    await expect(page.locator('main')).toContainText('DTDC');
    await expect(page.locator('main')).toContainText('DT4830012IN');
    await expect(page.locator('main')).toContainText(`we’ll mark it Received on ${day(at(O.O4, 'auto_receive_at'))}`);
    await page.getByRole('button', { name: 'Copy tracking number' }).click();
    await expect(page.locator('.toast').first()).toContainText('DT4830012IN');

    const open = page.getByRole('button', { name: 'I’ve received it' }).or(page.getByRole('button', { name: "I've received it" }));
    await open.click();
    const dialog = page.getByRole('dialog', { name: 'Confirm it arrived?' });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
    expect(at(O.O4, 'stage')).toBe('shipped');
    await open.click();
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.route('**/rest/v1/rpc/confirm_received', async (route) => { await new Promise((r) => setTimeout(r, 600)); await route.fallback(); });
    await dialog.getByRole('button', { name: 'Yes, it arrived' }).click();
    await expect(dialog.getByRole('button', { name: 'Saving…' })).toBeVisible();
    await expect(head(page)).toContainText('Received', { timeout: 10000 });
    await expect(page.locator('main')).toContainText('Something not right? Tell us by');
  });

  test('QA-S13-03 Received and its actions', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto(`/orders/${O.O5}`);
    await expect(page.locator('main')).toContainText('It arrived. Enjoy it.');
    await expect(page.locator('main')).toContainText(`Something not right? Tell us by ${day(at(O.O5, 'damage_window_ends'))}.`);
    await expect(actions(page).getByRole('link', { name: 'Something not right?' })).toHaveAttribute('href', `/orders/${O.O5}/damage`);
    await expect(actions(page).getByRole('link', { name: 'Review Meera' })).toHaveAttribute('href', `/orders/${O.O5}/review`);
    await expect(actions(page).getByRole('button', { name: 'Cancel Order' })).toHaveCount(0);
    await page.goto(`/orders/${O.O7}`);
    await expect(actions(page).getByRole('link')).toHaveCount(0);
  });

  test('QA-S13-04 refunded and partly refunded', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto(`/orders/${O.O9}`);
    await expect(head(page)).toContainText('Refunded');
    await expect(page.locator('main')).toContainText(/Your ₹2,500 refund was issued on .+\. It goes back to your original payment method\./);
    await expect(page.locator('main')).toContainText('Refunded ₹2,500 · 1 of 1');
    const refund = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Refund' }) });
    await expect(refund).toContainText('The print arrived damaged');
    await expect(refund).toContainText('₹2,500 for Monsoon Over Marina ×1');
    await expect(page.locator('main')).toContainText('−₹2,500');
    await expect(actions(page).getByRole('link', { name: /Review/ })).toHaveCount(0);

    await page.goto(`/orders/${O.O8}`);
    await expect(head(page)).toContainText('Received');
    await expect(page.locator('.badge.err').filter({ hasText: 'Refunded ₹2,200 · 1 of 1' })).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Refund' })).toBeVisible();
    await expect(actions(page).getByRole('link', { name: /Review/ })).toBeVisible();
  });

  test('QA-S13-05 a hold expiring on the page', async ({ page }) => {
    sql(`update public.orders set hold_until = now() + interval '6 seconds' where id = '${O.O1}'`);
    await signInAs(page, 'B1');
    await page.goto(`/orders/${O.O1}`);
    await expect(page.locator('main')).toContainText(/We’re keeping your pieces for 0:0\d\./);
    await expect(page.getByRole('button', { name: 'Finish paying' }).first()).toBeVisible();
    await expect(page.locator('main')).toContainText('The time to pay ran out. Your pieces went back on the wall.', { timeout: 15000 });
    await expect(page.locator('main').getByRole('link', { name: 'Return to Cart' })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Pay|Finish paying/ })).toHaveCount(0);
  });

  test('QA-S13-06 repeat confirmation and auto-receipt', async ({ page }) => {
    const b1 = await clientAs('B1');
    expect((await b1.rpc('confirm_received', { p_order: O.O4 })).error).toBeNull();
    expect((await b1.rpc('confirm_received', { p_order: O.O4 })).error?.message).toContain('wrong_stage');
    sql('select public.sweep()');
    expect(at(O.O14, "stage || '|' || (received_at >= auto_receive_at)")).toBe('received|true');
    await signInAs(page, 'B1');
    await page.goto(`/orders/${O.O14}`);
    await expect(head(page)).toContainText('Received');
    await expect(page.getByRole('list', { name: 'Order timeline' })).toContainText('marked Received automatically');
  });

  test('QA-S13-07 receipt', async ({ page, browser, browserName }) => {
    await signInAs(page, 'B1');
    await page.goto(`/orders/${O.O2}/receipt`);
    const receipt = page.locator('article.receipt');
    await expect(receipt.getByRole('heading', { name: 'Order summary' })).toBeVisible();
    await expect(receipt).toContainText('CraftMe');
    await expect(receipt).toContainText('CM-20402');
    await expect(receipt).toContainText('Kolam at Dawn');
    await expect(receipt).toContainText('₹6,900');
    await expect(receipt).toContainText('pay_fake_ok_order_fake_qa_o2');
    await expect(receipt).toContainText('UPI');
    await expect(receipt).toContainText('12 Carter Road');
    await expect(page.locator('main')).not.toContainText(/tax invoice/i);
    if (browserName === 'chromium') { // print preview fits one page
      const pdf = (await page.pdf({ format: 'A4' })).toString('latin1');
      expect((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(1);
    }
    const other = await browser.newPage({ baseURL: 'http://localhost:5173' });
    await signInAs(other, 'B2');
    await other.goto(`/orders/${O.O2}/receipt`);
    await expect(other.getByRole('heading', { name: /We couldn.t find this order/ })).toBeVisible();
    await other.close();
  });

  test('QA-S13-08 someone else\'s order on every order route', async ({ page, browser }) => {
    await signInAs(page, 'B2');
    for (const suffix of ['', '/damage', '/review', '/receipt']) {
      await page.goto(`/orders/${O.O2}${suffix}`);
      await expect(page.getByRole('heading', { name: /We couldn.t find this order/ })).toBeVisible();
    }
    const guest = await browser.newPage({ baseURL: 'http://localhost:5173' });
    await guest.goto(`/orders/${O.O2}`);
    await expect(guest).toHaveURL(/\/login$/);
    await guest.close();
  });

  test('QA-S13-10 refund still being processed', async ({ page }) => {
    sql(`update public.refunds set status = 'unknown' where order_id = '${O.O8}'`);
    await signInAs(page, 'B1');
    await page.goto(`/orders/${O.O8}`);
    await expect(page.locator('main')).toContainText('Your ₹2,200 refund is being processed. We’ll update this page.');
    await expect(page.locator('main')).not.toContainText(/refund was issued/);
    sql(`update public.refunds set status = 'pending' where order_id = '${O.O8}'`);
    await page.reload();
    await expect(page.locator('main')).toContainText('Your ₹2,200 refund is being processed.');
    sql(`update public.refunds set status = 'issued' where order_id = '${O.O8}'`);
    await expect(page.locator('main')).toContainText(/Your ₹2,200 refund was issued on/, { timeout: 10000 });
  });
});
