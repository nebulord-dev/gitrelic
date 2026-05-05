import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AiAdoptionTrend } from './AiAdoptionTrend';
import type { CoAuthorMonthEntry } from '@gitrelic/core';

describe('AiAdoptionTrend', () => {
  it('renders one bar per month with two stacked layers', () => {
    const byMonth: CoAuthorMonthEntry[] = [
      { month: '2026-01', aiAssisted: 5, pureHuman: 3, total: 8 },
      { month: '2026-02', aiAssisted: 7, pureHuman: 2, total: 9 },
    ];
    render(<AiAdoptionTrend byMonth={byMonth} />);
    expect(screen.getAllByTestId('ai-trend-bar-ai').length).toBe(2);
    expect(screen.getAllByTestId('ai-trend-bar-human').length).toBe(2);
  });

  it('renders empty-state placeholder when byMonth is empty', () => {
    render(<AiAdoptionTrend byMonth={[]} />);
    expect(
      screen.getByText(/no co-authored commits in this analysis window/i),
    ).toBeTruthy();
  });

  it('renders the hero caption', () => {
    render(
      <AiAdoptionTrend
        byMonth={[{ month: '2026-01', aiAssisted: 0, pureHuman: 5, total: 5 }]}
      />,
    );
    expect(screen.getByText(/top layer = AI-assisted/i)).toBeTruthy();
  });
});
