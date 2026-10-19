import { describe, expect, it } from 'vitest';

import commitsJson from '../../test/fixtures/commits.small.json';
import reportJson from '../../test/fixtures/report.small.json';
import { churnRhythm, type Rhythm } from '../churn/rhythm';
import { fromCommitIndex } from '../commits/commitLike';
import { checkScene } from '../model';
import { rhythmScene, rhythmTip } from './rhythm';
import type { CommitIndex, GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const commits = fromCommitIndex(commitsJson as unknown as CommitIndex);
const viewport = { width: 1200, height: 800 };
const rhythm = churnRhythm(report, commits);
const sceneOf = (r: Rhythm = rhythm) => rhythmScene(r, viewport);
const mark = (scene: ReturnType<typeof rhythmScene>, id: string) =>
  scene.marks.find((m) => m.id === id);

/** The fixture's rhythm with api, config and auth in one lockstep group. */
function locked(): Rhythm {
  const groups = [['src/api.ts', 'src/config.ts', 'src/auth.ts']];
  return {
    ...rhythm,
    groups,
    rows: rhythm.rows.map((r) => ({
      ...r,
      group: groups[0].includes(r.file.file) ? 0 : null,
    })),
  };
}

describe('rhythmScene', () => {
  it('is a sound scene', () => {
    expect(checkScene(sceneOf())).toEqual([]);
    expect(checkScene(sceneOf(locked()))).toEqual([]);
  });

  it('keeps each file’s dot, in row order down the left', () => {
    const scene = sceneOf();
    const helpers = mark(scene, 'file:src/helpers.ts')!;
    const index = mark(scene, 'file:src/index.ts')!;
    expect(helpers).toMatchObject({
      shape: 'dot',
      paint: '--risk-3',
      label: 'helpers.ts',
    });
    expect(index.x).toBe(helpers.x);
    expect(index.y).toBeGreaterThan(helpers.y);
  });

  it('draws a bar per week with commits, taller for more', () => {
    const scene = sceneOf();
    const weeks = scene.marks.filter((m) =>
      m.id.startsWith('wk:src/helpers.ts:'),
    );
    // 00000011202001: five weeks with commits.
    expect(weeks.map((m) => m.id.split(':').pop())).toEqual([
      '6',
      '7',
      '8',
      '10',
      '13',
    ]);
    const one = mark(scene, 'wk:src/helpers.ts:6')!;
    const two = mark(scene, 'wk:src/helpers.ts:8')!;
    expect(two.h).toBeCloseTo(one.h * 2);
    // Bars stand on a common floor and grow out of the file.
    expect(two.y + two.h / 2).toBeCloseTo(one.y + one.h / 2);
    expect(one.parent).toBe('file:src/helpers.ts');
    expect(one.x).toBeLessThan(two.x);
  });

  it('sets lines deleted against added on one axis', () => {
    const scene = sceneOf();
    const added = mark(scene, 'added:src/helpers.ts')!;
    const deleted = mark(scene, 'deleted:src/helpers.ts')!;
    // Added grows right of the axis, deleted left; 20 added against 7.
    expect(added.x - added.w / 2).toBeCloseTo(deleted.x + deleted.w / 2);
    expect(added.w).toBeGreaterThan(deleted.w);
    expect(added.paint).toBe('--accent');
    // Nothing deleted, no deleted bar.
    expect(mark(scene, 'deleted:src/types.ts')).toBeUndefined();
    expect(mark(scene, 'trait:src/api.ts')!.label).toBe('growing');
  });

  it('splits the window in half', () => {
    const halves = sceneOf().guides.find((g) => g.id === 'halves');
    const week7 = mark(sceneOf(), 'wk:src/helpers.ts:7')!;
    expect(halves?.kind === 'line' && halves.x1 <= week7.x).toBe(true);
    expect(mark(sceneOf(), 'halves-label')!.label).toBe('recent half');
  });

  it('labels quarter starts along the bottom', () => {
    const ticks = sceneOf()
      .marks.filter((m) => m.id.startsWith('tick:w:'))
      .map((m) => m.label);
    // Dec 29 opens the window and January starts a quarter; February and
    // March don't. The last week starts Mar 30, so April never shows.
    expect(ticks).toEqual(['Dec 25', 'Jan 26']);
  });

  it('ties lockstep rows together down the margin', () => {
    const scene = sceneOf(locked());
    expect(mark(scene, 'lock:src/api.ts')).toMatchObject({ shape: 'ring' });
    expect(mark(scene, 'lock:src/helpers.ts')).toBeUndefined();
    expect(scene.links.map((l) => l.id)).toEqual([
      'lock-link:src/api.ts:src/config.ts',
      'lock-link:src/config.ts:src/auth.ts',
    ]);
    expect(sceneOf().links).toEqual([]);
  });

  it('shows the file’s tooltip anywhere on its row', () => {
    const scene = sceneOf();
    const row = mark(scene, 'row:src/helpers.ts')!;
    expect(row.tip).toEqual(mark(scene, 'file:src/helpers.ts')!.tip);
    expect(row.tip).toEqual([
      'helpers.ts',
      '7 commits · 6 in the recent half',
      '+20 −7 lines',
      'tweaking',
    ]);
    expect(rhythmTip({ ...rhythm.rows[0], recent: 1 }, 'h')[1]).toBe(
      '7 commits · 1 in the recent half',
    );
  });

  it('draws rows but no weeks without commits', () => {
    const scene = sceneOf(churnRhythm(report, []));
    expect(checkScene(scene)).toEqual([]);
    expect(scene.marks.some((m) => m.id.startsWith('wk:'))).toBe(false);
    expect(mark(scene, 'file:src/helpers.ts')).toBeDefined();
  });
});
