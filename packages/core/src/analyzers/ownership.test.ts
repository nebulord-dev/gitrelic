import { describe, it, expect } from 'vitest';

import { packageResolver } from '../utils/workspace.js';
import { analyzeOwnership, MIN_PACKAGE_COMMITS } from './ownership.js';
import type { RawCommit } from '../utils/git.js';

const DAY = 86_400_000;
const AS_OF = Date.parse('2026-06-30T00:00:00Z');
const pkgOf = packageResolver(['packages/a', 'packages/b']);

let seq = 0;
function commit(
  author: string,
  files: string[],
  daysAgo = 10,
  overrides: Partial<RawCommit> = {},
): RawCommit {
  return {
    hash: `h${seq++}`,
    authorEmail: `${author}@example.com`,
    authorName: author,
    date: new Date(AS_OF - daysAgo * DAY).toISOString(),
    message: '',
    coAuthors: [],
    files,
    fileStats: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}
const times = (n: number, make: (i: number) => RawCommit) =>
  Array.from({ length: n }, (_, i) => make(i));
const run = (commits: RawCommit[], files?: string[]) =>
  analyzeOwnership(
    commits,
    files ?? [...new Set(commits.flatMap((c) => c.files))],
    pkgOf,
    AS_OF,
  );

describe('analyzeOwnership: packages', () => {
  it(`rates a package from ${MIN_PACKAGE_COMMITS} commits and counts the rest`, () => {
    const result = run([
      ...times(MIN_PACKAGE_COMMITS, () => commit('ann', ['packages/a/x.ts'])),
      ...times(MIN_PACKAGE_COMMITS - 1, () =>
        commit('ann', ['packages/b/y.ts']),
      ),
    ]);
    expect(result.packages.map((p) => p.package)).toEqual(['packages/a']);
    expect(result.belowFloor).toBe(1);
  });

  it('counts a commit once per package, however many of its files it touches', () => {
    const result = run(
      times(10, () => commit('ann', ['packages/a/x.ts', 'packages/a/y.ts'])),
    );
    expect(result.packages[0].commits).toBe(10);
  });

  it('names an owner at 30%, and none (shared) below it', () => {
    const owned = run([
      ...times(3, () => commit('ann', ['packages/a/x.ts'])),
      ...times(7, (i) => commit(`p${i}`, ['packages/a/x.ts'])),
    ]).packages[0];
    expect(owned.owner).toBe('ann@example.com');
    expect(owned.topShare).toBe(30);

    const shared = run([
      ...times(2, () => commit('ann', ['packages/a/x.ts'])),
      ...times(8, (i) => commit(`p${i}`, ['packages/a/x.ts'])),
    ]).packages[0];
    expect(shared.owner).toBeNull();
    expect(shared.shares[0]).toEqual({ email: 'ann@example.com', commits: 2 });
  });

  it('says a package rests on one person from 75%', () => {
    const at = (n: number) =>
      run([
        ...times(n, () => commit('ann', ['packages/a/x.ts'])),
        ...times(20 - n, () => commit('bob', ['packages/a/x.ts'])),
      ]).packages[0].onePerson;
    expect(at(15)).toBe(true);
    expect(at(14)).toBe(false);
  });

  it('marks the top contributor quiet after 90 days without a commit', () => {
    const pkg = (annLast: number) =>
      run([
        ...times(10, () => commit('ann', ['packages/a/x.ts'], annLast)),
        commit('bob', ['packages/a/x.ts'], 1),
      ]).packages[0];
    expect(pkg(91).topQuiet).toBe(true);
    expect(pkg(89).topQuiet).toBe(false);
  });

  it('counts someone as knowing a package at 10% and 3 commits', () => {
    const result = run([
      ...times(24, () => commit('ann', ['packages/a/x.ts'])),
      ...times(3, () => commit('bob', ['packages/a/x.ts'])), // 10%, 3 commits
      ...times(2, () => commit('cy', ['packages/a/x.ts'])), // 2 commits
      commit('dee', ['packages/a/x.ts']),
    ]);
    expect(result.packages[0].knowers).toEqual([
      'ann@example.com',
      'bob@example.com',
    ]);
  });

  it('leaves bots out', () => {
    const result = run([
      ...times(10, () => commit('ann', ['packages/a/x.ts'])),
      ...times(30, () =>
        commit('semantic-release-bot', ['packages/a/x.ts'], 1, {
          authorEmail: 'semantic-release-bot@martynus.net',
        }),
      ),
    ]);
    expect(result.packages[0].shares).toEqual([
      { email: 'ann@example.com', commits: 10 },
    ]);
  });

  it('counts deleted files in a package, and leaves out what `counts` rejects', () => {
    const commits = times(10, () =>
      commit('ann', ['packages/a/gone.ts', 'packages/b/gen.ts']),
    );
    const result = analyzeOwnership(
      commits,
      [], // neither file exists at the analyzed commit
      pkgOf,
      AS_OF,
      (f) => !f.endsWith('gen.ts'),
    );
    expect(result.packages.map((p) => p.package)).toEqual(['packages/a']);
    // The truck factor reads only files that exist.
    expect(result.truckFactor.files).toBe(0);
  });

  it('sorts packages by commits, most first', () => {
    const result = run([
      ...times(10, () => commit('ann', ['packages/a/x.ts'])),
      ...times(12, () => commit('ann', ['packages/b/y.ts'])),
    ]);
    expect(result.packages.map((p) => p.package)).toEqual([
      'packages/b',
      'packages/a',
    ]);
  });
});

describe('analyzeOwnership: truck factor', () => {
  // Each file gets two commits so it qualifies.
  const owns = (author: string, file: string) => [
    commit(author, [file]),
    commit(author, [file]),
  ];

  it('removes people until more than half the files have nobody left', () => {
    const result = run([
      ...owns('ann', 'packages/a/1.ts'),
      ...owns('ann', 'packages/a/2.ts'),
      ...owns('ann', 'packages/a/3.ts'),
      ...owns('bob', 'packages/a/4.ts'),
    ]);
    expect(result.truckFactor).toEqual({
      value: 1,
      people: ['ann@example.com'],
      files: 4,
    });
  });

  it('needs more than half: an even split takes both people', () => {
    const result = run([
      ...owns('ann', 'packages/a/1.ts'),
      ...owns('ann', 'packages/a/2.ts'),
      ...owns('bob', 'packages/a/3.ts'),
      ...owns('bob', 'packages/a/4.ts'),
    ]);
    expect(result.truckFactor.value).toBe(2);
  });

  it('leaves out files changed once', () => {
    const result = run([
      ...owns('ann', 'packages/a/1.ts'),
      commit('bob', ['packages/a/2.ts']),
      commit('bob', ['packages/a/3.ts']),
    ]);
    expect(result.truckFactor).toEqual({
      value: 1,
      people: ['ann@example.com'],
      files: 1,
    });
  });

  it('keeps a minor contributor off a file someone else wrote', () => {
    // ann: 6 changes; bob: 1. bob's degree of authorship is far below 75% of ann's.
    const commits = [
      ...times(6, () => commit('ann', ['packages/a/1.ts'])),
      commit('bob', ['packages/a/1.ts']),
    ];
    expect(run(commits).truckFactor.people).toEqual(['ann@example.com']);
  });

  it('is computed per package too', () => {
    const result = run([
      ...times(5, () => commit('ann', ['packages/a/1.ts'])),
      ...times(5, () => commit('bob', ['packages/a/2.ts'])),
      ...times(10, () => commit('cy', ['packages/b/3.ts'])),
    ]);
    const a = result.packages.find((p) => p.package === 'packages/a')!;
    const b = result.packages.find((p) => p.package === 'packages/b')!;
    expect(a.truckFactor.value).toBe(2);
    expect(b.truckFactor).toEqual({
      value: 1,
      people: ['cy@example.com'],
      files: 1,
    });
  });

  it('is 0 with nothing to rate', () => {
    expect(run([]).truckFactor).toEqual({ value: 0, people: [], files: 0 });
  });
});
