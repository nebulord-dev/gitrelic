import { describe, expect, it } from 'vitest';

import {
  CATALOG,
  catalogEntry,
  classicUrl,
  docsUrl,
  PRESET_GROUPS,
} from './catalog';

describe('catalog', () => {
  it('lists 23 presets with unique ids, each in a known group', () => {
    expect(CATALOG).toHaveLength(23);
    expect(new Set(CATALOG.map((e) => e.id)).size).toBe(23);
    const groups = new Set<string>(PRESET_GROUPS.map((g) => g.id));
    for (const entry of CATALOG) expect(groups.has(entry.group)).toBe(true);
  });

  it('keeps each group contiguous, in group order (rail order)', () => {
    const order = PRESET_GROUPS.map((g) => g.id);
    const seen = CATALOG.map((e) => order.indexOf(e.group));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it('explains every preset in a sentence', () => {
    for (const entry of CATALOG) expect(entry.explain).toMatch(/^[A-Z].+[.]$/);
  });

  it('builds docs and classic links', () => {
    const churn = catalogEntry('churn');
    expect(churn && docsUrl(churn)).toBe(
      'https://nebulord-dev.github.io/gitrelic/analyzers/churn',
    );
    const coupling = catalogEntry('coupling');
    expect(coupling && docsUrl(coupling)).toBeNull();
    expect(classicUrl('dead-code')).toBe('/classic/#preset=dead-code');
    expect(catalogEntry('nope')).toBeUndefined();
  });
});
