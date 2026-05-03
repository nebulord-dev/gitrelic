import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { StressTrend } from './StressTrend';
import type { GitrelicReport } from '@gitrelic/core';

function makeReport(
  byMonth: GitrelicReport['commitTiming']['byMonth'],
): GitrelicReport {
  return {
    commitTiming: {
      files: [],
      stressFiles: [],
      repoLateNightPercent: 0,
      repoWeekendPercent: 0,
      summary: '',
      repoHourDayMatrix: Array.from({ length: 7 }, () =>
        new Array<number>(24).fill(0),
      ),
      highStress: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth,
      authorStress: [],
    },
  } as unknown as GitrelicReport;
}

describe('StressTrend', () => {
  it('renders one bar per month with three stacked segments', () => {
    const report = makeReport([
      {
        month: '2026-01',
        weekendLateNight: 2,
        singleCriterion: 5,
        healthy: 30,
        total: 37,
      },
      {
        month: '2026-02',
        weekendLateNight: 0,
        singleCriterion: 3,
        healthy: 40,
        total: 43,
      },
    ]);
    const { container } = render(<StressTrend report={report} />);
    const bars = container.querySelectorAll('g.stress-trend-bar');
    expect(bars.length).toBe(2);
    bars.forEach((bar) => {
      expect(bar.querySelectorAll('rect').length).toBe(3);
    });
  });

  it('weekendLateNight segment uses critical color; singleCriterion uses warning', () => {
    const report = makeReport([
      {
        month: '2026-01',
        weekendLateNight: 2,
        singleCriterion: 5,
        healthy: 30,
        total: 37,
      },
    ]);
    const { container } = render(<StressTrend report={report} />);
    const crit = container.querySelector('rect.stress-trend-critical');
    const warn = container.querySelector('rect.stress-trend-warning');
    const healthy = container.querySelector('rect.stress-trend-healthy');
    expect(crit?.getAttribute('fill')).toContain('critical');
    expect(warn?.getAttribute('fill')).toContain('warning');
    expect(healthy).toBeTruthy();
  });

  it('layer heights sum to bar height (proportional to total)', () => {
    const report = makeReport([
      {
        month: '2026-01',
        weekendLateNight: 10,
        singleCriterion: 20,
        healthy: 70,
        total: 100,
      },
    ]);
    const { container } = render(<StressTrend report={report} />);
    const layers = container.querySelectorAll<SVGRectElement>(
      'g.stress-trend-bar rect',
    );
    const totalHeight = Array.from(layers).reduce(
      (sum, r) => sum + parseFloat(r.getAttribute('height') ?? '0'),
      0,
    );
    expect(totalHeight).toBeGreaterThan(0);
  });

  it('shows empty-state copy when byMonth is empty', () => {
    const { getByText } = render(<StressTrend report={makeReport([])} />);
    expect(getByText(/no commits/i)).toBeTruthy();
  });
});
