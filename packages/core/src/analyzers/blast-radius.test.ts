import { describe, it, expect } from 'vitest';

import { analyzeBlastRadius } from './blast-radius.js';
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

describe('analyzeBlastRadius', () => {
  it('measures average co-changed files per commit', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '2', files: ['a.ts'] }),
    ];
    const result = analyzeBlastRadius(commits, ['a.ts', 'b.ts', 'c.ts']);
    const fileA = result.files.find((f) => f.file === 'a.ts')!;
    expect(fileA.avgCoChangedFiles).toBe(1);
    expect(fileA.maxCoChangedFiles).toBe(2);
  });

  it('excludes commits touching 30+ files', () => {
    const bigFiles = Array.from({ length: 30 }, (_, i) => `f${i}.ts`);
    const commits = [
      makeCommit({ hash: '1', files: bigFiles }),
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts'] }),
    ];
    const result = analyzeBlastRadius(commits, ['a.ts', 'b.ts', ...bigFiles]);
    const fileA = result.files.find((f) => f.file === 'a.ts')!;
    expect(fileA.avgCoChangedFiles).toBe(1);
    expect(fileA.totalCommits).toBe(1);
  });

  it('normalizes blast score to 0-100', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts', 'c.ts', 'd.ts'] }),
      makeCommit({ hash: '2', files: ['e.ts'] }),
    ];
    const tracked = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
    const result = analyzeBlastRadius(commits, tracked);
    const fileA = result.files.find((f) => f.file === 'a.ts')!;
    expect(fileA.blastScore).toBe(100);
    const fileE = result.files.find((f) => f.file === 'e.ts')!;
    expect(fileE.blastScore).toBe(0);
  });

  it('only includes tracked files', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['tracked.ts', 'gone.ts'] }),
    ];
    const result = analyzeBlastRadius(commits, ['tracked.ts']);
    expect(result.files.map((f) => f.file)).toEqual(['tracked.ts']);
  });

  it('returns empty report for no commits', () => {
    const result = analyzeBlastRadius([], []);
    expect(result.files).toHaveLength(0);
  });

  it('returns topBlasters array', () => {
    const result = analyzeBlastRadius([], []);
    expect(result.topBlasters).toBeDefined();
  });

  it('produces a summary', () => {
    const commits = [makeCommit({ hash: '1', files: ['a.ts', 'b.ts'] })];
    const result = analyzeBlastRadius(commits, ['a.ts', 'b.ts']);
    expect(result.summary).toBeTruthy();
  });
});
