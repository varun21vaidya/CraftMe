import { describe, expect, it } from 'vitest';
import { slideFromScroll, step } from './gallery';
import { notificationTarget } from './notifications';

describe('step', () => {
  it('moves by one', () => expect(step(1, 1, 5)).toBe(2));
  it('stops at the first slide', () => expect(step(0, -1, 5)).toBe(0));
  it('stops at the last slide', () => expect(step(4, 1, 5)).toBe(4));
  it('stays at 0 for an empty or one-slide gallery', () => { expect(step(0, 1, 0)).toBe(0); expect(step(0, 1, 1)).toBe(0); });
});

describe('slideFromScroll', () => {
  it('rounds to the nearest slide', () => { expect(slideFromScroll(0, 400)).toBe(0); expect(slideFromScroll(230, 400)).toBe(1); expect(slideFromScroll(820, 400)).toBe(2); });
  it('is 0 when the width is unknown', () => expect(slideFromScroll(500, 0)).toBe(0));
});

describe('notificationTarget', () => {
  it('sends buyers to their order', () => {
    for (const t of ['order_paid', 'order_shipped', 'order_refunded']) expect(notificationTarget(t, { orderId: 'o1' })).toBe('/orders/o1');
  });
  it('falls back to the orders list without an id', () => expect(notificationTarget('order_paid', {})).toBe('/orders'));
  it('sends artists to Orders to ship', () => {
    for (const t of ['order_new', 'order_received', 'ship_reminder']) expect(notificationTarget(t, { orderId: 'o1' })).toBe('/dashboard/orders');
  });
  it('sends the Instagram reminder to the profile', () => expect(notificationTarget('instagram_reconnect')).toBe('/dashboard/profile'));
  it('has nowhere to go for an unknown type', () => expect(notificationTarget('mystery', {})).toBeNull());
});
