import { describe, expect, it } from 'vitest';

import { parallelReport } from '../../test/parallelReport';
import { ids } from '../ids';
import { checkScene } from '../model';
import { collisions } from '../parallel/collisions';
import { collisionsScene } from './collisions';
import type { GitrelicReport } from '@gitrelic/core';

const VIEWPORT = { width: 1200, height: 800 };
const w = (weekStart: string, authors: string[]) => ({
  weekStart: `${weekStart}T00:00:00.000Z`,
  authors,
  commitCount: authors.length,
});

function report(): GitrelicReport {
  const r = parallelReport();
  r.meta.firstCommit = '2026-01-05T09:00:00Z';
  r.meta.lastCommit = '2026-03-02T09:00:00Z';
  r.parallelDev.files[0].windows = [
    w('2026-01-05', ['ann@x', 'bob@x']),
    w('2026-02-02', ['ann@x', 'bob@x', 'cy@x']),
  ];
  r.parallelDev.files[1].windows = [
    w('2026-01-12', ['bob@x', 'cy@x']),
    w('2026-03-02', ['cy@x', 'dee@x']),
  ];
  return r;
}
const data = collisions(report());
const scene = collisionsScene(data, VIEWPORT);
const dots = (s: typeof scene) =>
  s.marks.filter((m) => m.id.startsWith('collisions-dot:'));

describe('collisionsScene', () => {
  it('is a sound scene', () => {
    expect(checkScene(scene)).toEqual([]);
  });

  it('draws each row as its file: mark, named, with its weeks', () => {
    const row = scene.marks.find((m) => m.id === ids.file('src/flags.js'))!;
    expect(row).toMatchObject({
      label: 'flags.js',
      labelSub: 'src · 2 weeks',
      labelAnchor: 'left',
    });
    // The row bar selects the file.
    expect(
      scene.marks.find((m) => m.id === 'collisions-row:src/flags.js')!.selects,
    ).toBe(ids.file('src/flags.js'));
  });

  it('stacks one dot per person per collision, in status colour, selecting them', () => {
    const feb = dots(scene).filter((m) =>
      m.id.startsWith('collisions-dot:src/flags.js:4:'),
    );
    expect(feb.map((m) => m.selects)).toEqual([
      ids.person('ann@x'),
      ids.person('bob@x'),
      ids.person('cy@x'),
    ]);
    expect(feb.map((m) => m.paint)).toEqual(['--soft', '--risk-2', '--risk-1']);
    // Stacked: same x, rising y.
    expect(new Set(feb.map((m) => m.x)).size).toBe(1);
    expect(feb[0].y).toBeLessThan(feb[2].y);
    expect(feb[1].tip).toEqual([
      'bob',
      'Week of Feb 2, 2026 · gone',
      'with ann, cy on flags.js',
    ]);
  });

  it('lights a selected person’s dots and fades the rest', () => {
    const focused = collisionsScene(data, VIEWPORT, {
      focus: ids.person('cy@x'),
    });
    expect(checkScene(focused)).toEqual([]);
    expect(focused.marks.map((m) => m.id)).toEqual(
      scene.marks.map((m) => m.id),
    );
    for (const m of dots(focused)) {
      if (m.selects === ids.person('cy@x')) expect(m.paint).toBe('--accent');
      else expect(m.alpha).toBeLessThan(0.5);
    }
  });

  it('keeps a selected file’s row at full strength', () => {
    const focused = collisionsScene(data, VIEWPORT, {
      focus: ids.file('src/loop.ts'),
    });
    for (const m of dots(focused)) {
      const mine = m.id.startsWith('collisions-dot:src/loop.ts:');
      expect(m.alpha > 0.5).toBe(mine);
    }
  });

  it('says so when no file is listed', () => {
    const r = report();
    r.parallelDev.files = [];
    const empty = collisionsScene(collisions(r), VIEWPORT);
    expect(checkScene(empty)).toEqual([]);
    expect(empty.marks[0].label).toBe(
      'No file had two or more people in two weeks',
    );
  });
});
