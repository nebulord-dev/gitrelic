import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlastRadiusTab } from './BlastRadiusTab';
import type { GitrelicReport } from '@gitrelic/core';

interface BlastFixture {
  file: string;
  blastScore: number;
  avgCoChangedFiles: number;
  maxCoChangedFiles: number;
  totalCommits: number;
}

function makeReport(files: BlastFixture[], summary = ''): GitrelicReport {
  const sorted = [...files].sort((a, b) => b.blastScore - a.blastScore);
  return {
    blastRadius: {
      files: sorted,
      topBlasters: sorted.slice(0, 10),
      summary,
    },
  } as unknown as GitrelicReport;
}

describe('BlastRadiusTab', () => {
  afterEach(() => cleanup());

  it('renders 0 with Low Risk badge and a safe-state finding when no files cross the high-blast threshold', () => {
    render(
      <BlastRadiusTab
        report={makeReport(
          [
            {
              file: 'a.ts',
              blastScore: 30,
              avgCoChangedFiles: 2,
              maxCoChangedFiles: 4,
              totalCommits: 5,
            },
            {
              file: 'b.ts',
              blastScore: 50,
              avgCoChangedFiles: 4,
              maxCoChangedFiles: 8,
              totalCommits: 6,
            },
          ],
          '0 high blast-radius files (architectural load-bearers)',
        )}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('0', { selector: 'div' })).toBeTruthy();
    expect(screen.getByText('Low Risk')).toBeTruthy();
    expect(screen.getByText('Files ≥70 Blast')).toBeTruthy();
    // Safe-state copy must replace the "Top blast files" header — otherwise
    // the finding would advertise sub-threshold files alongside a "0 / Low
    // Risk" headline (PR #53 review finding).
    expect(
      screen.getByText(
        'No files cross the high-blast threshold — coupling is well-distributed.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Top blast files')).toBeNull();
    expect(screen.queryByText('b.ts')).toBeNull();
  });

  it('omits sub-threshold files from "Top blast files" when fewer than 3 cross ≥70', () => {
    // 1 high-blast file + 2 sub-threshold. The top-3 cap should not pull
    // sub-threshold files into the "Top blast files" list under the headline.
    render(
      <BlastRadiusTab
        report={makeReport(
          [
            {
              file: 'load-bearer.ts',
              blastScore: 85,
              avgCoChangedFiles: 18,
              maxCoChangedFiles: 26,
              totalCommits: 4,
            },
            {
              file: 'sub-threshold-1.ts',
              blastScore: 60,
              avgCoChangedFiles: 9,
              maxCoChangedFiles: 14,
              totalCommits: 4,
            },
            {
              file: 'sub-threshold-2.ts',
              blastScore: 50,
              avgCoChangedFiles: 7,
              maxCoChangedFiles: 12,
              totalCommits: 4,
            },
          ],
          '1 high blast-radius file (architectural load-bearer)',
        )}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '1',
    );
    expect(screen.getByText('Top blast files')).toBeTruthy();
    expect(screen.getByText('load-bearer.ts')).toBeTruthy();
    expect(screen.queryByText('sub-threshold-1.ts')).toBeNull();
    expect(screen.queryByText('sub-threshold-2.ts')).toBeNull();
  });

  it('renders Moderate Risk badge for 1–9 high-blast files', () => {
    render(
      <BlastRadiusTab
        report={makeReport(
          [
            {
              file: 'a.ts',
              blastScore: 95,
              avgCoChangedFiles: 25,
              maxCoChangedFiles: 40,
              totalCommits: 10,
            },
            {
              file: 'b.ts',
              blastScore: 80,
              avgCoChangedFiles: 18,
              maxCoChangedFiles: 30,
              totalCommits: 8,
            },
          ],
          '2 high blast-radius files (architectural load-bearers)',
        )}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '2',
    );
    expect(screen.getByText('Moderate Risk')).toBeTruthy();
  });

  it('renders High Risk badge for 10+ high-blast files and shows the top three in the finding', () => {
    const files: BlastFixture[] = Array.from({ length: 12 }, (_, i) => ({
      file: `pkg/src/file${i}.ts`,
      blastScore: 90 - i,
      avgCoChangedFiles: 20 - i,
      maxCoChangedFiles: 30 - i,
      totalCommits: 5,
    }));
    render(
      <BlastRadiusTab
        report={makeReport(
          files,
          '12 high blast-radius files (architectural load-bearers)',
        )}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '12',
    );
    expect(screen.getByText('High Risk')).toBeTruthy();
    expect(screen.getByText('Top blast files')).toBeTruthy();
    expect(screen.getByText('file0.ts')).toBeTruthy();
    expect(screen.getByText('file1.ts')).toBeTruthy();
    expect(screen.getByText('file2.ts')).toBeTruthy();
    // Fourth file should not appear in the finding cap.
    expect(screen.queryByText('file3.ts')).toBeNull();
  });

  it('renders the per-tier mix in the subline (low/medium/high/critical) using blastTierFor cuts', () => {
    // blastTierFor: <25 low · <50 medium · <=75 high · >75 critical
    const files: BlastFixture[] = [
      {
        file: 'low1.ts',
        blastScore: 5,
        avgCoChangedFiles: 1,
        maxCoChangedFiles: 2,
        totalCommits: 1,
      },
      {
        file: 'low2.ts',
        blastScore: 24,
        avgCoChangedFiles: 2,
        maxCoChangedFiles: 3,
        totalCommits: 1,
      },
      {
        file: 'med1.ts',
        blastScore: 25,
        avgCoChangedFiles: 3,
        maxCoChangedFiles: 4,
        totalCommits: 1,
      },
      {
        file: 'med2.ts',
        blastScore: 49,
        avgCoChangedFiles: 4,
        maxCoChangedFiles: 5,
        totalCommits: 1,
      },
      {
        file: 'med3.ts',
        blastScore: 30,
        avgCoChangedFiles: 5,
        maxCoChangedFiles: 6,
        totalCommits: 1,
      },
      {
        file: 'hi1.ts',
        blastScore: 50,
        avgCoChangedFiles: 6,
        maxCoChangedFiles: 7,
        totalCommits: 1,
      },
      {
        file: 'hi2.ts',
        blastScore: 75,
        avgCoChangedFiles: 7,
        maxCoChangedFiles: 8,
        totalCommits: 1,
      },
      {
        file: 'crit1.ts',
        blastScore: 76,
        avgCoChangedFiles: 8,
        maxCoChangedFiles: 9,
        totalCommits: 1,
      },
      {
        file: 'crit2.ts',
        blastScore: 100,
        avgCoChangedFiles: 9,
        maxCoChangedFiles: 10,
        totalCommits: 1,
      },
    ];
    render(
      <BlastRadiusTab report={makeReport(files, '')} onApplyPreset={vi.fn()} />,
    );
    const subline = screen.getByText(/Tier mix:/).closest('div')!;
    expect(subline.textContent).toContain('2 low');
    expect(subline.textContent).toContain('3 medium');
    expect(subline.textContent).toContain('2 high');
    expect(subline.textContent).toContain('2 critical');
  });

  it('renders the "Where they live" rollup with the top high-blast directories', () => {
    // 3 high-blast in /tests, 2 high-blast in /src, 1 in /scripts; 1 medium that should be ignored.
    const files: BlastFixture[] = [
      {
        file: 'tests/a.ts',
        blastScore: 95,
        avgCoChangedFiles: 20,
        maxCoChangedFiles: 30,
        totalCommits: 1,
      },
      {
        file: 'tests/b.ts',
        blastScore: 90,
        avgCoChangedFiles: 18,
        maxCoChangedFiles: 28,
        totalCommits: 1,
      },
      {
        file: 'tests/c.ts',
        blastScore: 85,
        avgCoChangedFiles: 16,
        maxCoChangedFiles: 26,
        totalCommits: 1,
      },
      {
        file: 'src/x.ts',
        blastScore: 80,
        avgCoChangedFiles: 14,
        maxCoChangedFiles: 22,
        totalCommits: 1,
      },
      {
        file: 'src/y.ts',
        blastScore: 75,
        avgCoChangedFiles: 12,
        maxCoChangedFiles: 20,
        totalCommits: 1,
      },
      {
        file: 'scripts/q.ts',
        blastScore: 70,
        avgCoChangedFiles: 10,
        maxCoChangedFiles: 18,
        totalCommits: 1,
      },
      {
        file: 'src/z.ts',
        blastScore: 40,
        avgCoChangedFiles: 4,
        maxCoChangedFiles: 6,
        totalCommits: 1,
      },
    ];
    render(
      <BlastRadiusTab report={makeReport(files, '')} onApplyPreset={vi.fn()} />,
    );
    expect(screen.getByText('Where they live')).toBeTruthy();

    const dirRow = screen.getByText('tests').closest('div')!.parentElement!;
    // tests has 3 of 6 high-blast files → 50%
    expect(dirRow.textContent).toContain('3');
    expect(dirRow.textContent).toContain('50%');

    expect(screen.getByText('src')).toBeTruthy();
    expect(screen.getByText('scripts')).toBeTruthy();
  });

  it('surfaces the full directory path via Tooltip on hover (RELIC-334 truncation safety)', () => {
    // Long fixture path that would visibly ellipsize at side-by-side widths in
    // the real dashboard. The Tooltip wrapper must surface the full value on
    // hover so users can read the truncated path.
    const longDir =
      'compiler/packages/babel-plugin-react-compiler/src/__tests__/fixtures';
    const files: BlastFixture[] = [
      {
        file: `${longDir}/a.ts`,
        blastScore: 95,
        avgCoChangedFiles: 20,
        maxCoChangedFiles: 30,
        totalCommits: 1,
      },
    ];
    render(
      <BlastRadiusTab report={makeReport(files, '')} onApplyPreset={vi.fn()} />,
    );

    // Pre-hover: only the cell renders the path.
    expect(screen.getAllByText(longDir)).toHaveLength(1);

    fireEvent.mouseEnter(screen.getByText(longDir));

    // Post-hover: the tooltip duplicates the path inside the Tooltip wrapper.
    expect(screen.getAllByText(longDir)).toHaveLength(2);
  });

  it('shows a "+ N more directories" footer when more than 5 distinct directories exist', () => {
    // 7 high-blast files spread across 7 distinct directories — top 5 visible, 2 hidden.
    const files: BlastFixture[] = Array.from({ length: 7 }, (_, i) => ({
      file: `dir${i}/file.ts`,
      blastScore: 90 - i,
      avgCoChangedFiles: 15,
      maxCoChangedFiles: 20,
      totalCommits: 1,
    }));
    render(
      <BlastRadiusTab report={makeReport(files, '')} onApplyPreset={vi.fn()} />,
    );
    expect(screen.getByText(/\+ 2 more directories/)).toBeTruthy();
  });

  it('uses singular "directory" when exactly one directory is hidden', () => {
    const files: BlastFixture[] = Array.from({ length: 6 }, (_, i) => ({
      file: `dir${i}/file.ts`,
      blastScore: 90 - i,
      avgCoChangedFiles: 15,
      maxCoChangedFiles: 20,
      totalCommits: 1,
    }));
    render(
      <BlastRadiusTab report={makeReport(files, '')} onApplyPreset={vi.fn()} />,
    );
    expect(screen.getByText(/\+ 1 more directory/)).toBeTruthy();
  });

  it('omits the "+ more directories" footer when 5 or fewer distinct directories exist', () => {
    const files: BlastFixture[] = Array.from({ length: 5 }, (_, i) => ({
      file: `dir${i}/file.ts`,
      blastScore: 90 - i,
      avgCoChangedFiles: 15,
      maxCoChangedFiles: 20,
      totalCommits: 1,
    }));
    render(
      <BlastRadiusTab report={makeReport(files, '')} onApplyPreset={vi.fn()} />,
    );
    expect(screen.queryByText(/more director/)).toBeNull();
  });

  it('omits the rollup when no high-blast files exist', () => {
    render(
      <BlastRadiusTab
        report={makeReport(
          [
            {
              file: 'a.ts',
              blastScore: 30,
              avgCoChangedFiles: 2,
              maxCoChangedFiles: 4,
              totalCommits: 1,
            },
          ],
          '',
        )}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.queryByText('Where they live')).toBeNull();
  });

  it('routes Coupling click to onApplyPreset("coupling")', () => {
    const onApplyPreset = vi.fn();
    render(
      <BlastRadiusTab
        report={makeReport(
          [
            {
              file: 'a.ts',
              blastScore: 80,
              avgCoChangedFiles: 18,
              maxCoChangedFiles: 30,
              totalCommits: 5,
            },
          ],
          '',
        )}
        onApplyPreset={onApplyPreset}
      />,
    );
    screen.getByText('Coupling').click();
    expect(onApplyPreset).toHaveBeenCalledWith('coupling');
  });

  it('routes Hotspots click to onApplyPreset("hotspots")', () => {
    const onApplyPreset = vi.fn();
    render(
      <BlastRadiusTab
        report={makeReport(
          [
            {
              file: 'a.ts',
              blastScore: 80,
              avgCoChangedFiles: 18,
              maxCoChangedFiles: 30,
              totalCommits: 5,
            },
          ],
          '',
        )}
        onApplyPreset={onApplyPreset}
      />,
    );
    screen.getByText('Hotspots').click();
    expect(onApplyPreset).toHaveBeenCalledWith('hotspots');
  });

  it('falls back to the analyzer summary when no files exist', () => {
    render(
      <BlastRadiusTab
        report={makeReport([], 'No commits to analyze')}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe(
      '0',
    );
    expect(
      screen.getByText('No co-change activity in the analyzed window.'),
    ).toBeTruthy();
    expect(screen.getByText('No commits to analyze')).toBeTruthy();
  });
});
