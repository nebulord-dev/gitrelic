import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { buildEntityIndex } from '../entities';
import { ids } from '../ids';
import { checkScene } from '../model';
import { lensReadings, type LensReading } from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import { repoVitals } from '../overview/vitals';
import { dashboardLayout } from '../views/overview';
import {
  COLS,
  dashboardScene,
  openRows,
  packTiles,
  readingWeight,
} from './dashboard';
import type { FannedEntity } from '../overview/topEntities';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const index = buildEntityIndex(report);
const readings = lensReadings(report);
const vitals = repoVitals(report);
const topOf = (preset: string) => lensTopEntities(preset, report, index);

const fanned: FannedEntity[] = [
  { id: ids.file('src/a.ts'), label: 'a.ts', value: 'score 90' },
  { id: ids.file('src/b.ts'), label: 'b.ts', value: 'score 45' },
];
const mark = (scene: ReturnType<typeof dashboardScene>, id: string) =>
  scene.marks.find((m) => m.id === id);

describe('packTiles', () => {
  it('fills row by row, a wide tile taking two columns', () => {
    expect(
      packTiles(
        [
          { w: 2, h: 1 },
          { w: 1, h: 1 },
          { w: 1, h: 1 },
          { w: 1, h: 1 },
        ],
        4,
      ),
    ).toEqual([
      { col: 0, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
      { col: 0, row: 1 },
    ]);
  });

  it('fills the hole a wide tile leaves, as CSS grid dense flow does', () => {
    // Three columns: 1, then a 2-wide that won't fit beside it, then a 1 that does.
    expect(
      packTiles(
        [
          { w: 1, h: 1 },
          { w: 1, h: 1 },
          { w: 2, h: 1 },
          { w: 1, h: 1 },
        ],
        3,
      ),
    ).toEqual([
      { col: 0, row: 0 },
      { col: 1, row: 0 },
      { col: 0, row: 1 },
      { col: 2, row: 0 },
    ]);
  });

  it('keeps a tall tile’s rows for it', () => {
    const [open, next, after] = packTiles(
      [
        { w: 2, h: 2 },
        { w: 2, h: 1 },
        { w: 2, h: 1 },
      ],
      3,
    );
    expect(open).toEqual({ col: 0, row: 0 });
    // Only one column is free beside it: the wide ones go below.
    expect(next).toEqual({ col: 0, row: 2 });
    expect(after).toEqual({ col: 0, row: 3 });
  });
});

describe('readingWeight', () => {
  it('reads a share, else the last number', () => {
    expect(readingWeight('3 of 8 fixed')).toBeCloseTo(0.375, 9);
    expect(readingWeight('3 of 0 fixed')).toBe(0);
    expect(readingWeight('+3,695 lines a month')).toBe(3695);
    expect(readingWeight('1.00 deleted per line added')).toBe(1);
    expect(readingWeight('vmx, gone 182 days')).toBe(182);
    expect(readingWeight('gone quiet')).toBe(0);
  });
});

describe('dashboardScene', () => {
  it('draws the vitals and every lens as a tile, soundly', () => {
    const scene = dashboardScene(vitals, readings, topOf, null);
    expect(checkScene(scene)).toEqual([]);
    expect(
      scene.marks.filter((m) => m.id.startsWith('vital:')).map((m) => m.label),
    ).toEqual([
      'Files',
      'Lines',
      'Commits',
      'Contributors',
      'AI-assisted',
      'Language',
    ]);
    for (const v of scene.marks.filter((m) => m.id.startsWith('vital:')))
      expect(v.labelClass).toBe('atlas-label--vital');
    const tiles = scene.marks.filter((m) => m.id.startsWith('analyzer:'));
    expect(tiles.map((m) => m.id)).toEqual(
      readings.map((r) => ids.analyzer(r.preset)),
    );
    for (const t of tiles)
      expect(t).toMatchObject({ shape: 'card', labelAnchor: 'center' });
    // No lens is open, so nothing is fanned out.
    expect(scene.marks.some((m) => m.id.startsWith('file:'))).toBe(false);
  });

  it('makes a loud lens wide and hot, and splits its reading', () => {
    const graded: LensReading[] = readings.map((r, i) => ({
      ...r,
      grade: i === 0 ? 3 : 0,
      value: i === 0 ? '8 files' : r.value,
    }));
    const scene = dashboardScene(vitals, graded, topOf, null);
    const loud = mark(scene, ids.analyzer(graded[0].preset))!;
    const quiet = mark(scene, ids.analyzer(graded[1].preset))!;
    expect(loud.w).toBeGreaterThan(quiet.w * 2);
    expect(loud).toMatchObject({
      paint: '--risk-3',
      labelClass: 'atlas-label--hot',
      labelLead: '8',
      labelSub: 'files',
    });
    expect(loud.labelPriority).toBeGreaterThan(quiet.labelPriority ?? 0);
  });

  it('heads each view with its name and how many lenses are loud', () => {
    const graded = readings.map((r) => ({
      ...r,
      grade: (r.preset === 'bus-factor' ? 2 : 0) as LensReading['grade'],
    }));
    const scene = dashboardScene(vitals, graded, topOf, null);
    expect(mark(scene, 'section:ownership-risk')).toMatchObject({
      label: 'Ownership & Risk',
      shape: 'card',
      labelSub: '1 outside normal',
      labelClass: 'atlas-label--section-hot',
    });
    expect(mark(scene, 'section:structure')?.labelClass).toBe(
      'atlas-label--section',
    );
    expect(mark(scene, 'section:structure')?.labelSub).toBe(
      'all within normal',
    );
  });

  it('bands each view under its tiles, tinted by its loudest grade', () => {
    const graded = readings.map((r) => ({
      ...r,
      grade: (r.preset === 'bus-factor' ? 3 : 0) as LensReading['grade'],
    }));
    const scene = dashboardScene(vitals, graded, topOf, null);
    const band = mark(scene, 'band:ownership-risk')!;
    expect(band).toMatchObject({ shape: 'bar', paint: '--risk-3', z: 0 });
    expect(band.alpha).toBeLessThan(0.2);
    expect(mark(scene, 'band:structure')?.paint).toBe('--risk-0');
    // It holds every one of the view's tiles.
    for (const r of graded.filter((r) => r.group === 'ownership-risk')) {
      const t = mark(scene, ids.analyzer(r.preset))!;
      expect(t.y - t.h / 2).toBeGreaterThan(band.y - band.h / 2);
      expect(t.y + t.h / 2).toBeLessThan(band.y + band.h / 2);
    }
  });

  it('bars a closed tile’s top entities, the heaviest full height, picking the lens', () => {
    const preset = readings[0].preset;
    const scene = dashboardScene(vitals, readings, () => fanned, null);
    const bars = scene.marks.filter((m) => m.id.startsWith(`spark:${preset}:`));
    expect(bars).toHaveLength(2);
    expect(bars[0].h).toBeCloseTo(2 * bars[1].h, 9);
    for (const b of bars)
      expect(b).toMatchObject({
        shape: 'bar',
        selects: ids.analyzer(preset),
      });
  });

  it('opens a previewed lens in place over its fanned entities, dimming the rest', () => {
    const lens = readings[1];
    const scene = dashboardScene(vitals, readings, topOf, {
      preset: lens.preset,
      entities: fanned,
    });
    expect(checkScene(scene)).toEqual([]);
    const tile = mark(scene, ids.analyzer(lens.preset))!;
    expect(tile.labelClass).toBe('atlas-label--open');
    expect(tile.alpha).toBe(1);
    expect(mark(scene, ids.analyzer(readings[0].preset))!.alpha).toBeLessThan(
      1,
    );
    // Its rows: the entities, by name and reading, under its card, in rank
    // order, each in the fan's slot so a fan in another form morphs into it.
    const rows = fanned.map((e) => mark(scene, e.id)!);
    rows.forEach((row, j) => {
      expect(row).toMatchObject({
        shape: 'card',
        label: fanned[j].label,
        labelSub: fanned[j].value,
        labelClass: 'atlas-label--row',
        parent: tile.id,
        slot: `fan:${j}`,
        w: tile.w,
      });
      expect(row.y).toBeGreaterThan(tile.y + tile.h / 2);
    });
    expect(rows[1].y).toBeGreaterThan(rows[0].y);
    // Open, it has rows, not bars.
    expect(
      scene.marks.some((m) => m.id.startsWith(`spark:${lens.preset}:`)),
    ).toBe(false);
  });

  it('grows an open tile to fit a long list, pushing the views below down', () => {
    const lens = readings.find((r) => r.group === 'code-health')!;
    const long = Array.from({ length: 8 }, (_, i) => ({
      id: ids.file(`src/f${i}.ts`),
      label: `f${i}.ts`,
      value: `score ${90 - i}`,
    }));
    const closed = dashboardScene(vitals, readings, topOf, null);
    const open = dashboardScene(vitals, readings, topOf, {
      preset: lens.preset,
      entities: long,
    });
    expect(openRows(8)).toBeGreaterThan(2);
    expect(checkScene(open)).toEqual([]);
    expect(mark(open, 'section:structure')!.y).toBeGreaterThan(
      mark(closed, 'section:structure')!.y,
    );
    // The last row stays inside the bounds.
    const last = mark(open, long[7].id)!;
    expect(last.y + last.h / 2).toBeLessThan(open.bounds.y + open.bounds.h);
  });

  it('lays out at most COLS tiles across', () => {
    const scene = dashboardScene(vitals, readings, topOf, null);
    const tiles = scene.marks.filter((m) => m.id.startsWith('analyzer:'));
    const rights = tiles.map((t) => t.x + t.w / 2);
    const lefts = tiles.map((t) => t.x - t.w / 2);
    const width = Math.max(...rights) - Math.min(...lefts);
    const narrow = Math.min(...tiles.map((t) => t.w));
    expect(width).toBeLessThan(narrow * (COLS + 1));
  });
});

describe('dashboardLayout', () => {
  it('opens the tile of the lens in focus, and none for a view', () => {
    const preset = readings.find((r) => topOf(r.preset).length > 0)!.preset;
    const build = (focus: string | null) =>
      dashboardLayout.build(
        { report, commits: null, focus, index },
        { width: 1200, height: 800 },
      );
    const opened = build(ids.analyzer(preset));
    expect(mark(opened, ids.analyzer(preset))?.labelClass).toBe(
      'atlas-label--open',
    );
    expect(mark(opened, topOf(preset)[0].id)).toBeDefined();
    const none = build(ids.view('code-health'));
    expect(none.marks.some((m) => m.labelClass === 'atlas-label--open')).toBe(
      false,
    );
    expect(dashboardLayout.focusKinds).not.toContain('view');
  });
});
