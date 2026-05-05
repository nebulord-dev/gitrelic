import { describe, it, expect } from 'vitest';

import { analyzeCoAuthors } from './co-author.js';
import type { CoAuthor, RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@co.com',
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

function coAuthor(name: string, email: string): CoAuthor {
  return { name, email };
}

describe('analyzeCoAuthors', () => {
  it('detects co-authored-by trailers parsed by git', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@co.com',
        coAuthors: [coAuthor('Bob', 'bob@co.com')],
        files: ['auth.ts'],
      }),
    ];
    const result = analyzeCoAuthors(commits);
    expect(result.totalCoAuthoredCommits).toBe(1);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].authorA).toBe('alice@co.com');
    expect(result.pairs[0].authorB).toBe('bob@co.com');
  });

  it('handles multiple co-authors in one commit', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@co.com',
        coAuthors: [
          coAuthor('Bob', 'bob@co.com'),
          coAuthor('Carol', 'carol@co.com'),
        ],
        files: ['shared.ts'],
      }),
    ];
    const result = analyzeCoAuthors(commits);
    expect(result.pairs.length).toBeGreaterThanOrEqual(2);
  });

  it('tracks files co-authored together', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@co.com',
        coAuthors: [coAuthor('Bob', 'bob@co.com')],
        files: ['auth.ts', 'session.ts'],
      }),
    ];
    const result = analyzeCoAuthors(commits);
    expect(result.pairs[0].files).toContain('auth.ts');
    expect(result.pairs[0].files).toContain('session.ts');
  });

  it('accumulates across multiple commits', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@co.com',
        coAuthors: [coAuthor('Bob', 'bob@co.com')],
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'alice@co.com',
        coAuthors: [coAuthor('Bob', 'bob@co.com')],
        files: ['b.ts'],
      }),
    ];
    const result = analyzeCoAuthors(commits);
    const pair = result.pairs.find(
      (p) =>
        (p.authorA === 'alice@co.com' && p.authorB === 'bob@co.com') ||
        (p.authorA === 'bob@co.com' && p.authorB === 'alice@co.com'),
    )!;
    expect(pair.coAuthoredCommits).toBe(2);
    expect(pair.files).toContain('a.ts');
    expect(pair.files).toContain('b.ts');
  });

  it('returns empty report when no co-authored commits', () => {
    const commits = [makeCommit({ hash: '1', message: 'normal commit' })];
    const result = analyzeCoAuthors(commits);
    expect(result.totalCoAuthoredCommits).toBe(0);
    expect(result.pairs).toHaveLength(0);
  });

  it('builds per-author stats', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@co.com',
        coAuthors: [coAuthor('Bob', 'bob@co.com')],
        files: ['a.ts'],
      }),
    ];
    const result = analyzeCoAuthors(commits);
    const bobStats = result.authorStats.find((a) => a.author === 'bob@co.com');
    expect(bobStats).toBeDefined();
    expect(bobStats!.coAuthoredCommits).toBe(1);
  });

  it('lowercases co-author emails for matching', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'Alice@CO.com',
        coAuthors: [coAuthor('Bob', 'BOB@co.com')],
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'alice@co.com',
        coAuthors: [coAuthor('Bob', 'bob@co.com')],
        files: ['b.ts'],
      }),
    ];
    const result = analyzeCoAuthors(commits);
    expect(result.pairs).toHaveLength(1);
    expect(result.pairs[0].coAuthoredCommits).toBe(2);
  });

  it('produces a summary', () => {
    const result = analyzeCoAuthors([]);
    expect(result.summary).toBeTruthy();
  });
});
