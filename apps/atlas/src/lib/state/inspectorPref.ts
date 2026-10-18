// Whether the viewer keeps the inspector collapsed to its strip. A viewer
// preference, like the theme: localStorage, never the URL. Storage can be
// missing or throw (private windows, blocked site data); the inspector then
// starts open and the choice simply isn't remembered.

const STORAGE_KEY = 'gitrelic-atlas-inspector';

export function initialCollapsed(
  storage: Storage | undefined = globalThis.localStorage,
): boolean {
  try {
    return storage?.getItem(STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

export function rememberCollapsed(
  collapsed: boolean,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'open');
  } catch {
    // not remembered; harmless
  }
}
