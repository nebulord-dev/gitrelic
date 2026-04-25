import { describe, expect, it } from 'vitest';

import { coverageTierFor, prepareCoverageByDirData } from './TestCoverageByDir';

import type { GitrelicReport } from '@gitrelic/core';

interface DirectoryFixture {
  directory: string;
  sourceFiles: number;
  testFiles: number;
  coverageRatio: number;
  hasTests: boolean;
}

function makeReport(directories: DirectoryFixture[]): GitrelicReport {
  return {
    testCoverage: {
      directories,
      uncoveredDirectories: [],
      files: [],
      overallRatio: 0,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('coverageTierFor', () => {
  it('returns "critical" below 0.25', () => {
    expect(coverageTierFor(0)).toBe('critical');
    expect(coverageTierFor(0.24)).toBe('critical');
  });

  it('returns "low" from 0.25 up to (but not including) 0.50', () => {
    expect(coverageTierFor(0.25)).toBe('low');
    expect(coverageTierFor(0.49)).toBe('low');
  });

  it('returns "medium" from 0.50 up to (but not including) 0.80', () => {
    expect(coverageTierFor(0.5)).toBe('medium');
    expect(coverageTierFor(0.79)).toBe('medium');
  });

  it('returns "good" at and above 0.80', () => {
    expect(coverageTierFor(0.8)).toBe('good');
    expect(coverageTierFor(1)).toBe('good');
  });
});

describe('prepareCoverageByDirData', () => {
  it('sorts rows ascending by coverageRatio (worst first)', () => {
    const { rows } = prepareCoverageByDirData(
      makeReport([
        { directory: 'a', sourceFiles: 10, testFiles: 8, coverageRatio: 0.8, hasTests: true },
        { directory: 'b', sourceFiles: 10, testFiles: 1, coverageRatio: 0.1, hasTests: true },
        { directory: 'c', sourceFiles: 10, testFiles: 5, coverageRatio: 0.5, hasTests: true },
      ]),
    );
    expect(rows.map((r) => r.directory)).toEqual(['b', 'c', 'a']);
  });

  it('excludes directories with sourceFiles === 0', () => {
    const { rows } = prepareCoverageByDirData(
      makeReport([
        { directory: 'a', sourceFiles: 10, testFiles: 5, coverageRatio: 0.5, hasTests: true },
        { directory: 'b', sourceFiles: 0, testFiles: 4, coverageRatio: 0, hasTests: true },
        { directory: 'c', sourceFiles: 5, testFiles: 1, coverageRatio: 0.2, hasTests: true },
      ]),
    );
    expect(rows.map((r) => r.directory)).toEqual(['c', 'a']);
    expect(rows.some((r) => r.directory === 'b')).toBe(false);
  });

  it('classifies each row by coverageRatio threshold', () => {
    const { rows } = prepareCoverageByDirData(
      makeReport([
        {
          directory: 'critical',
          sourceFiles: 10,
          testFiles: 1,
          coverageRatio: 0.1,
          hasTests: true,
        },
        { directory: 'low', sourceFiles: 10, testFiles: 3, coverageRatio: 0.3, hasTests: true },
        { directory: 'medium', sourceFiles: 10, testFiles: 6, coverageRatio: 0.6, hasTests: true },
        { directory: 'good', sourceFiles: 10, testFiles: 9, coverageRatio: 0.9, hasTests: true },
      ]),
    );
    const byDir = Object.fromEntries(rows.map((r) => [r.directory, r.tier]));
    expect(byDir.critical).toBe('critical');
    expect(byDir.low).toBe('low');
    expect(byDir.medium).toBe('medium');
    expect(byDir.good).toBe('good');
  });

  it('returns [] for an empty report', () => {
    expect(prepareCoverageByDirData(makeReport([])).rows).toEqual([]);
  });

  it('caps at 30 rows by default after sorting', () => {
    const many: DirectoryFixture[] = [];
    for (let i = 0; i < 50; i += 1) {
      many.push({
        directory: `d${i}`,
        sourceFiles: 10,
        testFiles: i,
        coverageRatio: i / 50,
        hasTests: i > 0,
      });
    }
    const { rows } = prepareCoverageByDirData(makeReport(many));
    expect(rows).toHaveLength(30);
    // Worst-first sort means the very lowest-coverage dirs are at the top
    expect(rows[0].coverageRatio).toBe(0);
  });

  it('does not mutate the input directories array', () => {
    const original: DirectoryFixture[] = [
      { directory: 'a', sourceFiles: 10, testFiles: 8, coverageRatio: 0.8, hasTests: true },
      { directory: 'b', sourceFiles: 10, testFiles: 1, coverageRatio: 0.1, hasTests: true },
    ];
    const before = original.map((d) => d.directory);
    prepareCoverageByDirData(makeReport(original));
    expect(original.map((d) => d.directory)).toEqual(before);
  });
});
