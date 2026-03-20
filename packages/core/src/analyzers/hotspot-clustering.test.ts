import { describe, it, expect } from 'vitest';
import type {
  HotspotReport, HotspotEntry, BusFactorReport, CouplingReport,
  ContributorReport, ClusterMember,
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
