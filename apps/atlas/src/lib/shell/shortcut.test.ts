import { describe, expect, it } from 'vitest';

import { opensPalette, paletteShortcut } from './shortcut';

const key = (init: KeyboardEventInit, target?: HTMLElement) => {
  const e = new KeyboardEvent('keydown', init);
  if (target) Object.defineProperty(e, 'target', { value: target });
  return e;
};

describe('palette shortcut', () => {
  it('spells it per platform', () => {
    expect(paletteShortcut('MacIntel')).toBe('⌘K');
    expect(paletteShortcut('Win32')).toBe('Ctrl K');
  });

  it('opens on ⌘K / Ctrl+K, and on / outside text fields', () => {
    expect(opensPalette(key({ key: 'k', metaKey: true }))).toBe(true);
    expect(opensPalette(key({ key: 'K', ctrlKey: true }))).toBe(true);
    expect(opensPalette(key({ key: 'k', metaKey: true, altKey: true }))).toBe(
      false,
    );
    expect(opensPalette(key({ key: '/' }, document.body))).toBe(true);
    expect(
      opensPalette(key({ key: '/' }, document.createElement('textarea'))),
    ).toBe(false);
    expect(opensPalette(key({ key: 'k' }))).toBe(false);
  });
});
