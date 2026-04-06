import { describe, it, expect } from 'vitest';

import { analyzeHotspots } from './hotspot.js';

import type { ChurnReport, LocReport } from '../types.js';

function makeChurnReport(files: { file: string; churnScore: number }[]): ChurnReport {
  return {
    files: files.map((f) => ({ ...f, commitCount: f.churnScore, category: 'hot' as const })),
    topFiles: [],
    hotspotCount: 0,
    summary: '',
  };
}

function makeLocReport(files: { file: string; lines: number }[]): LocReport {
  return {
    totalFiles: files.length,
    totalLines: files.reduce((s, f) => s + f.lines, 0),
    files: files.map((f) => ({ ...f, language: 'TypeScript' })),
    languages: [],
    summary: '',
  };
}

describe('analyzeHotspots', () => {
  it('computes hotspot score as churnScore × log2(loc), normalized to 0-100', () => {
    const churn = makeChurnReport([
      { file: 'big.ts', churnScore: 100 },
      { file: 'small.ts', churnScore: 100 },
    ]);
    const loc = makeLocReport([
      { file: 'big.ts', lines: 1024 },
      { file: 'small.ts', lines: 32 },
    ]);

    const result = analyzeHotspots(churn, loc);

    expect(result.files[0].file).toBe('big.ts');
    expect(result.files[0].hotspotScore).toBe(100);
    expect(result.files[1].file).toBe('small.ts');
    expect(result.files[1].hotspotScore).toBe(50);
  });

  it('assigns correct categories based on score thresholds', () => {
    const churn = makeChurnReport([
      { file: 'a.ts', churnScore: 100 },
      { file: 'b.ts', churnScore: 70 },
      { file: 'c.ts', churnScore: 40 },
      { file: 'd.ts', churnScore: 10 },
    ]);
    const loc = makeLocReport([
      { file: 'a.ts', lines: 256 },
      { file: 'b.ts', lines: 256 },
      { file: 'c.ts', lines: 256 },
      { file: 'd.ts', lines: 256 },
    ]);

    const result = analyzeHotspots(churn, loc);

    expect(result.files.find((f) => f.file === 'a.ts')!.category).toBe('critical');
    expect(result.files.find((f) => f.file === 'd.ts')!.category).toBe('low');
  });

  it('excludes files in churn but not in LOC (deleted files)', () => {
    const churn = makeChurnReport([{ file: 'deleted.ts', churnScore: 80 }]);
    const loc = makeLocReport([]);

    const result = analyzeHotspots(churn, loc);

    expect(result.files).toHaveLength(0);
  });

  it('excludes files in LOC but not in churn (zero-churn files)', () => {
    const churn = makeChurnReport([]);
    const loc = makeLocReport([{ file: 'stable.ts', lines: 500 }]);

    const result = analyzeHotspots(churn, loc);

    expect(result.files).toHaveLength(0);
  });

  it('clamps LOC to 1 for empty files (avoids log2(0) = -Infinity)', () => {
    const churn = makeChurnReport([{ file: 'empty.ts', churnScore: 50 }]);
    const loc = makeLocReport([{ file: 'empty.ts', lines: 0 }]);

    const result = analyzeHotspots(churn, loc);

    expect(result.files[0].hotspotScore).toBe(0);
    expect(Number.isFinite(result.files[0].hotspotScore)).toBe(true);
  });

  it('limits topHotspots to 20', () => {
    const files = Array.from({ length: 25 }, (_, i) => ({ file: `f${i}.ts`, churnScore: 50 }));
    const churn = makeChurnReport(files);
    const loc = makeLocReport(files.map((f) => ({ file: f.file, lines: 100 })));

    const result = analyzeHotspots(churn, loc);

    expect(result.topHotspots.length).toBe(20);
  });

  it('sorts files by hotspot score descending', () => {
    const churn = makeChurnReport([
      { file: 'low.ts', churnScore: 20 },
      { file: 'high.ts', churnScore: 100 },
    ]);
    const loc = makeLocReport([
      { file: 'low.ts', lines: 100 },
      { file: 'high.ts', lines: 100 },
    ]);

    const result = analyzeHotspots(churn, loc);

    expect(result.files[0].file).toBe('high.ts');
    expect(result.files[1].file).toBe('low.ts');
  });

  it('produces a summary string', () => {
    const churn = makeChurnReport([{ file: 'a.ts', churnScore: 100 }]);
    const loc = makeLocReport([{ file: 'a.ts', lines: 256 }]);

    const result = analyzeHotspots(churn, loc);

    expect(result.summary).toBeTruthy();
  });
});
