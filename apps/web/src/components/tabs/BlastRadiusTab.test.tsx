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
    expect(screen.getByText('0')).toBeTruthy();
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
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('Moderate Risk')).toBeTruthy();
  });

  it('renders High Risk badge for 10+ high-blast files and shows top file in finding', () => {
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
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('High Risk')).toBeTruthy();
    expect(screen.getByText('file0.ts')).toBeTruthy();
    expect(
      screen.getByText('12 high blast-radius files (architectural load-bearers)'),
    ).toBeTruthy();
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

  it('falls back gracefully when no top file exists', () => {
    render(
      <BlastRadiusTab report={makeReport([], 'No commits to analyze')} onApplyPreset={vi.fn()} />,
    );
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('No co-change activity in the analyzed window.')).toBeTruthy();
  });
});
