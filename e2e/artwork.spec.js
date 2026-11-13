// P03 scripts: QA-S03-01 to 04 and 07 to 09. Needs the local stack and the seed.
import { expect, test } from '@playwright/test';
import { clientAs } from './helpers/api.js';
import { readCart } from './helpers/cart.js';
import { sql } from './helpers/db.js';
import { L, PEOPLE, W } from './helpers/ids.js';
import { seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const A1 = PEOPLE.A1.id;
const B1 = PEOPLE.B1.id;
const buy = (page) => page.getByRole('complementary', { name: 'Buy' });
const card = (page, kind) => page.locator('label.option-card').filter({ hasText: new RegExp(`^\\s*${kind}`) });
const views = (id) => Number(sql(`select views from public.artworks where id = '${id}'`));

test.beforeEach(() => seed());

test('QA-S03-01 available artwork, full page', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const before = views(W.W1);
  await page.goto(`/artwork/${W.W1}`);
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  for (const t of ['Home', 'Browse', 'Paintings', 'Monsoon Over Marina']) await expect(crumbs).toContainText(t);
  const left = Number(sql(`select stock - held from public.listings where id = '${L.W1P}'`));
  await expect(card(page, 'Original')).toContainText('Only 1 available');
  await expect(card(page, 'Original')).toContainText('₹42,000');
  await expect(card(page, 'Print')).toContainText(`${left} in stock`);
  await expect(card(page, 'Print')).toContainText('₹2,500');
  const trust = buy(page).locator('ul.list li');
  await expect(trust).toHaveCount(3);
  await expect(trust.nth(0)).toContainText('within 7 days');
  await expect(trust.nth(1)).toContainText('Nobody else can buy it while you check out');
  await expect(trust.nth(2)).toContainText('within 3 days');
  const label = page.getByRole('term').filter({ hasText: /./ });
  expect(await label.count()).toBeGreaterThanOrEqual(6);
  const wall = page.locator('dl[aria-label="Wall label"]');
  for (const t of ['Meera Iyer', 'Monsoon Over Marina', '2024', 'Acrylic on canvas', 'Paintings', 'Signed on the back', 'Chennai, Tamil Nadu', 'C1000000']) await expect(wall).toContainText(t);
  await wall.getByRole('button', { name: 'Copy' }).click();
  await expect(page.locator('.toast').first()).toContainText('Copied C1000000');
  await expect.poll(() => views(W.W1)).toBe(before + 1);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Monsoon Over Marina');
  await page.waitForTimeout(800);
  expect(views(W.W1)).toBe(before + 1);
  if (page.viewportSize().width <= 900) {
    const [g, a] = await Promise.all([page.locator('.gal').boundingBox(), buy(page).boundingBox()]);
    expect(a.y).toBeGreaterThanOrEqual(g.y + g.height - 1);
  }
});

test('QA-S03-02 sold original, and everything sold', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto(`/artwork/${W.W2}`);
  await expect(page.getByRole('radio', { name: /Original/ })).toBeDisabled();
  await expect(card(page, 'Original')).toContainText('Sold');
  await expect(page.getByRole('radio', { name: /Print/ })).toBeChecked();
  await expect(buy(page)).toContainText('This Original has found a home. Prints of this Artwork are still available.');
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await expect(page.locator('.toast').first()).toContainText('Added to your Cart');
  await page.goto(`/artwork/${W.W3}`);
  await expect(page.locator('.sold-tag')).toBeVisible();
  await expect(buy(page).getByRole('button', { name: 'Sold' })).toBeDisabled();
  await expect(buy(page).getByRole('button', { name: /Add to Cart|Buy now/ })).toHaveCount(0);
  await expect(page.getByRole('group', { name: /Quantity/ })).toHaveCount(0);
});

test('QA-S03-03 the Artist views their own work', async ({ page }) => {
  await signInAs(page, 'A1');
  await page.goto(`/artwork/${W.W1}`);
  const own = buy(page).getByText('This is your Artwork.');
  await expect(own).toBeVisible();
  await expect(buy(page)).toContainText('Artists can’t buy their own Listings.');
  await expect(buy(page).getByRole('link', { name: 'Edit in dashboard' })).toHaveAttribute('href', `/dashboard/artworks/${W.W1}`);
  for (const name of [/Add to Cart/, /Buy now/, /Save/, /Report this Artwork/]) await expect(buy(page).getByRole('button', { name })).toHaveCount(0);
});

test('QA-S03-04 quantity and Add to Cart', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto(`/artwork/${W.W2}`);
  await page.getByRole('radio', { name: /Print/ }).check();
  const plus = page.getByRole('button', { name: 'Increase quantity' });
  for (let i = 0; i < 12 && await plus.isEnabled(); i++) await plus.click();
  await expect(page.getByRole('textbox', { name: /Quantity/ })).toHaveValue('10');
  await expect(page.getByText('That\'s all there is.')).toBeVisible();
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Decrease quantity' }).click();
  await expect(page.getByRole('textbox', { name: /Quantity/ })).toHaveValue('2');
  await expect(buy(page)).toContainText('₹4,400');
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  await expect(page.locator('.toast').first()).toContainText('Added to your Cart');
  await expect(page).toHaveURL(new RegExp(`/artwork/${W.W2}$`));
  await expect(page.getByRole('button', { name: 'In your Cart' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View Cart' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();
  const cart = await readCart(page, 'B1');
  expect(cart.items).toEqual([{ listingId: L.W2P, qty: 2, seen: 220000 }]);
  await page.goto(`/artwork/${W.W1}`);
  await page.getByRole('radio', { name: /Original/ }).check();
  await expect(page.getByRole('group', { name: /Quantity/ })).toHaveCount(0);
  await expect(buy(page)).toContainText('Originals are always 1');
  // a listing with stock 5 stops at 5
  await page.goto(`/artwork/${W.W8}`);
  await page.getByRole('radio', { name: /Ready-made/ }).check();
  const more = page.getByRole('button', { name: 'Increase quantity' });
  for (let i = 0; i < 8 && await more.isEnabled(); i++) await more.click();
  await expect(page.getByRole('textbox', { name: /Quantity/ })).toHaveValue('5');
});

test('QA-S03-07 report an Artwork', async ({ page, browser }) => {
  await page.goto(`/artwork/${W.W6}`);
  await page.getByRole('button', { name: 'Report this Artwork' }).click();
  await expect(page).toHaveURL(/\/login/);
  const ctx = await browser.newContext({ viewport: page.viewportSize(), baseURL: 'http://localhost:5173' });
  const b1 = await ctx.newPage();
  await signInAs(b1, 'B1');
  await b1.goto(`/artwork/${W.W6}`);
  await b1.getByRole('button', { name: 'Report this Artwork' }).click();
  const dialog = b1.getByRole('dialog', { name: 'Report this Artwork' });
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog).toContainText('Choose what’s wrong.');
  await dialog.getByRole('radio', { name: 'It looks copied or stolen from another Artist' }).check();
  await dialog.getByLabel('Details').pressSequentially('x'.repeat(501));
  await expect(dialog.locator('#rep-count')).toHaveText('500 / 500');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(b1.locator('.toast').first()).toContainText('Report sent. Thank you.');
  await expect(dialog).toBeHidden();
  expect(sql(`select target_type || '|' || reason || '|' || length(details) || '|' || status from public.reports where target_id = '${W.W6}' and reporter_id = '${B1}'`)).toBe('artwork|copied|500|open');
  await b1.getByRole('button', { name: 'Report this Artwork' }).click();
  await dialog.getByRole('radio', { name: 'It looks copied or stolen from another Artist' }).check();
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(dialog).toContainText('You’ve already reported this. We’re looking at it.');
  await ctx.close();
});

test('QA-S03-08 reel in the gallery with its fallback', async ({ page }) => {
  let toInstagram = 0;
  await page.route(/instagram\.com/, (route) => { toInstagram += 1; return route.abort(); });
  await page.goto(`/artwork/${W.W1}`);
  const gallery = page.getByRole('region', { name: /photos/ });
  await expect(gallery).toBeVisible();
  await gallery.focus();
  for (let i = 0; i < 3; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(700); } // each press scrolls the track; the index follows the scroll
  const play = page.getByRole('button', { name: /^Play reel/ });
  await expect(play).toBeVisible();
  const next = page.getByRole('button', { name: 'Next photo' });
  if (await next.isVisible()) await expect(next).toBeDisabled(); // the reel is the last slide
  expect(toInstagram).toBe(0);
  await play.click();
  await expect(page.getByRole('link', { name: 'Open on Instagram' })).toBeVisible();
  const frame = await page.locator('iframe[title*="reel" i]').boundingBox();
  const slide = await page.locator('.reel-frame').boundingBox();
  expect(frame.width).toBeLessThanOrEqual(slide.width + 1);
});

test('QA-S03-09 reviews preview and related works', async ({ page }) => {
  const bodies = [];
  page.on('response', async (r) => { if (/\/rest\/v1\/reviews/.test(r.url())) bodies.push(await r.text().catch(() => '')); });
  await page.goto(`/artwork/${W.W1}`);
  const reviews = page.getByRole('region', { name: 'What Buyers say about Meera' });
  await expect(reviews).toBeVisible();
  const texts = await reviews.locator('article p').allTextContents();
  expect(texts).toEqual(['Lovely colours. The tube was a little dented but the print was fine.', 'Exactly as photographed, and it arrived in three days.', 'Beautiful print, packed with care.']);
  await expect(reviews.getByRole('link', { name: 'All 3 Reviews' })).toHaveAttribute('href', `/artist/${A1}?tab=reviews`);
  const from = page.getByRole('region', { name: 'More from Meera Iyer' });
  await expect(from).toBeVisible();
  const titles = await from.locator('article strong').allTextContents();
  for (const t of ['Monsoon Over Marina', 'Coconut Grove, Study 2', 'Pongal Morning']) expect(titles).not.toContain(t);
  expect(titles.length).toBeGreaterThan(0);
  const cat = page.getByRole('region', { name: 'More Paintings' });
  await expect(cat).toBeVisible();
  expect(await cat.locator('article strong').allTextContents()).not.toContain('Monsoon Over Marina');
  expect(bodies.length).toBeGreaterThan(0);
  for (const b of bodies) expect(b).not.toContain('buyer_id');
  await page.goto(`/artwork/${W.W6}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Brass Heron');
  await expect(page.getByText(/What Buyers say about/)).toHaveCount(0);
});

test('the Artist a Buyer reported twice cannot double-report through the API', async () => {
  const b1 = await clientAs('B1');
  await b1.rpc('report', { p_target_type: 'artwork', p_target: W.W6, p_reason: 'other', p_details: '' });
  const again = await b1.rpc('report', { p_target_type: 'artwork', p_target: W.W6, p_reason: 'other', p_details: '' });
  expect(JSON.parse(again.error.message).reason).toBe('already_exists');
});
