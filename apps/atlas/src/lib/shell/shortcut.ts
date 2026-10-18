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
  return pressed(e, '/');
}

/**
 * A single-key shortcut (`/`, `?`, `i`): no Ctrl, ⌘ or Alt, and never while
 * the viewer is typing into a field. Letters match either case.
 */
export function pressed(e: KeyboardEvent, key: string): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.key.toLowerCase() !== key) return false;
  return !isTyping(e.target);
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(
    el?.isContentEditable ||
    el?.tagName === 'INPUT' ||
    el?.tagName === 'TEXTAREA' ||
    el?.tagName === 'SELECT',
  );
}
