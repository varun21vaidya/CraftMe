import { describe, expect, it } from 'vitest';
import { listingLine, publishProblems, validateDetails, validateListing, workStatus } from './works';

const L = (status, extra = {}) => ({ status, kind: 'print', stock: 5, held: 0, price: 100000, ...extra });

describe('workStatus (QA-S22-01)', () => {
  it('follows the fixture shapes', () => {
    expect(workStatus({ status: 'published', listings: [L('live', { kind: 'original', stock: 1 }), L('live')] })).toBe('published'); // W1
    expect(workStatus({ status: 'published', listings: [L('sold', { kind: 'original' }), L('live')] })).toBe('published'); // W2
    expect(workStatus({ status: 'published', listings: [L('sold')] })).toBe('sold'); // W3
    expect(workStatus({ status: 'draft', listings: [] })).toBe('draft'); // W4
    expect(workStatus({ status: 'draft', listings: [L('ended')] })).toBe('ended'); // after End
    expect(workStatus({ status: 'published', listings: [L('ended')] })).toBe('ended'); // W5 as seeded
    expect(workStatus({ status: 'draft', listings: [L('draft')] })).toBe('draft');
    expect(workStatus({ status: 'published', listings: [] })).toBe('draft');
    expect(workStatus({ status: 'published' })).toBe('draft');
  });
});

describe('listingLine', () => {
  it('says how many are left, or Sold or Ended', () => {
    expect(listingLine(L('live', { kind: 'original', stock: 1, price: 4200000 }))).toEqual(['Original', 4200000, '1 left']);
    expect(listingLine(L('live', { stock: 50, held: 2 }))).toEqual(['Print', 100000, '50 in stock']);
    expect(listingLine(L('sold', { kind: 'original' }))[2]).toBe('Sold');
    expect(listingLine(L('ended'))[2]).toBe('Ended');
  });
});

describe('publishProblems', () => {
  it('lists what the database would refuse', () => {
    expect(publishProblems({ title: '', photos: [] }, [])).toEqual(['title', 'photos', 'listings']);
    expect(publishProblems({ title: 'A', photos: [] }, [])).toEqual(['photos', 'listings']);
    expect(publishProblems({ title: 'A', photos: ['x'] }, [L('ended'), L('sold')])).toEqual(['listings']);
    expect(publishProblems({ title: 'A', photos: ['x'] }, [L('draft')])).toEqual([]);
    expect(publishProblems({ title: ' ', photos: ['x'] }, [L('live')])).toEqual(['title']);
  });
});

describe('validateDetails', () => {
  it('accepts a blank year and refuses an impossible one', () => {
    const base = { title: 'A', description: '', year: '', medium: '' };
    expect(validateDetails(base)).toEqual({});
    expect(validateDetails({ ...base, year: '1899' }).year).toBeTruthy();
    expect(validateDetails({ ...base, year: '2027' }, 2026).year).toBeTruthy();
    expect(validateDetails({ ...base, year: '2026' }, 2026)).toEqual({});
    expect(validateDetails({ ...base, description: 'x'.repeat(1001) }).description).toBeTruthy();
  });
});

describe('validateListing (QA-S23-03)', () => {
  const ok = { kind: 'product', size: 'A4 frame', medium: 'Wood', price: '900', stock: '5' };
  it('passes a good Listing and an Original with no stock box', () => {
    expect(validateListing(ok)).toEqual({});
    expect(validateListing({ ...ok, kind: 'original', stock: '' })).toEqual({});
  });
  it('words the price and stock rules', () => {
    const e = validateListing({ ...ok, price: '0', stock: '0' });
    expect(e.price).toBe('Enter a price of at least ₹1.');
    expect(e.stock).toBe('Enter how many you have, from 1 to 1000.');
    expect(validateListing({ ...ok, price: '12.5' }).price).toBeTruthy();
    expect(validateListing({ ...ok, stock: '1001' }).stock).toBeTruthy();
  });
  it('refuses a stock below what is held', () => {
    expect(validateListing({ ...ok, stock: '2' }, { held: 3 }).stock).toBe('3 are in someone’s checkout right now.');
    expect(validateListing({ ...ok, stock: '3' }, { held: 3 })).toEqual({});
  });
});
