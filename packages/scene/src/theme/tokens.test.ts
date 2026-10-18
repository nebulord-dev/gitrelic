import { describe, expect, it } from 'vitest';

import { DEFAULT_THEME, isThemeName, THEME_TOKENS, THEMES } from './tokens';

describe('theme tokens', () => {
  it('defaults to a known theme', () => {
    expect(THEMES).toContain(DEFAULT_THEME);
  });

  it.each([
    ['glow', true],
    ['flat', true],
    ['dark', false],
    ['', false],
    [undefined, false],
  ])('isThemeName(%j) → %s', (value, expected) => {
    expect(isThemeName(value)).toBe(expected);
  });

  it('lists each token once, as a custom property', () => {
    expect(new Set(THEME_TOKENS).size).toBe(THEME_TOKENS.length);
    for (const token of THEME_TOKENS) expect(token).toMatch(/^--[a-z0-9-]+$/);
  });
});
