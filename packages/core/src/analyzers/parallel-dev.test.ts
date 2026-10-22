import { describe, it, expect } from 'vitest';

import { analyzeParallelDev, SWEEPING_COMMIT_FILES } from './parallel-dev.js';
import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
    authorName: 'Alice',
    date: '2025-06-02T00:00:00Z', // a Monday
    message: 'feat: something',
    coAuthors: [],
    files: [],
    fileStats: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}

// Helper: generate a Monday ISO date for a given week offset
function weekDate(weeksFromBase: number): string {
  const base = new Date('2025-06-02T00:00:00Z'); // Monday
  base.setDate(base.getDate() + weeksFromBase * 7);
  return base.toISOString();
}

describe('analyzeParallelDev', () => {
  it('returns empty report when all commits are single-author', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
    expect(result.totalParallelFiles).toBe(0);
  });

  it('detects two authors committing to the same file in the same week', () => {
    const commits = [
      makeCommit({
        hash: '5',
        authorEmail: 'bob@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '4',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].parallelWeeks).toBe(2);
    expect(result.files[0].totalActiveWeeks).toBe(3);
  });

  it('excludes files with fewer than 3 active weeks', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('excludes files with a single collision week: one overlap is chance', () => {
    // 1 parallel week out of 10 active weeks
    const commits = Array.from({ length: 10 }, (_, week) =>
      makeCommit({
        hash: `a${week}`,
        authorEmail: 'alice@x.com',
        date: weekDate(week),
        files: ['a.ts'],
      }),
    );
    // Add one commit from bob in week 0 to create 1 parallel week
    commits.push(
      makeCommit({
        hash: 'b0',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
    );

    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files).toHaveLength(0); // 1 < MIN_COLLISION_WEEKS
  });

  it('scores higher when more authors overlap in parallel weeks', () => {
    // File A: 2 authors overlap
    // File B: 4 authors overlap (same number of parallel weeks)
    const commits = [
      // File A: weeks 0-2, parallel in week 0 (2 authors)
      makeCommit({
        hash: 'a1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: 'a2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: 'a3',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: 'a4',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: 'a5',
        authorEmail: 'bob@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      // File B: weeks 0-2, parallel in week 0 (4 authors)
      makeCommit({
        hash: 'b1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['b.ts'],
      }),
      makeCommit({
        hash: 'b2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['b.ts'],
      }),
      makeCommit({
        hash: 'b3',
        authorEmail: 'charlie@x.com',
        date: weekDate(0),
        files: ['b.ts'],
      }),
      makeCommit({
        hash: 'b4',
        authorEmail: 'dave@x.com',
        date: weekDate(0),
        files: ['b.ts'],
      }),
      makeCommit({
        hash: 'b5',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['b.ts'],
      }),
      makeCommit({
        hash: 'b6',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['b.ts'],
      }),
      ...['bob', 'charlie', 'dave'].map((who) =>
        makeCommit({
          hash: `b7${who}`,
          authorEmail: `${who}@x.com`,
          date: weekDate(1),
          files: ['b.ts'],
        }),
      ),
    ];
    const result = analyzeParallelDev(commits, ['a.ts', 'b.ts']);
    const aScore =
      result.files.find((f) => f.file === 'a.ts')?.parallelScore ?? 0;
    const bScore =
      result.files.find((f) => f.file === 'b.ts')?.parallelScore ?? 0;
    expect(bScore).toBeGreaterThan(aScore);
  });

  it('clamps score to 100 max', () => {
    // Every week has 4+ authors → base ~100, multiplied by severity → would exceed 100
    const commits = Array.from({ length: 4 }, (_, week) =>
      ['alice', 'bob', 'charlie', 'dave'].map((name, i) =>
        makeCommit({
          hash: `w${week}a${i}`,
          authorEmail: `${name}@x.com`,
          date: weekDate(week),
          files: ['hot.ts'],
        }),
      ),
    ).flat();
    const result = analyzeParallelDev(commits, ['hot.ts']);
    expect(result.files[0].parallelScore).toBeLessThanOrEqual(100);
  });

  it('ignores files not in the tracked set', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['deleted.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['deleted.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['deleted.ts'],
      }),
      makeCommit({
        hash: '4',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['deleted.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['other.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('populates peakWindow with the highest-overlap week', () => {
    const commits = [
      // Week 0: 3 authors (peak)
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'charlie@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      // Week 1: 2 authors
      makeCommit({
        hash: '4',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '5',
        authorEmail: 'bob@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      // Week 2: 1 author
      makeCommit({
        hash: '6',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files[0].peakAuthors).toBe(3);
    expect(result.files[0].peakWindow.authors).toHaveLength(3);
    expect(result.files[0].topWindows).toHaveLength(2); // only 2 parallel weeks
  });

  it('limits hotFiles to top 10', () => {
    const files = Array.from({ length: 15 }, (_, i) => `file${i}.ts`);
    const commits = files.flatMap((file, i) => [
      makeCommit({
        hash: `a${i}`,
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: [file],
      }),
      makeCommit({
        hash: `b${i}`,
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: [file],
      }),
      makeCommit({
        hash: `c${i}`,
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: [file],
      }),
      makeCommit({
        hash: `d${i}`,
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: [file],
      }),
    ]);
    const result = analyzeParallelDev(commits, files);
    expect(result.hotFiles.length).toBeLessThanOrEqual(10);
  });

  it('generates narrative for files with parallel score >= 20', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '4',
        authorEmail: 'bob@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '5',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '6',
        authorEmail: 'bob@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files[0].narrative.length).toBeGreaterThan(0);
  });

  it('uses high-severity narrative for score >= 70', () => {
    // All 4 weeks have 4 authors → score should be very high (>=70)
    const commits = Array.from({ length: 4 }, (_, week) =>
      ['alice', 'bob', 'charlie', 'dave'].map((name, i) =>
        makeCommit({
          hash: `w${week}a${i}`,
          authorEmail: `${name}@x.com`,
          date: weekDate(week),
          files: ['hot.ts'],
        }),
      ),
    ).flat();
    const result = analyzeParallelDev(commits, ['hot.ts']);
    expect(result.files[0].narrative).toContain(
      'correlates with increased defect risk',
    );
  });
});

describe('highParallel aggregate', () => {
  it('counts files with parallelScore >= 70', () => {
    // 4 weeks, 4 authors per week → score 100 (high)
    const high = Array.from({ length: 4 }, (_, week) =>
      ['alice', 'bob', 'charlie', 'dave'].map((name, i) =>
        makeCommit({
          hash: `h${week}${i}`,
          authorEmail: `${name}@x.com`,
          date: weekDate(week),
          files: ['hot.ts'],
        }),
      ),
    ).flat();
    // 4 weeks, 1 parallel week with 2 authors → low score
    const low = [
      ...Array.from({ length: 4 }, (_, week) =>
        makeCommit({
          hash: `l${week}`,
          authorEmail: 'alice@x.com',
          date: weekDate(week),
          files: ['cool.ts'],
        }),
      ),
      makeCommit({
        hash: 'lb0',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['cool.ts'],
      }),
    ];
    const result = analyzeParallelDev([...high, ...low], ['hot.ts', 'cool.ts']);
    expect(result.highParallel).toBe(1);
  });

  it('returns 0 highParallel when no files cross the threshold', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.highParallel).toBe(0);
  });
});

describe('tierMix aggregate', () => {
  it('places each scored file into exactly one tier band', () => {
    // 4 weeks 4 authors → score 100 (critical)
    const critical = Array.from({ length: 4 }, (_, week) =>
      ['alice', 'bob', 'charlie', 'dave'].map((name, i) =>
        makeCommit({
          hash: `c${week}${i}`,
          authorEmail: `${name}@x.com`,
          date: weekDate(week),
          files: ['c.ts'],
        }),
      ),
    ).flat();
    const result = analyzeParallelDev(critical, ['c.ts']);
    const total =
      result.tierMix.low +
      result.tierMix.medium +
      result.tierMix.high +
      result.tierMix.critical;
    expect(total).toBe(result.files.length);
    expect(result.tierMix.critical).toBe(1);
    expect(result.tierMix.high).toBe(0);
    expect(result.tierMix.medium).toBe(0);
    expect(result.tierMix.low).toBe(0);
  });

  it('returns all-zero tierMix when no files are scored', () => {
    const result = analyzeParallelDev([], []);
    expect(result.tierMix).toEqual({
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    });
  });
});

describe('byMonth aggregate', () => {
  it('counts parallel events bucketed by ISO month of weekStart', () => {
    // Two parallel weeks in 2025-06 (one with 2 authors, one with 3)
    const commits = [
      // Week 0 (2025-06-02 Monday): 2 authors
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      // Week 1 (2025-06-09): 3 authors
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '4',
        authorEmail: 'bob@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '5',
        authorEmail: 'charlie@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      // Week 2 (2025-06-16): single-author, not a parallel event
      makeCommit({
        hash: '6',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.byMonth).toHaveLength(1);
    expect(result.byMonth[0].month).toBe('2025-06');
    expect(result.byMonth[0].parallelEvents).toBe(2);
    expect(result.byMonth[0].uniqueFiles).toBe(1);
    // avg authors across the two parallel events: (2 + 3) / 2 = 2.5
    expect(result.byMonth[0].avgAuthors).toBeCloseTo(2.5);
  });

  it('returns empty byMonth array when there are no parallel events', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.byMonth).toEqual([]);
  });

  it('sorts byMonth ascending by ISO month string', () => {
    // Months: 2025-06 (1 event) and 2025-07 (1 event)
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0), // 2025-06-02
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(4), // 2025-06-30 still
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '4',
        authorEmail: 'bob@x.com',
        date: weekDate(5), // crosses into 2025-07-07
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '5',
        authorEmail: 'alice@x.com',
        date: weekDate(5),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    const months = result.byMonth.map((b) => b.month);
    expect(result.byMonth).toHaveLength(2);
    expect(months).toContain('2025-06');
    expect(months).toContain('2025-07');
    const sorted = [...months].sort();
    expect(months).toEqual(sorted);
  });

  it('counts uniqueFiles distinctly per month', () => {
    // Week 0: parallel on a.ts AND b.ts → 2 unique files, 2 events
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts', 'b.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts', 'b.ts'],
      }),
      // Pad each file to 3 active weeks so they survive MIN_ACTIVE_WEEKS
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts', 'b.ts'],
      }),
      makeCommit({
        hash: '4',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts', 'b.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts', 'b.ts']);
    expect(result.byMonth[0].parallelEvents).toBe(2);
    expect(result.byMonth[0].uniqueFiles).toBe(2);
  });
});

describe('analyzeParallelDev: what counts', () => {
  // Alice and Bob share a.ts in weeks 0 and 1; Alice alone in week 2.
  const together = (files: string[], extra: Partial<RawCommit> = {}) => [
    makeCommit({
      hash: 'a0',
      authorEmail: 'alice@x.com',
      date: weekDate(0),
      files,
      ...extra,
    }),
    makeCommit({
      hash: 'b0',
      authorEmail: 'bob@x.com',
      date: weekDate(0),
      files,
      ...extra,
    }),
    makeCommit({
      hash: 'a1',
      authorEmail: 'alice@x.com',
      date: weekDate(1),
      files,
      ...extra,
    }),
    makeCommit({
      hash: 'b1',
      authorEmail: 'bob@x.com',
      date: weekDate(1),
      files,
      ...extra,
    }),
    makeCommit({
      hash: 'a2',
      authorEmail: 'alice@x.com',
      date: weekDate(2),
      files,
      ...extra,
    }),
  ];

  it('lists every collision week, oldest first', () => {
    const [a] = analyzeParallelDev(together(['a.ts']), ['a.ts']).files;
    expect(a.windows.map((w) => w.weekStart.slice(0, 10))).toEqual([
      '2025-06-02',
      '2025-06-09',
    ]);
    expect(a.windows[0].authors.sort()).toEqual(['alice@x.com', 'bob@x.com']);
  });

  it('leaves out sweeping commits, and counts them', () => {
    const many = Array.from(
      { length: SWEEPING_COMMIT_FILES + 1 },
      (_, i) => `f${i}.ts`,
    );
    const result = analyzeParallelDev(together(many), many);
    expect(result.files).toHaveLength(0);
    expect(result.pairs).toHaveLength(0);
    expect(result.leftOut.sweepingCommits).toBe(5);
  });

  it('leaves out bot commits, and counts them', () => {
    const commits = [
      ...together(['a.ts']).filter((c) => c.authorEmail === 'alice@x.com'),
      makeCommit({
        hash: 'd0',
        authorEmail: '49699333+dependabot[bot]@users.noreply.github.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: 'd1',
        authorEmail: '49699333+dependabot[bot]@users.noreply.github.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
    expect(result.leftOut.botCommits).toBe(2);
  });

  it('leaves out files that aren’t source', () => {
    const snap = 'src/__snapshots__/a.snap';
    const result = analyzeParallelDev(
      together([snap]),
      [snap],
      new Set([snap]),
    );
    expect(result.files).toHaveLength(0);
    expect(result.pairs).toHaveLength(0);
  });

  it('counts a pair’s shared weeks, not file-weeks, and names the files', () => {
    // A flag flipped across three forks, two weeks running: 6 file-weeks,
    // 2 weeks.
    const forks = ['flags.js', 'flags.www.js', 'flags.native.js'];
    const result = analyzeParallelDev(together(forks), forks);
    expect(result.pairs).toEqual([
      {
        a: 'alice@x.com',
        b: 'bob@x.com',
        weeks: 2,
        files: ['flags.js', 'flags.native.js', 'flags.www.js'],
      },
    ]);
  });
});
