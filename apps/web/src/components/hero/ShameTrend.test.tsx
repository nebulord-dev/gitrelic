import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ShameTrend } from './ShameTrend';

import type { GitrelicReport } from '@gitrelic/core';

const baseReport = {
  forensics: {
    byMonth: [
      { month: '2026-01', critical: 1, moderate: 2, mild: 5 },
      { month: '2026-02', critical: 0, moderate: 1, mild: 3 },
    ],
    files: [],
    shameLeaderboard: [],
    totalShameCommits: 12,
    keywordTiers: { critical: 1, moderate: 3, mild: 8 },
    summary: '',
  },
} as unknown as GitrelicReport;

describe('ShameTrend', () => {
  it('renders one bar per month', () => {
    const { container } = render(<ShameTrend report={baseReport} />);
    const bars = container.querySelectorAll('rect[data-tier]');
    // 2 months × 3 tier rects = 6
    expect(bars.length).toBe(6);
  });

  it('renders the hero caption', () => {
    render(<ShameTrend report={baseReport} />);
    expect(screen.getByText(/One bar per month/)).toBeTruthy();
  });

  it('renders empty state when byMonth is empty', () => {
    const empty = {
      ...baseReport,
      forensics: { ...baseReport.forensics, byMonth: [] },
    } as GitrelicReport;
    render(<ShameTrend report={empty} />);
    expect(screen.getByText(/No shame commits in the analysis window/)).toBeTruthy();
  });
});
