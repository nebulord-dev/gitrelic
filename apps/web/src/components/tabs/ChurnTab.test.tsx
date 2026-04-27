import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChurnTab } from './ChurnTab';

import type { GitrelicReport } from '@gitrelic/core';

function makeReport(): GitrelicReport {
  return {
    churn: {
      files: [
        { file: 'src/big.ts', commitCount: 50, churnScore: 90, category: 'hot' },
        { file: 'src/small.ts', commitCount: 5, churnScore: 20, category: 'cold' },
      ],
      topFiles: [],
      hotspotCount: 0,
      summary: '',
    },
    loc: {
      files: [
        { file: 'src/big.ts', lines: 500 },
        { file: 'src/small.ts', lines: 50 },
      ],
    },
    busFactors: {
      files: [{ file: 'src/big.ts', uniqueAuthors: 3, authors: ['a@x', 'b@x', 'c@x'] }],
    },
    ageMap: { files: [{ file: 'src/big.ts', ageInDays: 5 }] },
  } as unknown as GitrelicReport;
}

describe('ChurnTab', () => {
  afterEach(() => cleanup());

  it('renders all six column headers', () => {
    render(<ChurnTab report={makeReport()} selectedFile={null} onSelectFile={vi.fn()} />);
    expect(screen.getByText('File')).toBeTruthy();
    expect(screen.getByText('Commits')).toBeTruthy();
    expect(screen.getByText('LOC')).toBeTruthy();
    expect(screen.getByText('Authors')).toBeTruthy();
    expect(screen.getByText('Last Touched')).toBeTruthy();
    expect(screen.getByText('Category')).toBeTruthy();
  });

  it('pre-sorts rows by commits desc', () => {
    const { container } = render(
      <ChurnTab report={makeReport()} selectedFile={null} onSelectFile={vi.fn()} />,
    );
    // First data row should be 'big.ts' (50 commits) before 'small.ts' (5 commits).
    const text = container.textContent ?? '';
    expect(text.indexOf('big.ts')).toBeLessThan(text.indexOf('small.ts'));
  });

  it('hides the See also footer when onApplyPreset is undefined', () => {
    render(<ChurnTab report={makeReport()} selectedFile={null} onSelectFile={vi.fn()} />);
    expect(screen.queryByText(/See also/)).toBeNull();
  });

  it('routes a Hotspots footer click to onApplyPreset', () => {
    const onApplyPreset = vi.fn();
    render(
      <ChurnTab
        report={makeReport()}
        selectedFile={null}
        onSelectFile={vi.fn()}
        onApplyPreset={onApplyPreset}
      />,
    );
    screen.getByText('Hotspots').click();
    expect(onApplyPreset).toHaveBeenCalledWith('hotspots');
  });

  it('routes a Cursed Files footer click to onApplyPreset', () => {
    const onApplyPreset = vi.fn();
    render(
      <ChurnTab
        report={makeReport()}
        selectedFile={null}
        onSelectFile={vi.fn()}
        onApplyPreset={onApplyPreset}
      />,
    );
    screen.getByText('Cursed Files').click();
    expect(onApplyPreset).toHaveBeenCalledWith('cursed-files');
  });
});
