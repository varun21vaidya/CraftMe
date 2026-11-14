import { describe, expect, it } from 'vitest';
import { notificationTarget, notificationText } from './notifications';

const TYPES = ['order_paid', 'order_shipped', 'review_prompt', 'refund_issued', 'damage_upheld', 'damage_rejected', 'review_approved', 'review_rejected',
  'order_new', 'ship_reminder', 'order_received', 'damage_reported', 'damage_decided', 'review_new', 'payout_sent', 'artist_verified',
  'shop_restricted', 'shop_reinstated', 'instagram_reconnect', 'order_refunded'];

describe('notificationTarget', () => {
  it('goes somewhere for every known type, with or without ids', () => {
    for (const t of TYPES) {
      expect(notificationTarget(t, { orderId: 'o1' }, 'me1'), t).toMatch(/^\//);
      expect(notificationTarget(t, {}, undefined), `${t} without ids`).toMatch(/^\//);
      expect(notificationTarget(t, null), `${t} without data`).toMatch(/^\//);
    }
  });
  it('uses the order pages the plan lists', () => {
    expect(notificationTarget('order_paid', { orderId: 'o1' })).toBe('/orders/o1');
    expect(notificationTarget('review_prompt', { orderId: 'o1' })).toBe('/orders/o1/review');
    expect(notificationTarget('damage_upheld', { orderId: 'o1' })).toBe('/orders/o1/damage');
    expect(notificationTarget('review_new', {}, 'me1')).toBe('/artist/me1?tab=reviews');
  });
  it('falls back to the list page for its kind when the id is missing', () => {
    expect(notificationTarget('order_shipped', {})).toBe('/orders');
    expect(notificationTarget('review_approved', undefined)).toBe('/orders');
  });
  it('returns null for an unknown type', () => {
    expect(notificationTarget('from_the_future', { orderId: 'o1' })).toBeNull();
    expect(notificationTarget(undefined, undefined)).toBeNull();
  });
});

describe('notificationText', () => {
  it('has a title, detail, icon and category for every known type', () => {
    for (const t of TYPES) {
      const x = notificationText(t, { code: 'AB12', amount: 12345, net: 9000, orderId: 'o1' });
      expect(x.title.length, t).toBeGreaterThan(2);
      expect(['orders', 'reviews', 'shop']).toContain(x.category);
      expect(x.icon).toBeTruthy();
    }
  });
  it('writes the plan wording', () => {
    expect(notificationText('order_paid', { code: 'AB12' }).title).toBe('Payment received for AB12');
    expect(notificationText('refund_issued', { code: 'AB12', amount: 150000 }).title).toBe('Refund of ₹1,500 issued for AB12');
    expect(notificationText('review_prompt', { code: 'AB12', auto: true }).title).toBe('AB12 was marked Received');
    expect(notificationText('review_prompt', { code: 'AB12' }).title).toBe('How is your Order AB12?');
    expect(notificationText('payout_sent', { net: 450000 }).title).toBe('₹4,500 was paid to you');
  });
  it('reads "Update" for an unknown type and never throws on missing data', () => {
    expect(notificationText('from_the_future', {})).toMatchObject({ title: 'Update' });
    expect(() => TYPES.forEach((t) => notificationText(t, undefined))).not.toThrow();
  });
  it('puts review notices under Reviews and money and shop notices where the plan says', () => {
    expect(notificationText('review_approved', {}).category).toBe('reviews');
    expect(notificationText('artist_verified', {}).category).toBe('shop');
    expect(notificationText('refund_issued', { amount: 1 }).category).toBe('orders');
  });
});
