// P00 scripts: QA-SH-01..04, 06..08, QA-S20-01, QA-S20-02, QA-S13-08 (the parts that exist), QA-X-06.
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { O, PEOPLE, W } from './helpers/ids.js';
import { env } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const GROUPS = ['Art', 'Handmade Crafts', 'Jewellery & Accessories', 'Festive & Home Decor', 'DIY Kits'];
const wide = (page) => page.viewportSize().width > 900;
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const header = (page) => page.locator('header.site-header');
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.describe('QA-SH-01 public header', () => {
  test('visitor G', async ({ page }) => {
    await page.goto('/browse');
    await expect(header(page).getByRole('link', { name: /CraftMe/ })).toBeVisible();
    await expect(header(page).getByRole('link', { name: 'Log in' })).toBeVisible();
    if (wide(page)) {
      await expect(header(page).getByRole('link', { name: 'Browse' })).toBeVisible();
      await expect(header(page).getByRole('button', { name: 'Categories' })).toBeVisible();
      await expect(header(page).getByRole('search')).toBeVisible();
    } else {
      await expect(header(page).getByRole('button', { name: 'Open menu' })).toBeVisible();
      await expect(header(page).locator('.market-search-toggle')).toBeVisible();
    }
    expect(await noSideScroll(page)).toBe(true);
  });

  for (const key of ['B1', 'A1', 'AD1']) {
    test(`signed in as ${key}`, async ({ page }) => {
      await signInAs(page, key);
      await page.goto('/browse');
      await expect(header(page).getByRole('link', { name: /^Cart, \d+ items$/ })).toBeVisible();
      if (page.viewportSize().width > 640) await expect(header(page).getByRole('link', { name: /^Wish list, \d+ saved$/ })).toBeVisible();
      else { // phones: the wish list moves into the burger menu so the header fits without sideways scroll
        await header(page).getByRole('button', { name: 'Open menu' }).click();
        await expect(page.locator('.mobile-menu').getByRole('link', { name: /^Wish list/ })).toBeVisible();
        await header(page).getByRole('button', { name: 'Close menu' }).click();
      }
      await expect(header(page).getByRole('button', { name: 'Account menu' })).toBeVisible();
      await expect(header(page).getByRole('link', { name: 'Log in' })).toHaveCount(0);
      // the artist links live in the account menu, not in the header itself
      for (const name of ['Add artwork', 'My works', 'Orders to ship', 'My profile']) await expect(header(page).getByRole('link', { name })).toHaveCount(0);
      expect(await noSideScroll(page)).toBe(true);
    });
  }

  test('Categories lists the five groups and opens Browse with that group', async ({ page }) => {
    test.skip(!wide(page), 'on narrow screens the groups are in the burger menu (QA-SH-03)');
    await page.goto('/');
    await header(page).getByRole('button', { name: 'Categories' }).click();
    await expect(page.getByRole('menuitem')).toHaveText(GROUPS);
    await page.getByRole('menuitem', { name: 'Handmade Crafts' }).click();
    await expect(page).toHaveURL(/\/browse\?group=Handmade%20Crafts/);
  });
});

test.describe('QA-SH-02 account menu', () => {
  const entries = { B1: ['My orders', 'Wish list'], A1: ['My orders', 'Wish list', 'Artist dashboard'] };
  for (const [key, names] of Object.entries(entries)) {
    test(`entries and keyboard for ${key}`, async ({ page }) => {
      await signInAs(page, key);
      await page.goto('/');
      const button = page.getByRole('button', { name: 'Account menu' });
      await button.focus();
      await page.keyboard.press('Enter');
      await expect(button).toHaveAttribute('aria-expanded', 'true');
      const items = page.getByRole('menuitem');
      await expect(items.first()).toBeFocused();
      for (const name of names) await expect(items.filter({ hasText: name }).first()).toBeVisible();
      await expect(items.filter({ hasText: /theme$/ })).toHaveCount(1);
      await expect(items.filter({ hasText: 'Log out' })).toHaveCount(1);
      if (key === 'B1') await expect(page.getByRole('menuitem', { name: 'Artist dashboard' })).toHaveCount(0);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await expect(items.nth(2)).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).toHaveCount(0);
      await expect(button).toBeFocused();
      await button.press('ArrowDown'); // Down opens too
      await page.getByRole('menuitem', { name: 'Log out' }).click();
      await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
    });
  }
});

test('QA-SH-03 burger menu and mobile search', async ({ page }) => {
  test.skip(wide(page), 'phone and tablet widths only');
  await signInAs(page, 'A1');
  await page.goto('/browse');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.mobile-menu a').first().focus(); // a keyboard user tabs into the menu, then presses Escape
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('.mobile-menu').getByRole('link', { name: 'Artist dashboard' }).click();
  await expect(page).toHaveURL(/\/dashboard\/orders$/);
  await expect(page.locator('.mobile-menu')).toHaveCount(0);
  await page.goto('/browse');
  const toggle = page.locator('.market-search-toggle');
  await toggle.click();
  await page.getByRole('searchbox', { name: 'Search artworks and artists' }).fill('kolam');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/browse\?q=kolam$/);
  await expect(toggle).toBeFocused();
});

test('QA-SH-04 footer links', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer.site-footer');
  const hrefs = await footer.getByRole('link').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  for (const g of GROUPS) expect(hrefs).toContain(`/browse?group=${encodeURIComponent(g)}`);
  expect(hrefs).toContain('/legal/privacy');
  for (const href of [...new Set(hrefs)].filter((h) => h !== '/')) {
    await page.goto('/');
    await footer.locator(`a[href="${href}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`${escape(href)}$`));
    await expect(page.getByText('This wall is empty.')).toHaveCount(0);
  }
});

test.describe('QA-SH-06 guards', () => {
  test('a visitor lands on the login page', async ({ page }) => {
    for (const path of ['/orders', '/dashboard/artworks']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test('a signed-in buyer without the role lands on Home with a toast, and no artist data is requested', async ({ page }) => {
    await signInAs(page, 'B1');
    const artistReads = [];
    page.on('response', (r) => { if (/\/rest\/v1\/(artworks|orders)\?.*artist_id=eq\./.test(r.url()) && r.ok()) artistReads.push(r.url()); });
    await page.goto('/dashboard/artworks');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('alert').filter({ hasText: "You don't have access to that page." })).toBeVisible();
    expect(artistReads).toEqual([]);
  });
});

test('QA-SH-07 old paths redirect', async ({ page }) => {
  await signInAs(page, 'A1');
  const cases = [
    ['/dashboard/works', '/dashboard/artworks'],
    ['/dashboard/new', '/dashboard/artworks/new'],
    ['/dashboard/profile', '/dashboard/settings'],
    ['/privacy?x=1', '/legal/privacy?x=1'],
    ['/instagram-deletion?code=abc', '/instagram-deletion?code=abc'],
  ];
  for (const [from, to] of cases) {
    await page.goto('about:blank');
    await page.goto(from);
    await expect(page).toHaveURL(new RegExp(`${escape(to)}$`));
    await expect(page.getByText('This wall is empty.')).toHaveCount(0);
    if (from !== to) { // the redirect replaced the old entry, so Back does not return to it
      await page.goBack();
      expect(page.url()).not.toContain(from);
    }
  }
});

test('QA-SH-08 a stale deploy reloads once; a crash shows Try again', async ({ page }) => {
  await signInAs(page, 'B1');
  const orders = (url) => new URL(url).pathname.endsWith('/src/pages/OrdersPage.jsx') && !new URL(url).search.includes('real');
  let documents = 0;
  page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame() && r.url().endsWith('/orders')) documents += 1; });
  await page.route(orders, (route) => route.abort());
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: 'Something went wrong on this page' })).toBeVisible();
  expect(documents).toBe(2); // the open plus exactly one reload, no loop
  expect(await page.evaluate(() => Number(sessionStorage.getItem('craftme-reload')))).toBeGreaterThan(0);

  // step 2: the screen now loads but throws a plain error
  await page.unroute(orders);
  await page.addInitScript(() => { window.__boom = true; });
  await page.route(orders, (route) => route.fulfill({
    contentType: 'text/javascript',
    body: "import Real from '/src/pages/OrdersPage.jsx?real'; export default function Orders(p) { if (window.__boom) throw new Error('boom from the test'); return Real(p); }",
  }));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Something went wrong on this page' })).toBeVisible();
  await expect(page.getByText('boom from the test')).toBeVisible();
  await expect(header(page).getByRole('link', { name: 'Browse' }).or(header(page).getByRole('button', { name: 'Open menu' }))).toBeVisible(); // the header still works

  // step 3
  await page.evaluate(() => { window.__boom = false; });
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Something went wrong on this page' })).toHaveCount(0);
  await expect(page.locator('main')).toBeVisible();
});

test.describe('QA-S20 not found and missing resources', () => {
  test('QA-S20-01 unknown route', async ({ page }) => {
    await page.goto('/no/such/page');
    await expect(page.getByRole('heading', { name: 'This wall is empty.' })).toBeVisible();
    const main = page.locator('main');
    await main.getByRole('searchbox').fill('kolam');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/browse\?q=kolam$/);
    await page.goBack();
    await main.getByRole('link', { name: 'Go to Home' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.goBack();
    await main.getByRole('link', { name: 'Browse art' }).click();
    await expect(page).toHaveURL(/\/browse$/);
  });

  test('QA-S20-02 bad ids, missing resources and network errors', async ({ page, context }) => {
    await signInAs(page, 'B1');
    const missing = [
      ['/artwork/xyz', /We couldn.t find this artwork/],
      [`/artwork/${W.W4}`, /We couldn.t find this artwork/], // a draft
      [`/artwork/${W.W7}`, /We couldn.t find this artwork/], // a restricted Artist's work
      ['/orders/xyz', /We couldn.t find this order/],
      ['/artist/xyz', /We couldn.t find this Artist/],
    ];
    for (const [path, text] of missing) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: text })).toBeVisible();
      await expect(page.locator('main').getByRole('link').first()).toBeVisible(); // a way out
    }
    await context.route('**/rest/v1/**', (route) => route.abort());
    await page.goto(`/artwork/${W.W1}`);
    // supabase-js retries a failed read 3 times (1 s, 2 s, 4 s) before the page hears about it
    await expect(page.getByRole('heading', { name: /We couldn.t load this page/ })).toBeVisible({ timeout: 15000 });
    await context.unroute('**/rest/v1/**');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'Monsoon Over Marina' })).toBeVisible();
  });
});

test.describe('QA-S13-08 someone else\'s order (the parts that exist in P00)', () => {
  test('B2 gets the same words as for a missing order; G is sent to login', async ({ page, browser }) => {
    await signInAs(page, 'B2');
    await page.goto(`/orders/${O.O2}`);
    await expect(page.getByRole('heading', { name: /We couldn.t find this order/ })).toBeVisible();
    await page.goto('/orders/00000000-0000-4000-8000-000000000000');
    await expect(page.getByRole('heading', { name: /We couldn.t find this order/ })).toBeVisible();
    const guest = await browser.newPage({ baseURL: 'http://localhost:5173' });
    await guest.goto(`/orders/${O.O2}`);
    await expect(guest).toHaveURL(/\/login$/);
    await guest.close();
  });

  test('B2 selects on orders, order_lines and order_shipping return no rows for O2', async () => {
    const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: anon, QA_PASSWORD: password } = env();
    const client = createClient(url, anon, { auth: { persistSession: false } });
    await client.auth.signInWithPassword({ email: PEOPLE.B2.email, password });
    for (const [table, column] of [['orders', 'id'], ['order_lines', 'order_id'], ['order_shipping', 'order_id']]) {
      const { data, error } = await client.from(table).select('*').eq(column, O.O2);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
  });
});

test('QA-X-06 branding', async ({ page, request }) => {
  await page.goto('/');
  await expect(header(page).locator('img[src="/brand/craftme-icon.svg"]')).toBeVisible();
  await expect(header(page).getByRole('link', { name: /CraftMe/ })).toBeVisible();
  await expect(page.locator('link[rel="icon"][href="/brand/craftme-icon.svg"]')).toHaveCount(1);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#a3472b');
  expect((await request.get('/manifest.json')).ok()).toBe(true);
  expect(await page.locator('img[src*="ring" i]').count()).toBe(0);
});
