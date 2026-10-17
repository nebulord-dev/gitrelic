import { describe, expect, it } from 'vitest';

import { fromRawCommits } from '../commits/commitLike';
import { prepareSwimlaneData } from './swimlanes';
import type { GitrelicReport, RawCommit } from '@gitrelic/core';

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

function makeReport(commits: RawCommit[]): GitrelicReport {
  return {
    commits,
    hotspots: {
      files: [
        {
          file: 'hot.ts',
          hotspotScore: 90,
          churnScore: 80,
          loc: 200,
          category: 'critical',
        },
      ],
      topHotspots: [],
      summary: '',
    },
    ghostFiles: {
      files: [
        {
          file: 'old.ts',
          dominantAuthor: 'ghost@dev.com',
          dominantAuthorPercent: 100,
          lastAuthorCommitDate: '2025-01-01T00:00:00Z',
          authorInactiveDays: 180,
          loc: 50,
        },
      ],
      totalGhostFiles: 1,
      ghostOwners: 1,
      ghostLoc: 50,
      tierMix: { trueGhost: 0, fading: 1 },
      summary: '',
    },
    contributors: {
      contributors: [
        {
          email: 'alice@dev.com',
          name: 'Alice',
          commitCount: 3,
          firstCommit: '2025-06-02T10:00:00Z',
          lastCommit: '2025-06-16T10:00:00Z',
          filesOwned: 1,
          linesChanged: 30,
          activeDays: 3,
          focusAreas: [],
          isActive: true,
          isGhost: false,
        },
      ],
      activeContributors: [],
      ghostContributors: [],
      topContributor: {} as any,
      top3CommitShare: 0,
      newcomers90d: 0,
      summary: '',
    },
  } as Partial<GitrelicReport> as GitrelicReport;
}

describe('prepareSwimlaneData', () => {
  it('returns one lane per contributor sorted by commit count', () => {
    const commits = [
      makeCommit({
        authorEmail: 'alice@dev.com',
        date: '2025-06-02T10:00:00Z',
      }),
      makeCommit({
        authorEmail: 'alice@dev.com',
        date: '2025-06-03T10:00:00Z',
      }),
      makeCommit({ authorEmail: 'bob@dev.com', date: '2025-06-02T10:00:00Z' }),
    ];
    const report = makeReport(commits);
    report.contributors.contributors.push({
      email: 'bob@dev.com',
      name: 'Bob',
      commitCount: 1,
      firstCommit: '2025-06-02T10:00:00Z',
      lastCommit: '2025-06-02T10:00:00Z',
      filesOwned: 0,
      linesChanged: 10,
      activeDays: 1,
      focusAreas: [],
      isActive: true,
      isGhost: false,
    });

    const lanes = prepareSwimlaneData(report, fromRawCommits(report.commits));
    expect(lanes[0].email).toBe('alice@dev.com');
    expect(lanes[0].commits).toHaveLength(2);
    expect(lanes[1].email).toBe('bob@dev.com');
  });

  it('marks commits touching hotspot files', () => {
    const commits = [
      makeCommit({ files: ['hot.ts'], date: '2025-06-02T10:00:00Z' }),
      makeCommit({ files: ['safe.ts'], date: '2025-06-03T10:00:00Z' }),
    ];
    const report = makeReport(commits);
    const lanes = prepareSwimlaneData(report, fromRawCommits(report.commits));

    const hotCommit = lanes[0].commits.find((c) => c.isHotspot);
    expect(hotCommit).toBeDefined();

    const safeCommit = lanes[0].commits.find((c) => !c.isHotspot);
    expect(safeCommit).toBeDefined();
  });

  it('identifies ghost contributors', () => {
    const commits = [
      makeCommit({
        authorEmail: 'ghost@dev.com',
        date: '2025-01-15T10:00:00Z',
      }),
    ];
    const report = makeReport(commits);
    report.contributors.contributors.push({
      email: 'ghost@dev.com',
      name: 'Ghost',
      commitCount: 1,
      firstCommit: '2025-01-15T10:00:00Z',
      lastCommit: '2025-01-15T10:00:00Z',
      filesOwned: 0,
      linesChanged: 10,
      activeDays: 1,
      focusAreas: [],
      isActive: false,
      isGhost: false,
    });

    const lanes = prepareSwimlaneData(report, fromRawCommits(report.commits));
    const ghostLane = lanes.find((l) => l.email === 'ghost@dev.com');
    expect(ghostLane?.isGhost).toBe(true);
  });
});

describe('prepareSwimlaneData weekly strip', () => {
  it('returns no lanes for an empty history', () => {
    expect(prepareSwimlaneData(makeReport([]), [])).toEqual([]);
  });

  it('bins each lane by UTC week and records the last active date', () => {
    const commits = [
      makeCommit({ date: '2025-06-02T10:00:00Z' }), // Mon, week 0
      makeCommit({ date: '2025-06-08T23:00:00Z' }), // Sun, week 0
      makeCommit({ date: '2025-06-16T10:00:00Z' }), // Mon, week 2
    ];
    const [alice] = prepareSwimlaneData(
      makeReport(commits),
      fromRawCommits(commits),
    );
    expect(alice.weeklyIntensity.slice(0, 3)).toEqual([2, 0, 1]);
    expect(alice.lastActiveDate?.toISOString()).toBe(
      '2025-06-16T10:00:00.000Z',
    );
    expect(alice.commits.map((c) => c.date.toISOString())).toEqual([
      '2025-06-02T10:00:00.000Z',
      '2025-06-08T23:00:00.000Z',
      '2025-06-16T10:00:00.000Z',
    ]);
  });

  it('gives a contributor with no commits in range an empty lane', () => {
    const commits = [makeCommit({ authorEmail: 'bob@dev.com' })];
    const [alice] = prepareSwimlaneData(
      makeReport(commits),
      fromRawCommits(commits),
    );
    expect(alice.commits).toEqual([]);
    expect(alice.lastActiveDate).toBeNull();
    expect(alice.weeklyIntensity.every((n) => n === 0)).toBe(true);
  });
});
