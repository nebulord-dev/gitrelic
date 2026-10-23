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

  it('excludes sweeping commits (more than 20 files), as fix rate does', () => {
    const bigFiles = Array.from({ length: 21 }, (_, i) => `f${i}.ts`);
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

  describe('median over enough commits', () => {
    const others = (n: number) =>
      Array.from({ length: n }, (_, i) => `o${i}.ts`);
    // hub.ts: seven commits alone with one other file, one with 15 others.
    const commits = [
      ...Array.from({ length: 7 }, (_, i) =>
        makeCommit({ hash: `s${i}`, files: ['hub.ts', `p${i}.ts`] }),
      ),
      makeCommit({ hash: 'wide', files: ['hub.ts', ...others(15)] }),
      makeCommit({ hash: 'thin', files: ['thin.ts', ...others(10)] }),
    ];
    const quiet = Array.from({ length: 7 }, (_, i) => `p${i}.ts`);
    const result = analyzeBlastRadius(commits, [
      'hub.ts',
      'thin.ts',
      ...others(15),
      ...quiet,
    ]);
    const hub = result.files.find((f) => f.file === 'hub.ts')!;

    it('rates a file by its median, which one wide commit can’t drag up', () => {
      expect(hub.totalCommits).toBe(8);
      expect(hub.medianCoChanged).toBe(1);
      expect(hub.avgCoChangedFiles).toBe(2.8);
    });

    it('keeps its footprint: commits by how many other files each changed', () => {
      expect(hub.footprint).toHaveLength(20);
      expect(hub.footprint![1]).toBe(7);
      expect(hub.footprint![15]).toBe(1);
      expect(hub.footprint!.reduce((a, b) => a + b, 0)).toBe(8);
    });

    it('leaves files under 8 commits unrated, and counts the rated', () => {
      const thin = result.files.find((f) => f.file === 'thin.ts')!;
      expect(thin.medianCoChanged).toBeUndefined();
      expect(thin.footprint).toBeUndefined();
      expect(result.minCommits).toBe(8);
      expect(result.rated).toBe(1);
    });
  });
});
