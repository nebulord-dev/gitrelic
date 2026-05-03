import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AgeHistogram,
  ageTierFor,
  prepareAgeHistogramData,
} from './AgeHistogram';
import type { FileAge, GitrelicReport } from '@gitrelic/core';

function f(
  file: string,
  ageInDays: number,
  status: FileAge['status'],
): FileAge {
  return { file, lastCommitDate: '2025-01-01', ageInDays, status };
}

function makeReport(
  files: FileAge[],
  ageInDays = 365,
  thresholds = { freshLimit: 29, agingLimit: 120, staleLimit: 241 },
): GitrelicReport {
  return {
    meta: { ageInDays } as never,
    ageMap: {
      files,
      staleFiles: files.filter((x) => x.status === 'stale'),
      ancientFiles: files.filter((x) => x.status === 'ancient'),
      medianAgeDays: 0,
      thresholds,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('ageTierFor', () => {
  const t = { freshLimit: 29, agingLimit: 120, staleLimit: 241 };

  it('returns "fresh" up to and including freshLimit', () => {
    expect(ageTierFor(0, t)).toBe('fresh');
    expect(ageTierFor(29, t)).toBe('fresh');
  });

  it('returns "aging" above freshLimit, up to and including agingLimit', () => {
    expect(ageTierFor(30, t)).toBe('aging');
    expect(ageTierFor(120, t)).toBe('aging');
  });

  it('returns "stale" above agingLimit, up to and including staleLimit', () => {
    expect(ageTierFor(121, t)).toBe('stale');
    expect(ageTierFor(241, t)).toBe('stale');
  });

  it('returns "ancient" above staleLimit', () => {
    expect(ageTierFor(242, t)).toBe('ancient');
    expect(ageTierFor(1_000, t)).toBe('ancient');
  });
});

describe('prepareAgeHistogramData', () => {
  it('returns 30-day buckets covering 0 up to repoAgeDays for sub-540 windows', () => {
    const { bins } = prepareAgeHistogramData(makeReport([], 90));
    // 90/30 = 3 bins, no overflow
    expect(bins).toHaveLength(3);
    expect(bins[0]).toMatchObject({ rangeStart: 0, rangeEnd: 29 });
    expect(bins[1]).toMatchObject({ rangeStart: 30, rangeEnd: 59 });
    expect(bins[2]).toMatchObject({ rangeStart: 60, rangeEnd: 89 });
  });

  it('caps at 540 days with an overflow bin when the window is longer', () => {
    const { bins } = prepareAgeHistogramData(makeReport([], 1_000));
    // 540/30 = 18 in-range bins + 1 overflow
    expect(bins).toHaveLength(19);
    expect(bins[17]).toMatchObject({ rangeStart: 510 });
    expect(bins[18].isOverflow).toBe(true);
  });

  it('places each file into the bucket whose range contains its ageInDays', () => {
    // 365-day repo → ceil(365/30) = 13 in-range bins, no overflow.
    // Bin index = Math.floor(ageInDays / 30):
    //   age 5   → bin 0   (range 0-29)
    //   age 35  → bin 1   (range 30-59)
    //   age 200 → bin 6   (range 180-209)
    //   age 350 → bin 11  (range 330-359)
    const { bins } = prepareAgeHistogramData(
      makeReport(
        [
          f('fresh.ts', 5, 'fresh'),
          f('aging.ts', 35, 'aging'),
          f('stale.ts', 200, 'stale'),
          f('ancient.ts', 350, 'ancient'),
        ],
        365,
      ),
    );
    expect(bins[0].count).toBe(1);
    expect(bins[1].count).toBe(1);
    expect(bins[6].count).toBe(1);
    expect(bins[11].count).toBe(1);
  });

  it('puts ages ≥ 540 into the overflow bin when one exists', () => {
    const { bins } = prepareAgeHistogramData(
      makeReport([f('forgotten.ts', 800, 'ancient')], 1_000),
    );
    expect(bins[bins.length - 1].count).toBe(1);
    expect(bins[bins.length - 1].isOverflow).toBe(true);
  });

  it('tier-colors each bin by the analyzer thresholds (bin midpoint)', () => {
    const { bins } = prepareAgeHistogramData(
      makeReport([], 365, { freshLimit: 30, agingLimit: 120, staleLimit: 240 }),
    );
    // Midpoints: 14.5, 44.5, 74.5, 104.5, 134.5, 164.5, 194.5, 224.5, 254.5, 284.5, 314.5, 344.5
    expect(bins[0].tier).toBe('fresh'); // 14.5 ≤ 30
    expect(bins[1].tier).toBe('aging'); // 44.5 ≤ 120
    expect(bins[3].tier).toBe('aging'); // 104.5 ≤ 120
    expect(bins[4].tier).toBe('stale'); // 134.5 ≤ 240
    expect(bins[7].tier).toBe('stale'); // 224.5 ≤ 240
    expect(bins[8].tier).toBe('ancient'); // 254.5 > 240
  });

  it('reports totalFiles, maxCount, and ancientCount correctly', () => {
    const { totalFiles, maxCount, ancientCount } = prepareAgeHistogramData(
      makeReport([
        f('a', 5, 'fresh'),
        f('b', 5, 'fresh'),
        f('c', 35, 'aging'),
        f('d', 250, 'ancient'),
        f('e', 260, 'ancient'),
      ]),
    );
    expect(totalFiles).toBe(5);
    expect(maxCount).toBeGreaterThanOrEqual(2);
    expect(ancientCount).toBe(2);
  });

  it('handles an empty repo (0 ageInDays, no files)', () => {
    const { bins, totalFiles, ancientCount } = prepareAgeHistogramData(
      makeReport([], 0, { freshLimit: 0, agingLimit: 0, staleLimit: 0 }),
    );
    expect(bins).toEqual([]);
    expect(totalFiles).toBe(0);
    expect(ancientCount).toBe(0);
  });
});

describe('AgeHistogram', () => {
  it('renders the hero caption when files exist', () => {
    render(
      <AgeHistogram
        report={makeReport([f('a', 100, 'aging'), f('b', 250, 'ancient')], 365)}
      />,
    );
    expect(screen.getByText(/Distribution of last-commit age/)).toBeTruthy();
  });

  it('renders the hero caption in the empty state', () => {
    render(
      <AgeHistogram
        report={makeReport([], 0, {
          freshLimit: 0,
          agingLimit: 0,
          staleLimit: 0,
        })}
      />,
    );
    expect(screen.getByText(/Distribution of last-commit age/)).toBeTruthy();
  });

  it('shows the empty-state copy when no files exist', () => {
    render(<AgeHistogram report={makeReport([], 365)} />);
    expect(
      screen.getByText('No tracked files in the repository.'),
    ).toBeTruthy();
  });
});
