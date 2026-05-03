import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  BlastHistogram,
  HIGH_BLAST_THRESHOLD,
  blastTierFor,
  prepareBlastHistogramData,
} from './BlastHistogram';
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

describe('prepareBlastHistogramData', () => {
  it('returns 10 buckets covering 0..100, with the last bucket inclusive of 100', () => {
    const { buckets } = prepareBlastHistogramData(makeReport([]));
    expect(buckets).toHaveLength(10);
    expect(buckets[0]).toMatchObject({ rangeStart: 0, rangeEnd: 9 });
    expect(buckets[9]).toMatchObject({ rangeStart: 90, rangeEnd: 100 });
  });

  it('places each file into the bucket whose range contains its blastScore', () => {
    const { buckets } = prepareBlastHistogramData(
      makeReport([
        {
          file: 'a',
          blastScore: 0,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
        {
          file: 'b',
          blastScore: 9,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
        {
          file: 'c',
          blastScore: 35,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
        {
          file: 'd',
          blastScore: 70,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
        {
          file: 'e',
          blastScore: 100,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
      ]),
    );
    expect(buckets[0].count).toBe(2); // 0 + 9
    expect(buckets[3].count).toBe(1); // 35
    expect(buckets[7].count).toBe(1); // 70
    expect(buckets[9].count).toBe(1); // 100 (clamped to last bucket)
  });

  it('counts files with blastScore >= HIGH_BLAST_THRESHOLD as highBlastCount', () => {
    const { highBlastCount } = prepareBlastHistogramData(
      makeReport([
        {
          file: 'a',
          blastScore: 30,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
        {
          file: 'b',
          blastScore: HIGH_BLAST_THRESHOLD,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
        {
          file: 'c',
          blastScore: HIGH_BLAST_THRESHOLD - 1,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
        {
          file: 'd',
          blastScore: 95,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
      ]),
    );
    expect(highBlastCount).toBe(2);
  });

  it('reports totalFiles and maxCount correctly', () => {
    const { totalFiles, maxCount } = prepareBlastHistogramData(
      makeReport([
        {
          file: 'a',
          blastScore: 5,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
        {
          file: 'b',
          blastScore: 5,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
        {
          file: 'c',
          blastScore: 5,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
        {
          file: 'd',
          blastScore: 80,
          avgCoChangedFiles: 0,
          maxCoChangedFiles: 0,
          totalCommits: 0,
        },
      ]),
    );
    expect(totalFiles).toBe(4);
    expect(maxCount).toBe(3); // bucket 0 holds three 5s
  });

  it('handles an empty file list', () => {
    const { buckets, maxCount, totalFiles, highBlastCount } =
      prepareBlastHistogramData(makeReport([]));
    expect(buckets.every((b) => b.count === 0)).toBe(true);
    expect(maxCount).toBe(0);
    expect(totalFiles).toBe(0);
    expect(highBlastCount).toBe(0);
  });
});

describe('BlastHistogram', () => {
  it('renders the hero caption', () => {
    const report = makeReport([
      {
        file: 'a',
        blastScore: 10,
        avgCoChangedFiles: 0,
        maxCoChangedFiles: 0,
        totalCommits: 0,
      },
      {
        file: 'b',
        blastScore: 80,
        avgCoChangedFiles: 0,
        maxCoChangedFiles: 0,
        totalCommits: 0,
      },
    ]);
    render(<BlastHistogram report={report} />);
    expect(screen.getByText(/10-bin histogram/)).toBeTruthy();
  });

  it('renders the hero caption in the empty state', () => {
    render(<BlastHistogram report={makeReport([])} />);
    expect(screen.getByText(/10-bin histogram/)).toBeTruthy();
  });
});
