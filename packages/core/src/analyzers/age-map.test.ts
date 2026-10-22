import { describe, it, expect } from 'vitest';

import { analyzeAgeMap } from './age-map.js';
import type { RawCommit } from '../utils/git.js';

const FAKE_NOW = new Date('2026-03-08T12:00:00Z').getTime();

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

function daysAgo(n: number): string {
  return new Date(FAKE_NOW - n * 86_400_000).toISOString();
}

describe('analyzeAgeMap', () => {
  it('classifies files by percentage thresholds for 365-day repo', () => {
    // fresh <= 29d, aging <= 120d, stale <= 241d, ancient > 241d
    const commits = [
      makeCommit({ hash: '1', files: ['fresh.ts'], date: daysAgo(10) }),
      makeCommit({ hash: '2', files: ['aging.ts'], date: daysAgo(100) }),
      makeCommit({ hash: '3', files: ['stale.ts'], date: daysAgo(200) }),
      makeCommit({ hash: '4', files: ['ancient.ts'], date: daysAgo(300) }),
    ];
    const tracked = ['fresh.ts', 'aging.ts', 'stale.ts', 'ancient.ts'];
    const result = analyzeAgeMap(commits, tracked, 365, FAKE_NOW);

    expect(result.files.find((f) => f.file === 'fresh.ts')!.status).toBe(
      'fresh',
    );
    expect(result.files.find((f) => f.file === 'aging.ts')!.status).toBe(
      'aging',
    );
    expect(result.files.find((f) => f.file === 'stale.ts')!.status).toBe(
      'stale',
    );
    expect(result.files.find((f) => f.file === 'ancient.ts')!.status).toBe(
      'ancient',
    );
  });

  it('scales thresholds for 90-day repo', () => {
    // fresh <= 7d, aging <= 30d, stale <= 59d, ancient > 59d
    const commits = [
      makeCommit({ hash: '1', files: ['fresh.ts'], date: daysAgo(5) }),
      makeCommit({ hash: '2', files: ['aging.ts'], date: daysAgo(20) }),
      makeCommit({ hash: '3', files: ['stale.ts'], date: daysAgo(50) }),
      makeCommit({ hash: '4', files: ['ancient.ts'], date: daysAgo(80) }),
    ];
    const tracked = ['fresh.ts', 'aging.ts', 'stale.ts', 'ancient.ts'];
    const result = analyzeAgeMap(commits, tracked, 90, FAKE_NOW);

    expect(result.files.find((f) => f.file === 'fresh.ts')!.status).toBe(
      'fresh',
    );
    expect(result.files.find((f) => f.file === 'aging.ts')!.status).toBe(
      'aging',
    );
    expect(result.files.find((f) => f.file === 'stale.ts')!.status).toBe(
      'stale',
    );
    expect(result.files.find((f) => f.file === 'ancient.ts')!.status).toBe(
      'ancient',
    );
  });

  it('counts stale and ancient files', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'], date: daysAgo(200) }),
      makeCommit({ hash: '2', files: ['b.ts'], date: daysAgo(300) }),
      makeCommit({ hash: '3', files: ['c.ts'], date: daysAgo(5) }),
    ];
    const result = analyzeAgeMap(
      commits,
      ['a.ts', 'b.ts', 'c.ts'],
      365,
      FAKE_NOW,
    );
    expect(result.staleFiles.length).toBe(1);
    expect(result.ancientFiles.length).toBe(1);
  });

  it('sorts files oldest first', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['new.ts'], date: daysAgo(5) }),
      makeCommit({ hash: '2', files: ['old.ts'], date: daysAgo(300) }),
      makeCommit({ hash: '3', files: ['mid.ts'], date: daysAgo(100) }),
    ];
    const result = analyzeAgeMap(
      commits,
      ['new.ts', 'old.ts', 'mid.ts'],
      365,
      FAKE_NOW,
    );
    expect(result.files[0].file).toBe('old.ts');
    expect(result.files[result.files.length - 1].file).toBe('new.ts');
  });

  it('uses most recent commit date when file has multiple commits', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['multi.ts'], date: daysAgo(100) }),
      makeCommit({ hash: '2', files: ['multi.ts'], date: daysAgo(5) }),
      makeCommit({ hash: '3', files: ['multi.ts'], date: daysAgo(50) }),
    ];
    const result = analyzeAgeMap(commits, ['multi.ts'], 365, FAKE_NOW);
    expect(result.files[0].ageInDays).toBe(5);
  });

  it('produces summary mentioning ancient files', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['old.ts'], date: daysAgo(300) }),
    ];
    const result = analyzeAgeMap(commits, ['old.ts'], 365, FAKE_NOW);
    expect(result.summary).toContain('1 file');
  });

  it('exposes the repo-age-relative thresholds on the report', () => {
    const result = analyzeAgeMap([], [], 365, FAKE_NOW);
    expect(result.thresholds).toEqual({
      freshLimit: 29, // round(365 * 0.08)
      agingLimit: 120, // round(365 * 0.33)
      staleLimit: 241, // round(365 * 0.66)
    });
  });

  it('scales thresholds for a 90-day window', () => {
    const result = analyzeAgeMap([], [], 90, FAKE_NOW);
    expect(result.thresholds).toEqual({
      freshLimit: 7,
      agingLimit: 30,
      staleLimit: 59,
    });
  });

  it('counts ages back from the analyzed commit, not today', () => {
    // A dormant repo: its last commit is a year old. Measured from that
    // commit, the file it touched is fresh, not a year stale.
    const asOf = FAKE_NOW - 365 * 86_400_000;
    const result = analyzeAgeMap(
      [
        makeCommit({
          hash: '1',
          files: ['last.ts'],
          date: new Date(asOf).toISOString(),
        }),
        makeCommit({
          hash: '2',
          files: ['older.ts'],
          date: new Date(asOf - 100 * 86_400_000).toISOString(),
        }),
      ],
      ['last.ts', 'older.ts'],
      365,
      asOf,
    );
    const age = Object.fromEntries(
      result.files.map((f) => [f.file, f.ageInDays]),
    );
    expect(age).toEqual({ 'last.ts': 0, 'older.ts': 100 });
  });

  it('returns zero thresholds for an empty (0-day) repo', () => {
    const result = analyzeAgeMap([], [], 0, FAKE_NOW);
    expect(result.thresholds).toEqual({
      freshLimit: 0,
      agingLimit: 0,
      staleLimit: 0,
    });
  });
});

describe('analyzeAgeMap timezone handling', () => {
  it('orders commits by instant, not by their ISO strings', () => {
    // 23:30 at -08:00 is 07:30Z the next day — later than 01:00Z — but sorts
    // earlier as a string. Mixed-offset teams hit this on every file.
    const later = '2026-01-01T23:30:00-08:00';
    const earlier = '2026-01-02T01:00:00+00:00';
    const result = analyzeAgeMap(
      [
        makeCommit({ date: later, files: ['a.ts'] }),
        makeCommit({ date: earlier, files: ['a.ts'] }),
      ],
      ['a.ts'],
      365,
      FAKE_NOW,
    );
    expect(result.files[0].lastCommitDate).toBe(later);
  });
});
