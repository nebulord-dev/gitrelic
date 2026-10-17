import { buildCommitIndex } from '@gitrelic/core';
import { describe, expect, it } from 'vitest';

import { fromCommitIndex, fromRawCommits } from './commitLike';
import type { CommitIndex, RawCommit } from '@gitrelic/core';

// Uses core's real encoder (from its built dist — `pnpm test` builds first),
// so a change to the index's units or layout fails here, not in Atlas.

function raw(o: Partial<RawCommit> & Pick<RawCommit, 'date'>): RawCommit {
  return {
    hash: 'a'.repeat(40),
    authorEmail: 'ann@corp.com',
    authorName: 'Ann',
    message: 'm',
    coAuthors: [],
    files: [],
    fileStats: [],
    insertions: 0,
    deletions: 0,
    ...o,
  };
}

// Newest first, as `report.commits` arrives from git log. The middle commit's
// ISO string sorts after the last one's, but its instant is earlier.
const commits = [
  raw({ hash: 'c'.repeat(40), date: '2026-01-03T12:00:00Z' }),
  raw({
    hash: 'b'.repeat(40),
    date: '2026-01-02T09:00:00Z',
    authorEmail: 'bob@corp.com',
    files: ['src/a.ts', 'src/b.ts'],
  }),
  raw({ date: '2026-01-01T23:30:00-08:00', files: ['src/a.ts'] }),
];

describe('fromRawCommits', () => {
  it('converts dates (with offsets) to epoch ms, oldest first', () => {
    expect(fromRawCommits(commits)).toEqual([
      {
        timeMs: Date.parse('2026-01-02T07:30:00Z'),
        author: 'ann@corp.com',
        files: ['src/a.ts'],
      },
      {
        timeMs: Date.parse('2026-01-02T09:00:00Z'),
        author: 'bob@corp.com',
        files: ['src/a.ts', 'src/b.ts'],
      },
      {
        timeMs: Date.parse('2026-01-03T12:00:00Z'),
        author: 'ann@corp.com',
        files: [],
      },
    ]);
  });
});

describe('fromCommitIndex', () => {
  it('decodes core’s index to exactly what fromRawCommits yields', () => {
    expect(fromCommitIndex(buildCommitIndex(commits))).toEqual(
      fromRawCommits(commits),
    );
  });

  it('decodes an empty history', () => {
    expect(fromCommitIndex(buildCommitIndex([]))).toEqual([]);
  });

  it('refuses an index version it does not understand', () => {
    const future = { ...buildCommitIndex(commits), version: 2 };
    expect(() => fromCommitIndex(future as unknown as CommitIndex)).toThrow(
      /version 2/,
    );
  });
});
