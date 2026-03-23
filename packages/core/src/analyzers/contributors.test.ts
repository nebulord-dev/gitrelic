import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RawCommit } from '../utils/git.js';
import { analyzeContributors } from './contributors.js';

const FAKE_NOW = new Date('2026-03-08T12:00:00Z').getTime();

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

function daysAgo(n: number): string {
  return new Date(FAKE_NOW - n * 86_400_000).toISOString();
}

describe('analyzeContributors', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(FAKE_NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks recent contributors as active (within 25% of repo age)', () => {
    // repoAgeDays=365, active window = 91 days
    const commits = [
      makeCommit({ hash: '1', date: daysAgo(50), files: ['a.ts'] }),
    ];
    const result = analyzeContributors(commits, 365);
    expect(result.activeContributors.length).toBe(1);
    expect(result.activeContributors[0].isActive).toBe(true);
  });

  it('marks old contributors as ghosts (beyond 50% of repo age)', () => {
    // repoAgeDays=365, ghost window = 183 days
    const commits = [
      makeCommit({ hash: '1', date: daysAgo(200), files: ['a.ts'] }),
    ];
    const result = analyzeContributors(commits, 365);
    expect(result.ghostContributors.length).toBe(1);
    expect(result.ghostContributors[0].email).toBe('alice@example.com');
  });

  it('enforces minimum floors on young repos', () => {
    // repoAgeDays=90 — without floors, ghost window would be 45 days.
    // With the 180-day floor, a 60-day-inactive author is NOT a ghost.
    const commits = [
      makeCommit({ hash: '1', authorEmail: 'active@example.com', authorName: 'Active', date: daysAgo(10), files: ['a.ts'] }),
      makeCommit({ hash: '2', authorEmail: 'recent@example.com', authorName: 'Recent', date: daysAgo(60), files: ['b.ts'] }),
    ];
    const result = analyzeContributors(commits, 90);
    expect(result.activeContributors.map(c => c.email)).toContain('active@example.com');
    expect(result.ghostContributors).toHaveLength(0); // 60 days < 180-day floor
  });

  it('flags ghosts on young repos when past the floor', () => {
    const commits = [
      makeCommit({ hash: '1', authorEmail: 'active@example.com', authorName: 'Active', date: daysAgo(10), files: ['a.ts'] }),
      makeCommit({ hash: '2', authorEmail: 'ghost@example.com', authorName: 'Ghost', date: daysAgo(200), files: ['b.ts'] }),
    ];
    const result = analyzeContributors(commits, 90);
    expect(result.ghostContributors.map(c => c.email)).toContain('ghost@example.com');
  });

  it('extracts focus areas from file paths', () => {
    const commits = [
      makeCommit({ hash: '1', date: daysAgo(5), files: ['src/components/App.tsx', 'src/components/Nav.tsx', 'src/utils/helper.ts'] }),
    ];
    const result = analyzeContributors(commits, 365);
    const alice = result.contributors.find(c => c.email === 'alice@example.com')!;
    expect(alice.focusAreas).toContain('src/components');
  });

  it('aggregates lines changed across commits', () => {
    const commits = [
      makeCommit({ hash: '1', date: daysAgo(5), files: ['a.ts'], insertions: 50, deletions: 10 }),
      makeCommit({ hash: '2', date: daysAgo(3), files: ['b.ts'], insertions: 30, deletions: 20 }),
    ];
    const result = analyzeContributors(commits, 365);
    const alice = result.contributors.find(c => c.email === 'alice@example.com')!;
    expect(alice.linesChanged).toBe(110);
  });

  it('sorts contributors by commit count descending', () => {
    const commits = [
      makeCommit({ hash: '1', authorEmail: 'bob@example.com', authorName: 'Bob', date: daysAgo(5), files: ['a.ts'] }),
      makeCommit({ hash: '2', date: daysAgo(4), files: ['b.ts'] }),
      makeCommit({ hash: '3', date: daysAgo(3), files: ['c.ts'] }),
      makeCommit({ hash: '4', date: daysAgo(2), files: ['d.ts'] }),
    ];
    const result = analyzeContributors(commits, 365);
    expect(result.contributors[0].email).toBe('alice@example.com');
    expect(result.contributors[0].commitCount).toBe(3);
    expect(result.contributors[1].email).toBe('bob@example.com');
  });

  it('includes dynamic day count in ghost summary', () => {
    // repoAgeDays=365, ghost window = 183 days
    const commits = [
      makeCommit({ hash: '1', date: daysAgo(200), files: ['a.ts'] }),
    ];
    const result = analyzeContributors(commits, 365);
    expect(result.summary).toContain('183');
  });
});
