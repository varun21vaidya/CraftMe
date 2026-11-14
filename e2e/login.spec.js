// P04 scripts: QA-S05-01 to QA-S05-04. The local sign-in (a stored session) stands in for Google; the real Google screens are sandbox-only.
import { expect, test } from '@playwright/test';
import { sql } from './helpers/db.js';
import { O, PEOPLE, W } from './helpers/ids.js';
import { signInAs } from './helpers/session.js';
import { TERMS_VERSION } from '../src/content/legal/version.js';

const wide = (page) => page.viewportSize().width > 900;
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('QA-S05-01 login page', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome to CraftMe' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.locator('input[type=email], input[type=password]')).toHaveCount(0);
  await expect(page.locator('header.site-header')).toBeVisible();
  const card = page.locator('.login-card');
  await expect(card).toContainText('By continuing you agree to the Terms and Privacy policy');
  await card.getByRole('link', { name: 'Terms' }).click();
  await expect(page).toHaveURL(/\/legal\/terms$/);
  await page.goBack();
  await card.getByRole('link', { name: 'Privacy policy' }).click();
  await expect(page).toHaveURL(/\/legal\/privacy$/);
  await page.goBack();
  // the featured work shows over 900 px only
  const art = page.getByRole('complementary', { name: 'Featured artwork' });
  if (wide(page)) {
    await expect(art).toBeVisible();
    await expect(art.getByRole('link')).toHaveAttribute('href', /^\/artwork\/[0-9a-f-]{36}$/);
    await expect(art.locator('strong')).not.toBeEmpty();
    await expect(art.locator('img')).toBeVisible();
  } else {
    await expect(art).toBeHidden();
  }
  expect(await noSideScroll(page)).toBe(true);
});

/** Stands in for coming back from Google: the person now has a session, and the app is opened at /login. */
async function comeBackSignedIn(page, key) {
  await signInAs(page, key);
  await page.goto('/login');
}

test.describe('QA-S05-02 return to the intended page', () => {
  test('a guarded page', async ({ page }) => {
    await page.goto(`/orders/${O.O2}`);
    await expect(page).toHaveURL(/\/login$/);
    await comeBackSignedIn(page, 'B1');
    await expect(page).toHaveURL(new RegExp(`/orders/${O.O2}$`));
    expect(await page.evaluate(() => sessionStorage.getItem('cm-return'))).toBeNull();
  });

  test('the heart on an artwork', async ({ page }) => {
    await page.goto(`/artwork/${W.W1}`);
    await page.getByRole('button', { name: 'Save to wish list' }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await comeBackSignedIn(page, 'B1');
    await expect(page).toHaveURL(new RegExp(`/artwork/${W.W1}$`));
  });

  test('a crafted off-site value is ignored', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => sessionStorage.setItem('cm-return', '//evil.example'));
    await comeBackSignedIn(page, 'B1');
    await expect(page).toHaveURL(/\/\/[^/]+\/$/);
    expect(new URL(page.url()).pathname).toBe('/');
    expect(await page.evaluate(() => sessionStorage.getItem('cm-return'))).toBeNull();
  });

  test('already signed in', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto('/login');
    await expect(page).toHaveURL(/\/\/[^/]+\/$/);
  });
});

test.describe('QA-S05-03 Google cancelled or unreachable', () => {
  test('consent cancelled: the message shows and the error leaves the address bar', async ({ page }) => {
    await page.goto('/login#error=access_denied&error_description=cancelled');
    await expect(page.getByRole('alert')).toHaveText("Google sign-in was cancelled. Try again when you're ready.");
    await expect(page).toHaveURL(/\/login$/);
    expect(page.url()).not.toContain('error');
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.endsWith('-auth-token')))).toEqual([]);
  });

  test('the same refusal as a query string', async ({ page }) => {
    await page.goto('/login?error=access_denied&error_code=bad');
    await expect(page.getByRole('alert')).toContainText('cancelled');
    expect(page.url()).not.toContain('error');
  });

  test('the sign-in endpoint is blocked: the message shows and the button works again', async ({ page }) => {
    await page.route('**/auth/v1/**', (route) => route.abort());
    await page.goto('/login');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page.getByRole('alert')).toHaveText("We couldn't reach Google. Try again.");
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('pressing the button leaves for Google with the path remembered', async ({ page }) => {
    await page.route('**/auth/v1/authorize**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: 'Google stands here' }));
    await page.goto(`/orders/${O.O2}`); // the guard sends a guest to /login and keeps the path
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page).toHaveURL(/\/auth\/v1\/authorize\?provider=google.*redirect_to=http%3A%2F%2Flocalhost%3A5173%2Flogin/);
    await page.goBack();
    expect(await page.evaluate(() => sessionStorage.getItem('cm-return'))).toBe(`/orders/${O.O2}`);
  });

  test('the button says "Opening Google…" while it works', async ({ page }) => {
    let release;
    await page.route('**/auth/v1/**', (route) => new Promise((r) => { release = () => { route.abort(); r(); }; }));
    await page.goto('/login');
    await page.getByRole('button', { name: 'Continue with Google' }).click();
    await expect(page.getByRole('button', { name: 'Opening Google…' })).toBeDisabled();
    release();
    await expect(page.getByRole('alert')).toBeVisible();
  });
});

test.describe('QA-S05-04 first sign-in: policy acceptance', () => {
  test.beforeEach(() => sql(`update public.profiles set terms_accepted_at = null, terms_version = null where id = '${PEOPLE.B2.id}'`));
  test.afterAll(() => sql(`update public.profiles set terms_accepted_at = now(), terms_version = '${TERMS_VERSION}' where id = '${PEOPLE.B2.id}'`));

  test('the gate cannot be dismissed, then accepts once', async ({ page, browser }) => {
    const touched = () => sql(`select count(*) from public.profiles where terms_accepted_at is not null and id <> '${PEOPLE.B2.id}' and terms_accepted_at > now() - interval '1 minute'`);
    const before = touched();
    await signInAs(page, 'B2', { terms: false });
    await page.goto('/cart');
    const gate = page.getByRole('alertdialog', { name: 'Before you continue' });
    await expect(gate).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(gate).toBeVisible();
    await page.mouse.click(2, 2); // outside the dialog
    await expect(gate).toBeVisible();
    const go = gate.getByRole('button', { name: 'Continue' });
    await expect(go).toBeDisabled();
    for (const name of ['Terms', 'Privacy policy', 'Refund policy']) await expect(gate.getByRole('link', { name })).toHaveAttribute('target', '_blank');
    await gate.getByRole('checkbox').check();
    await go.click();
    await expect(gate).toBeHidden();
    await expect(page).toHaveURL(/\/cart$/);
    expect(sql(`select terms_version from public.profiles where id = '${PEOPLE.B2.id}'`)).toBe(TERMS_VERSION);
    expect(sql(`select terms_accepted_at is not null from public.profiles where id = '${PEOPLE.B2.id}'`)).toBe('t');
    expect(touched()).toBe(before);
    // signing in again later: no dialog
    const second = await (await browser.newContext()).newPage();
    await signInAs(second, 'B2', { terms: false });
    await second.goto('/cart');
    await expect(second.getByRole('heading', { name: /Cart/ }).first()).toBeVisible();
    await expect(second.getByRole('alertdialog')).toHaveCount(0);
    await second.context().close();
  });

  test('a failed save keeps the dialog and says so', async ({ page }) => {
    await signInAs(page, 'B2', { terms: false });
    await page.route('**/rest/v1/rpc/accept_terms', (route) => route.fulfill({ status: 500, body: '{}' }));
    await page.goto('/cart');
    const gate = page.getByRole('alertdialog', { name: 'Before you continue' });
    await gate.getByRole('checkbox').check();
    await gate.getByRole('button', { name: 'Continue' }).click();
    await expect(gate.getByRole('alert')).toHaveText("We couldn't save that. Try again.");
    await expect(gate).toBeVisible();
    expect(sql(`select terms_accepted_at is null from public.profiles where id = '${PEOPLE.B2.id}'`)).toBe('t');
  });

  test('a newer Terms version asks again', async ({ page }) => {
    sql(`update public.profiles set terms_accepted_at = now(), terms_version = 'older' where id = '${PEOPLE.B2.id}'`);
    await signInAs(page, 'B2', { terms: false });
    await page.goto('/cart');
    await expect(page.getByRole('alertdialog', { name: 'Before you continue' })).toBeVisible();
  });

  test('Log out leaves the gate', async ({ page }) => {
    await signInAs(page, 'B2', { terms: false });
    await page.goto('/cart');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
