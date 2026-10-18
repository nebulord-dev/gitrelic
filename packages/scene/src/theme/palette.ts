// The canvas can't use CSS variables, so a theme's colour roles are read into
// a Palette of RGBA values. The token reader is passed in: Atlas reads
// computed styles, tests read tokens.css.

import { COLOR_ROLES, type ColorRole } from '../model';
import { parseColor, type Palette, type Rgba } from '../motion/interp';

/**
 * Builds a palette from a token reader. Throws, naming the tokens, if any
 * role is missing or isn't a colour the parser understands.
 */
export function readPalette(read: (token: ColorRole) => string): Palette {
  const palette = {} as Record<ColorRole, Rgba>;
  const bad: string[] = [];
  for (const role of COLOR_ROLES) {
    const value = read(role);
    const color = parseColor(value);
    if (color) palette[role] = color;
    else bad.push(`${role}: ${JSON.stringify(value)}`);
  }
  if (bad.length > 0) {
    throw new Error(`Theme colours the canvas can't read — ${bad.join(', ')}`);
  }
  return palette;
}
