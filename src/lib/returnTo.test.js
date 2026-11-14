import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberReturn, takeReturn } from './returnTo';

beforeEach(() => {
  const store = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k),
  });
});

describe('returnTo', () => {
  it('gives back a remembered path once', () => {
    rememberReturn('/orders/abc?tab=x');
    expect(takeReturn()).toBe('/orders/abc?tab=x');
    expect(takeReturn()).toBe('/');
  });
  it.each(['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '', '/a\nb', null, undefined, 42])('refuses %j', (bad) => {
    rememberReturn(bad);
    expect(takeReturn()).toBe('/');
  });
  it('never returns to the login page', () => {
    rememberReturn('/login');
    expect(takeReturn()).toBe('/');
  });
  it('treats a crafted stored value like a bad one and still removes it', () => {
    sessionStorage.setItem('cm-return', '//evil.example');
    expect(takeReturn()).toBe('/');
    expect(sessionStorage.getItem('cm-return')).toBeNull();
  });
  it('does not throw when storage is blocked', () => {
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('sessionStorage', { getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(() => rememberReturn('/cart')).not.toThrow();
    expect(takeReturn()).toBe('/');
  });
});
