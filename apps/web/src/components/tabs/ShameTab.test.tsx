import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShameTab } from './ShameTab';

import type { GitrelicReport } from '@gitrelic/core';

const makeReport = (overrides: Partial<GitrelicReport['forensics']> = {}): GitrelicReport =>
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
      <ShameTab report={makeReport({ files, totalShameCommits: 60 })} onApplyPreset={vi.fn()} />,
    );
    expect(screen.getByText('12', { selector: 'div' })).toBeTruthy();
    expect(screen.getByText('High Shame')).toBeTruthy();
  });

  it('fires onApplyPreset when see-also link is clicked', () => {
    const onApplyPreset = vi.fn();
    render(<ShameTab report={makeReport()} onApplyPreset={onApplyPreset} />);
    screen.getByText('Cursed Files').click();
    expect(onApplyPreset).toHaveBeenCalledWith('cursed-files');
  });
});
