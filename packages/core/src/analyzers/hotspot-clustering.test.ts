import { describe, it, expect } from 'vitest';
import type {
  HotspotReport, HotspotEntry, BusFactorReport, CouplingReport,
  ContributorReport, ClusterMember, ContributorProfile,
} from '../types.js';
import type { RawCommit } from '../utils/git.js';
import { analyzeHotspotClustering } from './hotspot-clustering.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeHotspotReport(entries: { file: string; score: number }[]): HotspotReport {
  const files: HotspotEntry[] = entries.map(e => ({
    file: e.file,
    hotspotScore: e.score,
    churnScore: e.score,
    loc: 100,
    category: e.score >= 75 ? 'critical' : e.score >= 50 ? 'warning' : e.score >= 25 ? 'moderate' : 'low',
  }));
  return {
    files,
    topHotspots: files.slice(0, 20),
    summary: '',
  };
}

function emptyBusFactor(): BusFactorReport {
  return { files: [], criticalFiles: [], overallBusFactor: 999, summary: '' };
}

function emptyCoupling(): CouplingReport {
  return { pairs: [], fileProfiles: [], topPairs: [], summary: '' };
}

function emptyContributors(): ContributorReport {
  return {
    contributors: [
      { email: 'a@dev.com', name: 'A', commitCount: 10, firstCommit: '', lastCommit: '', filesOwned: 0, linesChanged: 0, activeDays: 0, focusAreas: [], isActive: true },
      { email: 'b@dev.com', name: 'B', commitCount: 5, firstCommit: '', lastCommit: '', filesOwned: 0, linesChanged: 0, activeDays: 0, focusAreas: [], isActive: true },
    ],
    activeContributors: [],
    ghostContributors: [],
    topContributor: {} as any,
    summary: '',
  };
}

function makeBusFactor(entries: { file: string; dominantAuthor: string; dominantAuthorPercent: number }[]): BusFactorReport {
  return {
    files: entries.map(e => ({
      file: e.file,
      uniqueAuthors: 2,
      authors: [e.dominantAuthor],
      dominantAuthor: e.dominantAuthor,
      dominantAuthorPercent: e.dominantAuthorPercent,
      risk: 'medium' as const,
    })),
    criticalFiles: [],
    overallBusFactor: 2,
    summary: '',
  };
}

// ─── Structural clustering ───────────────────────────────────────────────────

describe('structural clustering', () => {
  it('groups hotspots in the same directory prefix', () => {
    const hotspots = makeHotspotReport([
      { file: 'src/auth/login.ts', score: 80 },
      { file: 'src/auth/session.ts', score: 70 },
      { file: 'src/api/handler.ts', score: 60 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), [],
      ['src/auth/login.ts', 'src/auth/session.ts', 'src/api/handler.ts', 'src/api/routes.ts']
    );

    const structural = result.clusters.filter(c => c.dimension === 'structural');
    expect(structural.length).toBe(1);
    expect(structural[0].sharedTrait).toBe('src/auth');
    expect(structural[0].members).toHaveLength(2);
  });

  it('discards singleton groups', () => {
    const hotspots = makeHotspotReport([
      { file: 'src/auth/login.ts', score: 80 },
      { file: 'src/api/handler.ts', score: 60 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), [],
      ['src/auth/login.ts', 'src/api/handler.ts']
    );

    const structural = result.clusters.filter(c => c.dimension === 'structural');
    expect(structural).toHaveLength(0);
  });

  it('filters out overly broad prefixes (>50% of tracked files)', () => {
    const hotspots = makeHotspotReport([
      { file: 'src/a.ts', score: 80 },
      { file: 'src/b.ts', score: 70 },
    ]);
    // src/ contains all 3 tracked files — >50%
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), [],
      ['src/a.ts', 'src/b.ts', 'src/c.ts']
    );

    const structural = result.clusters.filter(c => c.dimension === 'structural');
    expect(structural).toHaveLength(0);
  });
});

// ─── Ownership clustering ─────────────────────────────────────────────────────

describe('ownership clustering', () => {
  it('groups hotspots by dominant author', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
      { file: 'c.ts', score: 60 },
    ]);
    const bf = makeBusFactor([
      { file: 'a.ts', dominantAuthor: 'alice@dev.com', dominantAuthorPercent: 85 },
      { file: 'b.ts', dominantAuthor: 'alice@dev.com', dominantAuthorPercent: 90 },
      { file: 'c.ts', dominantAuthor: 'bob@dev.com', dominantAuthorPercent: 75 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, bf, emptyCoupling(), emptyContributors(), [],
      ['a.ts', 'b.ts', 'c.ts']
    );

    const ownership = result.clusters.filter(c => c.dimension === 'ownership');
    expect(ownership).toHaveLength(1);
    expect(ownership[0].sharedTrait).toBe('alice@dev.com');
    expect(ownership[0].label).toContain('alice@dev.com');
    expect(ownership[0].label).toContain('avg');
    expect(ownership[0].members).toHaveLength(2);
  });

  it('skips ownership dimension for single-author repos', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
    ]);
    const bf = makeBusFactor([
      { file: 'a.ts', dominantAuthor: 'solo@dev.com', dominantAuthorPercent: 100 },
      { file: 'b.ts', dominantAuthor: 'solo@dev.com', dominantAuthorPercent: 100 },
    ]);
    const singleAuthorContribs: ContributorReport = {
      contributors: [
        { email: 'solo@dev.com', name: 'Solo', commitCount: 100, firstCommit: '', lastCommit: '', filesOwned: 0, linesChanged: 0, activeDays: 0, focusAreas: [], isActive: true },
      ],
      activeContributors: [],
      ghostContributors: [],
      topContributor: {} as any,
      summary: '',
    };
    const result = analyzeHotspotClustering(
      hotspots, bf, emptyCoupling(), singleAuthorContribs, [],
      ['a.ts', 'b.ts']
    );

    const ownership = result.clusters.filter(c => c.dimension === 'ownership');
    expect(ownership).toHaveLength(0);
  });
});

// ─── Temporal clustering ──────────────────────────────────────────────────────

function makeCommits(fileCommits: { file: string; dates: string[] }[]): RawCommit[] {
  const commits: RawCommit[] = [];
  for (const fc of fileCommits) {
    for (const date of fc.dates) {
      commits.push({
        hash: `${fc.file}-${date}`,
        authorEmail: 'dev@test.com',
        authorName: 'Dev',
        date,
        message: 'change',
        files: [fc.file],
        fileStats: [],
        insertions: 1,
        deletions: 0,
      });
    }
  }
  return commits;
}

describe('temporal clustering', () => {
  it('groups hotspots whose churn inflected in the same month', () => {
    // Both files have low activity early, spike in 2025-10
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
    ]);
    const commits = makeCommits([
      { file: 'a.ts', dates: ['2025-06-01', '2025-07-01', '2025-10-01', '2025-10-10', '2025-10-20', '2025-11-01'] },
      { file: 'b.ts', dates: ['2025-05-01', '2025-08-01', '2025-10-05', '2025-10-15', '2025-10-25', '2025-11-05'] },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), commits,
      ['a.ts', 'b.ts']
    );

    const temporal = result.clusters.filter(c => c.dimension === 'temporal');
    expect(temporal).toHaveLength(1);
    expect(temporal[0].members).toHaveLength(2);
    expect(temporal[0].sharedTrait).toContain('2025-10');
  });

  it('skips files with fewer than 4 commits', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
    ]);
    const commits = makeCommits([
      { file: 'a.ts', dates: ['2025-06-01', '2025-10-01', '2025-10-10'] },
      { file: 'b.ts', dates: ['2025-06-01', '2025-10-01', '2025-10-10'] },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), commits,
      ['a.ts', 'b.ts']
    );

    const temporal = result.clusters.filter(c => c.dimension === 'temporal');
    expect(temporal).toHaveLength(0);
  });

  it('skips temporal dimension when less than 3 distinct months', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
    ]);
    const commits = makeCommits([
      { file: 'a.ts', dates: ['2025-10-01', '2025-10-10', '2025-10-20', '2025-11-01'] },
      { file: 'b.ts', dates: ['2025-10-05', '2025-10-15', '2025-10-25', '2025-11-05'] },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), commits,
      ['a.ts', 'b.ts']
    );

    const temporal = result.clusters.filter(c => c.dimension === 'temporal');
    expect(temporal).toHaveLength(0);
  });
});
