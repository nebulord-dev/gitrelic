import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { CATALOG } from '../catalog';
import { buildEntityIndex } from '../entities';
import { ids } from '../ids';
import { checkScene } from '../model';
import { lensReadings } from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import { loudestView } from '../overview/viewHeadlines';
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
  const ring = VIEWS.get('overview')!.layouts.find((l) => l.id === 'ring')!;
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
    // Lenses have their view for a parent; fanned entities have a lens.
    expect(scene.marks.some((m) => m.parent?.startsWith('analyzer:'))).toBe(
      false,
    );
  });
});

describe('overview captions and focus kinds', () => {
  const [fan, ring] = VIEWS.get('overview')!.layouts;

  it('both forms carry a how-to-read caption', () => {
    expect(fan.caption).toMatch(/loudest lens/);
    expect(ring.caption).toMatch(/outside normal/);
  });

  it('the ring ignores a view focus; the fan re-forms around one', () => {
    expect(ring.focusKinds).toEqual(['analyzer', 'file', 'dir', 'person']);
    expect(fan.focusKinds).toContain('view');
  });
});

describe('overview fan', () => {
  const overview = VIEWS.get('overview')!;
  const fan = overview.layouts[0];
  const index = buildEntityIndex(report);
  const build = (focus: string | null) =>
    fan.build({ report, commits: null, focus, index }, viewport);
  const openLenses = (scene: ReturnType<typeof build>) =>
    scene.marks.filter((m) => m.id.startsWith('analyzer:')).map((m) => m.id);

  it('is the primary form, with the ring as its alternate', () => {
    expect(overview.layouts.map((l) => l.id)).toEqual(['fan', 'ring']);
    expect(fan.focusKinds).toContain('view');
  });

  it('opens the loudest view by default, or the one named by focus', () => {
    const readings = lensReadings(report);
    // The fixture's loudest view (loudestView: its top grade, ties to rail order).
    const loudest = 'ownership-risk';
    expect(loudestView(readings)).toBe(loudest);
    const ofView = (v: string) =>
      readings.filter((r) => r.group === v).map((r) => ids.analyzer(r.preset));
    expect(openLenses(build(null))).toEqual(ofView(loudest));
    expect(openLenses(build(ids.view('structure')))).toEqual(
      ofView('structure'),
    );
    // A lens opens its own view.
    expect(openLenses(build(ids.analyzer('bus-factor')))).toEqual(
      ofView('ownership-risk'),
    );
  });

  it('falls back to the loudest view for a focus it does not draw', () => {
    const loudest = build(null);
    expect(openLenses(build(ids.view('overview')))).toEqual(
      openLenses(loudest),
    );
    expect(openLenses(build(ids.file('src/api.ts')))).toEqual(
      openLenses(loudest),
    );
  });

  it('previews a focused lens with its fan', () => {
    // The fixture has entities for Hotspots, so its fan can't be empty.
    expect(lensTopEntities('hotspots', report, index).length).toBeGreaterThan(
      0,
    );
    const scene = build(ids.analyzer('hotspots'));
    expect(scene.marks.some((m) => m.parent === ids.analyzer('hotspots'))).toBe(
      true,
    );
  });
});
