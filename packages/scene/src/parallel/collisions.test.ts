import { describe, expect, it } from 'vitest';

import { parallelReport } from '../../test/parallelReport';
import { COLLISION_ROWS, collisions, collisionsOf } from './collisions';
import type { FileParallelDev, GitrelicReport } from '@gitrelic/core';

const W = (weekStart: string, authors: string[]) => ({
  weekStart: `${weekStart}T00:00:00.000Z`,
  authors,
  commitCount: authors.length,
});
const file = (
  path: string,
  windows: ReturnType<typeof W>[],
): FileParallelDev => ({
  file: path,
  parallelScore: 40,
  totalActiveWeeks: 8,
  parallelWeeks: windows.length,
  peakAuthors: 2,
  peakWindow: windows[0],
  topWindows: windows.slice(0, 3),
  windows,
  narrative: '',
});

// The three flag files are one family (6 of 6 commits shared); loop.ts is
// on its own. History: Mon 5 Jan to Mon 2 Mar 2026, nine weeks.
function report(files: FileParallelDev[]): GitrelicReport {
  const r = parallelReport();
  r.meta.firstCommit = '2026-01-05T09:00:00Z';
  r.meta.lastCommit = '2026-03-02T09:00:00Z';
  r.parallelDev.files = files;
  return r;
}
const flags = [
  file('src/flags.js', [
    W('2026-01-05', ['ann@x', 'bob@x']),
    W('2026-01-19', ['ann@x', 'bob@x']),
  ]),
  file('src/flags.www.js', [
    W('2026-01-05', ['ann@x', 'bob@x']),
    W('2026-02-02', ['bob@x', 'cy@x']),
    W('2026-01-19', ['ann@x', 'dee@x']),
  ]),
  file('src/flags.native.js', [W('2026-01-05', ['ann@x', 'bob@x'])]),
];
const loop = file('src/loop.ts', [
  W('2026-01-12', ['cy@x', 'dee@x']),
  W('2026-03-02', ['cy@x', 'ann@x']),
]);

describe('collisions', () => {
  it('folds a family into one row, drawn as its busiest member', () => {
    const data = collisions(report([...flags, loop]));
    expect(data.unit).toBe('week');
    expect(data.binStarts).toHaveLength(9);
    const [fam, solo] = data.rows;
    expect(fam).toMatchObject({
      file: 'src/flags.www.js',
      family: 'flags.*',
      weeks: 3,
    });
    expect(fam.members).toEqual([
      'src/flags.www.js',
      'src/flags.js',
      'src/flags.native.js',
    ]);
    expect(solo).toMatchObject({ file: 'src/loop.ts', family: null, weeks: 2 });
  });

  it('stacks each bin’s people across the row’s files, most involved first', () => {
    const [fam] = collisions(report([...flags, loop])).rows;
    expect(fam.marks.map((m) => m.bin)).toEqual([0, 2, 4]);
    // Week 0: ann and bob on three files each.
    expect(fam.marks[0].people.map((p) => p.email)).toEqual(['ann@x', 'bob@x']);
    // Week 2: ann on two files, bob and dee on one: ann first, then by email.
    expect(fam.marks[1].people.map((p) => p.email)).toEqual([
      'ann@x',
      'bob@x',
      'dee@x',
    ]);
    expect(fam.marks[1].people[1]).toMatchObject({
      name: 'bob',
      status: 'ghost',
    });
  });

  it('keeps COLLISION_ROWS rows and counts the rest', () => {
    const many = Array.from({ length: COLLISION_ROWS + 3 }, (_, i) =>
      file(`src/f${i}.ts`, [
        W('2026-01-05', ['ann@x', 'bob@x']),
        W('2026-01-12', ['ann@x', 'bob@x']),
      ]),
    );
    const data = collisions(report(many));
    expect(data.rows).toHaveLength(COLLISION_ROWS);
    expect(data.hidden).toBe(3);
  });

  it('is empty without listed files, and memoised per report', () => {
    expect(collisions(report([])).rows).toEqual([]);
    const r = report([loop]);
    expect(collisionsOf(r)).toBe(collisionsOf(r));
  });
});
