import { ids } from '@gitrelic/scene';
import { describe, expect, it, vi } from 'vitest';

import { palettePick } from './palettePick';

// Pretend Hotspots has an Atlas view; Churn doesn't.
vi.mock('@gitrelic/scene', async (importOriginal) => {
  const scene = await importOriginal<typeof import('@gitrelic/scene')>();
  return {
    ...scene,
    catalogEntry: (id: string) => {
      const e = scene.catalogEntry(id);
      return e && { ...e, atlas: id === 'hotspots' };
    },
  };
});

describe('palettePick', () => {
  it('opens an analyzer that has an Atlas view', () => {
    expect(palettePick(ids.analyzer('hotspots'))).toEqual({
      lens: 'hotspots',
      select: null,
    });
  });

  it('selects an analyzer only classic draws', () => {
    expect(palettePick(ids.analyzer('churn'))).toBeNull();
  });

  it('selects files and people', () => {
    expect(palettePick(ids.file('src/a.ts'))).toBeNull();
    expect(palettePick(ids.person('a@example.com'))).toBeNull();
  });

  it('opens the Overview with a view selected, so its fan opens', () => {
    const view = ids.view('structure');
    expect(palettePick(view)).toEqual({ lens: 'overview', select: view });
  });
});
