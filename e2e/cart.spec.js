// P01 scripts: QA-S03-05, QA-S03-06, QA-S08-01 to 07 and 09 (QA-S08-08 pays, so it is in checkout.spec.js).
import { expect, test } from '@playwright/test';
import { setCart, readCart } from './helpers/cart.js';
import { sql } from './helpers/db.js';
import { F01, L, PEOPLE, W } from './helpers/ids.js';
import { seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const A1 = PEOPLE.A1.id;
const A2 = PEOPLE.A2.id;
const A4 = PEOPLE.A4.id;
const B1 = PEOPLE.B1.id;
const savedRows = () => sql(`select listing_id || ':' || qty from public.saved_cart_items where buyer_id = '${B1}' order by listing_id`).split('\n').filter(Boolean);
const operations = () => Number(sql(`select count(*) from public.saved_cart_operations where buyer_id = '${B1}'`));
const cartLink = (page) => page.locator('header').getByRole('link', { name: /^Cart, / });

test.beforeEach(() => seed()); // each test starts from the fixtures

test('QA-S03-05 cart switch dialog saves the outgoing Cart', async ({ page }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 2, seen: 220000 }] });
  await page.goto(`/artwork/${W.W6}`);
  const add = page.getByRole('button', { name: 'Add to Cart' });
  const dialog = page.getByRole('alertdialog', { name: 'Start a new Cart?' });

  await add.click();
  await expect(dialog).toContainText('Meera Iyer');
  await expect(dialog).toContainText('Saved for later');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(add).toBeFocused();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 2 items');

  await add.click();
  await dialog.getByRole('button', { name: 'Keep my Cart' }).click();
  await expect(dialog).toBeHidden();
  await expect(add).toBeFocused();
  expect(operations()).toBe(0); // nothing was written in steps 2 and 3

  await page.route('**/rest/v1/rpc/switch_saved_cart', async (route) => { await new Promise((r) => setTimeout(r, 800)); await route.continue(); });
  await add.click();
  await dialog.getByRole('button', { name: 'Switch Cart' }).click();
  await expect(dialog.getByRole('button', { name: 'Switching…' })).toBeVisible();
  await expect(dialog).toBeHidden();
  expect((await readCart(page, 'B1')).items).toEqual([{ listingId: L.W6O, qty: 1, seen: 2800000 }]);
  expect(savedRows()).toEqual([`${L.W2P}:2`]);
  expect(operations()).toBe(1);
});

test.describe('QA-S03-06 Buy now', () => {
  test('A: an empty Cart goes straight to checkout, and a double press is still one unit', async ({ page }) => {
    await signInAs(page, 'B1');
    await page.goto(`/artwork/${W.W6}`);
    await page.getByRole('button', { name: 'Buy now' }).dblclick();
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByRole('heading', { name: 'Your Order' }).locator('..').locator('..')).toContainText('Brass Heron');
    expect((await readCart(page, 'B1')).items).toEqual([{ listingId: L.W6O, qty: 1, seen: 2800000 }]);
  });

  test('B: with another Artist in the Cart the dialog comes first', async ({ page }) => {
    await signInAs(page, 'B1');
    await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
    await page.goto(`/artwork/${W.W6}`);
    await page.getByRole('button', { name: 'Buy now' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Switch Cart' }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    expect((await readCart(page, 'B1')).items).toEqual([{ listingId: L.W6O, qty: 1, seen: 2800000 }]);
    expect(savedRows()).toEqual([`${L.W2P}:1`]);
  });

  test('C: "Keep my Cart" stays on the artwork page', async ({ page }) => {
    await signInAs(page, 'B1');
    await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
    await page.goto(`/artwork/${W.W6}`);
    await page.getByRole('button', { name: 'Buy now' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Keep my Cart' }).click();
    await expect(page).toHaveURL(new RegExp(`/artwork/${W.W6}$`));
    expect((await readCart(page, 'B1')).items).toEqual([{ listingId: L.W2P, qty: 1, seen: 220000 }]);
  });
});

test('QA-S08-01 Cart with items', async ({ page }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 2, seen: 220000 }, { listingId: L.W1P, qty: 1, seen: 250000 }] });
  await page.goto('/cart');
  const main = page.locator('main');
  await expect(main).toContainText('3 items from one Artist');
  await expect(main.getByText('Meera Iyer', { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: 'View Artist' })).toBeVisible();
  await expect(main.getByText('12 in stock')).toBeVisible();
  const summary = page.getByRole('complementary', { name: 'Order summary' });
  await expect(summary).toContainText('Items (3)');
  await expect(summary).toContainText('₹6,900');
  await expect(summary).toContainText('Included');
  await expect(summary.getByRole('link', { name: /Checkout/ })).not.toHaveAttribute('aria-disabled', 'true');
  await expect(main).toContainText('One Artist per Cart.');

  const note = page.getByLabel(/Gift note/);
  await note.fill('x'.repeat(121));
  await expect(note).toHaveValue('x'.repeat(120));
  await note.fill('Happy birthday');
  await page.reload();
  await expect(page.getByLabel(/Gift note/)).toHaveValue('Happy birthday');

  if (page.viewportSize().width < 1000) { // the summary sits under the lines
    const [lines, side] = await Promise.all([main.getByRole('region', { name: 'Cart items' }).boundingBox(), summary.boundingBox()]);
    expect(side.y).toBeGreaterThan(lines.y);
  }
});

test('QA-S08-02 empty Cart', async ({ page }) => {
  await signInAs(page, 'B2');
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your Cart is empty' })).toBeVisible();
  await expect(page.locator('main').getByRole('link', { name: 'Browse art' })).toBeVisible();
  await expect(page.getByText('No items saved for later.')).toBeVisible();
  await page.goto('/checkout');
  await expect(page).toHaveURL(/\/cart$/);
});

test('QA-S08-03 price changed and a sold line', async ({ page }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 2, seen: 220000 }, { listingId: L.W1O, qty: 1, seen: 4200000 }] });
  sql(`update public.listings set price = 240000 where id = '${L.W2P}'`);
  sql(`update public.listings set status = 'sold', stock = 0 where id = '${L.W1O}'`);
  await page.goto('/cart');
  const alert = page.getByRole('alert').filter({ hasText: 'Some things changed since you added them' });
  await expect(alert).toContainText('Kolam at Dawn (Print) went from ₹2,200 to ₹2,400.');
  await expect(alert).toContainText('Monsoon Over Marina (Original) was Sold to another Buyer and was removed.');
  await expect(page.locator('.cart-line')).toHaveCount(1);
  await expect(page.locator('.cart-line')).toContainText('Price changed');
  await expect(page.locator('.cart-line .strike')).toHaveText('₹2,200');
  await expect(page.locator('.cart-line')).toContainText('₹2,400 each');
  const checkout = page.getByRole('complementary', { name: 'Order summary' }).getByRole('link', { name: /Checkout/ });
  await expect(page.getByRole('complementary', { name: 'Order summary' })).toContainText('₹4,800');
  await expect(checkout).toHaveAttribute('aria-disabled', 'true');

  await alert.getByRole('button', { name: 'Accept new prices' }).click();
  await expect(page.locator('.toast').filter({ hasText: 'New prices accepted' })).toBeVisible();
  await expect(alert).toBeHidden();
  expect((await readCart(page, 'B1')).items).toEqual([{ listingId: L.W2P, qty: 2, seen: 240000 }]);
  await checkout.click();
  await expect(page).toHaveURL(/\/checkout$/);
});

test('QA-S08-03 a line fully held by someone else is kept but blocks Checkout', async ({ page }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A4, items: [{ listingId: L.W8F, qty: 1, seen: 90000 }] });
  sql(`update public.listings set held = stock where id = '${L.W8F}'`);
  await page.goto('/cart');
  await expect(page.locator('.cart-line')).toContainText('Being bought by someone else right now');
  await expect(page.getByRole('complementary', { name: 'Order summary' }).getByRole('link', { name: /Checkout/ })).toHaveAttribute('aria-disabled', 'true');
});

test('QA-S08-04 quantity limits', async ({ page }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A4, items: [{ listingId: L.W8P, qty: 1, seen: 180000 }, { listingId: L.W8F, qty: 1, seen: 90000 }] });
  await page.goto('/cart');
  const frame = page.locator('.cart-line').filter({ hasText: 'READY-MADE' });
  const print = page.locator('.cart-line').filter({ hasText: 'PRINT' });
  for (let i = 0; i < 6; i += 1) { const plus = frame.getByRole('button', { name: 'Increase quantity' }); if (await plus.isEnabled()) await plus.click(); }
  await expect(frame.getByRole('textbox')).toHaveValue('5');
  await expect(frame).toContainText("That's all there is.");
  await expect(frame).toContainText('₹4,500');
  for (let i = 0; i < 12; i += 1) { const plus = print.getByRole('button', { name: 'Increase quantity' }); if (await plus.isEnabled()) await plus.click(); }
  await expect(print.getByRole('textbox')).toHaveValue('10');
  await expect(print).toContainText("That's all there is.");
  for (let i = 0; i < 5; i += 1) await frame.getByRole('button', { name: 'Decrease quantity' }).click();
  await expect(page.locator('.cart-line')).toHaveCount(1);
});

test('QA-S08-04 an Original line has no quantity stepper', async ({ page }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A2, items: [{ listingId: L.W6O, qty: 1, seen: 2800000 }] });
  await page.goto('/cart');
  await expect(page.locator('.cart-line')).toContainText('Only 1 available');
  await expect(page.locator('.cart-line').getByRole('button', { name: 'Increase quantity' })).toHaveCount(0);
});

test('QA-S08-05 Saved for later: restore one item, then a group', async ({ page }) => {
  sql(`insert into public.saved_cart_items (buyer_id, listing_id, qty) values ('${B1}', '${L.W2P}', 3), ('${B1}', '${L.W1P}', 1)`);
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A2, items: [{ listingId: L.W6O, qty: 1, seen: 2800000 }] });
  await page.goto('/cart');
  const saved = page.getByRole('region', { name: 'Saved for later' });
  await saved.locator('.row').filter({ hasText: 'Monsoon Over Marina (Print)' }).getByRole('button', { name: 'Move to cart' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Imran Sheikh');
  await dialog.getByRole('button', { name: 'Switch Cart' }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await readCart(page, 'B1')).items.map((i) => `${i.listingId}:${i.qty}`)).toEqual([`${L.W1P}:1`]);
  expect(savedRows()).toEqual([`${L.W2P}:3`, `${L.W6O}:1`].sort());

  await saved.locator('.panel').filter({ hasText: 'Meera Iyer' }).getByRole('button', { name: 'Restore cart' }).click();
  await expect.poll(async () => (await readCart(page, 'B1')).items.map((i) => `${i.listingId}:${i.qty}`).sort()).toEqual([`${L.W1P}:1`, `${L.W2P}:3`].sort());
  expect(savedRows()).toEqual([`${L.W6O}:1`]);
});

test('QA-S08-06 restore past the quantity cap, and an unavailable saved work', async ({ page }) => {
  sql(`update public.listings set status = 'live' where id = 'd5000000-0000-4000-8000-000000000001'`); // allow the insert's listing to exist, then end it
  sql(`insert into public.saved_cart_items (buyer_id, listing_id, qty) values ('${B1}', '${L.W2P}', 8), ('${B1}', 'd5000000-0000-4000-8000-000000000001', 1)`);
  sql(`update public.listings set status = 'ended' where id = 'd5000000-0000-4000-8000-000000000001'`);
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 5, seen: 220000 }] });
  await page.goto('/cart');
  const saved = page.getByRole('region', { name: 'Saved for later' });
  // an ended listing is hidden from buyers by listings_read, so it shows nameless in its own group with nothing to restore
  const group = saved.locator('.panel').filter({ hasText: 'Unavailable works' });
  const ended = group.locator('.row').filter({ hasText: 'Qty 1' });
  await expect(ended).toContainText('Unavailable');
  await expect(ended.getByRole('button', { name: 'Move to cart' })).toBeDisabled();
  await expect(group.getByRole('button', { name: 'Restore cart' })).toHaveCount(0);
  await saved.locator('.row').filter({ hasText: 'Kolam at Dawn (Print)' }).getByRole('button', { name: 'Move to cart' }).click();
  await expect(saved).toContainText('The cart quantity limit was reached. Extra units are still saved for later.');
  await expect(page.locator('.cart-line').getByRole('textbox')).toHaveValue('10');
  expect(savedRows()).toContain(`${L.W2P}:3`);
});

test('QA-S08-07 a switch that fails, then a reload', async ({ page }) => {
  await signInAs(page, 'B1');
  await setCart(page, 'B1', { artistId: A1, items: [{ listingId: L.W2P, qty: 1, seen: 220000 }] });
  await page.route('**/rest/v1/rpc/switch_saved_cart', (route) => route.abort());
  await page.goto(`/artwork/${W.W6}`);
  await page.getByRole('button', { name: 'Add to Cart' }).click();
  const dialog = page.getByRole('alertdialog');
  await dialog.getByRole('button', { name: 'Switch Cart' }).click();
  await expect(dialog).toContainText('Could not switch carts. Try again.');
  await expect(dialog.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep my Cart' })).toBeDisabled();
  const journal = `cm-cart-operation:${B1}`;
  expect(await page.evaluate((k) => localStorage.getItem(k), journal)).not.toBeNull();

  await page.goto('/cart'); // a fresh load replays the unfinished switch, which fails again
  const saved = page.getByRole('region', { name: 'Saved for later' });
  await expect(saved).toContainText('Could not switch carts. Try again.');
  await page.unroute('**/rest/v1/rpc/switch_saved_cart');
  await saved.getByRole('button', { name: 'Try again' }).click();
  await expect.poll(async () => (await readCart(page, 'B1')).items.map((i) => i.listingId)).toEqual([L.W6O]);
  expect(await page.evaluate((k) => localStorage.getItem(k), journal)).toBeNull();
  expect(operations()).toBe(1);
  expect(savedRows()).toEqual([`${L.W2P}:1`]);
});

test.describe('QA-S08-09 add all by an Artist with another Artist\'s Cart active', () => {
  const prepare = async (page) => {
    sql(`insert into public.saved_works (user_id, artwork_id) values ('${B1}', '${W.W1}'), ('${B1}', '${W.W2}'), ('${B1}', '${W.W3}'), ('${B1}', '${F01}')`);
    await signInAs(page, 'B1');
    await setCart(page, 'B1', { artistId: A2, items: [{ listingId: L.W6O, qty: 1, seen: 2800000 }] });
    await page.goto('/wishlist');
    return page.getByRole('button', { name: 'Add all by Meera Iyer to Cart' });
  };

  test('one dialog, Keep changes nothing, Switch adds two and reports two skipped', async ({ page }) => {
    const addAll = await prepare(page);
    await addAll.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText('Imran Sheikh');
    await expect(dialog).toContainText('Saved for later');
    await expect(dialog).toContainText('2 works by Meera Iyer will be added.');
    await dialog.getByRole('button', { name: 'Keep my Cart' }).click();
    expect((await readCart(page, 'B1')).items.map((i) => i.listingId)).toEqual([L.W6O]);
    expect(operations()).toBe(0);

    await addAll.click();
    await dialog.getByRole('button', { name: 'Switch Cart' }).click();
    await expect(page.getByRole('status').filter({ hasText: '2 added. 2 skipped: sold, already in your Cart, or a version must be chosen.' })).toBeVisible();
    expect((await readCart(page, 'B1')).items.map((i) => i.listingId).sort()).toEqual([L.W2P, L.F01].sort());
    expect(savedRows()).toEqual([`${L.W6O}:1`]);
  });

  test('a double click on Switch Cart runs one operation', async ({ page }) => {
    const addAll = await prepare(page);
    await addAll.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Switch Cart' }).dblclick();
    await expect.poll(async () => (await readCart(page, 'B1')).items.length).toBe(2);
    expect(operations()).toBe(1);
    expect(savedRows()).toEqual([`${L.W6O}:1`]);
  });

  test('a reload in the middle of the switch finishes it once', async ({ page }) => {
    const addAll = await prepare(page);
    await page.route('**/rest/v1/rpc/switch_saved_cart_many', () => { /* never answers: the page reloads first */ });
    await addAll.click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Switch Cart' }).click();
    await expect.poll(() => page.evaluate((k) => localStorage.getItem(k), `cm-cart-operation:${B1}`)).not.toBeNull();
    await page.unroute('**/rest/v1/rpc/switch_saved_cart_many');
    await page.reload();
    await expect.poll(async () => (await readCart(page, 'B1')).items.length).toBe(2);
    expect(operations()).toBe(1);
    expect(savedRows()).toEqual([`${L.W6O}:1`]);
  });
});
