import { describe, it, expect } from 'vitest';

import { analyzeGhostFiles } from './ghost-files.js';
import type {
  BusFactorReport,
  ContributorReport,
  LocReport,
} from '../types.js';

function makeBusReport(
  files: {
    file: string;
    dominantAuthor: string;
    dominantAuthorPercent: number;
  }[],
): BusFactorReport {
  return {
    files: files.map((f) => ({
      file: f.file,
      dominantAuthor: f.dominantAuthor,
      dominantAuthorPercent: f.dominantAuthorPercent,
      uniqueAuthors: 1,
      authors: [f.dominantAuthor],
      risk: 'critical' as const,
    })),
    criticalFiles: [],
    overallBusFactor: 1,
    summary: '',
  };
}

function makeContributors(
  authors: {
    email: string;
    name: string;
    isActive: boolean;
    isGhost?: boolean;
    lastCommit?: string;
  }[],
): ContributorReport {
  return {
    contributors: authors.map((a) => ({
      email: a.email,
      name: a.name,
      isActive: a.isActive,
      isGhost: a.isGhost ?? !a.isActive,
      commitCount: 10,
      firstCommit: '2024-01-01',
      lastCommit: a.lastCommit ?? '2024-06-01',
      filesOwned: 5,
      linesChanged: 100,
      activeDays: 10,
      focusAreas: [],
    })),
    activeContributors: authors
      .filter((a) => a.isActive)
      .map((a) => ({
        email: a.email,
        name: a.name,
        isActive: a.isActive,
        isGhost: a.isGhost ?? !a.isActive,
        commitCount: 10,
        firstCommit: '2024-01-01',
        lastCommit: a.lastCommit ?? '2024-06-01',
        filesOwned: 5,
        linesChanged: 100,
        activeDays: 10,
        focusAreas: [],
      })),
    ghostContributors: [],
    topContributor: {
      email: '',
      name: '',
      isActive: true,
      isGhost: false,
      commitCount: 0,
      firstCommit: '',
      lastCommit: '',
      filesOwned: 0,
      linesChanged: 0,
      activeDays: 0,
      focusAreas: [],
    },
    summary: '',
    top3CommitShare: 0,
    newcomers90d: 0,
  };
}

function makeLocReport(files: { file: string; lines: number }[]): LocReport {
  return {
    totalFiles: files.length,
    totalLines: 0,
    files: files.map((f) => ({
      file: f.file,
      lines: f.lines,
      language: 'TypeScript',
    })),
    languages: [],
    summary: '',
  };
}

describe('analyzeGhostFiles', () => {
  it('flags files owned >=80% by ghost authors', () => {
    const bus = makeBusReport([
      {
        file: 'auth.ts',
        dominantAuthor: 'ghost@co.com',
        dominantAuthorPercent: 85,
      },
    ]);
    const contribs = makeContributors([
      { email: 'ghost@co.com', name: 'Ghost', isActive: false },
    ]);
    const loc = makeLocReport([{ file: 'auth.ts', lines: 200 }]);

    const result = analyzeGhostFiles(bus, contribs, loc);

    expect(result.files).toHaveLength(1);
    expect(result.files[0].file).toBe('auth.ts');
    expect(result.files[0].dominantAuthor).toBe('ghost@co.com');
    expect(result.files[0].loc).toBe(200);
  });

  it('excludes files where dominant author is active', () => {
    const bus = makeBusReport([
      {
        file: 'safe.ts',
        dominantAuthor: 'active@co.com',
        dominantAuthorPercent: 90,
      },
    ]);
    const contribs = makeContributors([
      { email: 'active@co.com', name: 'Active', isActive: true },
    ]);
    const loc = makeLocReport([{ file: 'safe.ts', lines: 100 }]);

    const result = analyzeGhostFiles(bus, contribs, loc);

    expect(result.files).toHaveLength(0);
  });

  it('excludes files where ownership is below 80%', () => {
    const bus = makeBusReport([
      {
        file: 'shared.ts',
        dominantAuthor: 'ghost@co.com',
        dominantAuthorPercent: 50,
      },
    ]);
    const contribs = makeContributors([
      { email: 'ghost@co.com', name: 'Ghost', isActive: false },
    ]);
    const loc = makeLocReport([{ file: 'shared.ts', lines: 100 }]);

    const result = analyzeGhostFiles(bus, contribs, loc);

    expect(result.files).toHaveLength(0);
  });

  it('sorts by ownership percent descending', () => {
    const bus = makeBusReport([
      {
        file: 'a.ts',
        dominantAuthor: 'ghost@co.com',
        dominantAuthorPercent: 82,
      },
      {
        file: 'b.ts',
        dominantAuthor: 'ghost@co.com',
        dominantAuthorPercent: 95,
      },
    ]);
    const contribs = makeContributors([
      { email: 'ghost@co.com', name: 'Ghost', isActive: false },
    ]);
    const loc = makeLocReport([
      { file: 'a.ts', lines: 50 },
      { file: 'b.ts', lines: 100 },
    ]);

    const result = analyzeGhostFiles(bus, contribs, loc);

    expect(result.files[0].file).toBe('b.ts');
    expect(result.files[1].file).toBe('a.ts');
  });

  it('returns totalGhostFiles count', () => {
    const result = analyzeGhostFiles(
      makeBusReport([]),
      makeContributors([]),
      makeLocReport([]),
    );
    expect(result.totalGhostFiles).toBe(0);
  });

  it('produces a summary', () => {
    const bus = makeBusReport([
      {
        file: 'a.ts',
        dominantAuthor: 'ghost@co.com',
        dominantAuthorPercent: 80,
      },
    ]);
    const contribs = makeContributors([
      { email: 'ghost@co.com', name: 'Ghost', isActive: false },
    ]);
    const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);

    const result = analyzeGhostFiles(bus, contribs, loc);
    expect(result.summary).toBeTruthy();
  });

  describe('ghostOwners', () => {
    it('is 0 on empty input', () => {
      const result = analyzeGhostFiles(
        makeBusReport([]),
        makeContributors([]),
        makeLocReport([]),
      );
      expect(result.ghostOwners).toBe(0);
    });

    it('counts distinct dominant authors', () => {
      const bus = makeBusReport([
        {
          file: 'a.ts',
          dominantAuthor: 'g1@co.com',
          dominantAuthorPercent: 90,
        },
        {
          file: 'b.ts',
          dominantAuthor: 'g1@co.com',
          dominantAuthorPercent: 85,
        },
        {
          file: 'c.ts',
          dominantAuthor: 'g2@co.com',
          dominantAuthorPercent: 92,
        },
      ]);
      const contribs = makeContributors([
        { email: 'g1@co.com', name: 'G1', isActive: false, isGhost: true },
        { email: 'g2@co.com', name: 'G2', isActive: false, isGhost: true },
      ]);
      const loc = makeLocReport([
        { file: 'a.ts', lines: 100 },
        { file: 'b.ts', lines: 200 },
        { file: 'c.ts', lines: 50 },
      ]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.files).toHaveLength(3);
      expect(result.ghostOwners).toBe(2);
    });
  });

  describe('tierMix', () => {
    function daysAgo(days: number): string {
      return new Date(Date.now() - days * 86_400_000).toISOString();
    }

    it('classifies authorInactiveDays >= 365 as trueGhost', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 90 },
      ]);
      const contribs = makeContributors([
        {
          email: 'g@co.com',
          name: 'G',
          isActive: false,
          isGhost: true,
          lastCommit: daysAgo(400),
        },
      ]);
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.tierMix.trueGhost).toBe(1);
      expect(result.tierMix.fading).toBe(0);
    });

    it('classifies 180 <= authorInactiveDays < 365 as fading', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 90 },
      ]);
      const contribs = makeContributors([
        {
          email: 'g@co.com',
          name: 'G',
          isActive: false,
          isGhost: true,
          lastCommit: daysAgo(200),
        },
      ]);
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.tierMix.trueGhost).toBe(0);
      expect(result.tierMix.fading).toBe(1);
    });

    it('365 days exactly is trueGhost (boundary inclusive)', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 90 },
      ]);
      const contribs = makeContributors([
        {
          email: 'g@co.com',
          name: 'G',
          isActive: false,
          isGhost: true,
          lastCommit: daysAgo(365),
        },
      ]);
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.tierMix.trueGhost).toBe(1);
      expect(result.tierMix.fading).toBe(0);
    });

    it('tier mix sums to totalGhostFiles (invariant)', () => {
      const bus = makeBusReport([
        {
          file: 'a.ts',
          dominantAuthor: 'g1@co.com',
          dominantAuthorPercent: 90,
        },
        {
          file: 'b.ts',
          dominantAuthor: 'g2@co.com',
          dominantAuthorPercent: 85,
        },
      ]);
      const contribs = makeContributors([
        {
          email: 'g1@co.com',
          name: 'G1',
          isActive: false,
          isGhost: true,
          lastCommit: daysAgo(400),
        },
        {
          email: 'g2@co.com',
          name: 'G2',
          isActive: false,
          isGhost: true,
          lastCommit: daysAgo(200),
        },
      ]);
      const loc = makeLocReport([
        { file: 'a.ts', lines: 100 },
        { file: 'b.ts', lines: 50 },
      ]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.tierMix.trueGhost + result.tierMix.fading).toBe(
        result.totalGhostFiles,
      );
    });
  });

  describe('ghostLoc', () => {
    it('is 0 on empty input', () => {
      const result = analyzeGhostFiles(
        makeBusReport([]),
        makeContributors([]),
        makeLocReport([]),
      );
      expect(result.ghostLoc).toBe(0);
    });

    it('sums LOC across all ghost files', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 90 },
        { file: 'b.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 85 },
      ]);
      const contribs = makeContributors([
        { email: 'g@co.com', name: 'G', isActive: false, isGhost: true },
      ]);
      const loc = makeLocReport([
        { file: 'a.ts', lines: 100 },
        { file: 'b.ts', lines: 250 },
      ]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.ghostLoc).toBe(350);
    });

    it('treats missing LOC entries as 0', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 90 },
      ]);
      const contribs = makeContributors([
        { email: 'g@co.com', name: 'G', isActive: false, isGhost: true },
      ]);
      const loc = makeLocReport([]); // no LOC data
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.ghostLoc).toBe(0);
    });
  });

  describe('isGhost gate (formula fix)', () => {
    it('excludes intermediate-zone authors (isActive=false but isGhost=false)', () => {
      const bus = makeBusReport([
        {
          file: 'a.ts',
          dominantAuthor: 'mid@co.com',
          dominantAuthorPercent: 90,
        },
      ]);
      const contribs = makeContributors([
        // intermediate: not active, not ghost (between cutoffs)
        { email: 'mid@co.com', name: 'M', isActive: false, isGhost: false },
      ]);
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.files).toHaveLength(0);
    });

    it('excludes files where the dominant author owns 79% (below 80% threshold)', () => {
      const bus = makeBusReport([
        {
          file: 'a.ts',
          dominantAuthor: 'g@co.com',
          dominantAuthorPercent: 79,
        },
      ]);
      const contribs = makeContributors([
        { email: 'g@co.com', name: 'G', isActive: false, isGhost: true },
      ]);
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.files).toHaveLength(0);
    });

    it('includes files where the dominant author owns exactly 80%', () => {
      const bus = makeBusReport([
        {
          file: 'a.ts',
          dominantAuthor: 'g@co.com',
          dominantAuthorPercent: 80,
        },
      ]);
      const contribs = makeContributors([
        { email: 'g@co.com', name: 'G', isActive: false, isGhost: true },
      ]);
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.files).toHaveLength(1);
    });
  });
});
