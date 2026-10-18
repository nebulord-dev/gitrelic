import { CATALOG } from '@gitrelic/scene';
import { describe, expect, it } from 'vitest';

import { PRESETS } from './registry';

// Atlas navigates by scene's CATALOG and deep-links back here with
// #preset=<id>, so the two lists must name the same presets the same way.
describe('scene catalog ↔ classic presets', () => {
  it('covers exactly the classic presets', () => {
    expect(CATALOG.map((e) => e.id).sort()).toEqual(
      Object.keys(PRESETS).sort(),
    );
  });

  it.each(CATALOG.map((e) => [e.id, e] as const))(
    '%s matches label, group and docs',
    (id, entry) => {
      const preset = PRESETS[id as keyof typeof PRESETS];
      expect(entry.label).toBe(preset.label);
      expect(entry.group).toBe(preset.group);
      expect(entry.docsPath).toBe(preset.docsPath);
    },
  );
});
