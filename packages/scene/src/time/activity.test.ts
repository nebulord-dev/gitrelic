import { describe, expect, it } from 'vitest';

import { ids } from '../ids';
import { normalizeReport } from '../report/normalizeReport';
import {
  previousNamesOf,
  touchesEntity,
  weeklyActivity,
  weeklyHits,
} from './activity';
import type { CommitLike } from '../commits/commitLike';

// 2026-03-02 is a Monday.
const MON = Date.UTC(2026, 2, 2);
const DAY = 86_400_000;
const commit = (day: number, author: string, files: string[]): CommitLike => ({
  timeMs: MON + day * DAY + 3_600_000,
  author,
  files,
});

const commits = [
  commit(0, 'ann@x', ['src/a.ts']),
  commit(2, 'bob@x', ['src/b.ts', 'docs/x.md']),
  commit(15, 'ann@x', ['src/a.ts']), // week 3; week 2 is empty
];

describe('weeklyActivity', () => {
  it('bins commits by UTC week, keeping empty weeks', () => {
    const a = weeklyActivity(commits);
    expect(a.start).toBe(MON);
    expect(a.totals).toEqual([2, 0, 1]);
    expect(a.hits).toEqual([0, 0, 0]);
  });

  it('counts the commits that touch an entity', () => {
    expect(
      weeklyActivity(commits, touchesEntity(ids.file('src/a.ts'))).hits,
    ).toEqual([1, 0, 1]);
    expect(weeklyActivity(commits, touchesEntity(ids.dir('src'))).hits).toEqual(
      [2, 0, 1],
    );
    expect(
      weeklyActivity(commits, touchesEntity(ids.person('bob@x'))).hits,
    ).toEqual([1, 0, 0]);
  });

  it('matches directories by path segment, not prefix', () => {
    const t = touchesEntity(ids.dir('sr'))!;
    expect(commits.some(t)).toBe(false);
  });

  it('has nothing to match for kinds commits do not touch', () => {
    expect(touchesEntity(ids.analyzer('hotspots'))).toBeNull();
    expect(touchesEntity('repo')).toBeNull();
  });

  it('is empty without commits', () => {
    expect(weeklyActivity([])).toEqual({ start: 0, totals: [], hits: [] });
  });

  it("follows a renamed file's history under its old paths", () => {
    const r = normalizeReport({});
    r.renameTracking.chains = [
      {
        currentPath: 'src/a.ts',
        previousNames: ['lib/old-a.ts'],
        renameCount: 1,
      },
    ];
    const renamed = [commit(0, 'ann@x', ['lib/old-a.ts']), ...commits];
    const names = previousNamesOf('src/a.ts', r);
    expect(names).toEqual(['lib/old-a.ts']);
    expect(
      weeklyActivity(renamed, touchesEntity(ids.file('src/a.ts'), names)).hits,
    ).toEqual([2, 0, 1]);
    expect(previousNamesOf('other.ts', r)).toEqual([]);
  });

  it('skips an old name a tracked file uses again', () => {
    const r = normalizeReport({});
    r.renameTracking.chains = [
      {
        currentPath: 'b.ts',
        previousNames: ['a.ts', 'old/b.ts'],
        renameCount: 2,
      },
    ];
    // a.ts was renamed to b.ts, then an unrelated a.ts was created.
    r.loc.files = [
      { file: 'a.ts', lines: 10, language: 'TypeScript' },
      { file: 'b.ts', lines: 20, language: 'TypeScript' },
    ] as never;
    expect(previousNamesOf('b.ts', r)).toEqual(['old/b.ts']);
  });

  it('recomputes only the hits over an existing series', () => {
    const { start, totals } = weeklyActivity(commits);
    expect(
      weeklyHits(
        commits,
        start,
        totals.length,
        touchesEntity(ids.person('ann@x')),
      ),
    ).toEqual([1, 0, 1]);
    expect(weeklyHits(commits, start, totals.length, null)).toEqual([0, 0, 0]);
  });
});
