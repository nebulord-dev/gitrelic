import { afterEach, describe, expect, it } from 'vitest';

import { initialTheme, rememberTheme } from './theme';

const throwing = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
} as unknown as Storage;

describe('theme preference', () => {
  afterEach(() => localStorage.clear());

  it('defaults to flat', () => {
    expect(initialTheme()).toBe('flat');
  });

  it('remembers the chosen theme', () => {
    rememberTheme('glow');
    expect(initialTheme()).toBe('glow');
  });

  it('ignores a stored value that is not a theme', () => {
    localStorage.setItem('gitrelic-atlas-theme', 'neon');
    expect(initialTheme()).toBe('flat');
  });

  it('falls back to the default when storage throws or is missing', () => {
    expect(initialTheme(throwing)).toBe('flat');
    expect(() => rememberTheme('glow', throwing)).not.toThrow();
    expect(initialTheme(undefined)).toBe('flat');
  });
});
