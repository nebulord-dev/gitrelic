import { describe, expect, it } from 'vitest';

import { fromCommitIndex, fromRawCommits } from './commitLike';
import type { CommitIndex, RawCommit } from '@gitrelic/core';

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

// The same two commits, as core's buildCommitIndex would encode them:
// time-sorted, authors and paths stored once, files in CSR form.
const commits = [
  raw({ date: '2026-01-01T23:30:00-08:00', files: ['src/a.ts'] }),
  raw({
    date: '2026-01-02T09:00:00Z',
    authorEmail: 'bob@corp.com',
    files: ['src/a.ts', 'src/b.ts'],
  }),
];
const index: CommitIndex = {
  version: 1,
  authors: ['ann@corp.com', 'bob@corp.com'],
  authorNames: ['Ann', 'Bob'],
  files: ['src/a.ts', 'src/b.ts'],
  time: [
    Date.parse('2026-01-02T07:30:00Z') / 1000,
    Date.parse('2026-01-02T09:00:00Z') / 1000,
  ],
  tz: [-480, 0],
  author: [0, 1],
  fileOffsets: [0, 1, 3],
  fileIds: [0, 0, 1],
  insertions: [0, 0],
  deletions: [0, 0],
  hash: ['aaaaaaaaaaaa', 'aaaaaaaaaaaa'],
};

describe('fromRawCommits', () => {
  it('converts ISO dates (with offsets) to epoch ms', () => {
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
    ]);
  });
});

describe('fromCommitIndex', () => {
  it('decodes the columnar index to the same commits as fromRawCommits', () => {
    expect(fromCommitIndex(index)).toEqual(fromRawCommits(commits));
  });

  it('handles commits with no files and an empty index', () => {
    const empty: CommitIndex = {
      ...index,
      time: [index.time[0]],
      tz: [0],
      author: [0],
      fileOffsets: [0, 0],
      fileIds: [],
    };
    expect(fromCommitIndex(empty)[0].files).toEqual([]);
    expect(
      fromCommitIndex({ ...index, time: [], author: [], fileOffsets: [0] }),
    ).toEqual([]);
  });
});
