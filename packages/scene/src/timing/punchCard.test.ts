import { describe, expect, it } from 'vitest';

import {
  busiestCells,
  emptyGrid,
  hourName,
  isOffHours,
  selectionHours,
  selectionHoursOf,
  selectionRule,
  cellAuthors,
  offHoursLine,
  offHoursPeople,
  offHoursRegulars,
  regularLine,
  topAuthors,
  SWEEPING_COMMIT_FILES,
  touchesSelection,
  workingHoursShare,
} from './punchCard';
import type { CommitLike } from '../commits/commitLike';
import type { GitrelicReport } from '@gitrelic/core';

// Tue 3 Jun 2025 at 02:00 and 14:00 UTC; Sat 7 Jun at 12:00 UTC.
const at = (
  iso: string,
  files: string[],
  author = 'a@x',
  tz = 0,
): CommitLike => ({
  timeMs: Date.parse(iso),
  author,
  files,
  tz,
});

describe('off-hours', () => {
  it('is late night (23:00 to 04:59) or the weekend', () => {
    expect(isOffHours(2, 23)).toBe(true);
    expect(isOffHours(2, 4)).toBe(true);
    expect(isOffHours(2, 5)).toBe(false);
    expect(isOffHours(6, 12)).toBe(true);
    expect(isOffHours(0, 12)).toBe(true);
    expect(isOffHours(1, 12)).toBe(false);
  });
});

describe('selectionHours', () => {
  it('counts a selection’s commits by local day and hour, as core counts them', () => {
    const commits = [
      at('2025-06-03T02:00:00Z', ['packages/server/a.ts']),
      // 14:00Z is 06:00 in -08:00: a weekday morning, not off-hours.
      at('2025-06-03T14:00:00Z', ['packages/server/b.ts'], 'a@x', -480),
      at('2025-06-07T12:00:00Z', ['packages/server/a.ts']),
      at('2025-06-03T14:00:00Z', ['src/x.ts']),
      // Left out: a sweeping commit, a bot's and an AI agent's.
      at(
        '2025-06-03T02:00:00Z',
        Array.from(
          { length: SWEEPING_COMMIT_FILES + 1 },
          (_, i) => `packages/server/f${i}.ts`,
        ),
      ),
      at(
        '2025-06-03T02:00:00Z',
        ['packages/server/a.ts'],
        '49699333+dependabot[bot]@users.noreply.github.com',
      ),
      at(
        '2025-06-03T02:00:00Z',
        ['packages/server/a.ts'],
        '209825114+claude[bot]@users.noreply.github.com',
      ),
    ];
    const s = selectionHours(commits, selectionRule('dir:packages/server')!);
    expect(s.commits).toBe(3);
    expect(s.offHours).toBe(2);
    expect(s.grid[2][2]).toBe(1);
    expect(s.grid[2][6]).toBe(1);
    expect(s.grid[6][12]).toBe(1);
  });

  it('matches files, directories and the root package; nothing else', () => {
    expect(touchesSelection('file:src/x.ts')!(['src/x.ts'])).toBe(true);
    expect(touchesSelection('dir:src')!(['src/deep/y.ts'])).toBe(true);
    expect(touchesSelection('dir:src')!(['srcfoo/y.ts'])).toBe(false);
    expect(touchesSelection('repo')!(['README.md'])).toBe(true);
    expect(touchesSelection('repo')!(['src/x.ts'])).toBe(false);
    expect(touchesSelection('person:a@x')).toBeNull();
  });

  it('is memoised per commit list and selection', () => {
    const commits = [at('2025-06-03T02:00:00Z', ['src/x.ts'])];
    expect(selectionHoursOf(commits, 'dir:src')).toBe(
      selectionHoursOf(commits, 'dir:src'),
    );
    expect(selectionHoursOf(commits, 'analyzer:churn')).toBeNull();
  });
});

describe('a person’s hours', () => {
  it('count every commit they made, sweeping ones too, whatever the case of the email', () => {
    const commits = [
      at('2025-06-07T12:00:00Z', ['src/a.ts'], 'Joe@X'),
      at(
        '2025-06-03T02:00:00Z',
        Array.from({ length: SWEEPING_COMMIT_FILES + 5 }, (_, i) => `f${i}.ts`),
        'joe@x',
      ),
      at('2025-06-03T14:00:00Z', ['src/a.ts'], 'ann@x'),
    ];
    const s = selectionHoursOf(commits, 'person:joe@x')!;
    expect(s.commits).toBe(2);
    expect(s.offHours).toBe(2);
    expect(s.grid[6][12]).toBe(1);
  });
});

describe('offHoursRegulars', () => {
  const base = {
    totalCommits: 30,
    lateNightCommits: 0,
    weekendCommits: 0,
    lateNightPercent: 0,
    weekendPercent: 0,
    stressScore: 0,
    lateNightWeeks: 0,
    lateNights: 0,
    regularLateNights: false,
  };
  const report = {
    contributors: { contributors: [{ email: 'Joe@X' }, { email: 'ann@x' }] },
    commitTiming: {
      authorStress: [
        {
          ...base,
          email: 'ann@x',
          name: 'Ann',
          activeWeeks: 10,
          weekendWeeks: 4,
          regularWeekends: true,
        },
        {
          ...base,
          email: 'joe@x',
          name: 'Joe',
          activeWeeks: 12,
          weekendWeeks: 9,
          regularWeekends: true,
          lateNightWeeks: 5,
          lateNights: 6,
          regularLateNights: true,
        },
        {
          ...base,
          email: 'cy@x',
          name: 'Cy',
          activeWeeks: 12,
          weekendWeeks: 1,
          regularWeekends: false,
        },
      ],
    },
  } as unknown as GitrelicReport;

  it('lists the regulars, most regular first, as their people', () => {
    const r = offHoursRegulars(report);
    expect(r.map((x) => [x.id, x.name])).toEqual([
      ['person:Joe@X', 'Joe'],
      ['person:ann@x', 'Ann'],
    ]);
    expect(regularLine(r[0])).toBe(
      'weekends in 9 of 12 active weeks; late nights in 5 of 12 active weeks (6 nights)',
    );
    expect(regularLine(r[1])).toBe('weekends in 4 of 10 active weeks');
  });

  it('ranks everyone with off-hours after the regulars, never the new or bots', () => {
    const more = {
      ...report,
      commitTiming: {
        authorStress: [
          ...report.commitTiming.authorStress,
          // One weekend is all of a two-week contributor: too few to rank.
          {
            ...base,
            email: 'new@x',
            name: 'New',
            activeWeeks: 2,
            weekendWeeks: 2,
            regularWeekends: false,
          },
          {
            ...base,
            email: 'dependabot[bot]@users.noreply.github.com',
            name: 'dependabot',
            activeWeeks: 20,
            weekendWeeks: 20,
            regularWeekends: false,
          },
          {
            ...base,
            email: 'zed@x',
            name: 'Zed',
            activeWeeks: 6,
            weekendWeeks: 0,
            lateNightWeeks: 1,
            lateNights: 1,
            regularWeekends: false,
          },
        ],
      },
    } as unknown as GitrelicReport;
    const people = offHoursPeople(more);
    expect(people.map((p) => p.name)).toEqual(['Joe', 'Ann', 'Zed', 'Cy']);
    expect(offHoursLine(people[3])).toBe(
      'weekends in 1 of 12 active weeks · 0 late nights',
    );
    expect(offHoursLine(people[2])).toBe(
      'weekends in 0 of 6 active weeks · 1 late night',
    );
    // Every regular shows, past the count.
    expect(offHoursPeople(more, 1).map((p) => p.name)).toEqual(['Joe', 'Ann']);
  });
});

describe('cellAuthors', () => {
  const at = (iso: string, author: string, files = ['src/a.ts']) => ({
    timeMs: Date.parse(iso),
    author,
    files,
    tz: 0,
  });
  const commits = [
    at('2025-06-07T02:00:00Z', 'ann@x'), // Sat 2am
    at('2025-06-07T02:30:00Z', 'ann@x'),
    at('2025-06-07T02:10:00Z', 'joe@x', ['lib/b.ts']),
    at(
      '2025-06-07T02:20:00Z',
      'cy@x',
      Array.from({ length: 30 }, (_, i) => `src/f${i}.ts`),
    ),
  ];

  it('counts each cell’s authors, busiest first', () => {
    const cell = cellAuthors(commits, null)[6][2];
    expect(topAuthors(cell)).toEqual([
      { author: 'ann@x', commits: 2 },
      { author: 'cy@x', commits: 1 },
      { author: 'joe@x', commits: 1 },
    ]);
    expect(topAuthors(cell, 1)).toHaveLength(1);
  });

  it('follows a package’s rule: its commits, less sweeping ones', () => {
    const cell = cellAuthors(commits, selectionRule('dir:src')!)[6][2];
    expect([...cell]).toEqual([['ann@x', 2]]);
  });
});

describe('the grid’s readings', () => {
  it('finds the working-hours share and the busiest hours', () => {
    const g = emptyGrid();
    g[1][12] = 6; // Mon noon
    g[2][16] = 3; // Tue 4pm
    g[6][2] = 1; // Sat 2am
    expect(workingHoursShare(g)).toBeCloseTo(0.9);
    expect(busiestCells(g, 2)).toEqual([
      { day: 1, hour: 12, commits: 6 },
      { day: 2, hour: 16, commits: 3 },
    ]);
    expect([0, 11, 12, 23].map(hourName)).toEqual([
      '12am',
      '11am',
      '12pm',
      '11pm',
    ]);
  });
});
