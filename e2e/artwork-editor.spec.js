// P06 scripts: QA-S23-01 to 08. Needs the local stack and the api function (fake provider mode).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { clientAs } from './helpers/api.js';
import { sql } from './helpers/db.js';
import { PEOPLE, W } from './helpers/ids.js';
import { seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const A1 = PEOPLE.A1.id;
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const photo = (name) => ({ name, mimeType: 'image/jpeg', buffer: JPEG });
const art = (cols, where) => sql(`select ${cols} from public.artworks where ${where}`);
const makeArtist = (id) => sql(`update auth.users set raw_app_meta_data = raw_app_meta_data || '{"artist": true}' where id = '${id}'`);
const saveBtn = (page) => page.getByRole('button', { name: 'Save draft' }).first();
const objects = (bucket, uid = A1) => Number(sql(`select count(*) from storage.objects where bucket_id = '${bucket}' and (storage.foldername(name))[1] = '${uid}'`));

async function details(page, over = {}) {
  const v = { title: 'Temple Bells', category: 'Paintings', year: '2026', medium: 'Acrylic on canvas', signed: 'back', description: 'A small study.', ...over };
  await page.locator('#ed-title').fill(v.title);
  if (v.category) await page.locator('#ed-category').selectOption(v.category);
  if (v.year) await page.locator('#ed-year').fill(v.year);
  if (v.medium) await page.locator('#ed-medium').fill(v.medium);
  if (v.signed) await page.locator('#ed-signed').selectOption(v.signed);
  if (v.description) await page.locator('#ed-description').fill(v.description);
}
async function addListing(page, { kind, size = '30 × 40 cm', medium = 'Acrylic, unframed', price = '12000', stock } = {}) {
  await page.getByRole('button', { name: 'Add Listing' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Listing' });
  if (kind) await dialog.getByRole('radio', { name: new RegExp(`^${kind}`) }).check();
  await dialog.locator('#ls-size').fill(size);
  await dialog.locator('#ls-medium').fill(medium);
  await dialog.locator('#ls-price').fill(price);
  if (stock !== undefined) await dialog.locator('#ls-stock').fill(stock);
  return dialog;
}

test.beforeEach(() => seed());
test.afterAll(() => seed());

test('QA-S23-01 create a work and publish', async ({ page }) => {
  test.setTimeout(120000);
  await signInAs(page, 'A1');
  await page.goto('/dashboard/artworks/new');
  await expect(page.getByRole('heading', { name: 'Add Artwork', level: 1 })).toBeVisible();
  await page.locator('#ed-title').fill('Temple Bells');
  await expect(page.getByText('12/100')).toBeVisible();
  await page.locator('#ed-description').fill('A small study.');
  await expect(page.getByText('14/1000')).toBeVisible();
  await details(page);
  await expect(page.getByLabel(/Title and description/, { exact: false }).or(page.getByText('Done: Title and description'))).toBeVisible();
  await page.getByLabel('Choose photos').setInputFiles([photo('a.jpg'), photo('b.jpg')]);
  await expect(page.getByText('2 of 5 added. The first photo is the cover.')).toBeVisible();
  await expect(page.getByText('Done: At least one photo')).toBeVisible();
  const dialog = await addListing(page, { kind: 'Original' });
  await expect(dialog.locator('#ls-stock')).toHaveCount(0); // an Original is always 1
  await dialog.getByRole('button', { name: 'Save Listing' }).click();
  await expect(page.getByRole('heading', { name: 'Edit Artwork', level: 1 })).toBeVisible({ timeout: 30000 }); // the draft was made first
  await expect(page.getByText('Done: At least one Listing with a price')).toBeVisible();
  await page.getByRole('button', { name: 'Publish Artwork' }).click();
  await expect(page.getByText('Published', { exact: true }).first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible();

  expect(art("status || '|' || year || '|' || medium || '|' || signed || '|' || cardinality(photos) || '|' || available", `title = 'Temple Bells'`)).toBe('published|2026|Acrylic on canvas|back|2|true');
  expect(sql(`select l.kind || '|' || l.status || '|' || l.price || '|' || l.stock from public.listings l join public.artworks a on a.id = l.artwork_id where a.title = 'Temple Bells'`)).toBe('original|live|1200000|1');
  expect(art('from_price_paise', `title = 'Temple Bells'`)).toBe('1200000');
  const id = art('id', `title = 'Temple Bells'`);
  await page.goto(`/artwork/${id}`);
  await expect(page.getByRole('heading', { name: 'Temple Bells' })).toBeVisible();
  await expect(page.getByText('Acrylic on canvas').first()).toBeVisible();
});

test('QA-S23-02 what stops publishing', async ({ page }) => {
  await signInAs(page, 'A1');
  await page.goto('/dashboard/artworks/new');
  await page.getByRole('button', { name: 'Publish Artwork' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Add a title and category to save a draft.' })).toBeVisible();
  expect(art('count(*)', `title = ''`)).toBe('0');

  await page.locator('#ed-title').fill('Only a title');
  await page.locator('#ed-category').selectOption('Paintings');
  await page.getByRole('button', { name: 'Publish Artwork' }).click();
  const alert = page.getByRole('alert').filter({ hasText: '2 things stop you publishing' });
  await expect(alert).toBeVisible({ timeout: 30000 });
  await expect(alert.getByRole('link', { name: 'Photos' })).toBeVisible();
  await expect(alert.getByRole('link', { name: 'Listings' })).toBeVisible();
  await expect(page.getByText('Add at least one photo.')).toBeVisible();
  await expect(page.getByText('Add at least one Listing with a price.')).toBeVisible();
  const id = art('id', `title = 'Only a title'`);
  const a1 = await clientAs('A1');
  const out = await a1.rpc('publish_artwork', { p_artwork: id });
  expect(JSON.parse(out.error.message)).toMatchObject({ code: 'invalid', fields: ['photos', 'listings'] });
});

test('QA-S23-02 an unverified Artist is told they can still publish', async ({ page }) => {
  makeArtist(PEOPLE.A2.id);
  await signInAs(page, 'A2');
  await page.goto('/dashboard/artworks/new');
  await expect(page.getByText('We’re checking your details. You can publish now, and you’ll be paid once that’s done.')).toBeVisible();
  await signInAs(page, 'A1');
});

test('QA-S23-03 the Listing dialog', async ({ page }) => {
  test.setTimeout(120000);
  await signInAs(page, 'A1');
  await page.goto(`/dashboard/artworks/${W.W1}`);
  await page.getByRole('button', { name: 'Add Listing' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Listing' });
  await expect(dialog.getByRole('radio', { name: /^Original/ })).toBeDisabled(); // W1 has one
  await expect(dialog.getByText('One of a kind. Stock is always 1.')).toBeVisible();
  await dialog.getByRole('radio', { name: /^Ready-made item/ }).check();
  await dialog.locator('#ls-size').fill('A4 frame');
  await dialog.locator('#ls-medium').fill('Wood');
  await dialog.locator('#ls-price').fill('0');
  await dialog.locator('#ls-stock').fill('0');
  await dialog.getByRole('button', { name: 'Save Listing' }).click();
  await expect(dialog.getByText('Enter a price of at least ₹1.')).toBeVisible();
  await expect(dialog.getByText('Enter how many you have, from 1 to 1000.')).toBeVisible();
  await dialog.locator('#ls-price').fill('900');
  await dialog.locator('#ls-stock').fill('5');
  await expect(dialog.getByText(/What you’d receive: about ₹/)).toBeVisible();
  await expect(dialog.getByText('An estimate, after CraftMe’s share and the payment cost.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save Listing' }).click();
  const added = page.locator('tr[data-listing]').filter({ hasText: 'Ready-made item' });
  await expect(added).toContainText('Live');
  expect(sql(`select count(*) from public.listings where artwork_id = '${W.W1}' and kind = 'product' and price = 90000 and stock = 5 and status = 'live'`)).toBe('1'); // W1 is published, so a new Listing is live at once

  // below the quantity held (O1 holds one W1 Print)
  await page.locator('tr[data-listing]').filter({ hasText: 'Print' }).getByRole('button', { name: 'Edit' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Listing' });
  await expect(edit.getByText('1 are in someone’s checkout right now.').first()).toBeVisible();
  await edit.locator('#ls-stock').fill('0');
  await edit.getByRole('button', { name: 'Save Listing' }).click();
  await expect(edit.getByText('Enter how many you have, from 1 to 1000.')).toBeVisible();
  await edit.getByRole('button', { name: 'Cancel' }).click();

  await added.getByRole('button', { name: 'End' }).click();
  await expect(added).toContainText('Ended');
  await added.getByRole('button', { name: 'Reopen' }).click();
  await expect(added).toContainText('Live');

  const a1 = await clientAs('A1');
  const est = await a1.rpc('earnings_estimate', { p_price: 90000 });
  const bps = Number(sql('select commission_bps from public.settings'));
  expect(est.data.net).toBe(90000 - Math.round((90000 * bps) / 10000) - Math.round((90000 * 236) / 10000));
  const second = await a1.from('listings').insert({ artwork_id: W.W1, artist_id: A1, kind: 'original', price: 100000, stock: 1, status: 'draft', title: 'again' });
  expect(second.error?.code).toBe('23505'); // the unique index: one open Original per work
});

test('QA-S23-04 photos: reorder, remove, add, save', async ({ page }) => {
  test.setTimeout(120000);
  const before = art('photos', `id = '${W.W1}'`).replace(/[{}]/g, '').split(',');
  expect(before.length).toBe(3);
  await signInAs(page, 'A1');
  await page.goto(`/dashboard/artworks/${W.W1}`);
  await expect(page.getByText('3 of 5 added. The first photo is the cover.')).toBeVisible();
  await page.getByRole('button', { name: 'Move photo 3 earlier' }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Move photo 2 earlier' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.photo-grid li').first().getByText('Cover')).toBeVisible();
  await expect(page.locator('.photo-grid img').first()).toHaveAttribute('src', before[2]);
  await page.getByRole('button', { name: 'Remove photo 2' }).click();
  await expect(page.getByText('2 of 5 added.')).toBeVisible();
  const big = { name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(6 * 1024 * 1024, 1) };
  await page.getByLabel('Choose photos').setInputFiles([photo('n1.jpg'), big, photo('n2.jpg')]);
  await expect(page.getByText('huge.jpg: bigger than 5 MB.').or(page.getByText(/huge\.jpg/))).toBeVisible();
  await expect(page.getByText('4 of 5 added.')).toBeVisible();
  await saveBtn(page).click();
  await expect(page.getByText(/Saved \d/)).toBeVisible({ timeout: 30000 });
  const saved = art('photos', `id = '${W.W1}'`).replace(/[{}]/g, '').split(',');
  expect(saved.length).toBe(4);
  expect(saved[0]).toBe(before[2]);
  expect(saved.slice(0, 2)).toEqual([before[2], before[1]]); // photo 3 moved to first, photo 2 (the old first) removed
  expect(saved).not.toContain(before[0]);
  await page.goto(`/artwork/${W.W1}`);
  await expect(page.locator('.gal-slide img').first()).toHaveAttribute('src', before[2]);
});

test('QA-S23-04 a removed photo leaves storage', async ({ page }) => {
  test.setTimeout(120000);
  const start = objects('artworks');
  await signInAs(page, 'A1');
  await page.goto('/dashboard/artworks/new');
  await details(page, { title: 'Two photos' });
  await page.getByLabel('Choose photos').setInputFiles([photo('p1.jpg'), photo('p2.jpg')]);
  await saveBtn(page).click();
  await expect(page.getByRole('heading', { name: 'Edit Artwork', level: 1 })).toBeVisible({ timeout: 30000 });
  expect(objects('artworks')).toBe(start + 2);
  await page.getByRole('button', { name: 'Remove photo 2' }).click();
  await saveBtn(page).click();
  await expect(page.getByText(/Saved \d/)).toBeVisible();
  await expect.poll(() => objects('artworks')).toBe(start + 1);
});

test('QA-S23-05 a video or a reel', async ({ page }) => {
  test.setTimeout(150000);
  // the length of a video is read in the browser: stand-ins let the test choose it
  await page.addInitScript(() => {
    const make = document.createElement.bind(document);
    document.createElement = (tag, ...rest) => {
      const el = make(tag, ...rest);
      if (String(tag).toLowerCase() === 'video') {
        Object.defineProperty(el, 'duration', { get: () => window.__seconds ?? 20 });
        setTimeout(() => el.dispatchEvent(new Event('loadedmetadata')), 0);
      }
      return el;
    };
  });
  await signInAs(page, 'A1');
  await page.goto(`/dashboard/artworks/${W.W2}`);
  await page.getByRole('radio', { name: /^Instagram reel/ }).check();
  await page.locator('#ed-reel-link').fill('https://example.com/video');
  await page.getByRole('button', { name: 'Check link' }).click();
  await expect(page.getByText('That isn’t an Instagram post or reel link.')).toBeVisible();
  await page.locator('#ed-reel-link').fill('https://www.instagram.com/reel/Cx9aB2_demo/');
  await page.getByRole('button', { name: 'Check link' }).click();
  await expect(page.getByText('Link looks right')).toBeVisible();
  await saveBtn(page).click();
  await expect(page.getByText(/Saved \d/)).toBeVisible({ timeout: 30000 });
  expect(sql(`select (r.highlighted)::text || '|' || r.url from public.artworks a join public.reels r on r.id = a.reel_id where a.id = '${W.W2}'`)).toBe('false|https://www.instagram.com/reel/Cx9aB2_demo/');
  await page.goto(`/artwork/${W.W2}`);
  if (page.viewportSize().width > 640) await expect(page.getByRole('button', { name: 'Show the reel' })).toBeVisible(); // the thumbnail strip is not drawn on a phone

  await page.goto(`/dashboard/artworks/${W.W2}`);
  await page.getByRole('radio', { name: /^Upload a video/ }).check();
  const input = page.locator('#ed-video-file');
  const bigFile = path.join(os.tmpdir(), 'craftme-big.mp4');
  fs.writeFileSync(bigFile, Buffer.alloc(60 * 1024 * 1024, 1)); // over Playwright's 50 MB buffer limit, so a file
  await input.setInputFiles(bigFile);
  await expect(page.getByText('Videos can be up to 50 MB.')).toBeVisible();
  await page.evaluate(() => { window.__seconds = 260; });
  await input.setInputFiles({ name: 'long.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(20 * 1024 * 1024, 1) });
  await expect(page.getByText('Videos can be up to 3 minutes.')).toBeVisible();
  await page.evaluate(() => { window.__seconds = 20; });
  await input.setInputFiles({ name: 'ok.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(5 * 1024 * 1024, 1) });
  await expect(page.getByText('ok.mp4 will upload when you save.')).toBeVisible();
  await saveBtn(page).click();
  await expect(page.getByText(/Saved \d/)).toBeVisible({ timeout: 60000 });
  expect(art("(video is not null)::text || '|' || (reel_id is null)::text", `id = '${W.W2}'`)).toBe('true|true');
  await page.goto(`/artwork/${W.W2}`);
  if (page.viewportSize().width > 640) await expect(page.getByRole('button', { name: 'Show the video' })).toBeVisible();
  await expect(page.locator('video.gal-video')).toHaveAttribute('preload', 'none');
});

test('QA-S23-06 save a draft, preview it, a failed save, leaving with changes', async ({ page, browser }) => {
  test.setTimeout(150000);
  await signInAs(page, 'A1');
  await page.goto('/dashboard/artworks/new');
  await page.locator('#ed-title').fill('Draft only');
  await page.locator('#ed-category').selectOption('Paintings');
  await saveBtn(page).click();
  await expect(page.getByRole('heading', { name: 'Edit Artwork', level: 1 })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText(/Saved \d/)).toBeVisible();
  await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
  const id = art('id', `title = 'Draft only'`);

  const [tab] = await Promise.all([page.context().waitForEvent('page'), page.getByRole('link', { name: 'Preview' }).click()]);
  await expect(tab.getByText('Preview.')).toBeVisible();
  await expect(tab.getByText('Buyers can’t see this until you publish.')).toBeVisible();
  await tab.close();
  const guest = await browser.newContext();
  const g = await guest.newPage();
  await g.goto(`/artwork/${id}?preview=1`);
  await expect(g.getByText(/couldn’t find this Artwork/)).toBeVisible();
  await guest.close();

  const files = objects('artworks');
  await page.route('**/rest/v1/artworks?*', (route) => (route.request().method() === 'PATCH' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }) : route.continue()));
  await page.getByLabel('Choose photos').setInputFiles([photo('f1.jpg'), photo('f2.jpg')]);
  await saveBtn(page).click();
  await expect(page.getByRole('alert').filter({ hasText: 'We couldn’t save. Try again.' })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('2 of 5 added.')).toBeVisible(); // the photos are still in the form
  await expect.poll(() => objects('artworks')).toBe(files); // and nothing of that attempt is left in storage
  await page.unroute('**/rest/v1/artworks?*');

  // leaving with unsaved changes asks the browser's question
  await page.locator('#ed-title').fill('Draft only, changed');
  const asked = page.waitForEvent('dialog');
  page.reload().catch(() => {});
  const dialog = await asked;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
});

test('QA-S23-07 publishing twice makes no duplicate', async ({ page }) => {
  test.setTimeout(120000);
  await signInAs(page, 'A1');
  await page.goto(`/dashboard/artworks/${W.W4}`);
  const dialog = await addListing(page, { kind: 'Print', price: '1500', stock: '4' });
  await dialog.getByRole('button', { name: 'Save Listing' }).click();
  await expect(page.locator('tr[data-listing]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Publish Artwork' }).dblclick();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible({ timeout: 30000 });
  expect(art('count(*)', `title = 'Coconut Grove, Study 2'`)).toBe('1');
  expect(sql(`select count(*) from public.listings where artwork_id = '${W.W4}'`)).toBe('1');
  const a1 = await clientAs('A1');
  await a1.rpc('publish_artwork', { p_artwork: W.W4 });
  await a1.rpc('publish_artwork', { p_artwork: W.W4 });
  expect(sql(`select count(*) from public.listings where artwork_id = '${W.W4}' and status = 'live'`)).toBe('1');
});

test('QA-S23-08 sold listings are read-only; other Artists and unknown ids see the 404', async ({ page }) => {
  await signInAs(page, 'A1');
  await page.goto(`/dashboard/artworks/${W.W2}`);
  const sold = page.locator('tr[data-listing]').filter({ hasText: 'Original' });
  await expect(sold).toContainText('Sold');
  await expect(sold.getByRole('button')).toHaveCount(0);
  await expect(sold).toContainText('Read-only');

  await page.goto('/dashboard/artworks/not-a-uuid');
  await expect(page.getByRole('heading', { name: 'This wall is empty.' })).toBeVisible();
  await page.goto('/dashboard/artworks/00000000-0000-4000-8000-00000000dead');
  await expect(page.getByRole('heading', { name: 'This wall is empty.' })).toBeVisible();

  makeArtist(PEOPLE.A2.id);
  const other = await page.context().browser().newContext();
  const p2 = await other.newPage();
  await signInAs(p2, 'A2');
  await p2.goto(`/dashboard/artworks/${W.W1}`);
  await expect(p2.getByRole('heading', { name: 'This wall is empty.' })).toBeVisible();
  await other.close();
  const a2 = await clientAs('A2');
  for (const [fn, args] of [['end_artwork', { p_artwork: W.W1 }], ['publish_artwork', { p_artwork: W.W1 }], ['set_listing_stock', { p_listing: 'd1000000-0000-4000-8000-000000000002', p_stock: 3 }]]) {
    const res = await a2.rpc(fn, args);
    expect(res.error.message).toContain('forbidden');
  }
  expect(sql(`select status from public.listings where id = 'd1000000-0000-4000-8000-000000000002'`)).toBe('live');
});
