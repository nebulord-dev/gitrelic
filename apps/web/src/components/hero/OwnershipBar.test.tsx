import { describe, expect, it } from 'vitest';

import { prepareOwnershipBarData } from './OwnershipBar';

import type { GitrelicReport } from '@gitrelic/core';

interface CriticalFixture {
  file: string;
  dominantAuthor: string;
  dominantAuthorPercent: number;
  risk: string;
  uniqueAuthors: number;
  authors: string[];
}

function makeReport(criticalFiles: CriticalFixture[]): GitrelicReport {
  return {
    busFactors: { files: [], criticalFiles, overallBusFactor: 1, summary: '' },
  } as unknown as GitrelicReport;
}

describe('prepareOwnershipBarData', () => {
  it('sorts rows by dominantAuthorPercent desc', () => {
    const rows = prepareOwnershipBarData(
      makeReport([
        {
          file: 'a',
          dominantAuthor: 'x',
          dominantAuthorPercent: 60,
          risk: 'medium',
          uniqueAuthors: 2,
          authors: [],
        },
        {
          file: 'b',
          dominantAuthor: 'y',
          dominantAuthorPercent: 95,
          risk: 'critical',
          uniqueAuthors: 1,
          authors: [],
        },
      ]),
    );
    expect(rows.map((r) => r.file)).toEqual(['b', 'a']);
  });

  it('caps at 30 rows by default', () => {
    const many: CriticalFixture[] = Array.from({ length: 50 }, (_, i) => ({
      file: `f${i}`,
      dominantAuthor: 'x',
      dominantAuthorPercent: 90,
      risk: 'high',
      uniqueAuthors: 1,
      authors: [],
    }));
    const rows = prepareOwnershipBarData(makeReport(many));
    expect(rows).toHaveLength(30);
  });

  it('returns [] when criticalFiles is empty', () => {
    expect(prepareOwnershipBarData(makeReport([]))).toEqual([]);
  });

  it('does not mutate the input criticalFiles array', () => {
    const original: CriticalFixture[] = [
      {
        file: 'a',
        dominantAuthor: 'x',
        dominantAuthorPercent: 60,
        risk: 'medium',
        uniqueAuthors: 2,
        authors: [],
      },
      {
        file: 'b',
        dominantAuthor: 'y',
        dominantAuthorPercent: 95,
        risk: 'critical',
        uniqueAuthors: 1,
        authors: [],
      },
    ];
    const beforeOrder = original.map((f) => f.file);
    prepareOwnershipBarData(makeReport(original));
    expect(original.map((f) => f.file)).toEqual(beforeOrder);
  });
});
