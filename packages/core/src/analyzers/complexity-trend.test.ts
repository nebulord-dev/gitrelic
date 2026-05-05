import { describe, it, expect } from 'vitest';

import { analyzeComplexityTrend } from './complexity-trend.js';
import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'a@b.com',
    authorName: 'A',
    date: '2025-06-01T00:00:00Z',
    message: '',
    coAuthors: [],
    files: [],
    fileStats: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}

describe('analyzeComplexityTrend', () => {
  it('returns empty report for no commits', () => {
    const result = analyzeComplexityTrend([], []);
    expect(result.files).toHaveLength(0);
    expect(result.growingFiles).toHaveLength(0);
    expect(result.shrinkingFiles).toHaveLength(0);
    expect(result.summary).toBeTruthy();
  });

  it('classifies a growing file', () => {
    const commits = [
      makeCommit({
        hash: '1',
        date: '2025-01-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 20, deletions: 5 }],
      }),
      makeCommit({
        hash: '2',
        date: '2025-02-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 25, deletions: 3 }],
      }),
      makeCommit({
        hash: '3',
        date: '2025-03-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 30, deletions: 10 }],
      }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].trend).toBe('growing');
    expect(result.files[0].totalNetLines).toBe(57); // (20-5) + (25-3) + (30-10)
    expect(result.growingFiles).toHaveLength(1);
  });

  it('classifies a shrinking file', () => {
    const commits = [
      makeCommit({
        hash: '1',
        date: '2025-01-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 2, deletions: 20 }],
      }),
      makeCommit({
        hash: '2',
        date: '2025-02-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 3, deletions: 25 }],
      }),
      makeCommit({
        hash: '3',
        date: '2025-03-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 1, deletions: 15 }],
      }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.files[0].trend).toBe('shrinking');
    expect(result.shrinkingFiles).toHaveLength(1);
  });

  it('classifies a stable file (net change within threshold)', () => {
    const commits = [
      makeCommit({
        hash: '1',
        date: '2025-01-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 10, deletions: 8 }],
      }),
      makeCommit({
        hash: '2',
        date: '2025-02-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 5, deletions: 7 }],
      }),
      makeCommit({
        hash: '3',
        date: '2025-03-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 8, deletions: 6 }],
      }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.files[0].trend).toBe('stable');
  });

  it('excludes files with fewer than 2 active months', () => {
    const commits = [
      makeCommit({
        hash: '1',
        date: '2025-01-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 50, deletions: 0 }],
      }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('uses last 3 active months for recentGrowthRate, not calendar months', () => {
    const commits = [
      makeCommit({
        hash: '1',
        date: '2025-01-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 10, deletions: 0 }],
      }),
      makeCommit({
        hash: '2',
        date: '2025-03-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 20, deletions: 0 }],
      }),
      makeCommit({
        hash: '3',
        date: '2025-09-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 30, deletions: 0 }],
      }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.files[0].recentGrowthRate).toBe(20);
  });

  it('excludes files not in trackedFiles', () => {
    const commits = [
      makeCommit({
        hash: '1',
        date: '2025-01-15T00:00:00Z',
        files: ['a.ts', 'deleted.ts'],
        fileStats: [
          { file: 'a.ts', insertions: 10, deletions: 0 },
          { file: 'deleted.ts', insertions: 10, deletions: 0 },
        ],
      }),
      makeCommit({
        hash: '2',
        date: '2025-02-15T00:00:00Z',
        files: ['a.ts', 'deleted.ts'],
        fileStats: [
          { file: 'a.ts', insertions: 10, deletions: 0 },
          { file: 'deleted.ts', insertions: 10, deletions: 0 },
        ],
      }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.files.map((f) => f.file)).toEqual(['a.ts']);
  });

  it('computes cumulative values correctly across buckets', () => {
    const commits = [
      makeCommit({
        hash: '1',
        date: '2025-01-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 10, deletions: 0 }],
      }),
      makeCommit({
        hash: '2',
        date: '2025-02-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 2, deletions: 5 }],
      }),
      makeCommit({
        hash: '3',
        date: '2025-03-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 8, deletions: 0 }],
      }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    const buckets = result.files[0].buckets;
    expect(buckets[0]).toEqual({
      month: '2025-01',
      netLines: 10,
      cumulative: 10,
    });
    expect(buckets[1]).toEqual({
      month: '2025-02',
      netLines: -3,
      cumulative: 7,
    });
    expect(buckets[2]).toEqual({
      month: '2025-03',
      netLines: 8,
      cumulative: 15,
    });
  });

  it('sorts by absolute recentGrowthRate with alphabetical tiebreaker', () => {
    const commits = [
      makeCommit({
        hash: '1',
        date: '2025-01-15T00:00:00Z',
        files: ['b.ts'],
        fileStats: [{ file: 'b.ts', insertions: 10, deletions: 0 }],
      }),
      makeCommit({
        hash: '2',
        date: '2025-02-15T00:00:00Z',
        files: ['b.ts'],
        fileStats: [{ file: 'b.ts', insertions: 10, deletions: 0 }],
      }),
      makeCommit({
        hash: '3',
        date: '2025-01-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 10, deletions: 0 }],
      }),
      makeCommit({
        hash: '4',
        date: '2025-02-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 10, deletions: 0 }],
      }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts', 'b.ts']);
    expect(result.files[0].file).toBe('a.ts');
    expect(result.files[1].file).toBe('b.ts');
  });

  it('produces a summary with counts', () => {
    const commits = [
      makeCommit({
        hash: '1',
        date: '2025-01-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 20, deletions: 0 }],
      }),
      makeCommit({
        hash: '2',
        date: '2025-02-15T00:00:00Z',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 20, deletions: 0 }],
      }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.summary).toContain('growing');
  });
});
