import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShameTab } from './ShameTab';
import type { GitrelicReport } from '@gitrelic/core';

const makeReport = (
  overrides: Partial<GitrelicReport['forensics']> = {},
): GitrelicReport =>
  ({
    forensics: {
      files: [],
      shameLeaderboard: [],
      totalShameCommits: 0,
      keywordTiers: { critical: 0, moderate: 0, mild: 0 },
      byMonth: [],
      summary: '',
      ...overrides,
    },
  }) as unknown as GitrelicReport;

const shameFile = (file: string, shameScore: number) => ({
  file,
  shameScore,
  rawShamePoints: 10,
  shameCommitCount: 5,
  topShameCommits: [],
  dominantKeywords: ['revert'],
});

describe('ShameTab', () => {
  afterEach(() => cleanup());

  it('renders Healthy state when no high-shame files', () => {
    render(<ShameTab report={makeReport()} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/Healthy/)).toBeTruthy();
  });

  it('renders High Shame badge with file count when ≥10 files cross threshold', () => {
    const files = Array.from({ length: 12 }, (_, i) => ({
      file: `f${i}.ts`,
      shameScore: 75,
      rawShamePoints: 15,
      shameCommitCount: 5,
      topShameCommits: [],
      dominantKeywords: ['revert'],
    }));
    render(
      <ShameTab
        report={makeReport({ files, totalShameCommits: 60 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '12',
    );
    expect(screen.getByText('High Shame')).toBeTruthy();
  });

  it('fires onApplyPreset when see-also link is clicked', () => {
    const onApplyPreset = vi.fn();
    render(<ShameTab report={makeReport()} onApplyPreset={onApplyPreset} />);
    screen.getByText('Cursed Files').click();
    expect(onApplyPreset).toHaveBeenCalledWith('cursed-files');
  });

  describe('directory rollup ("Where they live")', () => {
    it('renders the rollup with the top high-shame directories', () => {
      // 3 high-shame in /tests, 2 in /src, 1 in /scripts; 1 sub-threshold ignored.
      const files = [
        shameFile('tests/a.ts', 95),
        shameFile('tests/b.ts', 90),
        shameFile('tests/c.ts', 85),
        shameFile('src/x.ts', 80),
        shameFile('src/y.ts', 75),
        shameFile('scripts/q.ts', 72),
        shameFile('src/z.ts', 40),
      ];
      render(
        <ShameTab
          report={makeReport({ files, totalShameCommits: 30 })}
          onApplyPreset={vi.fn()}
        />,
      );
      expect(screen.getByText('Where they live')).toBeTruthy();

      // tests has 3 of 6 high-shame files → 50%
      const dirRow = screen.getByText('tests').closest('div')!.parentElement!;
      expect(dirRow.textContent).toContain('3');
      expect(dirRow.textContent).toContain('50%');

      expect(screen.getByText('src')).toBeTruthy();
      expect(screen.getByText('scripts')).toBeTruthy();
    });

    it('shows a "+ N more directories" footer when more than 5 distinct directories exist', () => {
      const files = Array.from({ length: 7 }, (_, i) =>
        shameFile(`dir${i}/file.ts`, 90 - i),
      );
      render(
        <ShameTab
          report={makeReport({ files, totalShameCommits: 30 })}
          onApplyPreset={vi.fn()}
        />,
      );
      expect(screen.getByText(/\+ 2 more directories/)).toBeTruthy();
    });

    it('uses singular "directory" when exactly one directory is hidden', () => {
      const files = Array.from({ length: 6 }, (_, i) =>
        shameFile(`dir${i}/file.ts`, 90 - i),
      );
      render(
        <ShameTab
          report={makeReport({ files, totalShameCommits: 30 })}
          onApplyPreset={vi.fn()}
        />,
      );
      expect(screen.getByText(/\+ 1 more directory/)).toBeTruthy();
    });

    it('omits the "+ more directories" footer when 5 or fewer distinct directories exist', () => {
      const files = Array.from({ length: 5 }, (_, i) =>
        shameFile(`dir${i}/file.ts`, 90 - i),
      );
      render(
        <ShameTab
          report={makeReport({ files, totalShameCommits: 30 })}
          onApplyPreset={vi.fn()}
        />,
      );
      expect(screen.queryByText(/more director/)).toBeNull();
    });

    it('omits the rollup when no high-shame files exist', () => {
      const files = [shameFile('a.ts', 30)];
      render(
        <ShameTab
          report={makeReport({ files, totalShameCommits: 1 })}
          onApplyPreset={vi.fn()}
        />,
      );
      expect(screen.queryByText('Where they live')).toBeNull();
    });
  });

  it('surfaces the full directory path via Tooltip on hover (RELIC-334 truncation safety)', () => {
    // Long fixture path that would visibly ellipsize at side-by-side widths in
    // the real dashboard. The Tooltip wrapper must surface the full value on
    // hover so users can read the truncated path.
    const longDir =
      'compiler/packages/babel-plugin-react-compiler/src/__tests__/fixtures';
    const files = [
      {
        file: `${longDir}/a.ts`,
        shameScore: 85,
        rawShamePoints: 20,
        shameCommitCount: 5,
        topShameCommits: [],
        dominantKeywords: ['revert'],
      },
    ];
    render(
      <ShameTab
        report={makeReport({ files, totalShameCommits: 5 })}
        onApplyPreset={vi.fn()}
      />,
    );

    // Pre-hover: only the cell renders the path.
    expect(screen.getAllByText(longDir)).toHaveLength(1);

    fireEvent.mouseEnter(screen.getByText(longDir));

    // Post-hover: the tooltip duplicates the path inside the Tooltip wrapper.
    expect(screen.getAllByText(longDir)).toHaveLength(2);
  });
});
