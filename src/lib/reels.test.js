import { describe, expect, it } from 'vitest';
import { reelCode } from './reels';

describe('reelCode', () => {
  it('reads the code from reel links', () => {
    expect(reelCode('https://www.instagram.com/reel/ABC_123-x/')).toBe('ABC_123-x');
    expect(reelCode(' https://instagram.com/reels/XYZ?igsh=abc ')).toBe('XYZ');
  });

  it('refuses anything that is not an Instagram reel', () => {
    expect(reelCode('https://evil.example/reel/ABC')).toBeNull();
    expect(reelCode('https://instagram.com/someone/')).toBeNull();
    expect(reelCode('')).toBeNull();
  });
});
