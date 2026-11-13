// P03 scripts: QA-S02-01 to 06. Needs the local stack and the seed (35 public works).
import { expect, test } from '@playwright/test';
import { sql } from './helpers/db.js';
import { seed } from './helpers/seed.mjs';

const count = (page) => page.getByRole('status').filter({ hasText: /match(es)? your filters\.|Searching…/ });
const cards = (page) => page.locator('article.art-card');
const chip = (page, name) => page.getByRole('button', { name: `Remove ${name}` });
const filter = (page, name) => page.getByRole('checkbox', { name, exact: true });
const search = (page) => page.getByRole('searchbox', { name: 'Search', exact: true });
const titles = async (page) => (await cards(page).locator('strong').allTextContents()).sort();
const hrefs = (page) => page.locator('article.art-card a.art-link').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
const TOTAL = 35;

test.beforeEach(() => seed());

test('QA-S02-01 combine filters', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/browse');
  await expect(count(page)).toHaveText(`${TOTAL} Artworks match your filters.`);
  await filter(page, 'Art').click();
await expect(filter(page, 'Art')).toBeChecked();
  await expect(chip(page, 'Art')).toBeVisible();
  await expect(count(page)).not.toHaveText(`${TOTAL} Artworks match your filters.`);
  const afterGroup = await count(page).innerText();
  await filter(page, 'Prints').click();
await expect(filter(page, 'Prints')).toBeChecked();
  await expect(chip(page, 'Prints')).toBeVisible();
  await expect(count(page)).not.toHaveText(afterGroup);
  await search(page).fill('riso');
  await expect(count(page)).toHaveText('1 Artwork matches your filters.');
  expect(await titles(page)).toEqual(['Riso Sunrise']);
  await page.getByRole('searchbox', { name: 'Artist', exact: true }).fill('tanvi');
  await page.getByRole('option', { name: 'Tanvi Rao' }).getByRole('button').click();
  await expect(chip(page, 'Tanvi Rao')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Active filters' }).locator('li')).toHaveCount(4);
  await expect(chip(page, '“riso”')).toBeVisible();
  expect(await titles(page)).toEqual(['Riso Sunrise']);
  // medium and Artist-name search
  await page.goto('/browse?q=acrylic');
  await expect(cards(page).filter({ hasText: 'Monsoon Over Marina' })).toBeVisible();
  await page.goto('/browse?q=meera');
  await expect(count(page)).toHaveText(`${sql("select count(*) from public.artworks a join public.profiles p on p.id = a.artist_id where p.display_name = 'Meera Iyer' and a.status = 'published' and exists (select 1 from public.listings l where l.artwork_id = a.id and l.status in ('live','sold'))")} Artworks match your filters.`);
  // never a draft, an ended work or a restricted Artist's work
  await page.goto('/browse?sort=price_asc&page=1');
  const all = [];
  for (const n of [1, 2]) { await page.goto(`/browse?page=${n}`); await expect(cards(page).first()).toBeVisible(); all.push(...(await titles(page))); }
  for (const hidden of ['Coconut Grove, Study 2', 'Pongal Morning', 'Peacock Study']) expect(all).not.toContain(hidden);
});

test('QA-S02-02 sorting and numbered pages with ties', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const [sort, label] of [['price_asc', 'Price: low to high'], ['new', 'Newest first'], ['rating', 'Highest rated Artist']]) {
    await page.goto('/browse');
    await page.getByRole('combobox', { name: 'Sort' }).selectOption({ label });
    const seen = [];
    for (let n = 1; n <= Math.ceil(TOTAL / 24); n++) {
      if (n > 1) await page.getByRole('button', { name: `Page ${n}`, exact: true }).click();
      const expected = n < Math.ceil(TOTAL / 24) ? 24 : TOTAL - 24 * (n - 1);
      await expect(cards(page)).toHaveCount(expected);
      const got = await hrefs(page);
      expect(got.length).toBe(expected);
      if (sort === 'rating' && n === 1) await expect(cards(page).first()).toContainText('Meera Iyer');
      seen.push(...got);
    }
    expect(new Set(seen).size, `${sort}: every work exactly once`).toBe(TOTAL);
    expect(seen.length).toBe(TOTAL);
  }
});

test('QA-S02-03 price range, hide sold, chips, URL restore', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/browse');
  await page.getByRole('checkbox', { name: 'Hide Sold Originals' }).click();
  await expect(cards(page).filter({ hasText: 'Temple Tank, Evening' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Hide Sold Originals' }).click();
  await expect(cards(page).filter({ hasText: 'Temple Tank, Evening' })).toHaveCount(1);
  await page.getByLabel('Minimum price in rupees').fill('10000');
  await page.getByLabel('Maximum price in rupees').fill('2000');
  await page.getByLabel('Maximum price in rupees').press('Enter');
  await expect(page.getByLabel('Minimum price in rupees')).toHaveValue('2000');
  await expect(page.getByLabel('Maximum price in rupees')).toHaveValue('10000');
  await expect(chip(page, '₹2,000 to ₹10,000')).toBeVisible();
  const prices = await cards(page).locator('span.small').allTextContents();
  for (const p of prices.filter((t) => t.startsWith('From'))) {
    const n = Number(p.replace(/[^\d.]/g, ''));
    expect(n).toBeGreaterThanOrEqual(2000);
    expect(n).toBeLessThanOrEqual(10000);
  }
  await page.getByRole('checkbox', { name: 'Hide Sold Originals' }).click();
  await expect(cards(page).filter({ hasText: 'Temple Tank, Evening' })).toHaveCount(0);
  await expect(cards(page).filter({ hasText: 'Kolam at Dawn' })).toHaveCount(1);
  const shown = await count(page).innerText();
  await page.reload();
  await expect(count(page)).toHaveText(shown);
  await expect(page.getByLabel('Minimum price in rupees')).toHaveValue('2000');
  await chip(page, '₹2,000 to ₹10,000').click();
  await expect(page.getByLabel('Minimum price in rupees')).toHaveValue('');
  expect(new URL(page.url()).searchParams.has('min')).toBe(false);
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  await page.goBack();
  await expect(page.getByLabel('Minimum price in rupees')).toHaveValue('2000');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByRole('list', { name: 'Active filters' })).toHaveCount(0);
  await expect(page.locator('summary', { hasText: 'Filters' }).locator('.badge')).toHaveText('0');
  await expect(page).toHaveURL(/\/browse$/);
});

test('QA-S02-04 no results', async ({ page }) => {
  await page.goto('/browse?q=zzzzzz');
  await expect(page.getByRole('heading', { name: 'Nothing matches those filters.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Clear all filters' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse everything' })).toBeVisible();
  await expect(count(page)).toHaveText('No Artworks match your filters.');
  await page.getByRole('button', { name: 'Clear all filters' }).click();
  await expect(count(page)).toHaveText(`${TOTAL} Artworks match your filters.`);
  await expect(cards(page).first()).toBeVisible();
});

test.describe('QA-S02-05 loading and failure are not "empty"', () => {
  test('a slow answer shows twelve skeleton tiles', async ({ page }) => {
    await page.route('**/rpc/browse_catalogue', async (route) => { await new Promise((r) => setTimeout(r, 2000)); await route.continue(); });
    await page.goto('/browse');
    await expect(page.locator('[aria-busy="true"] .skeleton')).toHaveCount(12);
    await expect(count(page)).toHaveText('Searching…');
    await expect(cards(page).first()).toBeVisible({ timeout: 10000 });
  });

  test('a failure is an alert with Try again, never the empty text', async ({ page }) => {
    await page.route('**/rpc/browse_catalogue', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
    await page.goto('/browse');
    const alert = page.getByRole('alert').filter({ hasText: 'We couldn’t load the catalogue.' });
    await expect(alert).toBeVisible();
    await expect(page.getByText('Nothing matches those filters.')).toHaveCount(0);
    await page.unroute('**/rpc/browse_catalogue');
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(cards(page).first()).toBeVisible();
    await expect(alert).toHaveCount(0);
  });

  test('the answer for the last thing typed wins even when an older answer arrives later', async ({ page }) => {
    await page.goto('/browse');
    await expect(cards(page).first()).toBeVisible();
    let n = 0;
    await page.route('**/rpc/browse_catalogue', async (route) => {
      n += 1;
      if (n === 1) await new Promise((r) => setTimeout(r, 3000));
      await route.continue();
    });
    await search(page).fill('a');
    await page.waitForTimeout(500);
    await search(page).fill('kolam');
    await expect(count(page)).toHaveText('1 Artwork matches your filters.');
    await page.waitForTimeout(3500);
    expect(await titles(page)).toEqual(['Kolam at Dawn']);
    await expect(count(page)).toHaveText('1 Artwork matches your filters.');
  });
});

test('QA-S02-06 narrow layout and header search results', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/browse');
  const panel = page.locator('details.filters');
  await expect(panel.locator(':scope > summary')).toContainText('Filters');
  await expect(panel).not.toHaveAttribute('open', '');
  const results = page.getByRole('region', { name: 'Results' });
  await panel.locator(':scope > summary').click();
  await expect(panel).toHaveAttribute('open', '');
  const [p, r] = await Promise.all([panel.boundingBox(), results.boundingBox()]);
  expect(p.y).toBeLessThan(r.y);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await page.getByRole('search').getByRole('searchbox').fill('meera');
  await page.getByRole('search').getByRole('searchbox').press('Enter');
  await expect(page.getByRole('heading', { name: 'Results for “meera”' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Artworks', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Artists', exact: true }).click();
  const link = page.getByRole('link', { name: 'Meera Iyer' });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', /\/artist\/a1000000-/);
});
