import { describe, expect, it } from 'vitest';
import { initials, isBadId, ratingText, safePhoto } from './artist';

describe('initials', () => {
  it('takes up to two words', () => expect(initials('varun vaidya dev')).toBe('VV'));
  it('handles one word and extra spaces', () => expect(initials('  Asha ')).toBe('A'));
  it('falls back when empty', () => { expect(initials('')).toBe('A'); expect(initials(undefined)).toBe('A'); });
});

describe('safePhoto', () => {
  it('keeps https', () => expect(safePhoto('https://x.test/a.jpg')).toBe('https://x.test/a.jpg'));
  it('drops everything else', () => {
    expect(safePhoto('http://x.test/a.jpg')).toBe('');
    expect(safePhoto('javascript:alert(1)')).toBe('');
    expect(safePhoto('')).toBe('');
    expect(safePhoto(null)).toBe('');
  });
});

describe('ratingText', () => {
  it('is empty with no reviews', () => { expect(ratingText(0, 0)).toBe(''); expect(ratingText(null, undefined)).toBe(''); });
  it('says "review" for one', () => expect(ratingText(5, 1)).toBe('5.0 ★ · 1 review'));
  it('says "reviews" for more', () => expect(ratingText('4.50', 2)).toBe('4.5 ★ · 2 reviews'));
});

describe('isBadId', () => {
  it('only matches the uuid parse error', () => {
    expect(isBadId({ code: '22P02' })).toBe(true);
    expect(isBadId({ code: 'PGRST301' })).toBe(false);
    expect(isBadId(undefined)).toBe(false);
  });
});
