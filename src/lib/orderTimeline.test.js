import { describe, expect, it } from 'vitest';
import { orderTimeline, receivedAutomatically } from './orderTimeline';

const day = 86400000;
const t0 = Date.UTC(2026, 10, 3, 6, 12);
const base = { total: 690000, paidAt: t0, shipBy: t0 + 7 * day, paymentMethod: 'upi', artist: { displayName: 'Meera Iyer' } };

describe('orderTimeline', () => {
  it('a paid order waits for the Artist, newest first', () => {
    const items = orderTimeline({ ...base, stage: 'paid' });
    expect(items.map((i) => i.label)).toEqual(['Waiting for Meera to ship', 'Paid ₹6,900']);
    expect(items[0].state).toBe('now');
    expect(items[0].note).toMatch(/^deadline /);
    expect(items[1].note).toBe('UPI');
  });

  it('an overdue order marks the wait as failed', () => {
    expect(orderTimeline({ ...base, stage: 'paid', overdue: true })[0].state).toBe('failed');
  });

  it('a shipped order shows tracking and the auto-receive date', () => {
    const items = orderTimeline({ ...base, stage: 'shipped', shippedAt: t0 + 3 * day, trackingNumber: 'DT4830012IN', autoReceiveAt: t0 + 17 * day });
    expect(items.map((i) => i.label)).toEqual(['Waiting for you to confirm it arrived', 'Shipped by Meera, tracking DT4830012IN', 'Paid ₹6,900']);
  });

  it('says who marked an order Received', () => {
    const shipped = { ...base, stage: 'received', shippedAt: t0 + day, autoReceiveAt: t0 + 15 * day };
    expect(orderTimeline({ ...shipped, receivedAt: t0 + 4 * day })[0].note).toBe('you confirmed');
    const auto = { ...shipped, receivedAt: t0 + 15 * day + 60000 };
    expect(receivedAutomatically(auto)).toBe(true);
    expect(orderTimeline(auto)[0].note).toBe('marked Received automatically');
  });

  it('orders damage and refund events by time', () => {
    const items = orderTimeline({
      ...base, stage: 'refunded', shippedAt: t0 + day, receivedAt: t0 + 2 * day, autoReceiveAt: t0 + 15 * day,
      damageReports: [{ status: 'upheld', createdAt: t0 + 3 * day, decidedAt: t0 + 4 * day }],
      refunds: [{ status: 'issued', amount: 250000, createdAt: t0 + 5 * day }],
    });
    expect(items.map((i) => i.label)).toEqual([
      'Refund of ₹2,500 issued', 'CraftMe agreed to refund you', 'You told us it arrived damaged', 'Received', 'Shipped by Meera', 'Paid ₹6,900',
    ]);
  });

  it('a refund still being processed is the current step', () => {
    const items = orderTimeline({ ...base, stage: 'received', receivedAt: t0 + day, refunds: [{ status: 'unknown', amount: 100, createdAt: t0 + 2 * day }] });
    expect(items[0]).toMatchObject({ label: 'Refund of ₹1 being processed', state: 'now' });
  });
});
