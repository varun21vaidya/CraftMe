// P00 scripts: QA-S36-02..05 for the components P00 owns (Dialog, Toast, Menu, theme). Tabs, Stepper, Timeline,
// Pagination, Field, QtyStepper and the rest arrive with the packages that first draw them, and their checks with them.
import { expect, test } from '@playwright/test';
import { W } from './helpers/ids.js';
import { signInAs } from './helpers/session.js';

const phone = (page) => page.viewportSize().width <= 560;

test.describe('QA-S36-03 dialogs', () => {
  test('alert dialog: the cart conflict', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto(`/artwork/${W.W1}`);
    await page.getByRole('button', { name: 'Add to Cart' }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await page.goto(`/artwork/${W.W6}`);
    const add = page.getByRole('button', { name: 'Add to Cart' });
    await add.click();

    const dialog = page.getByRole('alertdialog', { name: 'Start a new Cart?' });
    await expect(dialog).toBeVisible();
    const keep = dialog.getByRole('button', { name: 'Keep my Cart' });
    await expect(keep).toBeFocused(); // the safe button
    for (let i = 0; i < 4; i += 1) { // Tab twice round the two buttons: focus never leaves
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');

    // a backdrop click never closes an alert dialog
    await page.mouse.click(4, 4);
    await expect(dialog).toBeVisible();

    if (phone(page)) {
      const box = await dialog.boundingBox();
      expect(Math.round(box.width)).toBe(page.viewportSize().width);
      const [a, b] = await Promise.all([keep.boundingBox(), dialog.getByRole('button', { name: 'Switch Cart' }).boundingBox()]);
      expect(Math.abs(a.x - b.x)).toBeLessThan(2); // stacked, not side by side
    }

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(add).toBeFocused();
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });

  test('plain dialog: the test payment window', async ({ page }) => {
    await page.goto('/');
    const opener = page.locator('footer').getByRole('button', { name: /theme$/ });
    await opener.focus();
    const open = () => page.evaluate(() => {
      window.__pay = import('/src/components/cart/FakePayDialog.jsx')
        .then((m) => m.openFakePay({ razorpayOrderId: 'order_fake_ui', amount: 250000 }));
    });

    await open();
    const dialog = page.getByRole('dialog', { name: 'Test payment window' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close' }).last()).toBeFocused();
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => window.__pay)).toEqual({ ok: false, dismissed: true });
    await expect(opener).toBeFocused();

    await open();
    await expect(dialog).toBeVisible();
    await page.mouse.click(4, 4); // the backdrop
    await expect(dialog).toBeHidden();

    await open();
    await dialog.getByRole('button', { name: 'Pay' }).click();
    expect(await page.evaluate(() => window.__pay)).toEqual({
      ok: true, razorpayOrderId: 'order_fake_ui', signature: 'fake', razorpayPaymentId: 'pay_fake_ok_order_fake_ui',
    });
  });
});

test('QA-S36-04 toasts: errors as alerts, at most three, gone after about 4 seconds or on close', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto('/');
  const denied = () => page.evaluate(() => { // a client-side visit to an artist page, as a link would make
    window.history.pushState({}, '', '/dashboard/artworks');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  for (let i = 0; i < 4; i += 1) {
    await denied();
    await expect(page).toHaveURL(/\/$/);
  }
  const toasts = page.locator('.toasts .toast');
  await expect(toasts).toHaveCount(3);
  await expect(page.locator('.toasts [role="alert"]')).toHaveCount(3);
  await toasts.first().getByRole('button', { name: 'Close notification' }).click();
  await expect(toasts).toHaveCount(2);
  await expect(toasts).toHaveCount(0, { timeout: 5500 });
});

test('theme: the choice survives reload and wins over the system setting', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.dataset.theme ?? null)).toBeNull(); // nothing stored: follow the system
  const toggle = page.locator('footer').getByRole('button', { name: /theme$/ });
  const before = await toggle.textContent(); // names the theme it would switch to
  await toggle.click();
  const chosen = before.startsWith('Dark') ? 'dark' : 'light';
  expect(await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('cm-theme')])).toEqual([chosen, chosen]);
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(chosen);
  await page.goto('/browse');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(chosen);
});

test('theme toggle in the account menu', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto('/');
  await page.getByRole('button', { name: 'Account menu' }).click();
  const item = page.getByRole('menuitem', { name: /theme$/ });
  const chosen = (await item.textContent()).startsWith('Dark') ? 'dark' : 'light';
  await item.click();
  expect(await page.evaluate(() => localStorage.getItem('cm-theme'))).toBe(chosen);
});

test('QA-S36-02 icon-only buttons in the shell have names', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto('/');
  const unnamed = await page.locator('header button, header a').evaluateAll((els) => els
    .filter((el) => el.offsetParent !== null)
    .filter((el) => !(el.getAttribute('aria-label') || el.textContent.trim()))
    .map((el) => el.outerHTML.slice(0, 80)));
  expect(unnamed).toEqual([]);
});
