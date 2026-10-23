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
    coAuthors: [],
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

  it('filters out sweeping commits (more than 20 files), as fix rate does', () => {
    const bigFiles = Array.from({ length: 21 }, (_, i) => `file${i}.ts`);
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

  it('keeps a 20-file commit: only more than 20 is sweeping', () => {
    const files = Array.from({ length: 20 }, (_, i) => `f${i}.ts`);
    const commits = ['1', '2', '3'].map((hash) => makeCommit({ hash, files }));
    const result = analyzeCoupling(commits, files);
    expect(result.pairs.length).toBe((20 * 19) / 2);
  });

  describe('packages', () => {
    const commits = [
      // Five commits change server and client together; one changes docs too.
      ...['1', '2', '3', '4'].map((hash) =>
        makeCommit({
          hash,
          files: ['packages/server/a.ts', 'packages/client/b.ts'],
        }),
      ),
      makeCommit({
        hash: '5',
        files: ['packages/server/a.ts', 'packages/client/b.ts', 'README.md'],
      }),
      makeCommit({ hash: '6', files: ['packages/server/c.ts'] }),
      makeCommit({ hash: '7', files: ['packages/client/b.ts', 'docs/x.md'] }),
    ];
    const tracked = [
      'packages/server/a.ts',
      'packages/server/c.ts',
      'packages/client/b.ts',
      'README.md',
      'docs/x.md',
    ];
    const result = analyzeCoupling(commits, tracked);

    it('counts commits per package', () => {
      expect(result.packageCommits).toEqual([
        { package: 'packages/client', commits: 6 },
        { package: 'packages/server', commits: 6 },
        { package: '', commits: 1 },
        { package: 'docs', commits: 1 },
      ]);
    });

    it('links packages that changed together 3+ times, with the pairs behind it', () => {
      expect(result.packages).toHaveLength(1);
      const [link] = result.packages;
      expect(link).toMatchObject({
        packageA: 'packages/client',
        packageB: 'packages/server',
        commits: 5,
        share: 5 / 6,
      });
      expect(
        link.filePairs.map((p) => [p.fileA, p.fileB, p.coCommits]),
      ).toEqual([['packages/client/b.ts', 'packages/server/a.ts', 5]]);
    });
  });

  describe('families', () => {
    const fork = (hash: string, extra: string[] = []) =>
      makeCommit({
        hash,
        files: ['flags/a.ts', 'flags/b.ts', 'other/c.ts', ...extra],
      });
    const commits = [
      fork('1'),
      fork('2'),
      fork('3'),
      fork('4', ['hub.ts']),
      // hub.ts is busy elsewhere: it rides along with the family, not in it.
      ...Array.from({ length: 12 }, (_, i) =>
        makeCommit({ hash: `h${i}`, files: ['hub.ts', `x${i}.ts`] }),
      ),
    ];
    const tracked = [
      'flags/a.ts',
      'flags/b.ts',
      'other/c.ts',
      'hub.ts',
      ...Array.from({ length: 12 }, (_, i) => `x${i}.ts`),
    ];
    const result = analyzeCoupling(commits, tracked);

    it('groups files that change together both ways, naming their packages', () => {
      expect(result.families).toHaveLength(1);
      expect(result.families[0].files).toEqual([
        'flags/a.ts',
        'flags/b.ts',
        'other/c.ts',
      ]);
      expect(result.families[0].packages).toEqual(['flags', 'other']);
      expect(result.families[0].pairs).toHaveLength(3);
    });

    it('needs 4 shared commits', () => {
      const thin = analyzeCoupling(commits.slice(0, 3), tracked);
      expect(thin.families).toEqual([]);
    });
  });
});
