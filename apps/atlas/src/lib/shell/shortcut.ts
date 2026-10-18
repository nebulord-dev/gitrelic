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
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k')
    return true;
  if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return false;
  const target = e.target as HTMLElement | null;
  const typing =
    target?.isContentEditable ||
    target?.tagName === 'INPUT' ||
    target?.tagName === 'TEXTAREA' ||
    target?.tagName === 'SELECT';
  return !typing;
}
