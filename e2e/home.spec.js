// P03 scripts: QA-S01-01 to 03. Needs the local stack and the seed.
import { expect, test } from '@playwright/test';
import { sql } from './helpers/db.js';
import { seed } from './helpers/seed.mjs';

const setSwitch = (on) => sql(`update public.settings set switches = switches || '{"acceptArtists": ${on}}'::jsonb`);
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.beforeEach(() => { seed(); setSwitch(true); });

test('QA-S01-01 landing page renders and its buttons work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Original art from Indian artists');
  const heads = page.locator('main h2');
  await expect(heads.first()).toBeVisible();
  const texts = await heads.allTextContents();
  const order = ['categories', 'Buy the Original', 'Buying in 3 steps', 'Questions about buying'];
  order.forEach((t, i) => expect(texts[i]).toContain(t));
  expect(texts.at(-1)).toContain('Find something made by hand');
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(600);
expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.getByRole('link', { name: 'Browse art' }).first().click();
  await expect(page).toHaveURL(/\/browse$/);
  await page.goBack();
  await page.getByRole('link', { name: 'Browse Originals' }).click();
  await expect(page).toHaveURL(/\/browse\?kind=original$/);
  await expect(page.getByRole('button', { name: 'Remove Originals' })).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
});

test('QA-S01-02 category rows and section anchors', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Browse Handmade Crafts' }).click();
  expect(new URL(page.url()).searchParams.get('group')).toBe('Handmade Crafts');
  await expect(page.getByRole('checkbox', { name: 'Handmade Crafts', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Wood Crafts' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Art', exact: true })).not.toBeChecked();
  for (const id of ['how', 'questions']) {
    await page.goto(`/#${id}`);
    const heading = page.locator(`#${id} h2`);
    await expect(heading).toBeVisible();
    await expect.poll(async () => {
      const [h, bar] = await Promise.all([heading.boundingBox(), page.locator('header.site-header').boundingBox()]);
      return h.y >= bar.y + bar.height - 1;
    }).toBe(true);
  }
});

test.describe('QA-S01-03 seller entry follows the switch', () => {
  test('acceptArtists true: both links open /become-artist', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Sell your art' })).toHaveAttribute('href', '/become-artist');
    await expect(page.getByRole('link', { name: 'Start selling' })).toHaveAttribute('href', '/become-artist');
  });

  test('acceptArtists false, images blocked: both absent, layout intact, FAQ wording', async ({ page }) => {
    setSwitch(false);
    await page.route('**/*', (route) => (route.request().resourceType() === 'image' ? route.abort() : route.continue()));
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sell your art' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Start selling' })).toHaveCount(0);
    await expect(page.locator('#artists')).toHaveCount(0);
    expect(await noSideScroll(page)).toBe(true);
    const faq = page.locator('#questions');
    await expect(faq).toContainText('within 7 days');
    await expect(faq).toContainText('Not once it is Paid');
    await expect(faq).toContainText('a Cart holds one artist’s work');
    await expect(faq).toContainText('within India only');
    await expect(faq).toContainText('Only Buyers whose Order was Received can review');
    await expect(faq).toContainText('CraftMe approves every Review');
    await page.getByRole('link', { name: 'Browse art' }).first().click();
    await expect(page).toHaveURL(/\/browse$/);
  });
});
