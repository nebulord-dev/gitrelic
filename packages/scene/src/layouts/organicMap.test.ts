import { describe, expect, it, vi } from 'vitest';

import {
  manyPackagesReport,
  ownershipReport,
} from '../../test/ownershipReport';
import { checkScene } from '../model';
import { normalizeReport } from '../report/normalizeReport';
import { organicMapScene, strength } from './organicMap';
import { voronoiTreemap } from './voronoiTreemap';
import type { Mark } from '../model';

// The real treemap, counted, to check the layout computes it once per report.
vi.mock('./voronoiTreemap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./voronoiTreemap')>();
  return { ...actual, voronoiTreemap: vi.fn(actual.voronoiTreemap) };
});

const viewport = { width: 1200, height: 800 };
const build = (focus: string | null = null) =>
  organicMapScene(
    { report: ownershipReport(), commits: null, focus },
    viewport,
  );
const byId = (marks: Mark[], id: string) => marks.find((m) => m.id === id)!;

describe('organicMapScene', () => {
  const scene = build();

  it('draws a sound scene', () => {
    expect(checkScene(scene)).toEqual([]);
  });

  it('draws one cell per mapped package, as dir: polygons', () => {
    const cells = scene.marks.filter((m) => m.id.startsWith('dir:'));
    expect(cells.map((m) => m.id)).toEqual([
      'dir:packages/server',
      'dir:packages/client',
      'dir:packages/shared',
    ]);
    for (const c of cells) {
      expect(c.shape).toBe('poly');
      expect(c.pts!.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('sizes cells by commits', () => {
    const area = (m: Mark) => m.w * m.h;
    expect(area(byId(scene.marks, 'dir:packages/server'))).toBeGreaterThan(
      area(byId(scene.marks, 'dir:packages/shared')),
    );
  });

  it('colors a cell by its top contributor, as strongly as their share', () => {
    // ann tops server with 88%: her color, full strength.
    expect(byId(scene.marks, 'dir:packages/server').paint).toEqual({
      mix: ['--ghost', '--owner-0'],
      t: 1,
    });
    // shared's top has 21%: cy's color, faint.
    expect(byId(scene.marks, 'dir:packages/shared').paint).toEqual({
      mix: ['--ghost', '--owner-2'],
      t: 0.3,
    });
  });

  it('outlines a quiet top contributor’s cell, selecting the package', () => {
    const quiet = byId(scene.marks, 'quiet:packages/client');
    expect(quiet).toMatchObject({
      shape: 'poly',
      edge: 'dashed',
      selects: 'dir:packages/client',
      parent: 'dir:packages/client',
    });
    expect(scene.marks.some((m) => m.id === 'quiet:packages/server')).toBe(
      false,
    );
  });

  it('labels a cell with its name, then its top contributor and share', () => {
    const server = byId(scene.marks, 'dir:packages/server');
    expect(server.label).toBe('server');
    expect(server.labelSub).toBe('Lee 88%');
    expect(server.tip?.[0]).toBe('packages/server');
    expect(server.tip).toContain('Rests on one person');
  });

  it('dims the packages a selected person doesn’t top', () => {
    const s = build('person:ann@example.com');
    expect(byId(s.marks, 'dir:packages/server').alpha).toBe(1);
    expect(byId(s.marks, 'dir:packages/client').alpha).toBeLessThan(1);
  });

  it('keeps its shape between builds', () => {
    expect(build().marks).toEqual(scene.marks);
  });

  it('computes the treemap once per report, then scales it to the viewport', () => {
    const report = ownershipReport();
    const at = (focus: string | null, vp: typeof viewport) =>
      organicMapScene({ report, commits: null, focus }, vp);
    vi.mocked(voronoiTreemap).mockClear();
    at(null, { width: 600, height: 400 });
    at('person:ann@example.com', viewport);
    const scaled = at(null, viewport);
    expect(voronoiTreemap).toHaveBeenCalledTimes(1);
    // The scaled cells match a fresh report's, computed at this size.
    const fresh = build();
    expect(scaled.marks.map((m) => m.id)).toEqual(fresh.marks.map((m) => m.id));
    scaled.marks.forEach((m, i) => {
      const f = fresh.marks[i];
      for (const k of ['x', 'y', 'w', 'h'] as const)
        expect(m[k]).toBeCloseTo(f[k], 6);
    });
  });

  it('draws at most the busiest 60 packages', () => {
    const s = organicMapScene(
      { report: manyPackagesReport(70), commits: null },
      viewport,
    );
    expect(s.marks.filter((m) => m.id.startsWith('dir:'))).toHaveLength(60);
    expect(checkScene(s)).toEqual([]);
  });

  it('says what to do with a report from before the lens', () => {
    const s = organicMapScene(
      { report: normalizeReport({}), commits: null },
      viewport,
    );
    expect(s.marks).toEqual([]);
    expect(s.guides[0]).toMatchObject({
      kind: 'text',
      text: 'Rerun gitrelic to see who owns what.',
    });
  });
});

describe('strength', () => {
  it('runs from faint at 30% and under to full at 75% and over', () => {
    expect(strength(10)).toBe(0.3);
    expect(strength(25)).toBe(0.3);
    expect(strength(75)).toBe(1);
    expect(strength(100)).toBe(1);
    expect(strength(50)).toBeCloseTo(0.65, 9);
  });
});
