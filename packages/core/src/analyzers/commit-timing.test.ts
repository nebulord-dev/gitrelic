import { describe, it, expect } from 'vitest';

import { analyzeCommitTiming } from './commit-timing.js';

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

describe('analyzeCommitTiming', () => {
  it('late night commits get high lateNightPercent', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-02T23:30:00-04:00', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-03T01:15:00-04:00', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-04T02:00:00-04:00', files: ['a.ts'] }),
      makeCommit({ hash: '4', date: '2025-06-05T03:45:00-04:00', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].lateNightPercent).toBe(100);
  });

  it('weekend commits get high weekendPercent', () => {
    // 2025-06-07 is Saturday, 2025-06-08 is Sunday
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-07T10:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-08T14:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-07T16:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files[0].weekendPercent).toBe(100);
  });

  it('stress score combines both signals', () => {
    // All late night + all weekend = max stress
    // 2025-06-07 is Saturday, 2025-06-08 is Sunday
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-07T23:30:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-08T01:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-07T02:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    const profile = result.files[0];
    // lateNightPercent = 100, weekendPercent = 100
    // stressScore = 100 * 0.6 + 100 * 0.4 = 100
    expect(profile.stressScore).toBe(100);
  });

  it('files with < 3 commits are excluded', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-02T10:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-03T10:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('hour distribution has 24 entries', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-02T10:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-03T14:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-04T14:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files[0].hourDistribution).toHaveLength(24);
    expect(result.files[0].hourDistribution.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('peak hour is correctly identified', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-02T14:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-03T14:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-04T10:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files[0].peakHour).toBe(14);
  });

  it('only tracked files are included', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-02T10:00:00Z', files: ['a.ts', 'deleted.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-03T10:00:00Z', files: ['a.ts', 'deleted.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-04T10:00:00Z', files: ['a.ts', 'deleted.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files.map((f) => f.file)).toEqual(['a.ts']);
  });

  it('empty commits returns sensible defaults', () => {
    const result = analyzeCommitTiming([], []);
    expect(result.files).toHaveLength(0);
    expect(result.stressFiles).toHaveLength(0);
    expect(result.repoLateNightPercent).toBe(0);
    expect(result.repoWeekendPercent).toBe(0);
    expect(result.summary).toBeTruthy();
  });

  it('summary is generated', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-02T10:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-03T23:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-04T10:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.summary).toContain('% of commits happen after hours');
    expect(result.summary).toContain('% on weekends');
  });
});
