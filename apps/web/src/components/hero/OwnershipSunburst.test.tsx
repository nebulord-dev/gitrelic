import { describe, expect, it } from 'vitest';

import { countSunburstFiles, prepareSunburstData } from './OwnershipSunburst';
import type { GitrelicReport } from '@gitrelic/core';

interface BusFactorFixture {
  file: string;
  dominantAuthor: string;
  dominantAuthorPercent: number;
  risk: string;
}

function makeReport(
  busFactorsFiles: BusFactorFixture[],
  ghostFiles: string[] = [],
): GitrelicReport {
  return {
    busFactors: {
      files: busFactorsFiles,
      criticalFiles: [],
      overallBusFactor: 1,
      summary: '',
    },
    ghostFiles: {
      files: ghostFiles.map((f) => ({ file: f })),
      totalGhostFiles: ghostFiles.length,
      summary: '',
    },
    loc: {
      files: busFactorsFiles.map((b) => ({
        file: b.file,
        lines: 100,
        language: 'TypeScript',
      })),
      totalLines: 0,
      languages: [],
      summary: '',
    },
    contributors: {
      contributors: [],
      total: 0,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

function filesInTree(node: ReturnType<typeof prepareSunburstData>): string[] {
  const out: string[] = [];
  for (const author of node.children ?? []) {
    for (const file of author.children ?? []) {
      if (file.file) out.push(file.file);
    }
  }
  return out.sort();
}

describe('prepareSunburstData', () => {
  const fixture = [
    {
      file: 'silo.ts',
      dominantAuthor: 'a@x.io',
      dominantAuthorPercent: 95,
      risk: 'critical',
    },
    {
      file: 'shared.ts',
      dominantAuthor: 'b@x.io',
      dominantAuthorPercent: 60,
      risk: 'medium',
    },
    {
      file: 'just-over.ts',
      dominantAuthor: 'a@x.io',
      dominantAuthorPercent: 81,
      risk: 'high',
    },
    {
      file: 'at-threshold.ts',
      dominantAuthor: 'b@x.io',
      dominantAuthorPercent: 80,
      risk: 'medium',
    },
    {
      file: 'ghost.ts',
      dominantAuthor: 'c@x.io',
      dominantAuthorPercent: 100,
      risk: 'critical',
    },
  ];

  it('mode="all" includes every busFactors file', () => {
    const tree = prepareSunburstData(makeReport(fixture, ['ghost.ts']), 'all');
    expect(filesInTree(tree)).toEqual([
      'at-threshold.ts',
      'ghost.ts',
      'just-over.ts',
      'shared.ts',
      'silo.ts',
    ]);
  });

  it('mode="ghost" filters to ghostFiles only', () => {
    const tree = prepareSunburstData(
      makeReport(fixture, ['ghost.ts']),
      'ghost',
    );
    expect(filesInTree(tree)).toEqual(['ghost.ts']);
  });

  it('mode="single-author" filters to dominantAuthorPercent > 80 (strict)', () => {
    const tree = prepareSunburstData(makeReport(fixture, []), 'single-author');
    expect(filesInTree(tree)).toEqual(['ghost.ts', 'just-over.ts', 'silo.ts']);
  });

  it('mode="single-author" excludes files exactly at the 80% threshold', () => {
    const tree = prepareSunburstData(makeReport(fixture, []), 'single-author');
    expect(filesInTree(tree)).not.toContain('at-threshold.ts');
  });
});

describe('countSunburstFiles', () => {
  const fixture = [
    {
      file: 'silo.ts',
      dominantAuthor: 'a@x.io',
      dominantAuthorPercent: 95,
      risk: 'critical',
    },
    {
      file: 'shared.ts',
      dominantAuthor: 'b@x.io',
      dominantAuthorPercent: 60,
      risk: 'medium',
    },
    {
      file: 'ghost.ts',
      dominantAuthor: 'c@x.io',
      dominantAuthorPercent: 100,
      risk: 'critical',
    },
  ];

  it('counts all busFactors files in mode="all"', () => {
    expect(countSunburstFiles(makeReport(fixture, ['ghost.ts']), 'all')).toBe(
      3,
    );
  });

  it('counts only ghost files in mode="ghost"', () => {
    expect(countSunburstFiles(makeReport(fixture, ['ghost.ts']), 'ghost')).toBe(
      1,
    );
  });

  it('counts only single-author files in mode="single-author"', () => {
    expect(countSunburstFiles(makeReport(fixture, []), 'single-author')).toBe(
      2,
    );
  });
});
