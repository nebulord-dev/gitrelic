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

interface ChurnFixture {
  file: string;
  commitCount: number;
}

function makeReport(
  criticalFiles: CriticalFixture[],
  churnFiles: ChurnFixture[] = [],
): GitrelicReport {
  return {
    busFactors: { files: [], criticalFiles, overallBusFactor: 1, summary: '' },
    churn: { files: churnFiles, topFiles: [], summary: '' },
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

  it('breaks percent ties by commit count desc', () => {
    const rows = prepareOwnershipBarData(
      makeReport(
        [
          {
            file: 'low-impact',
            dominantAuthor: 'x',
            dominantAuthorPercent: 100,
            risk: 'critical',
            uniqueAuthors: 1,
            authors: [],
          },
          {
            file: 'high-impact',
            dominantAuthor: 'x',
            dominantAuthorPercent: 100,
            risk: 'critical',
            uniqueAuthors: 1,
            authors: [],
          },
        ],
        [
          { file: 'low-impact', commitCount: 2 },
          { file: 'high-impact', commitCount: 47 },
        ],
      ),
    );
    expect(rows.map((r) => r.file)).toEqual(['high-impact', 'low-impact']);
    expect(rows[0].commitCount).toBe(47);
  });

  it('treats missing churn data as zero commits when tiebreaking', () => {
    const rows = prepareOwnershipBarData(
      makeReport(
        [
          {
            file: 'untracked',
            dominantAuthor: 'x',
            dominantAuthorPercent: 100,
            risk: 'critical',
            uniqueAuthors: 1,
            authors: [],
          },
          {
            file: 'tracked',
            dominantAuthor: 'x',
            dominantAuthorPercent: 100,
            risk: 'critical',
            uniqueAuthors: 1,
            authors: [],
          },
        ],
        [{ file: 'tracked', commitCount: 5 }],
      ),
    );
    expect(rows[0].file).toBe('tracked');
    expect(rows[1].commitCount).toBe(0);
  });

  it('caps at 100 rows by default', () => {
    const many: CriticalFixture[] = Array.from({ length: 150 }, (_, i) => ({
      file: `f${i}`,
      dominantAuthor: 'x',
      dominantAuthorPercent: 90,
      risk: 'high',
      uniqueAuthors: 1,
      authors: [],
    }));
    const rows = prepareOwnershipBarData(makeReport(many));
    expect(rows).toHaveLength(100);
  });

  it('honors a custom topN', () => {
    const many: CriticalFixture[] = Array.from({ length: 20 }, (_, i) => ({
      file: `f${i}`,
      dominantAuthor: 'x',
      dominantAuthorPercent: 90,
      risk: 'high',
      uniqueAuthors: 1,
      authors: [],
    }));
    expect(prepareOwnershipBarData(makeReport(many), 5)).toHaveLength(5);
  });

  it('returns [] when criticalFiles is empty', () => {
    expect(prepareOwnershipBarData(makeReport([]))).toEqual([]);
  });

  it('preserves the full author email on the row', () => {
    const rows = prepareOwnershipBarData(
      makeReport([
        {
          file: 'a',
          dominantAuthor: 'mail@henrik-liebau.de',
          dominantAuthorPercent: 100,
          risk: 'critical',
          uniqueAuthors: 1,
          authors: [],
        },
      ]),
    );
    expect(rows[0].dominantAuthor).toBe('mail@henrik-liebau.de');
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
