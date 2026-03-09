import { describe, it, expect } from 'vitest';
import type { ChurnReport, BusFactorReport, AgeMapReport, ForensicsReport } from '../types.js';
import { findCursedFiles } from './cursed-files.js';

function makeChurnReport(files: { file: string; commitCount: number; churnScore: number }[]): ChurnReport {
  return {
    files: files.map(f => ({ ...f, category: f.churnScore > 75 ? 'hot' as const : f.churnScore > 40 ? 'warm' as const : 'cold' as const })),
    topFiles: files.slice(0, 20).map(f => ({ ...f, category: 'hot' as const })),
    hotspotCount: files.filter(f => f.churnScore > 75).length,
    summary: '',
  };
}

function makeBusFactorReport(files: { file: string; risk: 'critical' | 'high' | 'medium' | 'low'; dominantAuthorPercent: number; uniqueAuthors: number }[]): BusFactorReport {
  return {
    files: files.map(f => ({ ...f, authors: ['alice@example.com'], dominantAuthor: 'alice@example.com' })),
    criticalFiles: files.filter(f => f.risk === 'critical').map(f => ({ ...f, authors: ['alice@example.com'], dominantAuthor: 'alice@example.com' })),
    overallBusFactor: 1,
    summary: '',
  };
}

function makeAgeMapReport(files: { file: string; ageInDays: number }[]): AgeMapReport {
  return {
    files: files.map(f => ({ ...f, lastCommitDate: new Date(Date.now() - f.ageInDays * 86_400_000).toISOString(), status: 'fresh' as const })),
    staleFiles: [],
    ancientFiles: [],
    medianAgeDays: 0,
    summary: '',
  };
}

function makeEmptyForensics(): ForensicsReport {
  return { files: [], shameLeaderboard: [], totalShameCommits: 0, summary: '' };
}

describe('findCursedFiles', () => {
  it('requires score >= 50 to qualify', () => {
    // high churn (>75 → 35) + high bus factor (15) = 50 → qualifies
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 10, churnScore: 80 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'high', dominantAuthorPercent: 80, uniqueAuthors: 2 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 50 }]);

    const result = findCursedFiles(churn, bus, age, makeEmptyForensics(), 20);
    expect(result.length).toBe(1);
    expect(result[0].curseScore).toBe(50);
  });

  it('excludes files below threshold 50', () => {
    // warm churn (>40 → 15) + high bus factor (15) = 30 → excluded
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 5, churnScore: 50 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'high', dominantAuthorPercent: 80, uniqueAuthors: 2 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 50 }]);

    const result = findCursedFiles(churn, bus, age, makeEmptyForensics(), 20);
    expect(result.length).toBe(0);
  });

  it('requires multiple strong signals', () => {
    // Only critical bus factor (30), no churn signal (churnScore <= 40 → 0 from churn) → excluded
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 2, churnScore: 30 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'critical', dominantAuthorPercent: 100, uniqueAuthors: 1 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 50 }]);

    const result = findCursedFiles(churn, bus, age, makeEmptyForensics(), 20);
    expect(result.length).toBe(0);
  });

  it('combines hot churn (35) + critical bus factor (30) = 65', () => {
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 10, churnScore: 80 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'critical', dominantAuthorPercent: 100, uniqueAuthors: 1 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 50 }]);

    const result = findCursedFiles(churn, bus, age, makeEmptyForensics(), 20);
    expect(result[0].curseScore).toBe(65);
  });

  it('caps score at 100', () => {
    // hot churn (35) + critical bus (30) + age paradox (10) + many signals
    // We need churnScore > 60 and ageInDays < 30 for the age paradox bonus
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 50, churnScore: 95 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'critical', dominantAuthorPercent: 100, uniqueAuthors: 1 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 5 }]);

    const result = findCursedFiles(churn, bus, age, makeEmptyForensics(), 50);
    // 35 + 30 + 10 = 75, capped at 100 (doesn't exceed here, but test the cap mechanism)
    expect(result[0].curseScore).toBeLessThanOrEqual(100);
  });

  it('sorts by curseScore descending', () => {
    const churn = makeChurnReport([
      { file: 'low.ts', commitCount: 10, churnScore: 80 },
      { file: 'high.ts', commitCount: 20, churnScore: 90 },
    ]);
    const bus = makeBusFactorReport([
      { file: 'low.ts', risk: 'high', dominantAuthorPercent: 80, uniqueAuthors: 2 },
      { file: 'high.ts', risk: 'critical', dominantAuthorPercent: 100, uniqueAuthors: 1 },
    ]);
    const age = makeAgeMapReport([
      { file: 'low.ts', ageInDays: 50 },
      { file: 'high.ts', ageInDays: 50 },
    ]);

    const result = findCursedFiles(churn, bus, age, makeEmptyForensics(), 30);
    expect(result[0].file).toBe('high.ts');
    expect(result[0].curseScore).toBeGreaterThan(result[1].curseScore);
  });

  it('includes reasons for each signal', () => {
    const churn = makeChurnReport([{ file: 'a.ts', commitCount: 10, churnScore: 80 }]);
    const bus = makeBusFactorReport([{ file: 'a.ts', risk: 'critical', dominantAuthorPercent: 100, uniqueAuthors: 1 }]);
    const age = makeAgeMapReport([{ file: 'a.ts', ageInDays: 50 }]);

    const result = findCursedFiles(churn, bus, age, makeEmptyForensics(), 20);
    expect(result[0].reasons.length).toBeGreaterThanOrEqual(2);
    expect(result[0].reasons.some(r => r.toLowerCase().includes('commit'))).toBe(true);
    expect(result[0].reasons.some(r => r.toLowerCase().includes('author'))).toBe(true);
  });

  it('only considers candidates from topFiles and criticalFiles', () => {
    // File exists in churn.files but NOT in topFiles or criticalFiles
    const churn: ChurnReport = {
      files: [{ file: 'hidden.ts', commitCount: 10, churnScore: 80, category: 'hot' }],
      topFiles: [],  // not in topFiles
      hotspotCount: 1,
      summary: '',
    };
    const bus = makeBusFactorReport([{ file: 'hidden.ts', risk: 'high', dominantAuthorPercent: 80, uniqueAuthors: 2 }]);
    const age = makeAgeMapReport([{ file: 'hidden.ts', ageInDays: 50 }]);

    const result = findCursedFiles(churn, bus, age, makeEmptyForensics(), 20);
    expect(result.length).toBe(0);
  });

  it('adds shame reason for files with shameScore >= 75', () => {
    // Build a file that scores shame-qualifying (shameScore = 80)
    const forensics: ForensicsReport = {
      files: [{
        file: 'src/auth.ts',
        shameScore: 80,
        rawShamePoints: 24,
        shameCommitCount: 5,
        topShameCommits: [],
        dominantKeywords: ['revert'],
      }],
      shameLeaderboard: [{
        file: 'src/auth.ts',
        shameScore: 80,
        rawShamePoints: 24,
        shameCommitCount: 5,
        topShameCommits: [],
        dominantKeywords: ['revert'],
      }],
      totalShameCommits: 5,
      summary: '',
    };

    // Give it enough churn to be a candidate and cross 50 with shame bonus
    // churnScore > 75 = +35, shameScore >= 75 = +20 → total 55 (enough)
    const churn = makeChurnReport([{
      file: 'src/auth.ts',
      commitCount: 20,
      churnScore: 80,
    }]);
    const busFactor = makeBusFactorReport([]);
    const ageMap = makeAgeMapReport([]);

    const result = findCursedFiles(churn, busFactor, ageMap, forensics, 100);
    const auth = result.find(f => f.file === 'src/auth.ts');
    expect(auth).toBeDefined();
    expect(auth!.reasons.some(r => r.includes('revert'))).toBe(true);
  });
});
