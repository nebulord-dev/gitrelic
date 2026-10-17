import { describe, expect, it } from 'vitest';

import { buildCommitIndex, parseUtcOffsetMinutes } from './commitIndex.js';
import type { CommitIndex } from '../types.js';
import type { RawCommit } from './git.js';

function commit(
  o: Partial<RawCommit> & Pick<RawCommit, 'hash' | 'date'>,
): RawCommit {
  return {
    authorEmail: 'ann@corp.com',
    authorName: 'Ann Lee',
    message: 'm',
    coAuthors: [],
    files: [],
    fileStats: [],
    insertions: 0,
    deletions: 0,
    ...o,
  };
}

/** Expands the columnar index back into one object per commit. */
function decode(ix: CommitIndex) {
  return ix.time.map((time, i) => ({
    hash: ix.hash[i],
    time,
    tz: ix.tz[i],
    author: ix.authors[ix.author[i]],
    authorName: ix.authorNames[ix.author[i]],
    files: ix.fileIds
      .slice(ix.fileOffsets[i], ix.fileOffsets[i + 1])
      .map((id) => ix.files[id]),
    insertions: ix.insertions[i],
    deletions: ix.deletions[i],
  }));
}

describe('parseUtcOffsetMinutes', () => {
  it.each([
    ['2026-01-01T10:00:00Z', 0],
    ['2026-01-01T10:00:00+00:00', 0],
    ['2026-01-01T10:00:00-08:00', -480],
    ['2026-01-01T10:00:00+05:30', 330],
    ['2026-01-01T10:00:00+14:00', 840],
  ])('%s → %i', (iso, minutes) => {
    expect(parseUtcOffsetMinutes(iso)).toBe(minutes);
  });
});

describe('buildCommitIndex', () => {
  const commits = [
    commit({
      hash: 'b'.repeat(40),
      date: '2026-01-02T09:00:00+00:00',
      authorEmail: 'bob@corp.com',
      authorName: 'Bob Brown',
      files: ['src/a.ts', 'src/b.ts'],
      insertions: 5,
      deletions: 1,
    }),
    commit({
      // 23:30 at -08:00 is 07:30Z on Jan 2 — earlier than the commit above
      // even though its ISO string sorts later.
      hash: 'a'.repeat(40),
      date: '2026-01-01T23:30:00-08:00',
      files: ['src/a.ts'],
      insertions: 2,
      deletions: 0,
    }),
    commit({ hash: 'c'.repeat(40), date: '2026-01-03T12:00:00Z', files: [] }),
  ];

  it('round-trips every commit, sorted by instant', () => {
    expect(decode(buildCommitIndex(commits))).toEqual([
      {
        hash: 'aaaaaaaaaaaa',
        time: Date.parse('2026-01-02T07:30:00Z') / 1000,
        tz: -480,
        author: 'ann@corp.com',
        authorName: 'Ann Lee',
        files: ['src/a.ts'],
        insertions: 2,
        deletions: 0,
      },
      {
        hash: 'bbbbbbbbbbbb',
        time: Date.parse('2026-01-02T09:00:00Z') / 1000,
        tz: 0,
        author: 'bob@corp.com',
        authorName: 'Bob Brown',
        files: ['src/a.ts', 'src/b.ts'],
        insertions: 5,
        deletions: 1,
      },
      {
        hash: 'cccccccccccc',
        time: Date.parse('2026-01-03T12:00:00Z') / 1000,
        tz: 0,
        author: 'ann@corp.com',
        authorName: 'Ann Lee',
        files: [],
        insertions: 0,
        deletions: 0,
      },
    ]);
  });

  it('stores each author and path once', () => {
    const ix = buildCommitIndex(commits);
    expect(ix.authors).toEqual(['ann@corp.com', 'bob@corp.com']);
    expect(ix.files).toEqual(['src/a.ts', 'src/b.ts']);
    expect(ix.fileOffsets).toEqual([0, 1, 3, 3]);
  });

  it('keeps local time recoverable from time + tz', () => {
    // The clock view needs the author's own hour, not the viewer's.
    const [first] = decode(buildCommitIndex(commits));
    const local = new Date((first.time + first.tz * 60) * 1000);
    expect(local.getUTCHours()).toBe(23);
    expect(local.getUTCDate()).toBe(1);
  });

  it('handles an empty history', () => {
    const ix = buildCommitIndex([]);
    expect(ix.time).toEqual([]);
    expect(ix.fileOffsets).toEqual([0]);
  });

  it('is deterministic for commits at the same instant', () => {
    const same = [
      commit({ hash: 'f'.repeat(40), date: '2026-01-01T00:00:00Z' }),
      commit({ hash: 'e'.repeat(40), date: '2026-01-01T00:00:00Z' }),
    ];
    expect(buildCommitIndex(same).hash).toEqual(
      buildCommitIndex([...same].reverse()).hash,
    );
  });

  it('is several times smaller than the raw commit JSON', () => {
    // Realistic shape: long repeated paths, a handful of authors.
    const paths = Array.from(
      { length: 40 },
      (_, i) => `packages/feature-${i % 8}/src/components/Widget${i}.tsx`,
    );
    const many = Array.from({ length: 500 }, (_, i) =>
      commit({
        hash: i.toString(16).padStart(40, '0'),
        date: new Date(Date.UTC(2026, 0, 1) + i * 3_600_000).toISOString(),
        authorEmail: `dev${i % 6}@corp.com`,
        authorName: `Dev Number${i % 6}`,
        message: `feat: change ${i}`,
        files: [paths[i % 40], paths[(i * 7) % 40]],
        fileStats: [
          { file: paths[i % 40], insertions: 3, deletions: 1 },
          { file: paths[(i * 7) % 40], insertions: 2, deletions: 2 },
        ],
        insertions: 5,
        deletions: 3,
      }),
    );
    const raw = JSON.stringify(many).length;
    const compact = JSON.stringify(buildCommitIndex(many)).length;
    expect(raw / compact).toBeGreaterThan(5);
  });
});
