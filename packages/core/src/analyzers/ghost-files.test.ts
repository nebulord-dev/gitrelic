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
  authors: { email: string; name: string; isActive: boolean }[],
): ContributorReport {
  return {
    contributors: authors.map((a) => ({
      email: a.email,
      name: a.name,
      isActive: a.isActive,
      commitCount: 10,
      firstCommit: '2024-01-01',
      lastCommit: '2024-06-01',
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
        commitCount: 10,
        firstCommit: '2024-01-01',
        lastCommit: '2024-06-01',
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
      commitCount: 0,
      firstCommit: '',
      lastCommit: '',
      filesOwned: 0,
      linesChanged: 0,
      activeDays: 0,
      focusAreas: [],
    },
    summary: '',
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
  it('flags files owned >70% by inactive authors', () => {
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

  it('excludes files where ownership is below 70%', () => {
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
        dominantAuthorPercent: 75,
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
});
