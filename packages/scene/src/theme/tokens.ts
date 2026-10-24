// The theme contract. Every name here must be defined by each Atlas theme
// (apps/atlas/src/styles/tokens.css, checked by a test there), so a view or
// the renderer can read any role without knowing which theme is active.

export const THEMES = ['glow', 'flat'] as const;
export type ThemeName = (typeof THEMES)[number];

export const DEFAULT_THEME: ThemeName = 'flat';

export function isThemeName(value: unknown): value is ThemeName {
  return (THEMES as readonly unknown[]).includes(value);
}

export const THEME_TOKENS = [
  // Surfaces and text
  '--bg',
  '--text',
  '--soft',
  '--muted',
  '--panel-bg',
  '--panel-border',
  '--panel-radius',
  '--card-bg',
  '--card-border',
  '--card-radius',
  '--card-shadow',
  '--modal-bg',
  '--control-border',
  '--chip-radius',
  '--font-body',
  // Emphasis
  '--accent',
  '--accent-ink',
  '--selected-glow',
  // Entity kinds
  '--person',
  '--file',
  '--dir',
  '--ghost',
  // Marks and links
  '--link',
  '--link-hot',
  '--cell-base',
  '--risk-0',
  '--risk-1',
  '--risk-2',
  '--risk-3',
  // Owners (the Ownership lens): six people, everyone else is --ghost
  '--owner-0',
  '--owner-1',
  '--owner-2',
  '--owner-3',
  '--owner-4',
  '--owner-5',
] as const;
export type ThemeToken = (typeof THEME_TOKENS)[number];
