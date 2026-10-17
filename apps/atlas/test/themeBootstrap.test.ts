// @vitest-environment node
// Node-side check: reads files from disk, so it runs outside happy-dom.

import { readFileSync } from 'node:fs';
import { THEMES } from '@gitrelic/scene';
import { describe, expect, it } from 'vitest';

// index.html applies the saved theme before the bundle loads. It can't import
// theme.ts, so run its inline script against fakes to keep the two in step.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
// Plain slicing, not a regex: this reads our own file, it doesn't filter HTML.
const open = html.indexOf('<script>');
const inline =
  open === -1
    ? ''
    : html.slice(open + '<script>'.length, html.indexOf('</script>', open));

function boot(stored: string | null, opts: { throws?: boolean } = {}) {
  const documentElement = { dataset: { theme: 'flat' } };
  const localStorage = {
    getItem(key: string) {
      if (opts.throws) throw new Error('SecurityError');
      // Same key as src/lib/state/theme.ts (pinned in theme.test.ts too).
      return key === 'gitrelic-atlas-theme' ? stored : null;
    },
  };
  new Function('localStorage', 'document', inline)(localStorage, {
    documentElement,
  });
  return documentElement.dataset.theme;
}

describe('pre-paint theme script', () => {
  it('exists', () => {
    expect(inline).toContain('localStorage');
  });

  it.each(THEMES)('applies a saved %s theme', (theme) => {
    expect(boot(theme)).toBe(theme);
  });

  it('keeps the default for a missing, invalid or unreadable value', () => {
    expect(boot(null)).toBe('flat');
    expect(boot('neon')).toBe('flat');
    expect(boot('glow', { throws: true })).toBe('flat');
  });
});
