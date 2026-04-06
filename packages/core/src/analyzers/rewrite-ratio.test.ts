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
    expect(result.files[0].rewriteScore).toBe(10);
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
    expect(result.files[0].rewriteScore).toBe(5);
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
