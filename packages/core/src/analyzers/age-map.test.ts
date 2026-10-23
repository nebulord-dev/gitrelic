import { describe, it, expect } from 'vitest';

import { analyzeAgeMap } from './age-map.js';
import type { FileTouch, RawCommit } from '../utils/git.js';

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

  it('tiers stale and ancient files', () => {
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
    expect(result.files.map((f) => [f.file, f.status])).toEqual([
      ['b.ts', 'ancient'],
      ['a.ts', 'stale'],
      ['c.ts', 'fresh'],
    ]);
    // The tiers' files are read from `files`; the report carries no copies.
    expect(result).not.toHaveProperty('ancientFiles');
    expect(result).not.toHaveProperty('staleFiles');
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

function touch(o: Partial<FileTouch> & { files: string[] }): FileTouch {
  return {
    hash: Math.random().toString(36).slice(2),
    authorEmail: 'bob@example.com',
    authorName: 'Bob',
    date: daysAgo(1000),
    ...o,
  };
}

describe('analyzeAgeMap with older history', () => {
  it('ages files untouched in the window from the older history', () => {
    const r = analyzeAgeMap(
      [makeCommit({ files: ['new.ts'], date: daysAgo(10) })],
      ['new.ts', 'old.ts'],
      300,
      FAKE_NOW,
      { older: [touch({ files: ['old.ts'], date: daysAgo(900) })] },
    );
    expect(r.source).toBe('history');
    expect(r.files.find((f) => f.file === 'old.ts')!.ageInDays).toBe(900);
  });

  it('counts a commit in both lists once (--since and --until overlap)', () => {
    const r = analyzeAgeMap(
      [
        makeCommit({ hash: 'edge', files: ['a.ts'], date: daysAgo(400) }),
        makeCommit({
          hash: 'now',
          files: ['b.ts'],
          date: daysAgo(1),
          authorEmail: 'ann@x.com',
          authorName: 'Ann',
        }),
      ],
      ['a.ts', 'b.ts'],
      400,
      FAKE_NOW,
      // The same commit read again from the older history, under another
      // author: if the dedupe failed, Bob would join a.ts's authors.
      {
        older: [
          touch({
            hash: 'edge',
            files: ['a.ts'],
            date: daysAgo(400),
            authorName: 'Bob',
          }),
        ],
      },
    );
    expect(r.files.find((f) => f.file === 'a.ts')!.orphanedAuthors).toEqual([
      'Alice',
    ]);
  });

  it('says the ages cover the window only when the older read failed', () => {
    const r = analyzeAgeMap(
      [makeCommit({ files: ['a.ts'] })],
      ['a.ts'],
      300,
      FAKE_NOW,
      { older: null },
    );
    expect(r.source).toBe('window');
  });

  it('marks a cold file orphaned when every author has gone quiet', () => {
    const ann = { authorEmail: 'ann@x.com', authorName: 'Ann' };
    const bob = { authorEmail: 'bob@x.com', authorName: 'Bob' };
    const r = analyzeAgeMap(
      [makeCommit({ files: ['live.ts'], date: daysAgo(5), ...ann })],
      ['live.ts', 'old.ts', 'kept.ts'],
      365,
      FAKE_NOW,
      {
        older: [
          touch({ files: ['old.ts'], date: daysAgo(800), ...bob }),
          touch({
            files: ['old.ts'],
            date: daysAgo(900),
            authorEmail: 'cy@x.com',
            authorName: 'Cy',
          }),
          touch({ files: ['old.ts'], date: daysAgo(950), ...bob }),
          touch({ files: ['kept.ts'], date: daysAgo(800), ...ann }),
        ],
      },
    );
    const old = r.files.find((f) => f.file === 'old.ts')!;
    expect(old.orphaned).toBe(true);
    expect(old.orphanedAuthors).toEqual(['Bob', 'Cy']);
    // Ann changed kept.ts and is still active.
    expect(r.files.find((f) => f.file === 'kept.ts')!.orphaned).toBeUndefined();
  });

  it('compares people through the canonical map, older aliases included', () => {
    const r = analyzeAgeMap(
      [
        makeCommit({
          files: ['live.ts'],
          date: daysAgo(5),
          authorEmail: 'dan@new.com',
          authorName: 'dan',
        }),
      ],
      ['live.ts', 'old.ts'],
      365,
      FAKE_NOW,
      {
        older: [
          touch({
            files: ['old.ts'],
            date: daysAgo(900),
            authorEmail: 'Dan@Old.com',
            authorName: 'Dan Abramov',
          }),
        ],
        canonical: new Map([['dan@old.com', 'dan@new.com']]),
      },
    );
    // Same person under an older email, still active: not orphaned.
    expect(r.files.find((f) => f.file === 'old.ts')!.orphaned).toBeUndefined();
  });

  it("doesn't make authors of sweeping commits or bots", () => {
    const sweep = Array.from({ length: 21 }, (_, i) => `f${i}.ts`);
    const r = analyzeAgeMap(
      [makeCommit({ files: ['live.ts'], date: daysAgo(5) })],
      ['live.ts', ...sweep, 'bot.ts'],
      365,
      FAKE_NOW,
      {
        older: [
          touch({ files: sweep, date: daysAgo(800) }),
          touch({
            files: ['bot.ts'],
            date: daysAgo(800),
            authorEmail: '49699333+dependabot[bot]@users.noreply.github.com',
          }),
        ],
      },
    );
    // No human author: we can't say nobody is left who knows it.
    expect(r.files.find((f) => f.file === 'f0.ts')!.orphaned).toBeUndefined();
    expect(r.files.find((f) => f.file === 'bot.ts')!.orphaned).toBeUndefined();
    // The sweep still counts as a change for the file's age.
    expect(r.files.find((f) => f.file === 'f0.ts')!.ageInDays).toBe(800);
  });

  it('marks a file woken when it changed this year after a year untouched', () => {
    const r = analyzeAgeMap(
      [
        makeCommit({ hash: 'w1', files: ['woke.ts'], date: daysAgo(20) }),
        makeCommit({ hash: 'w2', files: ['woke.ts'], date: daysAgo(40) }),
        makeCommit({ hash: 's1', files: ['steady.ts'], date: daysAgo(30) }),
      ],
      ['woke.ts', 'steady.ts'],
      365,
      FAKE_NOW,
      {
        older: [
          touch({ files: ['woke.ts'], date: daysAgo(1040) }),
          touch({ files: ['steady.ts'], date: daysAgo(200) }),
        ],
      },
    );
    expect(r.files.find((f) => f.file === 'woke.ts')!.wokeAfterDays).toBe(1000);
    expect(
      r.files.find((f) => f.file === 'steady.ts')!.wokeAfterDays,
    ).toBeUndefined();
  });

  it('lists dormant packages: 5+ source files, none changed in a year', () => {
    const dormant = ['a', 'b', 'c', 'd', 'e'].map(
      (n) => `packages/old/${n}.ts`,
    );
    const small = ['packages/tiny/a.ts', 'packages/tiny/b.ts'];
    const r = analyzeAgeMap(
      [
        makeCommit({
          hash: 'l',
          files: ['packages/live/a.ts'],
          date: daysAgo(3),
        }),
        makeCommit({
          hash: 't',
          files: ['packages/old/a.test.ts'],
          date: daysAgo(3),
        }),
      ],
      [
        ...dormant,
        ...small,
        'packages/live/a.ts',
        'packages/old/a.test.ts',
        'root.ts',
      ],
      365,
      FAKE_NOW,
      {
        older: [
          touch({ files: dormant, date: daysAgo(1200) }),
          touch({ files: dormant.slice(0, 1), date: daysAgo(600) }),
          touch({ files: [...small, 'root.ts'], date: daysAgo(900) }),
        ],
        fileClasses: { 'packages/old/a.test.ts': 'test' },
      },
    );
    // A recent test change doesn't wake a package; tiny is under 5 files; the
    // root is never a package.
    expect(r.dormantPackages).toEqual([
      { package: 'packages/old', sourceFiles: 5, newestAgeDays: 600 },
    ]);
  });
});
