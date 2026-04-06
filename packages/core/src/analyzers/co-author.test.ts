import { describe, it, expect } from 'vitest';

import { analyzeCoAuthors } from './co-author.js';

import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@co.com',
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

describe('analyzeCoAuthors', () => {
  it('detects co-authored-by trailers in commit messages', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@co.com',
        message: 'feat: add auth\n\nCo-authored-by: Bob <bob@co.com>',
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
        message:
          'feat: collab\n\nCo-authored-by: Bob <bob@co.com>\nCo-authored-by: Carol <carol@co.com>',
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
        message: 'fix: auth\n\nCo-authored-by: Bob <bob@co.com>',
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
        message: 'feat: a\n\nCo-authored-by: Bob <bob@co.com>',
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'alice@co.com',
        message: 'feat: b\n\nCo-authored-by: Bob <bob@co.com>',
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
        message: 'feat\n\nCo-authored-by: Bob <bob@co.com>',
        files: ['a.ts'],
      }),
    ];
    const result = analyzeCoAuthors(commits);
    const bobStats = result.authorStats.find((a) => a.author === 'bob@co.com');
    expect(bobStats).toBeDefined();
    expect(bobStats!.coAuthoredCommits).toBe(1);
  });

  it('is case-insensitive for the trailer keyword', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@co.com',
        message: 'feat\n\nco-authored-by: Bob <bob@co.com>',
        files: ['a.ts'],
      }),
    ];
    const result = analyzeCoAuthors(commits);
    expect(result.totalCoAuthoredCommits).toBe(1);
  });

  it('produces a summary', () => {
    const result = analyzeCoAuthors([]);
    expect(result.summary).toBeTruthy();
  });
});
