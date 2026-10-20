import { describe, expect, it } from 'vitest';

import {
  CATALOG,
  catalogEntry,
  classicUrl,
  defaultLens,
  docsUrl,
  isPresetGroup,
  lensesOf,
  PRESET_GROUPS,
} from './catalog';

describe('catalog', () => {
  // Classic's 23 presets, less those merged into an Atlas lens (ATLAS_MERGES
  // in apps/web's catalogParity.test.ts): Risk into cursed-files.
  it('lists 22 presets with unique ids, each in a known group', () => {
    expect(CATALOG).toHaveLength(22);
    expect(new Set(CATALOG.map((e) => e.id)).size).toBe(22);
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

  it("lists each view's lenses and picks a default only from Atlas views", () => {
    expect(lensesOf('code-health').map((e) => e.id)).toEqual([
      'hotspots',
      'churn',
      'cursed-files',
      'dead-code',
      'blast-radius',
      'complexity-trend',
      'age-map',
      'rewrite-ratio',
      'shame',
    ]);
    // Overview's Repo map is the first Atlas lens; views without one have none.
    expect(defaultLens('overview')).toBe('overview');
    expect(defaultLens('structure')).toBeNull();
    expect(isPresetGroup('structure')).toBe(true);
    expect(isPresetGroup('hotspots')).toBe(false);
    expect(isPresetGroup('__proto__')).toBe(false);
  });
});
