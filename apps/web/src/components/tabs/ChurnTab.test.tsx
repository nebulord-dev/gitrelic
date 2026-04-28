import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChurnTab } from './ChurnTab';

import type { GitrelicReport } from '@gitrelic/core';

function makeReport(): GitrelicReport {
  return {
    churn: {
      files: [
        { file: 'src/components/Header.tsx', commitCount: 50, churnScore: 90, category: 'hot' },
        { file: 'src/components/Footer.tsx', commitCount: 10, churnScore: 30, category: 'cold' },
        { file: 'src/utils/format.ts', commitCount: 5, churnScore: 15, category: 'cold' },
        { file: 'README.md', commitCount: 3, churnScore: 5, category: 'frozen' },
      ],
      topFiles: [],
      hotspotCount: 0,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('ChurnTab', () => {
  afterEach(() => cleanup());

  it('renders the directory roll-up column headers', () => {
    render(<ChurnTab report={makeReport()} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('Directory')).toBeTruthy();
    expect(screen.getByText('Commits')).toBeTruthy();
    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();
    expect(screen.getByText('Top file')).toBeTruthy();
  });

  it('aggregates multiple files in the same directory into a single row', () => {
    render(<ChurnTab report={makeReport()} onApplyPreset={vi.fn()} />);
    // src/components: 50 + 10 = 60 commits across 2 files; top file is Header.tsx.
    expect(screen.getByText('src/components')).toBeTruthy();
    expect(screen.getByText('60')).toBeTruthy();
    expect(screen.getByText('Header.tsx')).toBeTruthy();
  });

  it('renders (root) for files at the repository root', () => {
    render(<ChurnTab report={makeReport()} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('(root)')).toBeTruthy();
    expect(screen.getByText('README.md')).toBeTruthy();
  });

  it('sorts directories by total commit count descending', () => {
    const { container } = render(<ChurnTab report={makeReport()} onApplyPreset={vi.fn()} />);
    const text = container.textContent ?? '';
    // src/components (60) before src/utils (5) before (root) (3).
    expect(text.indexOf('src/components')).toBeLessThan(text.indexOf('src/utils'));
    expect(text.indexOf('src/utils')).toBeLessThan(text.indexOf('(root)'));
  });

  it('routes a Hotspots footer click to onApplyPreset', () => {
    const onApplyPreset = vi.fn();
    render(<ChurnTab report={makeReport()} onApplyPreset={onApplyPreset} />);
    screen.getByText('Hotspots').click();
    expect(onApplyPreset).toHaveBeenCalledWith('hotspots');
  });

  it('routes a Cursed Files footer click to onApplyPreset', () => {
    const onApplyPreset = vi.fn();
    render(<ChurnTab report={makeReport()} onApplyPreset={onApplyPreset} />);
    screen.getByText('Cursed Files').click();
    expect(onApplyPreset).toHaveBeenCalledWith('cursed-files');
  });
});
