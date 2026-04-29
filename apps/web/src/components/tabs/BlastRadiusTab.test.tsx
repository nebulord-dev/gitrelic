import { cleanup, render, screen } from '@testing-library/react';
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

  it('renders 0 with Low Risk badge when no files cross the high-blast threshold', () => {
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
    expect(screen.getByText('2', { selector: 'div' })).toBeTruthy();
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
        report={makeReport(files, '12 high blast-radius files (architectural load-bearers)')}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('12', { selector: 'div' })).toBeTruthy();
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
    render(<BlastRadiusTab report={makeReport(files, '')} onApplyPreset={vi.fn()} />);
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
    render(<BlastRadiusTab report={makeReport(files, '')} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('Where they live')).toBeTruthy();

    const dirRow = screen.getByText('tests').closest('div')!.parentElement!;
    // tests has 3 of 6 high-blast files → 50%
    expect(dirRow.textContent).toContain('3');
    expect(dirRow.textContent).toContain('50%');

    expect(screen.getByText('src')).toBeTruthy();
    expect(screen.getByText('scripts')).toBeTruthy();
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
      <BlastRadiusTab report={makeReport([], 'No commits to analyze')} onApplyPreset={vi.fn()} />,
    );
    expect(screen.getByText('0', { selector: 'div' })).toBeTruthy();
    expect(screen.getByText('No co-change activity in the analyzed window.')).toBeTruthy();
    expect(screen.getByText('No commits to analyze')).toBeTruthy();
  });
});
