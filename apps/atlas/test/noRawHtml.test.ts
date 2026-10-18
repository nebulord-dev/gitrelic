// @vitest-environment node
// Node-side check: reads files from disk, so it runs outside happy-dom.

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Report data is attacker-influenced (commit messages, author names, file
// paths). Svelte escapes text interpolation, so the only ways to inject
// markup are these. Ban them in app code outright.
const RAW_HTML = /\{@html\b|\.innerHTML\b|\.outerHTML\b|insertAdjacentHTML/;

const src = fileURLToPath(new URL('../src', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(svelte|ts)$/.test(entry.name) && !entry.name.endsWith('.test.ts')
      ? [full]
      : [];
  });
}

describe('raw HTML ban', () => {
  it('finds source files to scan', () => {
    expect(sourceFiles(src).some((f) => f.endsWith('.svelte'))).toBe(true);
  });

  it.each(sourceFiles(src).map((f) => [path.relative(src, f), f]))(
    '%s',
    (_, file) => {
      expect(readFileSync(file, 'utf8')).not.toMatch(RAW_HTML);
    },
  );
});
