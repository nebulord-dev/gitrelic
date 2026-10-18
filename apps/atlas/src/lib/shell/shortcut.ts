// The palette shortcut, spelled the way the viewer's platform spells it.

export function isMac(
  platform: string = globalThis.navigator?.platform ?? '',
): boolean {
  return /mac|iphone|ipad/i.test(platform);
}

export function paletteShortcut(platform?: string): string {
  return isMac(platform) ? '⌘K' : 'Ctrl K';
}

/** ⌘K / Ctrl+K anywhere, or `/` when not typing into a field. */
export function opensPalette(e: KeyboardEvent): boolean {
  // The physical KeyK counts only when the layout types no Latin letter
  // there (Cyrillic, Greek): on Colemak or Dvorak that key is E or T, and
  // Ctrl+E / Ctrl+T belong to the browser. Shift is left alone too:
  // Ctrl+Shift+K is Firefox's console.
  const k = e.key.toLowerCase();
  const isK = k === 'k' || (!/^[a-z]$/.test(k) && e.code === 'KeyK');
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && isK) return true;
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return false;
  const target = e.target as HTMLElement | null;
  const typing =
    target?.isContentEditable ||
    target?.tagName === 'INPUT' ||
    target?.tagName === 'TEXTAREA' ||
    target?.tagName === 'SELECT';
  return !typing;
}
