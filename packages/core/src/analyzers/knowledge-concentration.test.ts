import { describe, it, expect } from 'vitest';

import { analyzeKnowledgeConcentration } from './knowledge-concentration.js';

import type { BusFactorReport } from '../types.js';

function makeBusReport(files: { file: string; dominantAuthorPercent: number }[]): BusFactorReport {
  return {
    files: files.map((f) => ({
      file: f.file,
      dominantAuthorPercent: f.dominantAuthorPercent,
      uniqueAuthors: 1,
      authors: ['a@b.com'],
      dominantAuthor: 'a@b.com',
      risk: f.dominantAuthorPercent > 80 ? ('critical' as const) : ('low' as const),
    })),
    criticalFiles: [],
    overallBusFactor: 1,
    summary: '',
  };
}

describe('analyzeKnowledgeConcentration', () => {
  it('counts files with >80% single-author ownership', () => {
    const bus = makeBusReport([
      { file: 'a.ts', dominantAuthorPercent: 90 },
      { file: 'b.ts', dominantAuthorPercent: 50 },
      { file: 'c.ts', dominantAuthorPercent: 85 },
    ]);
    const result = analyzeKnowledgeConcentration(bus);
    expect(result.singleAuthorFiles).toBe(2);
    expect(result.totalFiles).toBe(3);
  });

  it('computes concentration index as percentage', () => {
    const bus = makeBusReport([
      { file: 'a.ts', dominantAuthorPercent: 100 },
      { file: 'b.ts', dominantAuthorPercent: 100 },
      { file: 'c.ts', dominantAuthorPercent: 30 },
      { file: 'd.ts', dominantAuthorPercent: 20 },
    ]);
    const result = analyzeKnowledgeConcentration(bus);
    expect(result.concentrationIndex).toBe(50); // 2/4 * 100
  });

  it('returns 0 when no files are single-author dominant', () => {
    const bus = makeBusReport([
      { file: 'a.ts', dominantAuthorPercent: 50 },
      { file: 'b.ts', dominantAuthorPercent: 60 },
    ]);
    const result = analyzeKnowledgeConcentration(bus);
    expect(result.concentrationIndex).toBe(0);
  });

  it('returns 100 when all files are single-author dominant', () => {
    const bus = makeBusReport([
      { file: 'a.ts', dominantAuthorPercent: 90 },
      { file: 'b.ts', dominantAuthorPercent: 100 },
    ]);
    const result = analyzeKnowledgeConcentration(bus);
    expect(result.concentrationIndex).toBe(100);
  });

  it('handles empty file list', () => {
    const bus = makeBusReport([]);
    const result = analyzeKnowledgeConcentration(bus);
    expect(result.concentrationIndex).toBe(0);
    expect(result.singleAuthorFiles).toBe(0);
  });

  it('produces a summary', () => {
    const bus = makeBusReport([{ file: 'a.ts', dominantAuthorPercent: 90 }]);
    const result = analyzeKnowledgeConcentration(bus);
    expect(result.summary).toBeTruthy();
  });
});
