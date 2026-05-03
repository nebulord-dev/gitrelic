import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { CommitPunchCard } from './CommitPunchCard';
import type { GitrelicReport } from '@gitrelic/core';

function makeReport(matrix: number[][]): GitrelicReport {
  return {
    commitTiming: {
      files: [],
      stressFiles: [],
      repoLateNightPercent: 0,
      repoWeekendPercent: 0,
      summary: '',
      repoHourDayMatrix: matrix,
      highStress: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth: [],
      authorStress: [],
    },
  } as unknown as GitrelicReport;
}

function emptyMatrix(): number[][] {
  return Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
}

describe('CommitPunchCard', () => {
  it('renders 168 cells (7 × 24)', () => {
    const m = emptyMatrix();
    m[1][14] = 5; // Mon 14:00
    const { container } = render(<CommitPunchCard report={makeReport(m)} />);
    const cells = container.querySelectorAll('rect.punch-card-cell');
    expect(cells.length).toBe(168);
  });

  it('non-zero cells have higher fill opacity than zero cells', () => {
    const m = emptyMatrix();
    m[1][14] = 100;
    m[2][14] = 0;
    const { container } = render(<CommitPunchCard report={makeReport(m)} />);
    const cells = Array.from(
      container.querySelectorAll<SVGRectElement>('rect.punch-card-cell'),
    );
    const hot = cells.find(
      (c) =>
        c.getAttribute('data-day') === '1' &&
        c.getAttribute('data-hour') === '14',
    )!;
    const cold = cells.find(
      (c) =>
        c.getAttribute('data-day') === '2' &&
        c.getAttribute('data-hour') === '14',
    )!;
    const hotOpacity = parseFloat(hot.getAttribute('fill-opacity') ?? '0');
    const coldOpacity = parseFloat(cold.getAttribute('fill-opacity') ?? '0');
    expect(hotOpacity).toBeGreaterThan(coldOpacity);
  });

  it('uses log scale — count 100 is not 10× the opacity of count 10', () => {
    const m = emptyMatrix();
    m[1][14] = 10;
    m[2][14] = 100;
    const { container } = render(<CommitPunchCard report={makeReport(m)} />);
    const cells = Array.from(
      container.querySelectorAll<SVGRectElement>('rect.punch-card-cell'),
    );
    const ten = cells.find(
      (c) =>
        c.getAttribute('data-day') === '1' &&
        c.getAttribute('data-hour') === '14',
    )!;
    const hundred = cells.find(
      (c) =>
        c.getAttribute('data-day') === '2' &&
        c.getAttribute('data-hour') === '14',
    )!;
    const tenOp = parseFloat(ten.getAttribute('fill-opacity') ?? '0');
    const hundredOp = parseFloat(hundred.getAttribute('fill-opacity') ?? '0');
    // Linear ratio would be 10. Log-scaled ratio should be < 5.
    expect(hundredOp / tenOp).toBeLessThan(5);
    expect(hundredOp / tenOp).toBeGreaterThan(1.2);
  });

  it('renders stress-zone shading rectangles for weekend rows and late-night cols', () => {
    // Use a non-empty matrix so the empty-state branch is NOT taken — the
    // empty-state short-circuit returns before the SVG is rendered.
    const m = emptyMatrix();
    m[1][14] = 1; // Mon 14:00 — any nonzero cell satisfies total > 0
    const { container } = render(<CommitPunchCard report={makeReport(m)} />);
    expect(
      container.querySelectorAll('rect.punch-card-stress-zone').length,
    ).toBeGreaterThan(0);
  });

  it('shows empty-state copy when matrix is all-zero', () => {
    const { getByText } = render(
      <CommitPunchCard report={makeReport(emptyMatrix())} />,
    );
    expect(getByText(/no commits/i)).toBeTruthy();
  });
});
