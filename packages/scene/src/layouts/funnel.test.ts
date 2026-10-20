import { describe, expect, it } from 'vitest';

import {
  BUILD_HIR,
  FLAGS_WWW,
  fixRateCommits,
  fixRateReport,
  hashOf,
  PIPELINE,
  RUNNER,
} from '../../test/fixRateReport';
import { fixRateOf } from '../fixRate/points';
import { ids } from '../ids';
import { checkScene, type Mark, type Scene } from '../model';
import { funnelScene } from './funnel';

const viewport = { width: 1200, height: 800 };
const data = fixRateOf(fixRateReport());
const scene = funnelScene({ data }, viewport);
const markOf = (s: Scene, id: string): Mark => {
  const m = s.marks.find((x) => x.id === id);
  if (!m) throw new Error(`no mark ${id}`);
  return m;
};

describe('funnelScene', () => {
  it('is a sound scene', () => {
    expect(checkScene(scene)).toEqual([]);
  });

  it('names the files above chance, on the accent, and only them', () => {
    const labelled = scene.marks.filter(
      (m) => m.id.startsWith('file:') && m.label,
    );
    expect(labelled.map((m) => m.label).sort()).toEqual(
      ['BuildHIR.ts', 'Pipeline.ts', 'runner.ts'].sort(),
    );
    for (const m of labelled) expect(m.paint).toBe('--risk-3');
    expect(markOf(scene, ids.file(FLAGS_WWW)).paint).toBe('--risk-1');
  });

  it('puts higher rates higher, and more changes further right', () => {
    const runner = markOf(scene, ids.file(RUNNER));
    const pipeline = markOf(scene, ids.file(PIPELINE));
    expect(runner.y).toBeLessThan(pipeline.y);
    expect(runner.x).toBeLessThan(pipeline.x);
  });

  it('lays the files with no fix on a floor under the plot', () => {
    const floor = ['a', 'b', 'c', 'd'].map((f) =>
      markOf(scene, ids.file(`packages/react/src/${f}.js`)),
    );
    const flags = markOf(scene, ids.file(FLAGS_WWW));
    for (const m of floor) {
      expect(m.y).toBeGreaterThan(flags.y);
      expect(m.paint).toBe('--risk-0');
    }
    // Two at 8 changes: one column, stacked.
    const [a, b] = floor;
    expect(a.x).toBe(b.x);
    expect(a.y).not.toBe(b.y);
  });

  it('shades what chance allows, narrowing as changes grow', () => {
    const band = scene.marks.filter((m) => m.id.startsWith('band:'));
    expect(band.length).toBeGreaterThan(10);
    // 1 of 8 is 12.5%; 2 of 25 is 8%: the band's top drops.
    expect(markOf(scene, 'band:8').h).toBeGreaterThan(
      markOf(scene, 'band:25').h,
    );
    expect(markOf(scene, 'band:8').tip).toEqual([
      'What chance gives at a 1.2% repo rate',
      'Up to 1 of 8 changes fixed',
    ]);
    // Every file above chance sits above the band at its size.
    for (const f of [RUNNER, PIPELINE, BUILD_HIR]) {
      const m = markOf(scene, ids.file(f));
      const pt = data.points.find((p) => p.file === f)!;
      const bar = markOf(scene, `band:${pt.changes}`);
      expect(m.y).toBeLessThan(bar.y - bar.h / 2);
    }
  });

  it('says what a dot scored and what chance allows', () => {
    expect(markOf(scene, ids.file(RUNNER)).tip).toEqual([
      'runner.ts',
      '3 of 8 changes fixed within 30 days',
      'Chance allows up to 1 at this size: above chance',
      'Latest fix: [compiler][snap] Fixes to relative path resolution',
    ]);
  });

  it('notes how many files are too new to rate, under the x axis name', () => {
    const axis = markOf(scene, 'axis:x');
    expect(axis.labelSub).toBe(
      '1,169 files have fewer than 8 changes old enough to rate',
    );
    expect(axis.labelAnchor).toBe('center');
  });

  it('starts the y axis name at the plot’s left edge', () => {
    const y = markOf(scene, 'axis:y');
    expect(y.labelAnchor).toBe('right');
    const grid = scene.guides.find((g) => g.id.startsWith('grid:y:'));
    expect(grid?.kind === 'line' && grid.x1).toBe(y.x);
  });

  it('opens the selected file’s fix chain, with arcs to what each fix repaired', () => {
    const chain = funnelScene(
      { data, focus: ids.file(RUNNER), commits: fixRateCommits() },
      viewport,
    );
    expect(checkScene(chain)).toEqual([]);
    const runner = markOf(chain, ids.file(RUNNER));
    // The plot narrows to make room.
    expect(markOf(chain, ids.file(PIPELINE)).x).toBeLessThan(
      markOf(scene, ids.file(PIPELINE)).x,
    );
    const lane = chain.marks.filter((m) => m.id.startsWith('change:'));
    // Eleven commits touch it; all on one line, right of the plot.
    expect(lane).toHaveLength(11);
    for (const m of lane) expect(m.x).toBeGreaterThan(runner.x);
    const h = (k: number) => hashOf(k).slice(0, 12);
    expect(chain.links.map((l) => l.id).sort()).toEqual(
      [
        `repair:${h(109)}:${h(102)}`,
        `repair:${h(109)}:${h(105)}`,
        `repair:${h(110)}:${h(104)}`,
      ].sort(),
    );
    const fix = markOf(chain, `change:${h(109)}`);
    expect(fix).toMatchObject({ shape: 'ring', paint: '--accent' });
    expect(fix.tip?.[0]).toBe(
      '[compiler][snap] Fixes to relative path resolution',
    );
    expect(markOf(chain, `change:${h(102)}`).paint).toBe('--risk-3');
    // Day 300 of a window ending on day 320: too recent to rate.
    expect(markOf(chain, `change:${h(111)}`).alpha).toBeLessThan(1);
    expect(markOf(chain, `change:${h(101)}`).alpha).toBe(1);
    expect(markOf(chain, 'lane:title').label).toBe(
      'runner.ts — 3 of 8 changes fixed within 30 days',
    );
  });

  it('opens no chain for a file it doesn’t rate, or before commits load', () => {
    for (const s of [
      funnelScene(
        { data, focus: ids.file('nope.ts'), commits: fixRateCommits() },
        viewport,
      ),
      funnelScene({ data, focus: ids.file(RUNNER), commits: null }, viewport),
    ])
      expect(s.marks.some((m) => m.id.startsWith('change:'))).toBe(false);
  });

  it('says so for a report from before fix rate', () => {
    const old = funnelScene(
      {
        data: fixRateOf(
          fixRateReport([], { windowDays: 0, minChanges: 0, rate: null }),
        ),
      },
      viewport,
    );
    expect(checkScene(old)).toEqual([]);
    expect(old.marks.map((m) => m.label)).toEqual([
      'This report predates fix rate; re-run gitrelic.',
    ]);
  });

  it('says so when no file has enough changes', () => {
    const none = funnelScene({ data: fixRateOf(fixRateReport([])) }, viewport);
    expect(none.marks.map((m) => m.label)).toEqual([
      'No file has 8 changes older than 30 days yet.',
    ]);
  });
});
