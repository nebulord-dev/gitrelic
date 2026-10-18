import { ids } from '@gitrelic/scene';
import { describe, expect, it, vi } from 'vitest';

import { stageClick } from './stageClick';

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

const hotspots = ids.analyzer('hotspots');
const churn = ids.analyzer('churn');

describe('stageClick', () => {
  it('arms a lens dot on the first click and opens it on the second', () => {
    const first = stageClick(null, null, hotspots);
    expect(first).toEqual({ open: null, armed: hotspots });
    expect(stageClick(first.armed, hotspots, hotspots)).toEqual({
      open: 'hotspots',
      armed: null,
    });
  });

  it('never opens a lens the stage did not arm (inspector, palette, Back)', () => {
    // Selected elsewhere: nothing armed, so this click only arms.
    expect(stageClick(null, hotspots, hotspots)).toEqual({
      open: null,
      armed: hotspots,
    });
  });

  it('never leaves for classic from the stage', () => {
    expect(stageClick(churn, churn, churn)).toEqual({
      open: null,
      armed: churn,
    });
  });

  it('disarms on anything that is not a lens', () => {
    expect(stageClick(hotspots, hotspots, ids.file('a.ts')).armed).toBeNull();
    expect(stageClick(hotspots, hotspots, null).armed).toBeNull();
  });
});
