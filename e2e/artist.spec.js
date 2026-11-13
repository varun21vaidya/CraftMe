// P03 scripts: QA-S04-01 to 03 and 05 to 07. Needs the local stack and the seed.
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { clientAs } from './helpers/api.js';
import { sql } from './helpers/db.js';
import { O, PEOPLE } from './helpers/ids.js';
import { env, seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const { A1, A2, A3, B1 } = Object.fromEntries(['A1', 'A2', 'A3', 'B1'].map((k) => [k, PEOPLE[k].id]));
const cards = (page) => page.locator('article.art-card');
const titles = async (page) => (await cards(page).locator('strong').allTextContents()).sort();
const profile = (page) => page.getByRole('region', { name: 'Profile' });
const tab = (page, name) => page.getByRole('tab', { name: new RegExp(`^${name}`) });
const rating = () => Number(sql(`select rating_count from public.profiles where id = '${A1}'`));

test.beforeEach(() => seed());

test('QA-S04-01 header, copy link, About', async ({ page, context, browserName }) => {
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`/artist/${A1}`);
  const since = new Date(sql(`select created_at from public.profiles where id = '${A1}'`)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  await expect(profile(page).getByRole('heading', { level: 1 })).toHaveText('Meera Iyer');
  await expect(profile(page)).toContainText('Verified Artist');
  await expect(profile(page)).toContainText(`Chennai, Tamil Nadu · On CraftMe since ${since}`);
  await expect(profile(page)).toContainText('Chennai painter of monsoon skies and temple tanks.');
  await expect(profile(page).getByRole('button', { name: '3 Reviews' })).toBeVisible();
  await profile(page).getByRole('button', { name: 'Copy profile link' }).click();
  await expect(page.locator('.toast').first()).toContainText('/artist/meera-iyer');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${new URL(page.url()).origin}/artist/meera-iyer`);
  // every link on the page uses the id
  const hrefs = await page.locator('a[href^="/artist/"]').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  for (const h of hrefs) expect(h).toMatch(/^\/artist\/[0-9a-f-]{36}/);
  await tab(page, 'About').click();
  const about = page.locator('dl.kv');
  for (const t of ['Based in', 'Chennai, Tamil Nadu', 'Joined', 'Verified', 'Identity and payout details checked by CraftMe', 'Within 7 days, India only']) await expect(about).toContainText(t);
  // the short name redirects to the id, keeping the query, without bouncing on Back
  await page.goto('about:blank');
  await page.goto('/artist/meera-iyer?tab=reviews');
  await expect(page).toHaveURL(new RegExp(`/artist/${A1}\\?tab=reviews$`));
  await expect(tab(page, 'Reviews')).toHaveAttribute('aria-selected', 'true');
  await page.goBack();
  await expect(page).toHaveURL('about:blank');
  await page.goto('/artist/no-such-name');
  await expect(page.getByRole('heading', { name: 'We couldn’t find this Artist' })).toBeVisible();
  await page.goto(`/artist/${A2}`);
  await expect(profile(page)).not.toContainText('Verified Artist');
  await tab(page, 'About').click();
  await expect(page.locator('dl.kv')).toContainText('Checks in progress');
  expect(sql(`select slug from public.profiles where id = '${A1}'`)).toBe('meera-iyer');
  expect(sql(`select coalesce(slug, 'none') from public.profiles where id = '${B1}'`)).toBe('none');
});

test('QA-S04-02 Artworks tab filters', async ({ page }) => {
  await page.goto(`/artist/${A1}`);
  const showing = page.getByRole('status').filter({ hasText: /^Showing/ });
  const all = await (async () => { await expect(cards(page).first()).toBeVisible(); return titles(page); })();
  for (const hidden of ['Coconut Grove, Study 2', 'Pongal Morning']) expect(all).not.toContain(hidden);
  const chip = (name) => page.getByRole('button', { name, exact: true });
  await chip('Originals').click();
  await expect(showing).toHaveText('Showing 1 Artwork');
  expect(await titles(page)).toEqual(['Monsoon Over Marina']);
  await chip('Prints').click();
  await expect(showing).toHaveText('Showing 2 Artworks');
  expect(await titles(page)).toEqual(['Kolam at Dawn', 'Monsoon Over Marina']);
  await chip('Ready-made').click();
  await expect(showing).toContainText('Showing');
  await chip('All').click();
  await expect(showing).toHaveText(`Showing ${all.length} Artworks`);
  await chip('Sold').click();
  await expect(showing).toHaveText('Showing 1 Artwork');
  expect(await titles(page)).toEqual(['Temple Tank, Evening']);
  await page.reload();
  await expect(chip('Sold')).toHaveAttribute('aria-pressed', 'true');
  await expect(showing).toHaveText('Showing 1 Artwork');
});

test('QA-S04-03 public reviews', async ({ page }) => {
  await page.goto(`/artist/${A1}?tab=reviews`);
  const summary = page.getByLabel('Rating summary');
  await expect(summary).toContainText('4.7');
  await expect(summary).toContainText('Based on 3 Reviews from Buyers who received their Orders');
  const bars = page.getByRole('list', { name: 'Reviews by stars' }).locator('li');
  const total = () => bars.evaluateAll((els) => els.map((e) => Number(e.getAttribute('aria-label').split(': ')[1])).reduce((a, b) => a + b, 0));
  await expect.poll(total).toBe(3);
  const reviews = page.locator('article').filter({ hasText: 'Received Order' });
  await expect(reviews).toHaveCount(3);
  for (const t of ['Ananya', 'Rahul']) await expect(reviews.filter({ hasText: t }).first()).toBeVisible();
  await expect(reviews.first()).toContainText(/\d{4}/);
  // reject one pending review and approve another, as Admin
  const start = rating();
  const b1 = await clientAs('B1');
  const admin = await clientAs('AD1');
  expect((await b1.rpc('submit_review', { p_order: O.O6, p_rating: 1, p_comment: 'Call me on 9876543210' })).error).toBeNull();
  expect((await b1.rpc('submit_review', { p_order: O.O5, p_rating: 5, p_comment: 'Splendid.' })).error).toBeNull();
  await page.reload();
  await expect(reviews).toHaveCount(3);
  expect((await admin.rpc('decide_review', { p_order: O.O6, p_decision: 'rejected' })).error).toBeNull();
  expect((await admin.rpc('decide_review', { p_order: O.O5, p_decision: 'approved' })).error).toBeNull();
  await page.reload();
  await expect(reviews).toHaveCount(4);
  await expect(page.getByText('Splendid.')).toBeVisible();
  await expect(page.getByText('Call me on')).toHaveCount(0);
  expect(rating()).toBe(start + 1);
  await page.goto(`/artist/${A2}?tab=reviews`);
  await expect(page.getByRole('heading', { name: 'No Reviews yet.' })).toBeVisible();
});

test('QA-S04-05 stats', async ({ page }) => {
  await page.goto(`/artist/${A1}`);
  const stats = page.getByLabel('Artist stats');
  const works = sql(`select count(*) from public.artworks a where a.artist_id = '${A1}' and a.status = 'published' and exists (select 1 from public.listings l where l.artwork_id = a.id and l.status in ('live','sold'))`);
  const shipped = sql(`select count(*) from public.orders where artist_id = '${A1}' and shipped_at is not null`);
  const hours = Number(sql(`select round(avg(extract(epoch from shipped_at - paid_at) / 3600)::numeric, 1) from public.orders where artist_id = '${A1}' and shipped_at is not null and paid_at is not null`));
  const days = hours < 24 ? 'under a day' : `${(hours / 24).toFixed(1)} days`;
  await expect(stats.locator('.stat').filter({ hasText: 'Artworks' })).toContainText(works);
  await expect(stats.locator('.stat').filter({ hasText: 'Orders shipped' })).toContainText(shipped);
  await expect(stats.locator('.stat').filter({ hasText: 'Avg. time to ship' })).toContainText(days);
  const anon = createClient(env().VITE_SUPABASE_URL, env().VITE_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  expect((await anon.rpc('artist_public_stats', { p_artist: A3 })).data).toBeNull();
  await page.goto(`/artist/${A3}`);
  await expect(page.getByText('This Artist isn’t taking orders right now.')).toBeVisible();
  await expect(page.getByLabel('Artist stats')).toHaveCount(0);
});

test('QA-S04-06 report an Artist', async ({ page, browser }) => {
  await signInAs(page, 'B1');
  await page.goto(`/artist/${A1}`);
  await profile(page).getByRole('button', { name: 'Report' }).click();
  const dialog = page.getByRole('dialog', { name: 'Report this Artist' });
  await dialog.getByLabel('What’s wrong').selectOption({ label: 'Impersonation or stolen work' });
  await dialog.getByLabel('Details').fill('This looks like another painter’s account.');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(page.locator('.toast').first()).toContainText('Report sent. Thank you.');
  expect(sql(`select target_type || '|' || reason from public.reports where target_id = '${A1}' and reporter_id = '${B1}'`)).toBe('artist|impersonation');
  const ctx = await browser.newContext({ viewport: page.viewportSize(), baseURL: 'http://localhost:5173' });
  const own = await ctx.newPage();
  await signInAs(own, 'A1');
  await own.goto(`/artist/${A1}`);
  await expect(own.getByRole('heading', { level: 1, name: 'Meera Iyer' })).toBeVisible();
  await expect(own.getByRole('button', { name: 'Report' })).toHaveCount(0);
  await ctx.close();
});

test('QA-S04-07 unknown, restricted, empty and owner views', async ({ page, browser }) => {
  test.setTimeout(90000); // supabase-js retries a failed read for about 7 seconds before the page hears about it
  for (const key of ['not-a-uuid', B1]) {
    await page.goto(`/artist/${key}`);
    await expect(page.getByRole('heading', { name: 'We couldn’t find this Artist' })).toBeVisible();
  }
  await page.goto(`/artist/${A3}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Naina Kapoor' })).toBeVisible();
  await expect(page.getByText('This Artist isn’t taking orders right now.')).toBeVisible();
  await expect(cards(page)).toHaveCount(0);
  await expect(page.getByText('Buyers can’t see your works right now.')).toHaveCount(0);
  const ctx = await browser.newContext({ viewport: page.viewportSize(), baseURL: 'http://localhost:5173' });
  const owner = await ctx.newPage();
  await signInAs(owner, 'A3');
  await owner.goto(`/artist/${A3}`);
  await expect(owner.getByText('Buyers can’t see your works right now.')).toBeVisible();
  await ctx.close();
  // an Artist with no photo, bio or works
  const bare = sql("insert into public.profiles (id, display_name, roles) values (gen_random_uuid(), 'Bare Artist', '{artist}') returning id").split('\n')[0];
  await page.goto(`/artist/${bare}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Bare Artist' })).toBeVisible();
  await expect(profile(page).locator('.avatar')).toHaveText('BA');
  await expect(page.getByRole('heading', { name: 'No work on sale right now.' })).toBeVisible();
  // a blocked network
  await page.route('**/rest/v1/**', (route) => route.abort());
  await page.goto(`/artist/${A1}`);
  await expect(page.getByRole('heading', { name: 'We couldn’t load this page.' })).toBeVisible({ timeout: 20000 });
  await page.unroute('**/rest/v1/**');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Meera Iyer' })).toBeVisible();
});
