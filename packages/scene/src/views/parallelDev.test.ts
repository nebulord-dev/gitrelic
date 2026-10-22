import { describe, expect, it } from 'vitest';

import { parallelReport } from '../../test/parallelReport';
import { ids } from '../ids';
import { checkScene } from '../model';
import {
  filePeople,
  pairsLayout,
  parallelDevFindings,
  parallelDevTable,
  parallelDevView,
} from './parallelDev';

const input = (report = parallelReport()) => ({ report, commits: null });
const text = (segments: (string | { text: string })[]) =>
  segments.map((s) => (typeof s === 'string' ? s : s.text)).join('');

describe('parallelDevFindings', () => {
  it('names the top pair and their files, the hot file and its family, and what was left out', () => {
    const [pair, hot, left] = parallelDevFindings(input());
    expect(text(pair.segments)).toBe(
      'ann and bob committed to the same files in 3 weeks: flags.js, flags.www.js.',
    );
    expect(pair.segments).toContainEqual({
      ref: ids.person('ann@x'),
      text: 'ann',
    });
    expect(text(hot.segments)).toBe(
      'flags.js had two or more people in 3 of its 8 active weeks, one of 3 files that change together.',
    );
    expect(text(left.segments)).toMatch(/^Left out 3 sweeping commits/);
  });

  it('says nothing about pairs or files when there are none', () => {
    const report = parallelReport([], { sweepingCommits: 0, botCommits: 0 });
    report.parallelDev.files = [];
    expect(parallelDevFindings(input(report))).toEqual([]);
  });
});

describe('parallelDevTable', () => {
  it('lists the files people collided on, tiered by score', () => {
    const table = parallelDevTable(input());
    expect(table.rows.map((r) => [r.id, r.tier])).toEqual([
      [ids.file('src/flags.js'), 1],
      [ids.file('src/loop.ts'), 0],
    ]);
    expect(table.rows[0].cells).toMatchObject({
      people: 'ann, bob',
      weeks: 3,
      active: 8,
      peak: 2,
      score: 40,
      package: 'src',
    });
  });
});

describe('the table’s People column', () => {
  it('names who collided on a file, most weeks first, and lets the filter find them', () => {
    const report = parallelReport();
    const w = (authors: string[]) => ({
      weekStart: '2026-01-05T00:00:00.000Z',
      authors,
      commitCount: authors.length,
    });
    report.parallelDev.files[0].windows = [
      w(['ann@x', 'bob@x']),
      w(['bob@x', 'cy@x']),
      w(['bob@x', 'dee@x', 'eve@x']),
    ];
    const [row] = parallelDevTable(input(report)).rows;
    // bob in all three weeks; the rest once each, by name; past three, +N.
    expect(row.cells.people).toBe('bob, ann, cy +2');
    expect(row.search).toContain('eve');
  });

  it('counts each person’s weeks on the file', () => {
    expect(
      filePeople(
        { windows: [{ authors: ['a@x', 'b@x'] }, { authors: ['a@x', 'c@x'] }] },
        new Map([['a@x', 'Ann']]),
      ),
    ).toEqual([
      { name: 'Ann', weeks: 2 },
      { name: 'b@x', weeks: 1 },
      { name: 'c@x', weeks: 1 },
    ]);
  });
});

describe('parallelDevView', () => {
  it('draws pairs from the report alone', () => {
    expect(parallelDevView.layouts[0]).toBe(pairsLayout);
    expect(pairsLayout.needsCommits).toBe(false);
    const scene = pairsLayout.build(input(), { width: 1200, height: 800 });
    expect(checkScene(scene)).toEqual([]);
  });
});
