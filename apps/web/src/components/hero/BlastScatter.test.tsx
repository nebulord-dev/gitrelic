import { describe, expect, it } from 'vitest';

import { blastTierFor, prepareBlastData } from './BlastScatter';

import type { GitrelicReport } from '@gitrelic/core';

interface BlastFixture {
  file: string;
  blastScore: number;
  avgCoChangedFiles: number;
  maxCoChangedFiles: number;
  totalCommits: number;
}

function makeReport(files: BlastFixture[]): GitrelicReport {
  return {
    blastRadius: { files, topBlasters: [], summary: '' },
  } as unknown as GitrelicReport;
}

describe('blastTierFor', () => {
  it('returns "low" below 25', () => {
    expect(blastTierFor(0)).toBe('low');
    expect(blastTierFor(24)).toBe('low');
  });

  it('returns "medium" from 25 up to (but not including) 50', () => {
    expect(blastTierFor(25)).toBe('medium');
    expect(blastTierFor(49)).toBe('medium');
  });

  it('returns "high" from 50 up to and including 75', () => {
    expect(blastTierFor(50)).toBe('high');
    expect(blastTierFor(75)).toBe('high');
  });

  it('returns "critical" above 75', () => {
    expect(blastTierFor(76)).toBe('critical');
    expect(blastTierFor(100)).toBe('critical');
  });
});

describe('prepareBlastData', () => {
  it('projects each file to a point with file/x/y/tier', () => {
    const { points } = prepareBlastData(
      makeReport([
        {
          file: 'a.ts',
          blastScore: 10,
          avgCoChangedFiles: 2,
          maxCoChangedFiles: 5,
          totalCommits: 3,
        },
        {
          file: 'b.ts',
          blastScore: 90,
          avgCoChangedFiles: 25,
          maxCoChangedFiles: 50,
          totalCommits: 10,
        },
      ]),
    );
    expect(points).toEqual([
      { file: 'a.ts', x: 10, y: 2, tier: 'low' },
      { file: 'b.ts', x: 90, y: 25, tier: 'critical' },
    ]);
  });

  it('returns xMax and yMax as the largest blastScore and avgCoChangedFiles', () => {
    const { xMax, yMax } = prepareBlastData(
      makeReport([
        { file: 'a', blastScore: 10, avgCoChangedFiles: 2, maxCoChangedFiles: 0, totalCommits: 0 },
        { file: 'b', blastScore: 90, avgCoChangedFiles: 25, maxCoChangedFiles: 0, totalCommits: 0 },
        { file: 'c', blastScore: 60, avgCoChangedFiles: 15, maxCoChangedFiles: 0, totalCommits: 0 },
      ]),
    );
    expect(xMax).toBe(90);
    expect(yMax).toBe(25);
  });

  it('returns xMax=0 and yMax=0 for an empty report', () => {
    const { points, xMax, yMax } = prepareBlastData(makeReport([]));
    expect(points).toEqual([]);
    expect(xMax).toBe(0);
    expect(yMax).toBe(0);
  });

  it('does not mutate the input files array', () => {
    const original: BlastFixture[] = [
      { file: 'a', blastScore: 10, avgCoChangedFiles: 2, maxCoChangedFiles: 5, totalCommits: 3 },
      { file: 'b', blastScore: 90, avgCoChangedFiles: 25, maxCoChangedFiles: 50, totalCommits: 10 },
    ];
    const before = original.map((f) => f.file);
    prepareBlastData(makeReport(original));
    expect(original.map((f) => f.file)).toEqual(before);
  });
});
