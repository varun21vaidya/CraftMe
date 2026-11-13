// P02 scripts: QA-S15-01 to 06 (and S13.i.13). Needs the local stack and the seed.
import { expect, test } from '@playwright/test';
import { clientAs } from './helpers/api.js';
import { sql } from './helpers/db.js';
import { O, PEOPLE } from './helpers/ids.js';
import { seed } from './helpers/seed.mjs';
import { signInAs } from './helpers/session.js';

const B1 = PEOPLE.B1.id;
const A1 = PEOPLE.A1.id;
const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
const long = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const textbox = (page) => page.getByLabel('Your Review');
const sendBtn = (page) => page.getByRole('button', { name: /^(Send Review|Sending)/ });
const reviews = (order) => Number(sql(`select count(*) from public.reviews where order_id = '${order}'`));
const rate = async (page, n) => {
  await page.getByRole('radio', { name: '1 star' }).focus();
  for (let i = 1; i < n; i++) await page.keyboard.press('ArrowRight');
};
const reason = (r) => JSON.parse(r.error.message);

test.beforeEach(() => seed());

test('QA-S15-01 form page and a good review', async ({ page }) => {
  const rating = () => sql(`select rating_count || '/' || rating_avg from public.profiles where id = '${A1}'`);
  const before = rating();
  await signInAs(page, 'B1');
  await page.goto(`/orders/${O.O6}/review`);
  await expect(page.getByRole('heading', { name: 'Review Meera Iyer' })).toBeVisible();
  await expect(page.locator('main')).toContainText('Reviews rate the Artist as a seller');
  await expect(page.locator('main')).toContainText(`Order CM-20406 · Received ${long(sql(`select received_at from public.orders where id = '${O.O6}'`))} · Window closes in 20 days`);
  await expect(page.locator('main')).toContainText('Don’t include your address, phone number or links.');
  await expect(page.locator('main')).toContainText('appears on Meera Iyer’s profile after CraftMe approves it. You can’t edit it once sent.');
  await expect(page.locator('#rc-c')).toHaveText('0 / 500');
  await rate(page, 4);
  await expect(page.getByRole('radio', { name: '4 stars' })).toBeChecked();
  await expect(page.locator('#rate-v')).toHaveText('4 of 5');
  await textbox(page).fill('Exactly as photographed.');
  await page.getByRole('button', { name: 'Packed well' }).click();
  await expect(textbox(page)).toHaveValue('Exactly as photographed. Packed well.');
  await page.getByRole('button', { name: 'Fast shipping' }).click();
  await expect(textbox(page)).toHaveValue('Exactly as photographed. Packed well. Fast shipping.');
  await expect(page.getByRole('button', { name: 'Fast shipping' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Fast shipping' }).click();
  await expect(textbox(page)).toHaveValue('Exactly as photographed. Packed well.');
  await expect(page.getByRole('button', { name: 'Fast shipping' })).toHaveAttribute('aria-pressed', 'false');
  await sendBtn(page).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.locator('.toast').first()).toContainText('Thanks. Your Review will appear once CraftMe approves it.');
  expect(sql(`select rating || '|' || comment || '|' || status || '|' || buyer_name from public.reviews where order_id = '${O.O6}' and buyer_id = '${B1}'`)).toBe('4|Exactly as photographed. Packed well.|pending|Ananya');
  expect(sql(`select reviewed from public.orders where id = '${O.O6}'`)).toBe('t');
  expect(rating()).toBe(before);
});

test('QA-S15-02 validation and length', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto(`/orders/${O.O6}/review`);
  await sendBtn(page).click();
  await expect(page.locator('main').getByText('Pick a rating.', { exact: true })).toBeVisible();
  await expect(page.locator('main').getByText('Write a few words.', { exact: true })).toBeVisible();
  expect(reviews(O.O6)).toBe(0);
  await rate(page, 5);
  await textbox(page).fill('x'.repeat(500));
  await expect(page.locator('#rc-c')).toHaveText('500 / 500');
  for (const chip of ['Packed well', 'As described', 'Fast shipping', 'Good communication']) await expect(page.getByRole('button', { name: chip })).toBeDisabled();
  await textbox(page).fill('Fine.');
  await expect(page.getByRole('button', { name: 'Packed well' })).toBeEnabled();
});

test('QA-S15-03 window closed, including while the form is open', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto(`/orders/${O.O6}/review`);
  await rate(page, 5);
  await textbox(page).fill('Lovely.');
  sql(`update public.orders set review_by = now() - interval '1 minute' where id = '${O.O6}'`);
  await sendBtn(page).click();
  const closed = page.getByRole('status').filter({ hasText: 'The Review window has closed' });
  const when = day(sql(`select review_by from public.orders where id = '${O.O6}'`));
  await expect(closed).toContainText(`Reviews can be written for 30 days after an Order is Received. This one closed on ${when}.`);
  await expect(closed.getByRole('link', { name: 'Back to Order' })).toBeVisible();
  expect(reviews(O.O6)).toBe(0);
  await page.reload();
  await expect(closed).toContainText(`This one closed on ${when}.`);
});

test('QA-S15-04 already reviewed and double submit', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto(`/orders/${O.O7}/review`);
  const mine = page.getByRole('region', { name: 'You reviewed Meera Iyer' });
  await expect(mine).toBeVisible();
  await expect(mine.getByRole('img', { name: '5 of 5 stars' })).toBeVisible();
  await expect(mine).toContainText('Beautiful print, packed with care.');
  await expect(mine).toContainText(`Sent ${long(sql(`select created_at from public.reviews where order_id = '${O.O7}'`))}`);
  await expect(mine).toContainText('Published');
  await expect(page.getByRole('radio')).toHaveCount(0);

  await page.goto(`/orders/${O.O6}/review`);
  await rate(page, 3);
  await textbox(page).fill('Good.');
  await sendBtn(page).dblclick();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.locator('.toast')).toHaveCount(1);
  expect(reviews(O.O6)).toBe(1);
  const again = await (await clientAs('B1')).rpc('submit_review', { p_order: O.O6, p_rating: 4, p_comment: 'Again' });
  expect(reason(again).reason).toBe('already_exists');
  expect(reviews(O.O6)).toBe(1);
});

test('QA-S15-05 refunds and eligibility', async ({ page }) => {
  await signInAs(page, 'B1');
  await page.goto(`/orders/${O.O8}/review`);
  await expect(page.getByRole('heading', { name: 'Review Meera Iyer' })).toBeVisible();
  await expect(sendBtn(page)).toBeVisible();
  await page.goto(`/orders/${O.O9}/review`);
  await expect(page.getByText('This Order was refunded in full, so it can’t be reviewed.')).toBeVisible();
  await expect(sendBtn(page)).toHaveCount(0);
  await page.goto(`/orders/${O.O2}/review`);
  await expect(page.getByText('You can review Meera Iyer once the Order is Received.')).toBeVisible();
  const b1 = await clientAs('B1');
  for (const order of [O.O9, O.O2]) {
    const res = await b1.rpc('submit_review', { p_order: order, p_rating: 5, p_comment: 'Nice' });
    expect(reason(res).reason).toBe('wrong_stage');
  }
  // the order page: a partly refunded order keeps Review, a fully refunded one has none
  await page.goto(`/orders/${O.O8}`);
  await expect(page.getByRole('region', { name: 'Actions' }).getByRole('link', { name: /^Review / })).toBeVisible();
  await page.goto(`/orders/${O.O9}`);
  await expect(page.getByRole('region', { name: 'Actions' }).getByRole('link', { name: /^Review / })).toHaveCount(0);
});

test('QA-S15-06 the buyer sees what happened to their review', async ({ page }) => {
  const b1 = await clientAs('B1');
  const admin = await clientAs('AD1');
  const avg = () => sql(`select rating_count from public.profiles where id = '${A1}'`);
  const start = avg();
  expect((await b1.rpc('submit_review', { p_order: O.O6, p_rating: 2, p_comment: 'Call me on 9876543210' })).error).toBeNull();
  expect((await admin.rpc('decide_review', { p_order: O.O6, p_decision: 'rejected' })).error).toBeNull();
  await signInAs(page, 'B1');
  await page.goto(`/orders/${O.O6}/review`);
  const mine = page.getByRole('region', { name: 'You reviewed Meera Iyer' });
  await expect(mine).toContainText('Not published');
  await expect(mine).toContainText('CraftMe didn’t publish this Review');
  expect(avg()).toBe(start);
  expect((await b1.rpc('submit_review', { p_order: O.O5, p_rating: 5, p_comment: 'Superb.' })).error).toBeNull();
  await page.goto(`/orders/${O.O5}/review`);
  await expect(page.getByRole('region', { name: 'You reviewed Meera Iyer' })).toContainText('Waiting for approval');
  expect((await admin.rpc('decide_review', { p_order: O.O5, p_decision: 'approved' })).error).toBeNull();
  await page.reload();
  await expect(page.getByRole('region', { name: 'You reviewed Meera Iyer' })).toContainText('Published');
  expect(Number(avg())).toBe(Number(start) + 1);
});
