import { describe, expect, it } from 'vitest';

import { binCommitsByWeek } from './Timeline';

import type { RawCommit } from '@gitrelic/core';

function makeCommit(overrides: Partial<RawCommit>): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@dev.com',
    authorName: 'Alice',
    date: '2025-06-02T10:00:00Z',
    message: 'test',
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

    const { weeks, authors } = binCommitsByWeek(commits);

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

    const { authors } = binCommitsByWeek(commits);
    expect(authors[0]).toBe('alice@dev.com');
  });
});
