import { DEFAULT_THEME, isThemeName, type ThemeName } from '@gitrelic/scene';

const STORAGE_KEY = 'gitrelic-atlas-theme';

// Storage can be missing or throw (private windows, blocked site data); the
// theme then falls back to the default and simply isn't remembered.
export function initialTheme(
  storage: Storage | undefined = globalThis.localStorage,
): ThemeName {
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    if (isThemeName(stored)) return stored;
  } catch {
    // fall through to the default
  }
  return DEFAULT_THEME;
}

export function rememberTheme(
  theme: ThemeName,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(STORAGE_KEY, theme);
  } catch {
    // not remembered; harmless
  }
}
