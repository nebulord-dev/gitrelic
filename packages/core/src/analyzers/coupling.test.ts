import { describe, it, expect } from 'vitest';

import { analyzeCoupling } from './coupling.js';

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

describe('analyzeCoupling', () => {
  it('detects co-occurring file pairs', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '2', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '3', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '4', files: ['auth.ts'] }),
    ];
    const tracked = ['auth.ts', 'session.ts'];

    const result = analyzeCoupling(commits, tracked);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].coCommits).toBe(3);
    expect(result.pairs[0].couplingStrength).toBe(100);
  });

  it('filters out commits touching 30+ files', () => {
    const bigFiles = Array.from({ length: 30 }, (_, i) => `file${i}.ts`);
    const commits = [
      makeCommit({ hash: '1', files: bigFiles }),
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '3', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '4', files: ['a.ts', 'b.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts', ...bigFiles]);

    const bigFilePair = result.pairs.find(
      (p) => p.fileA === 'file0.ts' || p.fileB === 'file0.ts',
    );
    expect(bigFilePair).toBeUndefined();
  });

  it('requires minimum 3 co-occurrences', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts']);

    expect(result.pairs).toHaveLength(0);
  });

  it('requires minimum 30% coupling strength', () => {
    const commits: RawCommit[] = [];
    for (let i = 0; i < 10; i++)
      commits.push(makeCommit({ hash: `a${i}`, files: ['a.ts'] }));
    for (let i = 0; i < 10; i++)
      commits.push(makeCommit({ hash: `b${i}`, files: ['b.ts'] }));
    for (let i = 0; i < 3; i++)
      commits.push(makeCommit({ hash: `ab${i}`, files: ['a.ts', 'b.ts'] }));

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts']);

    expect(result.pairs).toHaveLength(0); // 3/13 = 23% < 30%
  });

  it('includes pairs at exactly 30% coupling strength', () => {
    const commits: RawCommit[] = [];
    for (let i = 0; i < 7; i++)
      commits.push(makeCommit({ hash: `a${i}`, files: ['a.ts'] }));
    for (let i = 0; i < 7; i++)
      commits.push(makeCommit({ hash: `b${i}`, files: ['b.ts'] }));
    for (let i = 0; i < 3; i++)
      commits.push(makeCommit({ hash: `ab${i}`, files: ['a.ts', 'b.ts'] }));

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts']);

    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].couplingStrength).toBe(30);
  });

  it('uses min(totalA, totalB) as denominator for strength', () => {
    const commits: RawCommit[] = [
      makeCommit({ hash: '1', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '2', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '3', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '4', files: ['auth.ts', 'session.ts'] }),
      makeCommit({ hash: '5', files: ['auth.ts'] }),
      makeCommit({ hash: '6', files: ['auth.ts'] }),
      makeCommit({ hash: '7', files: ['auth.ts'] }),
      makeCommit({ hash: '8', files: ['auth.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['auth.ts', 'session.ts']);

    expect(result.pairs[0].couplingStrength).toBe(100);
    expect(result.pairs[0].totalCommitsA).toBe(8);
    expect(result.pairs[0].totalCommitsB).toBe(4);
  });

  it('builds per-file coupling profiles', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '3', files: ['a.ts', 'b.ts', 'c.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts', 'c.ts']);

    const profileA = result.fileProfiles.find((p) => p.file === 'a.ts')!;
    expect(profileA.partners).toHaveLength(2);
    expect(profileA.topPartner).toBeTruthy();
    expect(profileA.couplingScore).toBeGreaterThan(0);
  });

  it('ignores files not in tracked set', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['tracked.ts', 'deleted.ts'] }),
      makeCommit({ hash: '2', files: ['tracked.ts', 'deleted.ts'] }),
      makeCommit({ hash: '3', files: ['tracked.ts', 'deleted.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['tracked.ts']);

    expect(result.pairs).toHaveLength(0);
  });

  it('returns empty report when no qualifying pairs exist', () => {
    const commits = [makeCommit({ hash: '1', files: ['lonely.ts'] })];

    const result = analyzeCoupling(commits, ['lonely.ts']);

    expect(result.pairs).toHaveLength(0);
    expect(result.fileProfiles).toHaveLength(0);
    expect(result.topPairs).toHaveLength(0);
  });

  it('limits topPairs to 20', () => {
    const files = Array.from({ length: 6 }, (_, i) => `f${i}.ts`);
    const commits = [
      makeCommit({ hash: '1', files }),
      makeCommit({ hash: '2', files }),
      makeCommit({ hash: '3', files }),
    ];

    const result = analyzeCoupling(commits, files);

    expect(result.topPairs.length).toBeLessThanOrEqual(20);
  });

  it('sorts pairs by coupling strength descending', () => {
    const commits: RawCommit[] = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '3', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '4', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '5', files: ['a.ts', 'b.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts', 'c.ts']);

    expect(result.pairs[0].couplingStrength).toBeGreaterThanOrEqual(
      result.pairs[result.pairs.length - 1].couplingStrength,
    );
  });

  it('produces a summary string', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts'] }),
      makeCommit({ hash: '3', files: ['a.ts', 'b.ts'] }),
    ];

    const result = analyzeCoupling(commits, ['a.ts', 'b.ts']);

    expect(result.summary).toContain('1');
  });
});
