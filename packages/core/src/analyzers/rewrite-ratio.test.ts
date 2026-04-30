import { describe, it, expect } from 'vitest';

import { analyzeRewriteRatio } from './rewrite-ratio.js';

import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'a@b.com',
    authorName: 'A',
    date: '2025-06-01T00:00:00Z',
    message: '',
    files: [],
    fileStats: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}

describe('analyzeRewriteRatio', () => {
  it('scores high when insertions and deletions are balanced', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 50, deletions: 50 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files[0].rewriteScore).toBe(100);
    expect(result.files[0].ratio).toBe(1);
  });

  it('scores low when mostly insertions (growth)', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 100, deletions: 10 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    // raw = 10, min = 10, confidence = 10/30, dampened: round(10 * 0.333) = 3
    expect(result.files[0].rewriteScore).toBe(3);
  });

  it('scores low when mostly deletions (shrinking)', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 5, deletions: 100 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    // raw = 5, min = 5, confidence = 5/30, dampened: round(5 * 0.166) = 1
    expect(result.files[0].rewriteScore).toBe(1);
  });

  it('accumulates across multiple commits', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 30, deletions: 20 }],
      }),
      makeCommit({
        hash: '2',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 20, deletions: 30 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files[0].rewriteScore).toBe(100);
  });

  it('excludes files with zero insertions and zero deletions', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 0, deletions: 0 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('only includes tracked files', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts', 'gone.ts'],
        fileStats: [
          { file: 'a.ts', insertions: 10, deletions: 10 },
          { file: 'gone.ts', insertions: 10, deletions: 10 },
        ],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files.map((f) => f.file)).toEqual(['a.ts']);
  });

  it('returns topRewriters array', () => {
    const result = analyzeRewriteRatio([], []);
    expect(result.topRewriters).toBeDefined();
  });

  it('produces a summary', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 50, deletions: 50 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.summary).toBeTruthy();
  });
});

describe('confidence multiplier (min(ins, del) / 30)', () => {
  it('dampens scores when min(ins,del) is below the floor', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 1, deletions: 1 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    // raw = 100, confidence = 1/30, dampened to round(100 * 1/30) = 3
    expect(result.files[0].rewriteScore).toBe(3);
  });

  it('half-dampens at min(ins,del) = 15', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 15, deletions: 15 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    // raw = 100, confidence = 15/30 = 0.5, dampened to 50
    expect(result.files[0].rewriteScore).toBe(50);
  });

  it('reaches full confidence at min(ins,del) = 30', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 30, deletions: 30 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files[0].rewriteScore).toBe(100);
  });

  it('stays at full confidence beyond the floor', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 200, deletions: 200 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files[0].rewriteScore).toBe(100);
  });

  it('leaves the raw ratio field untouched (no floor applied to ratio)', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 1, deletions: 1 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files[0].ratio).toBe(1);
  });
});

describe('aggregate fields', () => {
  it('emits totalInsertions and totalDeletions across tracked files', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts', 'b.ts'],
        fileStats: [
          { file: 'a.ts', insertions: 50, deletions: 30 },
          { file: 'b.ts', insertions: 100, deletions: 40 },
        ],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts', 'b.ts']);
    expect(result.totalInsertions).toBe(150);
    expect(result.totalDeletions).toBe(70);
  });

  it('only counts tracked files in the totals', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts', 'gone.ts'],
        fileStats: [
          { file: 'a.ts', insertions: 10, deletions: 10 },
          { file: 'gone.ts', insertions: 99, deletions: 99 },
        ],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.totalInsertions).toBe(10);
    expect(result.totalDeletions).toBe(10);
  });

  it('emits highRewrite as count of files with score >= 70', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['hi.ts', 'mid.ts', 'low.ts'],
        fileStats: [
          { file: 'hi.ts', insertions: 50, deletions: 50 }, // score 100, ≥70
          { file: 'mid.ts', insertions: 60, deletions: 30 }, // raw 50 → score 50
          { file: 'low.ts', insertions: 100, deletions: 5 }, // raw 5 → score 1 with floor
        ],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['hi.ts', 'mid.ts', 'low.ts']);
    expect(result.highRewrite).toBe(1);
  });

  it('returns zero aggregates when files is empty', () => {
    const result = analyzeRewriteRatio([], []);
    expect(result.totalInsertions).toBe(0);
    expect(result.totalDeletions).toBe(0);
    expect(result.highRewrite).toBe(0);
  });
});
