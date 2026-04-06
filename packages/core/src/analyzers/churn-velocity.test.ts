import { describe, it, expect } from 'vitest';

import { analyzeChurnVelocity } from './churn-velocity.js';

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

describe('analyzeChurnVelocity', () => {
  it('classifies file with recent-heavy commits as accelerating', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-10-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-11-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '4', date: '2025-12-01T00:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.files[0].trend).toBe('accelerating');
    expect(result.files[0].velocityScore).toBeGreaterThan(60);
  });

  it('classifies file with old-heavy commits as decelerating', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-02-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-03-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '4', date: '2025-12-01T00:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.files[0].trend).toBe('decelerating');
    expect(result.files[0].velocityScore).toBeLessThan(40);
  });

  it('classifies evenly spread commits as stable', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-04-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-08-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '4', date: '2025-12-01T00:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.files[0].trend).toBe('stable');
  });

  it('excludes files with fewer than 2 commits', () => {
    const commits = [makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts'] })];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('only includes tracked files', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts', 'deleted.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-01T00:00:00Z', files: ['a.ts', 'deleted.ts'] }),
    ];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.files.map((f) => f.file)).toEqual(['a.ts']);
  });

  it('returns acceleratingFiles array', () => {
    const result = analyzeChurnVelocity([], []);
    expect(result.acceleratingFiles).toBeDefined();
  });

  it('produces a summary', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-12-01T00:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.summary).toBeTruthy();
  });
});
