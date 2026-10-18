// Reads the active theme's colour roles off the document for the canvas.
// The renderer re-reads on a theme switch and tweens every mark to the new
// palette (TweenEngine.repaint).

import { readPalette, type Palette } from '@gitrelic/scene';

/** The palette of whichever theme `<html data-theme>` currently applies. */
export function paletteFromDocument(
  root: Element = document.documentElement,
): Palette {
  const style = getComputedStyle(root);
  return readPalette((token) => style.getPropertyValue(token));
}
