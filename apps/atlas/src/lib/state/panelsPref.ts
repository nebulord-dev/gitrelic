// The picture's collapsible panels the viewer keeps open (Mark.toggles keys,
// like the dashboard's calm lenses). A viewer preference, like the
// inspector's: localStorage, never the URL. Storage can be missing, throw or
// hold junk; every panel then starts closed and the choice simply isn't
// remembered.

const STORAGE_KEY = 'gitrelic-atlas-panels';

export function initialPanels(
  storage: Storage | undefined = globalThis.localStorage,
): ReadonlySet<string> {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '[]');
    return new Set(
      Array.isArray(saved)
        ? saved.filter((k): k is string => typeof k === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

export function rememberPanels(
  open: ReadonlySet<string>,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify([...open]));
  } catch {
    // not remembered; harmless
  }
}
