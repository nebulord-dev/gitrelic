import { CATALOG } from '@gitrelic/scene';
import { describe, expect, it } from 'vitest';

import { PRESETS } from './registry';

// Atlas navigates by scene's CATALOG and deep-links back here with
// #preset=<id>, so the two lists must name the same presets the same way —
// except where Atlas's lens is a different picture under a deliberate new
// name (docs/atlas-views.md records each).
const ATLAS_RENAMES: Record<string, string> = {
  overview: 'Repo map',
  'cursed-files': 'Risk',
  'co-authors': 'AI & Co-authors',
};

// A classic preset folded into an Atlas lens leaves the catalog: Atlas has
// no tab for it, and classic still serves it at /classic/#preset=<id>.
const ATLAS_MERGES: Record<string, string> = {
  risk: 'cursed-files',
  shame: 'fix-rate',
};

// Lenses only Atlas has: no classic preset to match, and none may appear.
const ATLAS_ONLY = new Set(['fix-rate']);

describe('scene catalog ↔ classic presets', () => {
  it('covers exactly the classic presets, less the merged ones', () => {
    expect(
      CATALOG.map((e) => e.id)
        .filter((id) => !ATLAS_ONLY.has(id))
        .sort(),
    ).toEqual(
      Object.keys(PRESETS)
        .filter((id) => !(id in ATLAS_MERGES))
        .sort(),
    );
  });

  it.each(Object.entries(ATLAS_MERGES))(
    '%s merges into %s, a classic preset Atlas draws',
    (from, into) => {
      expect(from in PRESETS).toBe(true);
      expect(CATALOG.find((e) => e.id === into)?.atlas).toBe(true);
    },
  );

  it.each([...ATLAS_ONLY])(
    '%s is Atlas-only: an Atlas lens with no classic preset',
    (id) => {
      expect(id in PRESETS).toBe(false);
      expect(CATALOG.find((e) => e.id === id)?.atlas).toBe(true);
    },
  );

  it.each(
    CATALOG.filter((e) => !ATLAS_ONLY.has(e.id)).map((e) => [e.id, e] as const),
  )('%s matches label, group and docs', (id, entry) => {
    const preset = PRESETS[id as keyof typeof PRESETS];
    expect(entry.label).toBe(ATLAS_RENAMES[id] ?? preset.label);
    expect(entry.group).toBe(preset.group);
    expect(entry.docsPath).toBe(preset.docsPath);
  });
});
