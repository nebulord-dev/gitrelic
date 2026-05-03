import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ParallelDevTab } from './ParallelDevTab';
import type { GitrelicReport, FileParallelDev } from '@gitrelic/core';

function f(
  path: string,
  parallelScore: number,
  overrides: Partial<FileParallelDev> = {},
): FileParallelDev {
  return {
    file: path,
    parallelScore,
    totalActiveWeeks: 10,
    parallelWeeks: 5,
    peakAuthors: 3,
    peakWindow: {
      weekStart: '2025-06-02T00:00:00.000Z',
      authors: ['a@x.com', 'b@x.com'],
      commitCount: 2,
    },
    topWindows: [],
    narrative: '',
    ...overrides,
  };
}

function makeReport(files: FileParallelDev[]): GitrelicReport {
  const high = files.filter((file) => file.parallelScore >= 70).length;
  return {
    parallelDev: {
      files,
      hotFiles: files.slice(0, 10),
      totalParallelFiles: files.length,
      highParallel: high,
      tierMix: {
        low: files.filter((file) => file.parallelScore < 25).length,
        medium: files.filter(
          (file) => file.parallelScore >= 25 && file.parallelScore < 50,
        ).length,
        high: files.filter(
          (file) => file.parallelScore >= 50 && file.parallelScore < 75,
        ).length,
        critical: files.filter((file) => file.parallelScore >= 75).length,
      },
      byMonth: [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('ParallelDevTab', () => {
  it('renders the highParallel count as the big number', () => {
    render(
      <ParallelDevTab
        report={makeReport([f('a.ts', 80), f('b.ts', 75), f('c.ts', 30)])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '2',
    );
  });

  it('renders 0 with the Healthy tier when no files cross the threshold', () => {
    render(
      <ParallelDevTab
        report={makeReport([f('a.ts', 30)])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '0',
    );
    expect(screen.getByText('Healthy')).toBeTruthy();
  });

  it('shows top-3 high-parallel files in the finding section', () => {
    render(
      <ParallelDevTab
        report={makeReport([
          f('top.ts', 90),
          f('mid.ts', 80),
          f('low.ts', 75),
          f('extra.ts', 71), // 4th file — should NOT appear
        ])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('top.ts')).toBeTruthy();
    expect(screen.getByText('mid.ts')).toBeTruthy();
    expect(screen.getByText('low.ts')).toBeTruthy();
    expect(screen.queryByText('extra.ts')).toBeNull();
  });

  it('does NOT include sub-threshold files in the top-3 even if hotFiles does', () => {
    // Single file above threshold; the other 2 are sub-threshold but in hotFiles
    // (because hotFiles is whole-repo top-10, regardless of threshold)
    render(
      <ParallelDevTab
        report={makeReport([
          f('only-high.ts', 80),
          f('mid.ts', 60),
          f('low.ts', 40),
        ])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('only-high.ts')).toBeTruthy();
    // Sub-threshold files must not appear under "Top parallel files"
    expect(screen.queryByText('mid.ts')).toBeNull();
    expect(screen.queryByText('low.ts')).toBeNull();
  });

  it('renders the 3-tier subline collapse (low / moderate / high)', () => {
    render(
      <ParallelDevTab
        report={makeReport([
          f('a.ts', 10), // low
          f('b.ts', 30), // medium → moderate
          f('c.ts', 60), // high → high
          f('d.ts', 80), // critical → high
        ])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/low/)).toBeTruthy();
    expect(screen.getByText(/moderate/)).toBeTruthy();
    expect(screen.getByText(/high/)).toBeTruthy();
  });

  it('wires the see-also footer to Co-Authors and Coupling', () => {
    const onApplyPreset = vi.fn();
    render(
      <ParallelDevTab
        report={makeReport([f('a.ts', 80)])}
        onApplyPreset={onApplyPreset}
      />,
    );
    screen.getByRole('button', { name: 'Co-Authors' }).click();
    expect(onApplyPreset).toHaveBeenCalledWith('co-authors');
    screen.getByRole('button', { name: 'Coupling' }).click();
    expect(onApplyPreset).toHaveBeenCalledWith('coupling');
  });

  it('renders the directory rollup in the extras slot when there are high-parallel files', () => {
    render(
      <ParallelDevTab
        report={makeReport([
          f('packages/a/src/x.ts', 80),
          f('packages/a/src/y.ts', 80),
          f('packages/b/src/z.ts', 75),
        ])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Where they live')).toBeTruthy();
    expect(screen.getByText('packages/a/src')).toBeTruthy();
    expect(screen.getByText('packages/b/src')).toBeTruthy();
  });

  it('hides the extras slot when no files cross the threshold', () => {
    render(
      <ParallelDevTab
        report={makeReport([f('a.ts', 30)])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.queryByText('Where they live')).toBeNull();
  });
});
