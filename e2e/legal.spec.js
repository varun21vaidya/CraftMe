// P04 scripts: QA-S19-01 to QA-S19-04. QA-S19-05 (draft text cannot ship) is src/content/legal/legal.test.jsx plus the production build check.
import { expect, test } from '@playwright/test';
import { sql } from './helpers/db.js';
import { PEOPLE } from './helpers/ids.js';
import { seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';
import { RULES } from '../src/lib/rules.js';

const PAGES = [
  ['terms', 'Terms of Use', 'Terms'], ['privacy', 'Privacy policy', 'Privacy'], ['refunds', 'Cancellation and Refunds', 'Cancellation and Refunds'],
  ['shipping', 'Shipping', 'Shipping'], ['contact', 'Contact', 'Contact'], ['artist', 'Artist agreement', 'Artist agreement'], ['deletion', 'Delete my data', 'Delete my data'],
];
const A1 = PEOPLE.A1.id;
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe('QA-S19-01 seven pages, deep links, signed out', () => {
  test('/legal goes to the Terms', async ({ page }) => {
    await page.goto('/legal');
    await expect(page).toHaveURL(/\/legal\/terms$/);
  });

  for (const [slug, title, tab] of PAGES) {
    test(`/legal/${slug}`, async ({ page }) => {
      await page.goto(`/legal/${slug}`);
      await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
      await expect(page.getByText(/^Last updated \d{1,2} \w{3} \d{4}$/)).toBeVisible();
      const tabs = page.getByRole('navigation', { name: 'Legal pages' });
      await expect(tabs.getByRole('link')).toHaveCount(7);
      await expect(tabs.getByRole('link', { name: tab, exact: true })).toHaveAttribute('aria-current', 'page');
      await expect(tabs.locator('[aria-current=page]')).toHaveCount(1);
      await expect(page.getByRole('link', { name: 'Log in', exact: true })).toBeVisible(); // reachable signed out
      expect(await noSideScroll(page)).toBe(true);
    });
  }

  test('an unknown page is the 404, and /privacy moves', async ({ page }) => {
    await page.goto('/legal/nope');
    await expect(page.getByRole('heading', { name: 'This wall is empty.' })).toBeVisible();
    await page.goto('/privacy');
    await expect(page).toHaveURL(/\/legal\/privacy$/);
  });

  test('the tab row scrolls sideways on a phone without moving the page', async ({ page }) => {
    test.skip(page.viewportSize().width > 640, 'phone widths only');
    await page.goto('/legal/terms');
    const tabs = page.locator('.legal-tabs');
    expect(await tabs.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await noSideScroll(page)).toBe(true);
    await page.getByRole('link', { name: 'Delete my data', exact: true }).first().click();
    await expect(page).toHaveURL(/\/legal\/deletion$/);
    expect(await noSideScroll(page)).toBe(true);
  });

  test('footer and menu links reach every page', async ({ page }) => {
    await page.goto('/');
    for (const [slug, , label] of [['terms', 0, 'Terms'], ['privacy', 0, 'Privacy'], ['refunds', 0, 'Refunds'], ['shipping', 0, 'Shipping'], ['contact', 0, 'Contact'], ['artist', 0, 'Artist agreement'], ['deletion', 0, 'Delete my data']]) {
      await expect(page.locator('footer').getByRole('link', { name: label, exact: true })).toHaveAttribute('href', `/legal/${slug}`);
    }
  });
});

test('QA-S19-02 policy numbers and the overdue wording', async ({ page }) => {
  await page.goto('/legal/refunds');
  const text = await page.locator('.legal-body').innerText();
  for (const n of [`${RULES.holdMinutes} minutes`, `${RULES.shipDays} days`, `${RULES.autoReceiveDays} days`, `${RULES.damageDays} days`, `${RULES.reviewDays} days`, `${RULES.owedRestrictDays} days`, '1st and 15th']) {
    expect(text, n).toContain(n);
  }
  expect(text).toContain('reviewed by CraftMe and usually refunded in full');
  expect(text).not.toMatch(/automatic(ally)? refund/i);
});

test.describe('QA-S19-03 deletion request from the legal page', () => {
  test.beforeAll(() => seed());
  test.afterAll(() => seed());

  test('signed out: the form asks for a login that returns here', async ({ page }) => {
    await page.goto('/legal/deletion');
    await page.getByRole('link', { name: 'Log in to request deletion' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await signInAs(page, 'B2');
    await page.goto('/login');
    await expect(page).toHaveURL(/\/legal\/deletion$/);
  });

  test('a Buyer: Everything opens the same DELETE dialog as the profile', async ({ page }) => {
    await signInAs(page, 'B2');
    await page.goto('/legal/deletion');
    await expect(page.getByLabel('What should we delete?').locator('option')).toHaveText(['Everything']); // no Instagram choice for a Buyer
    await page.getByRole('button', { name: 'Request deletion' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete your Account?' });
    await expect(dialog.getByLabel('Type DELETE to confirm')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    expect(sql(`select count(*) from public.deletion_requests`)).toBe('0');
  });

  test('an Artist: only the Instagram data goes', async ({ page }) => {
    sql(`insert into public.instagram_accounts (artist_id, ig_user_id, username, token_cipher, token_expires_at) values ('${A1}', 'ig-p04', 'meera_art', 'x', now() + interval '60 days')
         on conflict (artist_id) do nothing`);
    for (const i of [1, 2]) {
      sql(`insert into public.reels (artist_id, url, owner_confirmed, ig_media_id) values ('${A1}', 'https://www.instagram.com/reel/IMPORT${i}/', true, 'media-${i}')`);
    }
    sql(`insert into public.reels (artist_id, url, owner_confirmed) values ('${A1}', 'https://www.instagram.com/reel/PASTED1/', true)`);
    const name = sql(`select display_name from public.profiles where id = '${A1}'`);
    await signInAs(page, 'A1');
    await page.goto('/legal/deletion');
    await page.getByLabel('What should we delete?').selectOption('Only my Instagram data');
    await page.getByRole('button', { name: 'Request deletion' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete your Instagram data?' });
    await dialog.getByRole('button', { name: 'Delete Instagram data' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Your Instagram data was deleted.' })).toBeVisible();
    expect(sql(`select count(*) from public.instagram_accounts where artist_id = '${A1}'`)).toBe('0');
    expect(sql(`select count(*) from public.reels where artist_id = '${A1}' and ig_media_id is not null`)).toBe('0');
    expect(sql(`select count(*) from public.reels where artist_id = '${A1}' and url like '%PASTED1%'`)).toBe('1');
    expect(sql(`select display_name from public.profiles where id = '${A1}'`)).toBe(name);
    expect(sql(`select count(*) from public.deletion_requests`)).toBe('0');
  });
});

test.describe('QA-S19-04 Meta deletion status page', () => {
  test.beforeAll(() => {
    seed();
    sql(`insert into public.instagram_deletions (code, ig_user_id, done_at) values ('P04DONE', '111', '2026-11-10T08:00:00Z'), ('P04OPEN', '222', null)`);
  });
  test.afterAll(() => { sql(`delete from public.instagram_deletions where code like 'P04%'`); });

  test('finished, unfinished and unknown codes', async ({ page }) => {
    await page.goto('/instagram-deletion?code=P04DONE');
    await expect(page.getByText(/was deleted from CraftMe on 10 Nov 2026/)).toBeVisible();
    await expect(page.getByText('P04DONE')).toBeVisible();
    for (const code of ['P04OPEN', 'nope-nope']) {
      await page.goto(`/instagram-deletion?code=${code}`);
      await expect(page.getByText(/We couldn.t find a finished request for that code/)).toBeVisible();
    }
  });

  test('it is linked from the legal page', async ({ page }) => {
    await page.goto('/legal/deletion');
    await page.getByRole('link', { name: 'deletion status page' }).click();
    await expect(page).toHaveURL(/\/instagram-deletion$/);
  });
});
