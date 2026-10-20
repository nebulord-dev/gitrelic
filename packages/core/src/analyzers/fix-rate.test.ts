import { describe, expect, it } from 'vitest';

import {
  aboveChance,
  binomialUpperTail,
  computeFixRate,
  FIX_WINDOW_DAYS,
  fixKind,
  MAX_FIX_FILES,
  MIN_CHANGES,
  type FixOrigins,
} from './fix-rate.js';
import type { RawCommit } from '../utils/git.js';

const BOT = '49699333+dependabot[bot]@users.noreply.github.com';

/** A commit `day` days into 2026. */
function makeCommit(
  hash: string,
  day: number,
  files: string[],
  message = 'feat: work',
  authorEmail = 'ann@corp.com',
): RawCommit {
  const date = new Date(Date.UTC(2026, 0, 1) + day * 86_400_000).toISOString();
  return {
    hash,
    authorEmail,
    authorName: 'Ann',
    date,
    message,
    coAuthors: [],
    files,
    fileStats: [],
    insertions: 0,
    deletions: 0,
  };
}

/** `n` changes to `file` on days 0..n-1, hashed `${prefix}0`…, plus an end marker. */
function history(file: string, n: number, prefix = 'c'): RawCommit[] {
  return Array.from({ length: n }, (_, i) =>
    makeCommit(`${prefix}${i}`, i, [file]),
  );
}
const endAt = (day: number) => makeCommit('end', day, ['other.md']);
const blame = (pairs: Record<string, [string, string][]>): FixOrigins =>
  new Map(
    Object.entries(pairs).map(([fix, o]) => [
      fix,
      o.map(([hash, file]) => ({ hash, file })),
    ]),
  );

describe('fixKind', () => {
  it.each([
    ['fix: null check', 'fix'],
    ['[DevTools] Fix host highlighting (#34661)', 'fix'],
    ['Fixes #12', 'fix'],
    ['bugfix for scroll', 'fix'],
    ['Hotfix the release', 'fix'],
    ['oops, wrong file', 'fix'],
    ['Revert "Add hooks" (#35346)', 'revert'],
    ['revert: drop flag', 'revert'],
    ['  Reverting the cache', 'revert'],
    ['Add prefix to ids', null],
    ['debug logging', null],
    ['hack around the timer', null],
    ['temporary workaround', null],
    ['cleanup imports', null],
  ])('%s → %s', (message, kind) => {
    expect(fixKind(message)).toBe(kind);
  });
});

describe('computeFixRate', () => {
  const file = 'src/a.ts';
  const rated = new Set([file]);

  it('rates a file from MIN_CHANGES changes, counting each one a fix traced to', () => {
    const commits = [
      ...history(file, MIN_CHANGES),
      makeCommit('fix', MIN_CHANGES, [file], 'fix: a'),
      endAt(100),
    ];
    const r = computeFixRate(
      commits,
      blame({
        fix: [
          ['c2', file],
          ['c5', file],
        ],
      }),
      rated,
    );
    expect(r.files).toHaveLength(1);
    // The fix is itself a change.
    expect(r.files[0]).toMatchObject({
      file,
      changes: MIN_CHANGES + 1,
      fixedAfter: 2,
    });
    expect(r.files[0].rate).toBeCloseTo(2 / (MIN_CHANGES + 1));
    expect(r.files[0].fixes[0].causes).toEqual(['c2', 'c5']);
    expect(r.rate).toBeCloseTo(2 / (MIN_CHANGES + 1));
    expect(r.fixCommits).toBe(1);
  });

  it('gives no rate below MIN_CHANGES, and counts the file as unrated', () => {
    const r = computeFixRate(
      [...history(file, MIN_CHANGES - 1), endAt(100)],
      new Map(),
      rated,
    );
    expect(r.files).toEqual([]);
    expect(r.unratedFiles).toBe(1);
    // The repo-wide rate still counts its changes.
    expect(r.changes).toBe(MIN_CHANGES - 1);
    expect(r.rate).toBe(0);
  });

  it('only counts a fix within the window', () => {
    const commits = [
      ...history(file, MIN_CHANGES),
      makeCommit('ontime', FIX_WINDOW_DAYS + 1, [file], 'fix: one'),
      makeCommit('late', FIX_WINDOW_DAYS + 3, [file], 'fix: two'),
      endAt(200),
    ];
    const r = computeFixRate(
      commits,
      // c1 on day 1: fixed on day 31 (30 days); c2 on day 2: fixed on day 33 (31).
      blame({ ontime: [['c1', file]], late: [['c2', file]] }),
      rated,
    );
    expect(r.files[0].fixedAfter).toBe(1);
    expect(r.files[0].fixes.map((f) => f.hash)).toEqual(['ontime']);
  });

  it('rates only changes that have had a full window', () => {
    // End on day 40: changes after day 10 are too fresh.
    const commits = [...history(file, 20), endAt(40)];
    const r = computeFixRate(commits, new Map(), rated);
    expect(r.changes).toBe(11);
  });

  it('keeps a fix dated before the change it blames (clock skew)', () => {
    const commits = [
      ...history(file, MIN_CHANGES),
      makeCommit('fix', 3, [file], 'fix: skewed'),
      endAt(100),
    ];
    const r = computeFixRate(commits, blame({ fix: [['c5', file]] }), rated);
    expect(r.files[0].fixedAfter).toBe(1);
  });

  it('matches a cause by the path its lines had in that change', () => {
    const r = computeFixRate(
      [
        ...history(file, MIN_CHANGES),
        makeCommit('fix', 9, [file], 'fix'),
        endAt(100),
      ],
      // The blamed lines came from another file in c3: not a.ts's change.
      blame({ fix: [['c3', 'src/b.ts']] }),
      rated,
    );
    expect(r.files[0].fixedAfter).toBe(0);
  });

  it('leaves bots out as changes and as fixes', () => {
    const commits = [
      ...history(file, MIN_CHANGES),
      makeCommit('botfix', 9, [file], 'fix: bump', BOT),
      makeCommit('botchange', 10, [file], 'chore: bump', BOT),
      endAt(100),
    ];
    const r = computeFixRate(commits, blame({ botfix: [['c1', file]] }), rated);
    expect(r.files[0]).toMatchObject({ changes: MIN_CHANGES, fixedAfter: 0 });
    expect(r.fixCommits).toBe(0);
  });

  it('skips a fix that sweeps more than MAX_FIX_FILES files', () => {
    const many = Array.from(
      { length: MAX_FIX_FILES + 1 },
      (_, i) => `f${i}.ts`,
    );
    const commits = [
      ...history(file, MIN_CHANGES),
      makeCommit('sweep', 9, [file, ...many], 'fix: rename everything'),
      endAt(100),
    ];
    const r = computeFixRate(commits, blame({ sweep: [['c1', file]] }), rated);
    expect(r.files[0].fixedAfter).toBe(0);
    expect(r.sweepingSkipped).toBe(1);
    expect(r.fixCommits).toBe(0);
  });

  it('lists at most five fixes, newest first, and counts reverts', () => {
    const fixes = Array.from({ length: 7 }, (_, i) =>
      makeCommit(`fix${i}`, 10 + i, [file], i === 6 ? 'Revert "x"' : 'fix: y'),
    );
    const r = computeFixRate(
      [...history(file, MIN_CHANGES), ...fixes, endAt(100)],
      blame(
        Object.fromEntries(fixes.map((f, i) => [f.hash, [[`c${i}`, file]]])),
      ),
      rated,
    );
    expect(r.files[0].fixes.map((f) => f.hash)).toEqual([
      'fix6',
      'fix5',
      'fix4',
      'fix3',
      'fix2',
    ]);
    expect(r.files[0].fixes[0].revert).toBe(true);
    expect(r.reverts).toBe(1);
  });

  it('sorts by rate, then changes, and buckets changes by month', () => {
    const b = 'src/b.ts';
    const commits = [
      ...history(file, MIN_CHANGES),
      ...history(b, MIN_CHANGES + 2, 'b'),
      makeCommit('fix', 25, [b], 'fix: b'),
      makeCommit('feb', 35, [file]),
      endAt(200),
    ];
    const r = computeFixRate(
      commits,
      blame({ fix: [['b0', b]] }),
      new Set([file, b]),
    );
    expect(r.files.map((f) => f.file)).toEqual([b, file]);
    expect(r.byMonth).toEqual([
      { month: '2026-01', changes: 2 * MIN_CHANGES + 3, fixedAfter: 1 },
      { month: '2026-02', changes: 1, fixedAfter: 0 },
    ]);
  });

  it('has no rate before any change is old enough', () => {
    const r = computeFixRate(history(file, 3), new Map(), rated);
    expect(r.rate).toBeNull();
    expect(r.summary).toMatch(/none can be rated/);
  });

  it('ignores files outside the rated set', () => {
    const r = computeFixRate(
      [...history('fixtures/a.snap', MIN_CHANGES), endAt(100)],
      new Map(),
      rated,
    );
    expect(r.changes).toBe(0);
    expect(r.unratedFiles).toBe(0);
  });
});

describe('aboveChance', () => {
  // React's last 12 months: a 1.2% repo rate. The Atlas lens marks the same
  // three files (scene's fixRate/points.test.ts).
  const p = 0.0121;
  it.each([
    [3, 8, true],
    [4, 18, true],
    [2, 11, true],
    [1, 25, false],
    [1, 8, false],
    [0, 20, false],
  ])('%i of %i changes → %s', (fixedAfter, changes, expected) => {
    expect(aboveChance({ fixedAfter, changes }, p)).toBe(expected);
  });

  it('is never above chance without a repo rate', () => {
    expect(aboveChance({ fixedAfter: 5, changes: 8 }, null)).toBe(false);
  });

  it('sums the tail without underflowing on huge files', () => {
    // (1 − p)^n is 0 in floating point here; the log-space sum isn't.
    expect(binomialUpperTail(5000, 1500, 0.3)).toBeCloseTo(0.5, 1);
    expect(binomialUpperTail(10, 0, 0.1)).toBe(1);
    expect(binomialUpperTail(10, 11, 0.1)).toBe(0);
  });
});
