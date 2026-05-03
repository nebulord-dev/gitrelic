import { describe, expect, it } from 'vitest';

import { prepareStalenessData, staleTierFor } from './StalenessScatter';

import type { GitrelicReport } from '@gitrelic/core';

interface CandidateFixture {
  file: string;
  lastCommitDate: string;
  ageInDays: number;
  language: string;
  loc: number;
}

function makeReport(candidates: CandidateFixture[]): GitrelicReport {
  return {
    deadCode: {
      candidates,
      totalDeadFiles: candidates.length,
      totalDeadLines: 0,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('staleTierFor', () => {
  it('returns "fresh" below 30 days', () => {
    expect(staleTierFor(0)).toBe('fresh');
    expect(staleTierFor(29)).toBe('fresh');
  });

  it('returns "aging" from 30 up to (but not including) 180 days', () => {
    expect(staleTierFor(30)).toBe('aging');
    expect(staleTierFor(179)).toBe('aging');
  });

  it('returns "stale" from 180 up to and including 365 days', () => {
    expect(staleTierFor(180)).toBe('stale');
    expect(staleTierFor(365)).toBe('stale');
  });

  it('returns "ancient" above 365 days', () => {
    expect(staleTierFor(366)).toBe('ancient');
    expect(staleTierFor(10_000)).toBe('ancient');
  });
});

describe('prepareStalenessData', () => {
  it('projects each candidate to a point with file/x/y/tier', () => {
    const { points } = prepareStalenessData(
      makeReport([
        {
          file: 'a.ts',
          lastCommitDate: '',
          ageInDays: 10,
          language: 'TypeScript',
          loc: 100,
        },
        {
          file: 'b.ts',
          lastCommitDate: '',
          ageInDays: 400,
          language: 'TypeScript',
          loc: 5000,
        },
      ]),
    );
    expect(points).toEqual([
      { file: 'a.ts', x: 10, y: 100, tier: 'fresh' },
      { file: 'b.ts', x: 400, y: 5000, tier: 'ancient' },
    ]);
  });

  it('returns xMax and yMax as the largest x and y across points', () => {
    const { xMax, yMax } = prepareStalenessData(
      makeReport([
        {
          file: 'a',
          lastCommitDate: '',
          ageInDays: 10,
          language: 'TS',
          loc: 100,
        },
        {
          file: 'b',
          lastCommitDate: '',
          ageInDays: 400,
          language: 'TS',
          loc: 5000,
        },
        {
          file: 'c',
          lastCommitDate: '',
          ageInDays: 200,
          language: 'TS',
          loc: 1500,
        },
      ]),
    );
    expect(xMax).toBe(400);
    expect(yMax).toBe(5000);
  });

  it('returns xMax=0 and yMax=0 for an empty report (so callers can guard divisions)', () => {
    const { points, xMax, yMax } = prepareStalenessData(makeReport([]));
    expect(points).toEqual([]);
    expect(xMax).toBe(0);
    expect(yMax).toBe(0);
  });

  it('does not mutate the input candidates array', () => {
    const original: CandidateFixture[] = [
      {
        file: 'a',
        lastCommitDate: '',
        ageInDays: 10,
        language: 'TS',
        loc: 100,
      },
      {
        file: 'b',
        lastCommitDate: '',
        ageInDays: 400,
        language: 'TS',
        loc: 5000,
      },
    ];
    const before = original.map((c) => c.file);
    prepareStalenessData(makeReport(original));
    expect(original.map((c) => c.file)).toEqual(before);
  });
});
