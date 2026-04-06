import { describe, it, expect } from 'vitest';

import { analyzeParallelDev } from './parallel-dev.js';

import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
    authorName: 'Alice',
    date: '2025-06-02T00:00:00Z', // a Monday
    message: 'feat: something',
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
      makeCommit({ hash: '1', authorEmail: 'alice@x.com', date: weekDate(0), files: ['a.ts'] }),
      makeCommit({ hash: '2', authorEmail: 'alice@x.com', date: weekDate(1), files: ['a.ts'] }),
      makeCommit({ hash: '3', authorEmail: 'alice@x.com', date: weekDate(2), files: ['a.ts'] }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
    expect(result.totalParallelFiles).toBe(0);
  });

  it('detects two authors committing to the same file in the same week', () => {
    const commits = [
      makeCommit({ hash: '1', authorEmail: 'alice@x.com', date: weekDate(0), files: ['a.ts'] }),
      makeCommit({ hash: '2', authorEmail: 'bob@x.com', date: weekDate(0), files: ['a.ts'] }),
      makeCommit({ hash: '3', authorEmail: 'alice@x.com', date: weekDate(1), files: ['a.ts'] }),
      makeCommit({ hash: '4', authorEmail: 'alice@x.com', date: weekDate(2), files: ['a.ts'] }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].parallelWeeks).toBe(1);
    expect(result.files[0].totalActiveWeeks).toBe(3);
  });

  it('excludes files with fewer than 3 active weeks', () => {
    const commits = [
      makeCommit({ hash: '1', authorEmail: 'alice@x.com', date: weekDate(0), files: ['a.ts'] }),
      makeCommit({ hash: '2', authorEmail: 'bob@x.com', date: weekDate(0), files: ['a.ts'] }),
      makeCommit({ hash: '3', authorEmail: 'alice@x.com', date: weekDate(1), files: ['a.ts'] }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('excludes files with parallel score below MIN_PARALLEL_SCORE (20)', () => {
    // 1 parallel week out of 10 active weeks → base score 10, severity 1.0 → score 10 < 20
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
      makeCommit({ hash: 'b0', authorEmail: 'bob@x.com', date: weekDate(0), files: ['a.ts'] }),
    );

    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files).toHaveLength(0); // score 10 < 20 threshold
  });

  it('scores higher when more authors overlap in parallel weeks', () => {
    // File A: 2 authors overlap
    // File B: 4 authors overlap (same number of parallel weeks)
    const commits = [
      // File A: weeks 0-2, parallel in week 0 (2 authors)
      makeCommit({ hash: 'a1', authorEmail: 'alice@x.com', date: weekDate(0), files: ['a.ts'] }),
      makeCommit({ hash: 'a2', authorEmail: 'bob@x.com', date: weekDate(0), files: ['a.ts'] }),
      makeCommit({ hash: 'a3', authorEmail: 'alice@x.com', date: weekDate(1), files: ['a.ts'] }),
      makeCommit({ hash: 'a4', authorEmail: 'alice@x.com', date: weekDate(2), files: ['a.ts'] }),
      // File B: weeks 0-2, parallel in week 0 (4 authors)
      makeCommit({ hash: 'b1', authorEmail: 'alice@x.com', date: weekDate(0), files: ['b.ts'] }),
      makeCommit({ hash: 'b2', authorEmail: 'bob@x.com', date: weekDate(0), files: ['b.ts'] }),
      makeCommit({ hash: 'b3', authorEmail: 'charlie@x.com', date: weekDate(0), files: ['b.ts'] }),
      makeCommit({ hash: 'b4', authorEmail: 'dave@x.com', date: weekDate(0), files: ['b.ts'] }),
      makeCommit({ hash: 'b5', authorEmail: 'alice@x.com', date: weekDate(1), files: ['b.ts'] }),
      makeCommit({ hash: 'b6', authorEmail: 'alice@x.com', date: weekDate(2), files: ['b.ts'] }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts', 'b.ts']);
    const aScore = result.files.find((f) => f.file === 'a.ts')?.parallelScore ?? 0;
    const bScore = result.files.find((f) => f.file === 'b.ts')?.parallelScore ?? 0;
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
      makeCommit({ hash: '2', authorEmail: 'bob@x.com', date: weekDate(0), files: ['deleted.ts'] }),
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
      makeCommit({ hash: '1', authorEmail: 'alice@x.com', date: weekDate(0), files: ['a.ts'] }),
      makeCommit({ hash: '2', authorEmail: 'bob@x.com', date: weekDate(0), files: ['a.ts'] }),
      makeCommit({ hash: '3', authorEmail: 'charlie@x.com', date: weekDate(0), files: ['a.ts'] }),
      // Week 1: 2 authors
      makeCommit({ hash: '4', authorEmail: 'alice@x.com', date: weekDate(1), files: ['a.ts'] }),
      makeCommit({ hash: '5', authorEmail: 'bob@x.com', date: weekDate(1), files: ['a.ts'] }),
      // Week 2: 1 author
      makeCommit({ hash: '6', authorEmail: 'alice@x.com', date: weekDate(2), files: ['a.ts'] }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.files[0].peakAuthors).toBe(3);
    expect(result.files[0].peakWindow.authors).toHaveLength(3);
    expect(result.files[0].topWindows).toHaveLength(2); // only 2 parallel weeks
  });

  it('limits hotFiles to top 10', () => {
    const files = Array.from({ length: 15 }, (_, i) => `file${i}.ts`);
    const commits = files.flatMap((file, i) => [
      makeCommit({ hash: `a${i}`, authorEmail: 'alice@x.com', date: weekDate(0), files: [file] }),
      makeCommit({ hash: `b${i}`, authorEmail: 'bob@x.com', date: weekDate(0), files: [file] }),
      makeCommit({ hash: `c${i}`, authorEmail: 'alice@x.com', date: weekDate(1), files: [file] }),
      makeCommit({ hash: `d${i}`, authorEmail: 'alice@x.com', date: weekDate(2), files: [file] }),
    ]);
    const result = analyzeParallelDev(commits, files);
    expect(result.hotFiles.length).toBeLessThanOrEqual(10);
  });

  it('generates narrative for files with parallel score >= 20', () => {
    const commits = [
      makeCommit({ hash: '1', authorEmail: 'alice@x.com', date: weekDate(0), files: ['a.ts'] }),
      makeCommit({ hash: '2', authorEmail: 'bob@x.com', date: weekDate(0), files: ['a.ts'] }),
      makeCommit({ hash: '3', authorEmail: 'alice@x.com', date: weekDate(1), files: ['a.ts'] }),
      makeCommit({ hash: '4', authorEmail: 'bob@x.com', date: weekDate(1), files: ['a.ts'] }),
      makeCommit({ hash: '5', authorEmail: 'alice@x.com', date: weekDate(2), files: ['a.ts'] }),
      makeCommit({ hash: '6', authorEmail: 'bob@x.com', date: weekDate(2), files: ['a.ts'] }),
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
    expect(result.files[0].narrative).toContain('correlates with increased defect risk');
  });
});
