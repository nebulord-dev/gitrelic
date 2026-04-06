import { describe, it, expect } from 'vitest';

import { analyzeDeadCode } from './dead-code.js';

import type { AgeMapReport, LocReport } from '../types.js';
import type { RawCommit } from '../utils/git.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'a@b.com',
    authorName: 'A',
    date: '2025-06-01T00:00:00Z',
    message: '',
    files: [],
    fileStats: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}

function makeAgeMap(files: { file: string; ageInDays: number }[]): AgeMapReport {
  return {
    files: files.map((f) => ({
      file: f.file,
      lastCommitDate: '2025-01-01T00:00:00Z',
      ageInDays: f.ageInDays,
      status: 'stale' as const,
    })),
    staleFiles: [],
    ancientFiles: [],
    medianAgeDays: 0,
    summary: '',
  };
}

function makeLocReport(files: { file: string; lines: number }[]): LocReport {
  return {
    totalFiles: files.length,
    totalLines: 0,
    files: files.map((f) => ({ file: f.file, lines: f.lines, language: 'TypeScript' })),
    languages: [],
    summary: '',
  };
}

describe('analyzeDeadCode', () => {
  it('identifies files with zero commits in window', () => {
    const commits = [makeCommit({ hash: '1', files: ['active.ts'] })];
    const tracked = ['active.ts', 'dead.ts'];
    const ageMap = makeAgeMap([
      { file: 'active.ts', ageInDays: 5 },
      { file: 'dead.ts', ageInDays: 200 },
    ]);
    const loc = makeLocReport([
      { file: 'active.ts', lines: 100 },
      { file: 'dead.ts', lines: 50 },
    ]);
    const result = analyzeDeadCode(commits, tracked, ageMap, loc);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].file).toBe('dead.ts');
    expect(result.candidates[0].ageInDays).toBe(200);
    expect(result.candidates[0].loc).toBe(50);
  });

  it('returns empty when all files have commits', () => {
    const commits = [makeCommit({ hash: '1', files: ['a.ts', 'b.ts'] })];
    const ageMap = makeAgeMap([
      { file: 'a.ts', ageInDays: 5 },
      { file: 'b.ts', ageInDays: 5 },
    ]);
    const loc = makeLocReport([
      { file: 'a.ts', lines: 100 },
      { file: 'b.ts', lines: 100 },
    ]);
    const result = analyzeDeadCode(commits, ['a.ts', 'b.ts'], ageMap, loc);
    expect(result.candidates).toHaveLength(0);
  });

  it('sorts by age descending (oldest first)', () => {
    const commits = [makeCommit({ hash: '1', files: ['active.ts'] })];
    const tracked = ['active.ts', 'old.ts', 'older.ts'];
    const ageMap = makeAgeMap([
      { file: 'active.ts', ageInDays: 1 },
      { file: 'old.ts', ageInDays: 100 },
      { file: 'older.ts', ageInDays: 300 },
    ]);
    const loc = makeLocReport([
      { file: 'active.ts', lines: 10 },
      { file: 'old.ts', lines: 20 },
      { file: 'older.ts', lines: 30 },
    ]);
    const result = analyzeDeadCode(commits, tracked, ageMap, loc);
    expect(result.candidates[0].file).toBe('older.ts');
    expect(result.candidates[1].file).toBe('old.ts');
  });

  it('counts total dead lines', () => {
    const commits = [makeCommit({ hash: '1', files: ['active.ts'] })];
    const tracked = ['active.ts', 'dead1.ts', 'dead2.ts'];
    const ageMap = makeAgeMap([
      { file: 'active.ts', ageInDays: 1 },
      { file: 'dead1.ts', ageInDays: 100 },
      { file: 'dead2.ts', ageInDays: 200 },
    ]);
    const loc = makeLocReport([
      { file: 'active.ts', lines: 100 },
      { file: 'dead1.ts', lines: 50 },
      { file: 'dead2.ts', lines: 75 },
    ]);
    const result = analyzeDeadCode(commits, tracked, ageMap, loc);
    expect(result.totalDeadFiles).toBe(2);
    expect(result.totalDeadLines).toBe(125);
  });

  it('produces a summary', () => {
    const result = analyzeDeadCode(
      [],
      ['dead.ts'],
      makeAgeMap([{ file: 'dead.ts', ageInDays: 100 }]),
      makeLocReport([{ file: 'dead.ts', lines: 50 }]),
    );
    expect(result.summary).toBeTruthy();
  });
});
