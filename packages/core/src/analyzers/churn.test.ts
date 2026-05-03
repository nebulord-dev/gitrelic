import { describe, it, expect } from 'vitest';

import { analyzeChurn } from './churn.js';

import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
    authorName: 'Alice',
    date: '2025-06-01T00:00:00Z',
    message: '',
    files: [],
    fileStats: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}

describe('analyzeChurn', () => {
  it('assigns churnScore 100 to the most-committed file', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '2', files: ['a.ts'] }),
      makeCommit({ hash: '3', files: ['a.ts'] }),
    ];
    const result = analyzeChurn(commits, ['a.ts', 'b.ts']);
    const fileA = result.files.find((f) => f.file === 'a.ts')!;
    expect(fileA.churnScore).toBe(100);
  });

  it('assigns correct churn categories', () => {
    // Create commits so that files get different scores
    // a.ts: 10 commits (100), b.ts: 6 commits (60), c.ts: 2 commits (20), d.ts: 1 commit (10)
    const commits: RawCommit[] = [];
    for (let i = 0; i < 10; i++)
      commits.push(makeCommit({ hash: `a${i}`, files: ['a.ts'] }));
    for (let i = 0; i < 6; i++)
      commits.push(makeCommit({ hash: `b${i}`, files: ['b.ts'] }));
    for (let i = 0; i < 2; i++)
      commits.push(makeCommit({ hash: `c${i}`, files: ['c.ts'] }));
    commits.push(makeCommit({ hash: 'd0', files: ['d.ts'] }));

    const result = analyzeChurn(commits, ['a.ts', 'b.ts', 'c.ts', 'd.ts']);
    expect(result.files.find((f) => f.file === 'a.ts')!.category).toBe('hot'); // 100
    expect(result.files.find((f) => f.file === 'b.ts')!.category).toBe('warm'); // 60
    expect(result.files.find((f) => f.file === 'c.ts')!.category).toBe('cold'); // 20
    expect(result.files.find((f) => f.file === 'd.ts')!.category).toBe(
      'frozen',
    ); // 10
  });

  it('limits topFiles to 20', () => {
    const files = Array.from({ length: 25 }, (_, i) => `file${i}.ts`);
    const commits = files.map((file, i) =>
      makeCommit({ hash: `h${i}`, files: [file] }),
    );
    const result = analyzeChurn(commits, files);
    expect(result.topFiles.length).toBe(20);
  });

  it('ignores files not in tracked set', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['tracked.ts', 'deleted.ts'] }),
    ];
    const result = analyzeChurn(commits, ['tracked.ts']);
    expect(result.files.map((f) => f.file)).toEqual(['tracked.ts']);
  });

  it('counts hotspots (churnScore > 75)', () => {
    // a.ts: 10 commits (100), b.ts: 8 commits (80) — both hot
    // c.ts: 1 commit (10) — frozen
    const commits: RawCommit[] = [];
    for (let i = 0; i < 10; i++)
      commits.push(makeCommit({ hash: `a${i}`, files: ['a.ts'] }));
    for (let i = 0; i < 8; i++)
      commits.push(makeCommit({ hash: `b${i}`, files: ['b.ts'] }));
    commits.push(makeCommit({ hash: 'c0', files: ['c.ts'] }));

    const result = analyzeChurn(commits, ['a.ts', 'b.ts', 'c.ts']);
    expect(result.hotspotCount).toBe(2);
  });

  it('produces summary referencing top file', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['main.ts'] }),
      makeCommit({ hash: '2', files: ['main.ts'] }),
    ];
    const result = analyzeChurn(commits, ['main.ts']);
    expect(result.summary).toContain('main.ts');
  });
});
