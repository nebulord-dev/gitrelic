// @vitest-environment node
// Node-side check: reads files from disk, so it runs outside happy-dom.

import { readFileSync } from 'node:fs';
import { readPalette, THEMES } from '@gitrelic/scene';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  new URL('../src/styles/tokens.css', import.meta.url),
  'utf8',
);

/** `--token: value;` pairs declared in `:root[data-theme='<theme>'] { … }`. */
function tokens(theme: string): Map<string, string> {
  const block = css.match(
    new RegExp(String.raw`:root\[data-theme='${theme}'\]\s*\{([^}]*)\}`),
  );
  if (!block) throw new Error(`tokens.css has no block for ${theme}`);
  return new Map(
    [...block[1].matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}

describe.each(THEMES)('%s theme on the canvas', (theme) => {
  it('gives every colour role a value the renderer can parse', () => {
    const values = tokens(theme);
    const palette = readPalette((role) => values.get(role) ?? '');
    expect(palette['--accent'].a).toBe(1);
  });
});
