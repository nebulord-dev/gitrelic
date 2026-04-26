import { describe, expect, it } from 'vitest';

import { sortCriticalByImpact } from './sortBusFactor';

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

const baseFixture = {
  dominantAuthor: 'x',
  risk: 'critical',
  uniqueAuthors: 1,
  authors: [],
};

describe('sortCriticalByImpact', () => {
  it('sorts by dominantAuthorPercent desc', () => {
    const out = sortCriticalByImpact(
      makeReport([
        { ...baseFixture, file: 'low', dominantAuthorPercent: 60 },
        { ...baseFixture, file: 'high', dominantAuthorPercent: 95 },
      ]),
    );
    expect(out.map((f) => f.file)).toEqual(['high', 'low']);
  });

  it('breaks percent ties by commit count desc', () => {
    const out = sortCriticalByImpact(
      makeReport(
        [
          { ...baseFixture, file: 'small', dominantAuthorPercent: 100 },
          { ...baseFixture, file: 'big', dominantAuthorPercent: 100 },
        ],
        [
          { file: 'small', commitCount: 2 },
          { file: 'big', commitCount: 47 },
        ],
      ),
    );
    expect(out.map((f) => f.file)).toEqual(['big', 'small']);
  });

  it('treats missing churn data as zero commits', () => {
    const out = sortCriticalByImpact(
      makeReport(
        [
          { ...baseFixture, file: 'orphan', dominantAuthorPercent: 100 },
          { ...baseFixture, file: 'tracked', dominantAuthorPercent: 100 },
        ],
        [{ file: 'tracked', commitCount: 5 }],
      ),
    );
    expect(out.map((f) => f.file)).toEqual(['tracked', 'orphan']);
  });

  it('does not mutate the input criticalFiles array', () => {
    const input: CriticalFixture[] = [
      { ...baseFixture, file: 'a', dominantAuthorPercent: 60 },
      { ...baseFixture, file: 'b', dominantAuthorPercent: 95 },
    ];
    const before = input.map((f) => f.file);
    sortCriticalByImpact(makeReport(input));
    expect(input.map((f) => f.file)).toEqual(before);
  });

  it('returns [] for empty input', () => {
    expect(sortCriticalByImpact(makeReport([]))).toEqual([]);
  });
});
