import { describe, expect, it } from 'vitest';

import { fromRawCommits } from '../commits/commitLike';
import { binCommitsByWeek } from './weeklyBins';
import type { RawCommit } from '@gitrelic/core';

function makeCommit(overrides: Partial<RawCommit>): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@dev.com',
    authorName: 'Alice',
    date: '2025-06-02T10:00:00Z',
    message: 'test',
    coAuthors: [],
    files: ['a.ts'],
    fileStats: [],
    insertions: 10,
    deletions: 5,
    ...overrides,
  };
}

describe('binCommitsByWeek', () => {
  it('bins commits into weekly buckets per author', () => {
    const commits = [
      makeCommit({
        date: '2025-06-02T10:00:00Z',
        authorEmail: 'alice@dev.com',
      }),
      makeCommit({
        date: '2025-06-03T10:00:00Z',
        authorEmail: 'alice@dev.com',
      }),
      makeCommit({ date: '2025-06-03T10:00:00Z', authorEmail: 'bob@dev.com' }),
      makeCommit({
        date: '2025-06-09T10:00:00Z',
        authorEmail: 'alice@dev.com',
      }),
    ];

    const { weeks, authors } = binCommitsByWeek(fromRawCommits(commits));

    expect(authors).toContain('alice@dev.com');
    expect(authors).toContain('bob@dev.com');
    expect(weeks.length).toBeGreaterThanOrEqual(2);

    // First week should have 2 alice + 1 bob
    const firstWeek = weeks[0];
    expect(firstWeek.counts['alice@dev.com']).toBe(2);
    expect(firstWeek.counts['bob@dev.com']).toBe(1);
  });

  it('returns authors sorted by total commits descending', () => {
    const commits = [
      makeCommit({ authorEmail: 'alice@dev.com' }),
      makeCommit({ authorEmail: 'alice@dev.com' }),
      makeCommit({ authorEmail: 'bob@dev.com' }),
    ];

    const { authors } = binCommitsByWeek(fromRawCommits(commits));
    expect(authors[0]).toBe('alice@dev.com');
  });
});

describe('binCommitsByWeek edges', () => {
  const at = (iso: string, author = 'a@x.com') => ({
    timeMs: Date.parse(iso),
    author,
    files: [],
  });

  it('returns nothing for an empty history', () => {
    expect(binCommitsByWeek([])).toEqual({ weeks: [], authors: [] });
  });

  it('starts at the Monday of the first commit and splits at Monday 00:00 UTC', () => {
    const { weeks } = binCommitsByWeek([
      at('2026-01-11T23:59:00Z'), // Sunday
      at('2026-01-12T00:01:00Z'), // Monday
    ]);
    expect(weeks.map((w) => w.weekStart.toISOString())).toEqual([
      '2026-01-05T00:00:00.000Z',
      '2026-01-12T00:00:00.000Z',
    ]);
    expect(weeks.map((w) => w.counts['a@x.com'])).toEqual([1, 1]);
  });

  it('keeps empty weeks in a gap so the series stays evenly spaced', () => {
    const { weeks } = binCommitsByWeek([
      at('2026-01-05T10:00:00Z'),
      at('2026-01-26T10:00:00Z'),
    ]);
    expect(weeks.map((w) => w.counts['a@x.com'])).toEqual([1, 0, 0, 1]);
  });
});
