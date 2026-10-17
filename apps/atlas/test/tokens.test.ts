// @vitest-environment node
// Node-side check: reads files from disk, so it runs outside happy-dom.

import { readFileSync } from 'node:fs';
import { THEME_TOKENS, THEMES } from '@gitrelic/scene';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  new URL('../src/styles/tokens.css', import.meta.url),
  'utf8',
);

/** Custom properties declared directly in `:root[data-theme='<theme>'] { … }`. */
function declared(theme: string): string[] {
  const block = css.match(
    new RegExp(String.raw`:root\[data-theme='${theme}'\]\s*\{([^}]*)\}`),
  );
  if (!block) throw new Error(`tokens.css has no block for ${theme}`);
  return [...block[1].matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((m) => m[1]);
}

describe.each(THEMES)('%s theme', (theme) => {
  it('defines exactly the shared token set', () => {
    expect(declared(theme).sort()).toEqual([...THEME_TOKENS].sort());
  });
});
