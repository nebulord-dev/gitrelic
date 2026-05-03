import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  BusFactorHistogram,
  HIGH_OWNERSHIP_THRESHOLD,
  busFactorTierFor,
  prepareBusFactorHistogramData,
} from './BusFactorHistogram';

import type { FileBusFactor, GitrelicReport } from '@gitrelic/core';

function fileFixture(
  file: string,
  dominantAuthorPercent: number,
): FileBusFactor {
  return {
    file,
    uniqueAuthors: dominantAuthorPercent === 100 ? 1 : 3,
    authors: ['solo@example.com'],
    dominantAuthor: 'solo@example.com',
    dominantAuthorPercent,
    risk: 'critical',
  };
}

function makeReport(files: FileBusFactor[]): GitrelicReport {
  return {
    busFactors: { files, criticalFiles: [], overallBusFactor: 0, summary: '' },
  } as unknown as GitrelicReport;
}

describe('busFactorTierFor', () => {
  it('returns "low" below 50', () => {
    expect(busFactorTierFor(0)).toBe('low');
    expect(busFactorTierFor(49)).toBe('low');
  });

  it('returns "medium" from 50 up to (but not including) 75', () => {
    expect(busFactorTierFor(50)).toBe('medium');
    expect(busFactorTierFor(74)).toBe('medium');
  });

  it('returns "high" from 75 up to (but not including) 90', () => {
    expect(busFactorTierFor(75)).toBe('high');
    expect(busFactorTierFor(89)).toBe('high');
  });

  it('returns "critical" at and above the high-ownership threshold', () => {
    expect(busFactorTierFor(HIGH_OWNERSHIP_THRESHOLD)).toBe('critical');
    expect(busFactorTierFor(100)).toBe('critical');
  });
});

describe('prepareBusFactorHistogramData', () => {
  it('returns 10 buckets covering 0..100, with the last bucket inclusive of 100', () => {
    const { buckets } = prepareBusFactorHistogramData(makeReport([]));
    expect(buckets).toHaveLength(10);
    expect(buckets[0]).toMatchObject({ rangeStart: 0, rangeEnd: 9 });
    expect(buckets[9]).toMatchObject({ rangeStart: 90, rangeEnd: 100 });
  });

  it('places each file into the bucket whose range contains its dominantAuthorPercent', () => {
    const { buckets } = prepareBusFactorHistogramData(
      makeReport([
        fileFixture('a', 0),
        fileFixture('b', 9),
        fileFixture('c', 35),
        fileFixture('d', 70),
        fileFixture('e', 100),
      ]),
    );
    expect(buckets[0].count).toBe(2); // 0 + 9
    expect(buckets[3].count).toBe(1); // 35
    expect(buckets[7].count).toBe(1); // 70
    expect(buckets[9].count).toBe(1); // 100 (clamped to last bucket)
  });

  it('counts files at or above HIGH_OWNERSHIP_THRESHOLD as highOwnershipCount', () => {
    const { highOwnershipCount } = prepareBusFactorHistogramData(
      makeReport([
        fileFixture('a', 30),
        fileFixture('b', HIGH_OWNERSHIP_THRESHOLD),
        fileFixture('c', HIGH_OWNERSHIP_THRESHOLD - 1),
        fileFixture('d', 100),
      ]),
    );
    expect(highOwnershipCount).toBe(2);
  });

  it('reports totalFiles and maxCount correctly', () => {
    const { totalFiles, maxCount } = prepareBusFactorHistogramData(
      makeReport([
        fileFixture('a', 100),
        fileFixture('b', 100),
        fileFixture('c', 100),
        fileFixture('d', 30),
      ]),
    );
    expect(totalFiles).toBe(4);
    expect(maxCount).toBe(3); // bucket 9 holds three 100s
  });

  it('handles an empty file list', () => {
    const { buckets, maxCount, totalFiles, highOwnershipCount } =
      prepareBusFactorHistogramData(makeReport([]));
    expect(buckets.every((b) => b.count === 0)).toBe(true);
    expect(maxCount).toBe(0);
    expect(totalFiles).toBe(0);
    expect(highOwnershipCount).toBe(0);
  });
});

describe('BusFactorHistogram', () => {
  it('renders the hero caption', () => {
    render(<BusFactorHistogram report={makeReport([fileFixture('a', 100)])} />);
    expect(screen.getByText(/10-bin histogram/)).toBeTruthy();
  });

  it('renders the hero caption in the empty state', () => {
    render(<BusFactorHistogram report={makeReport([])} />);
    expect(screen.getByText(/10-bin histogram/)).toBeTruthy();
  });
});
