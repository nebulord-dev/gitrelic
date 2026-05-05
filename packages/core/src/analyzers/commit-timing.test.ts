import { describe, it, expect } from 'vitest';

import { analyzeCommitTiming } from './commit-timing.js';
import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'a@b.com',
    authorName: 'A',
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

describe('analyzeCommitTiming', () => {
  it('late night commits get high lateNightPercent', () => {
    const commits = [
      makeCommit({
        hash: '1',
        date: '2025-06-02T23:30:00-04:00',
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        date: '2025-06-03T01:15:00-04:00',
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        date: '2025-06-04T02:00:00-04:00',
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '4',
        date: '2025-06-05T03:45:00-04:00',
        files: ['a.ts'],
      }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].lateNightPercent).toBe(100);
  });

  it('weekend commits get high weekendPercent', () => {
    // 2025-06-07 is Saturday, 2025-06-08 is Sunday
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-07T10:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-08T14:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-07T16:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files[0].weekendPercent).toBe(100);
  });

  it('stress score combines both signals', () => {
    // All late night + all weekend = max stress
    // 2025-06-07 is Saturday, 2025-06-08 is Sunday
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-07T23:30:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-08T01:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-07T02:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    const profile = result.files[0];
    // lateNightPercent = 100, weekendPercent = 100
    // stressScore = 100 * 0.6 + 100 * 0.4 = 100
    expect(profile.stressScore).toBe(100);
  });

  it('files with < 3 commits are excluded', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-02T10:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-03T10:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('hour distribution has 24 entries', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-02T10:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-03T14:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-04T14:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files[0].hourDistribution).toHaveLength(24);
    expect(result.files[0].hourDistribution.reduce((a, b) => a + b, 0)).toBe(3);
  });

  it('peak hour is correctly identified', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-02T14:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-03T14:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-04T10:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files[0].peakHour).toBe(14);
  });

  it('only tracked files are included', () => {
    const commits = [
      makeCommit({
        hash: '1',
        date: '2025-06-02T10:00:00Z',
        files: ['a.ts', 'deleted.ts'],
      }),
      makeCommit({
        hash: '2',
        date: '2025-06-03T10:00:00Z',
        files: ['a.ts', 'deleted.ts'],
      }),
      makeCommit({
        hash: '3',
        date: '2025-06-04T10:00:00Z',
        files: ['a.ts', 'deleted.ts'],
      }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.files.map((f) => f.file)).toEqual(['a.ts']);
  });

  it('empty commits returns sensible defaults', () => {
    const result = analyzeCommitTiming([], []);
    expect(result.files).toHaveLength(0);
    expect(result.stressFiles).toHaveLength(0);
    expect(result.repoLateNightPercent).toBe(0);
    expect(result.repoWeekendPercent).toBe(0);
    expect(result.summary).toBeTruthy();
  });

  it('summary is generated', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-06-02T10:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-03T23:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-06-04T10:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeCommitTiming(commits, ['a.ts']);
    expect(result.summary).toContain('% of commits happen after hours');
    expect(result.summary).toContain('% on weekends');
  });
});

describe('repoHourDayMatrix', () => {
  it('builds a 7×24 matrix; sum equals commits.length', () => {
    const commits: RawCommit[] = [
      makeCommit({ date: '2026-03-15T14:00:00Z' }), // Sun 14:00 UTC
      makeCommit({ date: '2026-03-16T03:00:00Z' }), // Mon 03:00 UTC
      makeCommit({ date: '2026-03-16T14:00:00Z' }), // Mon 14:00 UTC
    ];
    const report = analyzeCommitTiming(commits, []);
    expect(report.repoHourDayMatrix).toHaveLength(7);
    expect(report.repoHourDayMatrix[0]).toHaveLength(24);
    expect(report.repoHourDayMatrix[0][14]).toBe(1); // Sun 14
    expect(report.repoHourDayMatrix[1][3]).toBe(1); // Mon 03
    expect(report.repoHourDayMatrix[1][14]).toBe(1); // Mon 14
    let sum = 0;
    for (const row of report.repoHourDayMatrix) {
      for (const c of row) sum += c;
    }
    expect(sum).toBe(commits.length);
  });

  it('respects timezone offset for hour bucketing', () => {
    // 03:00 IST (+05:30) = 21:30 UTC prior day. The author's *local* time is
    // Saturday 03:00 (day=6, hour=3). Use a date where the local day is Saturday.
    const commits: RawCommit[] = [
      makeCommit({ date: '2026-03-21T03:00:00+05:30' }), // Sat 03:00 IST = Fri 21:30 UTC
    ];
    const report = analyzeCommitTiming(commits, []);
    expect(report.repoHourDayMatrix[6][3]).toBe(1); // Sat 03 in local time
  });
});

describe('byMonth', () => {
  it('layers are disjoint and sum to month total', () => {
    const commits: RawCommit[] = [
      makeCommit({ date: '2026-03-21T02:00:00Z' }), // Sat 02:00 = weekend + late-night = weekendLateNight
      makeCommit({ date: '2026-03-21T15:00:00Z' }), // Sat 15:00 = weekend only = singleCriterion
      makeCommit({ date: '2026-03-16T03:00:00Z' }), // Mon 03:00 = late-night only = singleCriterion
      makeCommit({ date: '2026-03-16T14:00:00Z' }), // Mon 14:00 = healthy
    ];
    const report = analyzeCommitTiming(commits, []);
    expect(report.byMonth).toHaveLength(1);
    const march = report.byMonth[0];
    expect(march.month).toBe('2026-03');
    expect(march.weekendLateNight).toBe(1);
    expect(march.singleCriterion).toBe(2);
    expect(march.healthy).toBe(1);
    expect(march.total).toBe(4);
    expect(march.weekendLateNight + march.singleCriterion + march.healthy).toBe(
      march.total,
    );
  });

  it('months sorted ascending by ISO string', () => {
    const commits: RawCommit[] = [
      makeCommit({ hash: '1', date: '2026-03-15T12:00:00Z' }),
      makeCommit({ hash: '2', date: '2026-01-15T12:00:00Z' }),
      makeCommit({ hash: '3', date: '2026-02-15T12:00:00Z' }),
    ];
    const report = analyzeCommitTiming(commits, []);
    expect(report.byMonth.map((b) => b.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });

  it('buckets by local-time month, not UTC string prefix', () => {
    // 23:00 EST on Jan 31 = 04:00 UTC on Feb 1. Local month is January, not February.
    const commits: RawCommit[] = [
      makeCommit({ date: '2026-01-31T23:00:00-05:00' }),
    ];
    const report = analyzeCommitTiming(commits, []);
    expect(report.byMonth).toHaveLength(1);
    expect(report.byMonth[0].month).toBe('2026-01');
  });
});

describe('authorStress', () => {
  function commitAt(date: string, email: string, name: string): RawCommit {
    return makeCommit({ authorEmail: email, authorName: name, date });
  }

  it('drops sub-floor authors entirely (< MIN_AUTHOR_COMMITS = 5)', () => {
    const commits: RawCommit[] = [];
    // Alice: 5 commits, all late-night → makes the floor
    for (let i = 0; i < 5; i++) {
      commits.push(
        commitAt(`2026-03-${10 + i}T03:00:00Z`, 'alice@x.com', 'Alice'),
      );
    }
    // Bob: 4 commits, all late-night → below floor, dropped
    for (let i = 0; i < 4; i++) {
      commits.push(commitAt(`2026-03-${10 + i}T03:00:00Z`, 'bob@x.com', 'Bob'));
    }
    const report = analyzeCommitTiming(commits, []);
    const emails = report.authorStress.map((a) => a.email);
    expect(emails).toContain('alice@x.com');
    expect(emails).not.toContain('bob@x.com');
  });

  it('per-author stressScore matches per-file formula', () => {
    const commits: RawCommit[] = [];
    // Alice: 10 commits, 6 late-night, 4 healthy → late=60, wknd=0, score = round(60*0.6 + 0*0.4) = 36
    // 2026-03-01 is a Sunday, so weekdays are Mon Mar 2 … Fri Mar 6, then Mon Mar 9 … Fri Mar 13.
    // Use Mon–Fri Mar 2–6 + Mon Mar 9 (6 weekdays) for late-night,
    //     Tue–Fri Mar 10–13 (4 weekdays) for healthy.
    const lateNightDates = [
      '2026-03-02', // Mon
      '2026-03-03', // Tue
      '2026-03-04', // Wed
      '2026-03-05', // Thu
      '2026-03-06', // Fri
      '2026-03-09', // Mon
    ];
    for (const d of lateNightDates) {
      commits.push(commitAt(`${d}T03:00:00Z`, 'alice@x.com', 'Alice'));
    }
    const healthyDates = [
      '2026-03-10', // Tue
      '2026-03-11', // Wed
      '2026-03-12', // Thu
      '2026-03-13', // Fri
    ];
    for (const d of healthyDates) {
      commits.push(commitAt(`${d}T14:00:00Z`, 'alice@x.com', 'Alice'));
    }
    const report = analyzeCommitTiming(commits, []);
    const alice = report.authorStress.find((a) => a.email === 'alice@x.com');
    expect(alice).toBeDefined();
    expect(alice!.lateNightPercent).toBe(60);
    expect(alice!.weekendPercent).toBe(0);
    expect(alice!.stressScore).toBe(36);
  });

  it('sort order: stressScore desc, name alphabetical tiebreaker', () => {
    const commits: RawCommit[] = [];
    // Alice — high stress
    for (let i = 0; i < 5; i++) {
      commits.push(
        commitAt(`2026-03-${10 + i}T03:00:00Z`, 'alice@x.com', 'Alice'),
      );
    }
    // Bob — low stress (all healthy hours)
    for (let i = 0; i < 5; i++) {
      commits.push(commitAt(`2026-03-${10 + i}T14:00:00Z`, 'bob@x.com', 'Bob'));
    }
    const report = analyzeCommitTiming(commits, []);
    expect(report.authorStress[0].email).toBe('alice@x.com');
    expect(report.authorStress[1].email).toBe('bob@x.com');
  });
});

describe('name-collision disambiguation', () => {
  function bulk(
    email: string,
    name: string,
    n: number,
    baseDay = 10,
  ): RawCommit[] {
    return Array.from({ length: n }, (_, i) =>
      makeCommit({
        authorEmail: email,
        authorName: name,
        date: `2026-03-${String(baseDay + i).padStart(2, '0')}T14:00:00Z`,
      }),
    );
  }

  it('no collision — single email per name → no suffix', () => {
    const commits: RawCommit[] = [
      ...bulk('alice@x.com', 'Alice Lee', 5),
      ...bulk('bob@x.com', 'Bob Smith', 5),
    ];
    const report = analyzeCommitTiming(commits, []);
    const names = report.authorStress.map((a) => a.name).sort();
    expect(names).toEqual(['Alice Lee', 'Bob Smith']);
  });

  it('2-author collision — both get (local-part) suffix', () => {
    const commits: RawCommit[] = [
      ...bulk('alex@x.com', 'Alex Lee', 5),
      ...bulk('alee@x.com', 'Alex Lee', 5),
    ];
    const report = analyzeCommitTiming(commits, []);
    const names = new Set(report.authorStress.map((a) => a.name));
    expect(names).toEqual(new Set(['Alex Lee (alex)', 'Alex Lee (alee)']));
  });

  it('3-author collision — all three get suffix; all unique', () => {
    const commits: RawCommit[] = [
      ...bulk('alex@x.com', 'Alex Lee', 5),
      ...bulk('alee@x.com', 'Alex Lee', 5),
      ...bulk('a.lee@x.com', 'Alex Lee', 5),
    ];
    const report = analyzeCommitTiming(commits, []);
    const names = report.authorStress.map((a) => a.name);
    expect(new Set(names).size).toBe(3); // all unique
    expect(names.every((n) => n.startsWith('Alex Lee ('))).toBe(true);
  });
});

describe('tierMix and highStress', () => {
  it('tierMix counts files by score band; independent of authorStress floor', () => {
    // Build a controlled set: 4 files, one per tier.
    // To get a per-file stressScore we need ≥3 commits per file.
    function fileCommits(
      file: string,
      count: number,
      lateRatio: number,
      weekendRatio: number,
    ): RawCommit[] {
      const commits: RawCommit[] = [];
      const lateN = Math.round(count * lateRatio);
      const wkndN = Math.round(count * weekendRatio);
      for (let i = 0; i < count; i++) {
        const isLate = i < lateN;
        const isWknd = i < wkndN;
        // Choose a date that satisfies the predicates
        let date: string;
        if (isLate && isWknd)
          date = '2026-03-21T03:00:00Z'; // Sat 03 = both
        else if (isLate)
          date = '2026-03-16T03:00:00Z'; // Mon 03 = late only
        else if (isWknd)
          date = '2026-03-21T14:00:00Z'; // Sat 14 = wknd only
        else date = '2026-03-16T14:00:00Z'; // Mon 14 = healthy
        commits.push(
          makeCommit({
            hash: `${file}-${i}`,
            date,
            files: [file],
          }),
        );
      }
      return commits;
    }
    const commits = [
      ...fileCommits('lo.ts', 5, 0, 0), // score = 0 → low
      ...fileCommits('mid.ts', 5, 0.5, 0), // score = round(50*0.6) = 30 → medium
      ...fileCommits('hi.ts', 5, 0.9, 0), // score ≈ 54 → high
      ...fileCommits('crit.ts', 5, 1, 1), // score = 100 → critical
    ];
    const report = analyzeCommitTiming(commits, [
      'lo.ts',
      'mid.ts',
      'hi.ts',
      'crit.ts',
    ]);
    expect(report.tierMix.low).toBeGreaterThanOrEqual(1);
    expect(report.tierMix.critical).toBeGreaterThanOrEqual(1);
    expect(
      report.tierMix.low +
        report.tierMix.medium +
        report.tierMix.high +
        report.tierMix.critical,
    ).toBe(report.files.length);
  });

  it('highStress equals files filtered to stressScore ≥ 70', () => {
    // Build one file at score 100, one at score 0
    const commits: RawCommit[] = [];
    for (let i = 0; i < 5; i++) {
      commits.push(
        makeCommit({
          hash: `crit-${i}`,
          date: '2026-03-21T03:00:00Z', // Sat 03 — wknd + late
          files: ['crit.ts'],
        }),
      );
    }
    for (let i = 0; i < 5; i++) {
      commits.push(
        makeCommit({
          hash: `clean-${i}`,
          date: '2026-03-16T14:00:00Z', // Mon 14
          files: ['clean.ts'],
        }),
      );
    }
    const report = analyzeCommitTiming(commits, ['crit.ts', 'clean.ts']);
    expect(report.highStress).toBe(
      report.files.filter((f) => f.stressScore >= 70).length,
    );
    expect(report.highStress).toBeGreaterThanOrEqual(1);
  });
});

describe('edge cases', () => {
  it('empty repo returns zeroed aggregates', () => {
    const report = analyzeCommitTiming([], []);
    expect(report.repoHourDayMatrix).toHaveLength(7);
    expect(report.repoHourDayMatrix.flat().every((c) => c === 0)).toBe(true);
    expect(report.highStress).toBe(0);
    expect(report.tierMix).toEqual({ low: 0, medium: 0, high: 0, critical: 0 });
    expect(report.byMonth).toEqual([]);
    expect(report.authorStress).toEqual([]);
  });

  it('no-eligible-authors: every author below the 5-commit floor → authorStress is []', () => {
    const commits: RawCommit[] = [];
    // Three different authors, 4 commits each — all sub-floor
    const emails = ['a@x.com', 'b@x.com', 'c@x.com'];
    const names = ['A One', 'B Two', 'C Three'];
    emails.forEach((e, idx) => {
      for (let i = 0; i < 4; i++) {
        commits.push(
          makeCommit({
            authorEmail: e,
            authorName: names[idx],
            date: `2026-03-${String(10 + idx * 4 + i).padStart(2, '0')}T14:00:00Z`,
          }),
        );
      }
    });
    const report = analyzeCommitTiming(commits, []);
    expect(report.authorStress).toEqual([]);
  });
});
