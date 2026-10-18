import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { CATALOG } from '../catalog';
import { buildEntityIndex } from '../entities';
import { ids } from '../ids';
import { checkScene } from '../model';
import { VIEWS } from './index';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const viewport = { width: 1200, height: 800 };

describe('VIEWS', () => {
  it('has a view for exactly the lenses the catalog marks atlas', () => {
    expect([...VIEWS.keys()].sort()).toEqual(
      CATALOG.filter((e) => e.atlas)
        .map((e) => e.id)
        .sort(),
    );
  });

  it('every layout builds a sound scene from the fixture', () => {
    for (const view of VIEWS.values()) {
      for (const layout of view.layouts) {
        const scene = layout.build({ report, commits: null }, viewport);
        expect(checkScene(scene)).toEqual([]);
      }
    }
  });
});

describe('overview ring', () => {
  const ring = VIEWS.get('overview')!.layouts[0];
  const index = buildEntityIndex(report);

  it('fans out the lens named by focus', () => {
    const scene = ring.build(
      { report, commits: null, focus: ids.analyzer('hotspots'), index },
      viewport,
    );
    expect(scene.marks.some((m) => m.parent === ids.analyzer('hotspots'))).toBe(
      true,
    );
  });

  it('draws no fan for any other focus', () => {
    const scene = ring.build(
      { report, commits: null, focus: ids.file('src/api.ts'), index },
      viewport,
    );
    expect(scene.marks.some((m) => m.parent)).toBe(false);
  });
});
