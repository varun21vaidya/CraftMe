// P03 scripts: QA-X-01 (hearts on cards and pages) and QA-X-05 (global search while the catalogue changes). Needs the local stack and the seed.
import { expect, test } from '@playwright/test';
import { sql } from './helpers/db.js';
import { PEOPLE, W } from './helpers/ids.js';
import { seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const B1 = PEOPLE.B1.id;
const A1 = PEOPLE.A1.id;
const saved = () => Number(sql(`select count(*) from public.saved_works where user_id = '${B1}' and artwork_id = '${W.W6}'`));

test.beforeEach(() => seed());

test('QA-X-01 heart on cards and pages', async ({ page, browser }) => {
  await page.goto('/browse');
  await expect(page.locator('article.art-card').first()).toBeVisible();
  await page.locator('article.art-card').first().getByRole('button', { name: 'Save to wish list' }).click();
  await expect(page).toHaveURL(/\/login/);

  const ctx = await browser.newContext({ viewport: page.viewportSize(), baseURL: 'http://localhost:5173' });
  const b1 = await ctx.newPage();
  await signInAs(b1, 'B1');
  await b1.goto(`/artwork/${W.W6}`);
  const heart = b1.getByRole('button', { name: /wish list/ }).first();
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  const count = b1.getByRole('link', { name: /^Wish list, \d+ saved/ });
  const before = Number((await count.getAttribute('aria-label')).match(/\d+/)[0]);
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await expect(count).toHaveAttribute('aria-label', `Wish list, ${before + 1} saved`);
  await expect.poll(saved).toBe(1);
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  await expect(count).toHaveAttribute('aria-label', `Wish list, ${before} saved`);
  await expect.poll(saved).toBe(0);
  await ctx.close();

  const own = await browser.newContext({ viewport: page.viewportSize(), baseURL: 'http://localhost:5173' });
  const a1 = await own.newPage();
  await signInAs(a1, 'A1');
  await a1.goto(`/browse?q=${encodeURIComponent('Monsoon')}`);
  const w1 = a1.locator('article.art-card').filter({ hasText: 'Monsoon Over Marina' });
  await expect(w1).toBeVisible();
  await expect(w1.getByRole('button', { name: /wish list/ })).toHaveCount(0);
  await own.close();
});

test('QA-X-05 global search while the catalogue changes', async ({ page }) => {
  await page.goto('/browse?q=a');
  const cards = page.locator('article.art-card');
  await expect(cards).toHaveCount(24);
  // another Artist publishes a new matching work meanwhile
  sql(`with a as (insert into public.artworks (artist_id, title, category, status, created_at) values ('${A1}', 'Late Arrival', 'Paintings', 'published', now() + interval '1 minute') returning id)
       insert into public.listings (artwork_id, artist_id, title, kind, price, stock, status) select id, '${A1}', 'Print', 'print', 100000, 5, 'live' from a`);
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(cards.first()).toBeVisible();
  const second = await cards.count();
  expect(second).toBeGreaterThan(0);
  expect(second).toBeLessThanOrEqual(24);
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(cards).toHaveCount(24);
  await expect(page.getByRole('alert')).toHaveCount(0);
  // the Artists view lists only unrestricted Artists
  await page.goto('/browse?q=a&type=artists');
  await expect(page.getByRole('link', { name: 'Meera Iyer' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Naina Kapoor' })).toHaveCount(0);
  // % is a plain character
  await page.goto(`/browse?q=${encodeURIComponent('%')}`);
  await expect(page.getByRole('heading', { name: 'Nothing matches those filters.' })).toBeVisible();
  await page.goto(`/browse?q=${encodeURIComponent('%')}&type=artists`);
  await expect(page.getByRole('heading', { name: /No Artists match/ })).toBeVisible();
});
