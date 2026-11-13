// P02 scripts: QA-S13-09, QA-S14-01 to 08. Needs the local stack, the seed and the api function served (for the cleanup job):
//   npx supabase functions serve api --env-file supabase/.env.local --no-verify-jwt
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { clientAs } from './helpers/api.js';
import { sql } from './helpers/db.js';
import { L, O, PEOPLE } from './helpers/ids.js';
import { env, seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const B1 = PEOPLE.B1.id;
const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const jpg = (name, mb = 0.01) => ({ name, mimeType: 'image/jpeg', buffer: Buffer.alloc(Math.round(mb * 1024 * 1024), 1) });
const photos = (n, prefix = 'p') => Array.from({ length: n }, (_, i) => jpg(`${prefix}${i}.jpg`));
const objects = (uid = B1) => Number(sql(`select count(*) from storage.objects where bucket_id = 'damage' and name like '${uid}/%'`));
const reports = (order) => Number(sql(`select count(*) from public.damage_reports where order_id = '${order}'`));
const submitted = (page) => page.getByRole('status').filter({ hasText: 'Report sent' });
const send = (page) => page.getByRole('button', { name: /^(Send report|Uploading|Sending)/ });
const cronSecret = () => (fs.readFileSync('supabase/.env.local', 'utf8').match(/^CRON_SECRET=(.*)$/m) || [])[1]?.trim();

/** A complete form: lines (by position), kind, note and n photos. */
async function fill(page, { lines = [0], kind = 'Torn, creased or crushed', note = 'The tube arrived crushed.', n = 2 } = {}) {
  for (const i of lines) await page.locator('label.option-card').nth(i).locator('input').check();
  await page.getByRole('radio', { name: kind }).check();
  await page.getByLabel('Describe it').fill(note);
  if (n) await page.locator('input[type=file]').setInputFiles(photos(n));
}

/** Delays (and optionally fails) the photo uploads the page makes. delay(n) gets the request number from 1. */
async function uploads(page, { delay = () => 0, failAt = 0 } = {}) {
  const seen = { n: 0 };
  await page.route('**/storage/v1/object/damage/**', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const n = ++seen.n;
    const ms = delay(n);
    if (ms) await new Promise((r) => setTimeout(r, ms));
    return n === failAt ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }) : route.continue();
  });
  return seen;
}

/** Puts n small JPEGs in the user's damage folder through the storage API; returns the full paths report_damage takes. */
async function stored(client, uid, n, tag) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const name = `${uid}/${tag}-${randomUUID().slice(0, 8)}-${i}.jpg`; // storage keeps files across seed runs
    const { error } = await client.storage.from('damage').upload(name, Buffer.alloc(10, 1), { contentType: 'image/jpeg' });
    if (error) throw error;
    out.push(`damage/${name}`);
  }
  return out;
}
const reportRpc = (client, order, lines, photoPaths, note = 'Crushed.') => client.rpc('report_damage', { p_order: order, p_line_ids: lines, p_note: note, p_photos: photoPaths, p_kind: 'torn' });

test.beforeEach(() => seed());

test('QA-S14-01 form page', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto(`/orders/${O.O5}/damage`);
  await expect(page.getByRole('heading', { name: 'Report damage' })).toBeVisible();
  const crumbs = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(crumbs).toContainText('My orders');
  await expect(crumbs).toContainText('CM-20405');
  await expect(crumbs.locator('[aria-current=page]')).toHaveText('Report damage');
  await expect(page.locator('main')).toContainText(`Please tell us by ${day(sql(`select damage_window_ends from public.orders where id = '${O.O5}'`))}.`);
  const lines = page.locator('label.option-card');
  await expect(lines).toHaveCount(2);
  for (const t of ['Kolam at Dawn', 'Monsoon Over Marina']) await expect(lines.filter({ hasText: t })).toContainText(/₹/);
  await expect(page.locator('label.option-card input:checked')).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(5);
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(page.getByLabel('Describe it')).toHaveAttribute('maxlength', '800');
  await expect(page.locator('#dd-c')).toHaveText('0 / 800');
  await expect(page.locator('main')).toContainText('Add at least 2: the outside of the parcel, and the damage up close.');
  await expect(page.locator('main')).toContainText('Up to 6 · JPEG or PNG · 5 MB each');
  const aside = page.getByRole('complementary', { name: 'What to expect' });
  await expect(aside.locator('li')).toHaveCount(3);
  await expect(aside).toContainText('one Damage Report per Order');
  await page.getByRole('link', { name: 'Cancel' }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${O.O5}$`));
});

test('QA-S14-02 validation', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto(`/orders/${O.O5}/damage`);
  await send(page).click();
  const summary = page.getByRole('alert').filter({ hasText: 'Please fix these' });
  for (const m of ['Choose at least one item.', 'Choose the type of damage.', 'Describe what happened.', 'Add at least 2 photos.']) {
    await expect(summary).toContainText(m);
    await expect(page.locator('main').getByText(m, { exact: true })).toHaveCount(2); // summary and inline
  }
  await page.locator('label.option-card').first().locator('input').check();
  await page.getByRole('radio', { name: 'Torn, creased or crushed' }).check();
  await page.getByLabel('Describe it').fill('x'.repeat(900));
  await expect(page.getByLabel('Describe it')).toHaveValue('x'.repeat(800));
  await expect(page.locator('#dd-c')).toHaveText('800 / 800');
  await page.locator('input[type=file]').setInputFiles(photos(1));
  await send(page).click();
  await expect(summary.locator('li')).toHaveCount(1);
  await expect(summary).toContainText('Add at least 2 photos.');
  expect(reports(O.O5)).toBe(0);
});

test('QA-S14-03 mixed files', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto(`/orders/${O.O5}/damage`);
  const input = page.locator('input[type=file]');
  const before = objects();
  await input.setInputFiles([
    jpg('one.jpg', 1), jpg('two.jpg', 1),
    { name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(6 * 1024 * 1024) },
    { name: 'doc.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(10) },
    { name: 'pic.webp', mimeType: 'image/webp', buffer: Buffer.alloc(10) },
  ]);
  const previews = page.getByRole('list', { name: 'Chosen photos' }).getByRole('listitem');
  await expect(previews).toHaveCount(2);
  const refused = page.getByRole('alert').filter({ hasText: 'big.png' });
  await expect(refused.locator('.error-msg')).toHaveCount(3);
  await expect(refused).toContainText('big.png: too large');
  await expect(refused).toContainText('doc.pdf: not a JPEG or PNG.');
  await expect(refused).toContainText('pic.webp: not a JPEG or PNG.');
  await input.setInputFiles(photos(5, 'more'));
  await expect(previews).toHaveCount(6);
  await expect(page.getByRole('alert').filter({ hasText: 'up to 6 photos' })).toContainText('more4.jpg: up to 6 photos.');
  await page.getByRole('button', { name: 'Remove photo 1' }).click();
  await expect(previews).toHaveCount(5);
  await input.setInputFiles(photos(1, 'again'));
  await expect(previews).toHaveCount(6);
  expect(objects()).toBe(before); // nothing is uploaded until Send
});

test.describe('QA-S14-04 upload fails part-way; retry; orphans', () => {
  test('run A: the second upload fails once, Try again sends only that photo', async ({ page }) => {
    await signInAs(page, 'B1');
    const up = await uploads(page, { delay: () => 600, failAt: 2 });
    const before = objects();
    await page.goto(`/orders/${O.O5}/damage`);
    await fill(page, { n: 3 });
    await send(page).click();
    await expect(page.getByRole('button', { name: 'Uploading photo 2 of 3…' })).toBeDisabled();
    await expect(page.getByText(/Didn.t upload/)).toHaveCount(1);
    expect(up.n).toBe(3);
    expect(reports(O.O5)).toBe(0);
    await page.locator('.thumb').filter({ hasText: /Didn.t upload/ }).getByRole('button', { name: 'Try again' }).click();
    await expect(submitted(page)).toBeVisible();
    expect(up.n).toBe(4); // only the failed photo went again
    expect(objects() - before).toBe(3);
    expect(sql(`select cardinality(photos) from public.damage_reports where order_id = '${O.O5}'`)).toBe('3');
  });

  test('run B: the report call fails once; the retry makes no new upload', async ({ page }) => {
    await signInAs(page, 'B1');
    const up = await uploads(page);
    let failed = false;
    await page.route('**/rest/v1/rpc/report_damage', (route) => {
      if (failed) return route.continue();
      failed = true;
      return route.abort('failed');
    });
    await page.goto(`/orders/${O.O5}/damage`);
    await fill(page, { n: 3 });
    const before = objects();
    await send(page).click();
    await expect(page.getByRole('alert').filter({ hasText: 'We couldn’t send your report. Your photos are saved. Try again.' })).toBeVisible();
    expect(up.n).toBe(3);
    await send(page).click();
    await expect(submitted(page)).toBeVisible();
    expect(up.n).toBe(3);
    expect(objects() - before).toBe(3);
    expect(sql(`select cardinality(photos) from public.damage_reports where order_id = '${O.O5}'`)).toBe('3');
  });

  test('run C: Cancel after two uploads leaves no files', async ({ page }) => {
    await signInAs(page, 'B1');
    await uploads(page, { delay: (n) => (n < 3 ? 200 : 3000) });
    const before = objects();
    await page.goto(`/orders/${O.O5}/damage`);
    await fill(page, { n: 3 });
    await send(page).click();
    await expect(page.getByRole('button', { name: 'Uploading photo 3 of 3…' })).toBeVisible();
    await page.getByRole('link', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(new RegExp(`/orders/${O.O5}$`));
    await expect.poll(() => objects() - before, { timeout: 15000 }).toBe(0);
    expect(reports(O.O5)).toBe(0);
  });

  test('the cleanup job removes files older than 24 hours that no report uses', async () => {
    const client = await clientAs('B1');
    const url = `${env().VITE_SUPABASE_URL}/functions/v1/api/cron?job=cleanup`;
    const call = (secret) => fetch(url, { method: 'POST', headers: { 'x-cron-secret': secret, apikey: env().VITE_SUPABASE_PUBLISHABLE_KEY } });
    expect((await call('wrong')).status).toBe(403);
    const [old, young] = await stored(client, B1, 2, 'orphan');
    const [kept1, kept2] = await stored(client, B1, 2, 'kept');
    const { error } = await reportRpc(client, O.O5, [L.W2P], [kept1, kept2]);
    expect(error).toBeNull();
    sql(`update storage.objects set created_at = now() - interval '25 hours' where name in ('${old.slice(7)}', '${kept1.slice(7)}', '${kept2.slice(7)}')`);
    const res = await (await call(cronSecret())).json();
    expect(res.ok).toBe(true);
    expect(res.data.removed).toBeGreaterThanOrEqual(1);
    const left = (p) => Number(sql(`select count(*) from storage.objects where bucket_id = 'damage' and name = '${p.slice(7)}'`));
    expect(left(old)).toBe(0);
    expect(left(young)).toBe(1);
    expect(left(kept1) + left(kept2)).toBe(2);
  });
});

test('QA-S14-05 submitted view is durable', async ({ page, browser }) => {
  await signInAs(page, 'B1');
  await page.goto(`/orders/${O.O5}/damage`);
  await fill(page, { lines: [1], kind: 'Water or moisture damage', note: 'Wet corner.' });
  await send(page).click();
  await expect(submitted(page)).toBeVisible();
  const code = sql(`select code from public.damage_reports where order_id = '${O.O5}'`);
  const header = submitted(page);
  await expect(header).toContainText(`Reference ${code}`);
  await expect(header).toContainText('You’ll get a notification here when we’ve decided.');
  await expect(page.locator('main')).not.toContainText(/email/i);
  const steps = page.getByRole('list', { name: 'Report progress' }).locator('li');
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText('You sent the report');
  await expect(steps.nth(0)).toContainText(/\d{2}:\d{2}/);
  await page.reload();
  await expect(submitted(page)).toContainText(`Reference ${code}`);
  const other = await browser.newPage({ baseURL: 'http://localhost:5173', viewport: page.viewportSize() });
  await signInAs(other, 'B1');
  await other.goto(`/orders/${O.O5}/damage`);
  await expect(submitted(other)).toContainText(`Reference ${code}`);
  const rep = sql(`select kind || '|' || cardinality(line_ids) || '|' || cardinality(photos) || '|' || note || '|' || status from public.damage_reports where order_id = '${O.O5}'`);
  expect(rep).toBe('water|1|2|Wet corner.|open');
  expect(sql(`select open_report::text || '|' || payable::text from public.orders where id = '${O.O5}'`)).toBe('true|false');
  const admin = await clientAs('AD1');
  const { error } = await admin.rpc('decide_damage', { p_order: O.O5, p_decision: 'rejected', p_note: 'Photos show normal wear.' });
  expect(error).toBeNull();
  await page.reload();
  await expect(page.getByRole('list', { name: 'Report progress' })).toContainText('Not upheld');
  await expect(page.getByRole('list', { name: 'Report progress' })).toContainText('Photos show normal wear.');
  await other.close();
});

test('QA-S14-06 already reported', async ({ page }) => {
  await signInAs(page, 'B2');
  await page.goto(`/orders/${O.O10}/damage`);
  await expect(submitted(page)).toBeVisible();
  await expect(page.getByRole('button', { name: /Send report/ })).toHaveCount(0);
  const b2 = await clientAs('B2');
  const paths = await stored(b2, PEOPLE.B2.id, 2, 'dup');
  const { error } = await reportRpc(b2, O.O10, [L.W2P], paths);
  expect(JSON.parse(error.message)).toMatchObject({ code: 'conflict', reason: 'already_exists' });
  // two submissions at the same moment on a fresh order: one wins, the other is told it already exists
  const b1 = await clientAs('B1');
  const a = await stored(b1, B1, 2, 'race-a');
  const b = await stored(b1, B1, 2, 'race-b');
  const results = await Promise.all([reportRpc(b1, O.O5, [L.W2P], a), reportRpc(b1, O.O5, [L.W2P], b)]);
  expect(results.filter((r) => !r.error)).toHaveLength(1);
  expect(JSON.parse(results.find((r) => r.error).error.message).reason).toBe('already_exists');
  expect(reports(O.O5)).toBe(1);
});

test('QA-S14-07 the window closes during upload', async ({ page }) => {
  await signInAs(page, 'B1');
  await uploads(page, { delay: () => 3000 });
  const before = objects();
  await page.goto(`/orders/${O.O5}/damage`);
  await fill(page);
  const ends = sql(`select damage_window_ends from public.orders where id = '${O.O5}'`);
  await send(page).click();
  sql(`update public.orders set damage_window_ends = now() - interval '1 minute' where id = '${O.O5}'`);
  await expect(page.getByText(/The time to report damage ended on/)).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('link', { name: 'Back to Order' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Contact CraftMe' })).toBeVisible();
  expect(ends).toBeTruthy();
  expect(reports(O.O5)).toBe(0);
  await expect.poll(() => objects() - before, { timeout: 15000 }).toBe(0);
});

test('QA-S14-08 wrong person or wrong stage', async () => {
  const b1 = await clientAs('B1');
  const b2 = await clientAs('B2');
  const a1 = await clientAs('A1');
  const reason = (r) => JSON.parse(r.error.message);
  const p2 = await stored(b2, PEOPLE.B2.id, 2, 'wp');
  const pa = await stored(a1, PEOPLE.A1.id, 2, 'wp');
  const p1 = await stored(b1, B1, 2, 'wp');
  expect(reason(await reportRpc(b2, O.O5, [L.W2P], p2)).code).toBe('forbidden');
  expect(reason(await reportRpc(a1, O.O5, [L.W2P], pa)).code).toBe('forbidden');
  expect(reason(await reportRpc(b1, O.O2, [L.W2P], p1)).reason).toBe('wrong_stage');
  const other = await reportRpc(b1, O.O5, [L.W2P], p2);
  expect(reason(other)).toMatchObject({ code: 'invalid', fields: ['photoPaths'] });
  expect(reports(O.O5)).toBe(0);
});

test('QA-S13-09 actions disappear at their cut-offs', async ({ page, context }) => {
  await signInAs(page, 'B1');
  await page.goto(`/orders/${O.O5}`);
  const actions = page.getByRole('region', { name: 'Actions' });
  await expect(actions.getByRole('link', { name: 'Something not right?' })).toBeVisible();
  await expect(actions.getByRole('link', { name: /^Review / })).toBeVisible();
  const tab = await context.newPage();
  await tab.goto(`/orders/${O.O5}/damage`);
  await fill(tab);
  sql(`update public.orders set damage_window_ends = now() - interval '1 minute' where id = '${O.O5}'`);
  await page.waitForTimeout(5000);
  await expect(actions.getByRole('link', { name: 'Something not right?' })).toHaveCount(0);
  await send(tab).click();
  await expect(tab.getByText(/The time to report damage ended on/)).toBeVisible();
  expect(reports(O.O5)).toBe(0);
  sql(`update public.orders set review_by = now() - interval '1 minute' where id = '${O.O5}'`);
  await page.waitForTimeout(5000);
  await expect(actions.getByRole('link', { name: /^Review / })).toHaveCount(0);
});
