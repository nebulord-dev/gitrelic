import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  HIGH_PARALLEL_THRESHOLD,
  ParallelScoreHistogram,
  parallelTierFor,
  prepareParallelHistogramData,
} from './ParallelScoreHistogram';
import type { GitrelicReport } from '@gitrelic/core';

interface ParallelFixture {
  file: string;
  parallelScore: number;
}

function makeReport(files: ParallelFixture[]): GitrelicReport {
  return {
    parallelDev: {
      files: files.map((f) => ({
        file: f.file,
        parallelScore: f.parallelScore,
        totalActiveWeeks: 10,
        parallelWeeks: 5,
        peakAuthors: 3,
        peakWindow: {
          weekStart: '2025-06-02T00:00:00.000Z',
          authors: [],
          commitCount: 0,
        },
        topWindows: [],
        narrative: '',
      })),
      hotFiles: [],
      totalParallelFiles: files.length,
      highParallel: files.filter(
        (f) => f.parallelScore >= HIGH_PARALLEL_THRESHOLD,
      ).length,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth: [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('parallelTierFor', () => {
  it('returns "low" below 25', () => {
    expect(parallelTierFor(0)).toBe('low');
    expect(parallelTierFor(24)).toBe('low');
  });

  it('returns "medium" from 25 up to (but not including) 50', () => {
    expect(parallelTierFor(25)).toBe('medium');
    expect(parallelTierFor(49)).toBe('medium');
  });

  it('returns "high" from 50 up to (but not including) 75', () => {
    expect(parallelTierFor(50)).toBe('high');
    expect(parallelTierFor(74)).toBe('high');
  });

  it('returns "critical" at 75 and above (matches core tierMix.critical at >= 75)', () => {
    expect(parallelTierFor(75)).toBe('critical');
    expect(parallelTierFor(76)).toBe('critical');
    expect(parallelTierFor(100)).toBe('critical');
  });
});

describe('prepareParallelHistogramData', () => {
  it('returns 10 buckets covering 0..100, with the last bucket inclusive of 100', () => {
    const { buckets } = prepareParallelHistogramData(makeReport([]));
    expect(buckets).toHaveLength(10);
    expect(buckets[0]).toMatchObject({ rangeStart: 0, rangeEnd: 9 });
    expect(buckets[9]).toMatchObject({ rangeStart: 90, rangeEnd: 100 });
  });

  it('places each file into the bucket whose range contains its parallelScore', () => {
    const { buckets } = prepareParallelHistogramData(
      makeReport([
        { file: 'a', parallelScore: 0 },
        { file: 'b', parallelScore: 9 },
        { file: 'c', parallelScore: 35 },
        { file: 'd', parallelScore: 70 },
        { file: 'e', parallelScore: 100 },
      ]),
    );
    expect(buckets[0].count).toBe(2);
    expect(buckets[3].count).toBe(1);
    expect(buckets[7].count).toBe(1);
    expect(buckets[9].count).toBe(1);
  });

  it('counts files with parallelScore >= HIGH_PARALLEL_THRESHOLD as highParallelCount', () => {
    const { highParallelCount } = prepareParallelHistogramData(
      makeReport([
        { file: 'a', parallelScore: 30 },
        { file: 'b', parallelScore: HIGH_PARALLEL_THRESHOLD },
        { file: 'c', parallelScore: HIGH_PARALLEL_THRESHOLD - 1 },
        { file: 'd', parallelScore: 95 },
      ]),
    );
    expect(highParallelCount).toBe(2);
  });

  it('reports totalFiles and maxCount correctly', () => {
    const { totalFiles, maxCount } = prepareParallelHistogramData(
      makeReport([
        { file: 'a', parallelScore: 5 },
        { file: 'b', parallelScore: 5 },
        { file: 'c', parallelScore: 5 },
        { file: 'd', parallelScore: 80 },
      ]),
    );
    expect(totalFiles).toBe(4);
    expect(maxCount).toBe(3);
  });

  it('handles an empty file list', () => {
    const { buckets, maxCount, totalFiles, highParallelCount } =
      prepareParallelHistogramData(makeReport([]));
    expect(buckets.every((b) => b.count === 0)).toBe(true);
    expect(maxCount).toBe(0);
    expect(totalFiles).toBe(0);
    expect(highParallelCount).toBe(0);
  });
});

describe('ParallelScoreHistogram', () => {
  it('renders the hero caption', () => {
    const report = makeReport([
      { file: 'a', parallelScore: 10 },
      { file: 'b', parallelScore: 80 },
    ]);
    render(<ParallelScoreHistogram report={report} />);
    expect(screen.getByText(/10-bin histogram/)).toBeTruthy();
  });

  it('renders the hero caption in the empty state', () => {
    render(<ParallelScoreHistogram report={makeReport([])} />);
    expect(screen.getByText(/10-bin histogram/)).toBeTruthy();
  });
});
