import { describe, expect, it } from 'vitest';

import { opensPalette, paletteShortcut, pressed } from './shortcut';

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

  it('opens on the physical K key under non-Latin layouts', () => {
    // Russian layout: the K key types 'л'.
    expect(opensPalette(key({ key: 'л', code: 'KeyK', metaKey: true }))).toBe(
      true,
    );
    expect(opensPalette(key({ key: 'л', code: 'KeyK' }))).toBe(false);
    // Colemak (KeyK types e) and Dvorak (t): the browser keeps Ctrl+E / Ctrl+T.
    expect(opensPalette(key({ key: 'e', code: 'KeyK', ctrlKey: true }))).toBe(
      false,
    );
    expect(opensPalette(key({ key: 't', code: 'KeyK', metaKey: true }))).toBe(
      false,
    );
    // Firefox's console.
    expect(opensPalette(key({ key: 'K', ctrlKey: true, shiftKey: true }))).toBe(
      false,
    );
  });

  it('matches single-key shortcuts outside fields, either case', () => {
    expect(pressed(key({ key: 'I', shiftKey: true }, document.body), 'i')).toBe(
      true,
    );
    expect(pressed(key({ key: 'i' }, document.body), 'i')).toBe(true);
    expect(pressed(key({ key: '?', shiftKey: true }, document.body), '?')).toBe(
      true,
    );
    expect(pressed(key({ key: 'i', metaKey: true }, document.body), 'i')).toBe(
      false,
    );
    expect(
      pressed(key({ key: 'i' }, document.createElement('input')), 'i'),
    ).toBe(false);
  });
});
