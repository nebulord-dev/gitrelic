import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ParallelTimeline } from './ParallelTimeline';
import type { GitrelicReport, ParallelByMonth } from '@gitrelic/core';

function makeReport(byMonth: ParallelByMonth[]): GitrelicReport {
  return {
    parallelDev: {
      files: [],
      hotFiles: [],
      totalParallelFiles: 0,
      highParallel: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('ParallelTimeline', () => {
  it('renders the empty-state caption when byMonth is empty', () => {
    render(<ParallelTimeline report={makeReport([])} />);
    expect(screen.getByText(/Monthly bar chart/)).toBeTruthy();
  });

  it('renders the caption when byMonth has entries', () => {
    render(
      <ParallelTimeline
        report={makeReport([
          {
            month: '2025-06',
            parallelEvents: 5,
            uniqueFiles: 3,
            avgAuthors: 2.4,
          },
          {
            month: '2025-07',
            parallelEvents: 8,
            uniqueFiles: 5,
            avgAuthors: 3.0,
          },
        ])}
      />,
    );
    expect(screen.getByText(/Monthly bar chart/)).toBeTruthy();
  });

  it('renders one bar per month', () => {
    const { container } = render(
      <ParallelTimeline
        report={makeReport([
          {
            month: '2025-06',
            parallelEvents: 5,
            uniqueFiles: 3,
            avgAuthors: 2.4,
          },
          {
            month: '2025-07',
            parallelEvents: 8,
            uniqueFiles: 5,
            avgAuthors: 3.0,
          },
          {
            month: '2025-08',
            parallelEvents: 2,
            uniqueFiles: 2,
            avgAuthors: 2.0,
          },
        ])}
      />,
    );
    expect(
      container.querySelectorAll('rect.parallel-timeline-bar'),
    ).toHaveLength(3);
  });
});
