import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgeMapByDirectoryTab } from './AgeMapByDirectoryTab';

import type { FileAge, GitrelicReport } from '@gitrelic/core';

function f(
  file: string,
  ageInDays: number,
  status: FileAge['status'],
): FileAge {
  return { file, lastCommitDate: '2025-01-01', ageInDays, status };
}

function makeReport(files: FileAge[]): GitrelicReport {
  return {
    meta: { ageInDays: 365 } as never,
    ageMap: {
      files,
      staleFiles: files.filter((x) => x.status === 'stale'),
      ancientFiles: files.filter((x) => x.status === 'ancient'),
      medianAgeDays: 0,
      thresholds: { freshLimit: 29, agingLimit: 120, staleLimit: 241 },
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('AgeMapByDirectoryTab', () => {
  afterEach(() => cleanup());

  it('renders a row per directory with file count, median age, and tier counts', () => {
    const files = [
      f('a/x.ts', 10, 'fresh'),
      f('a/y.ts', 100, 'aging'),
      f('a/z.ts', 250, 'ancient'),
      f('b/x.ts', 50, 'aging'),
    ];
    render(
      <AgeMapByDirectoryTab
        report={makeReport(files)}
        onSelectFile={vi.fn()}
      />,
    );

    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.getByText('Median Age')).toBeTruthy();
    expect(screen.getByText('Ancient')).toBeTruthy();
    expect(screen.getByText('Stale')).toBeTruthy();
    expect(screen.getByText('Fresh')).toBeTruthy();
  });

  it('default-sorts by median age desc', () => {
    const files = [
      f('young/x.ts', 5, 'fresh'),
      f('young/y.ts', 10, 'fresh'),
      f('old/x.ts', 300, 'ancient'),
      f('old/y.ts', 320, 'ancient'),
    ];
    const { container } = render(
      <AgeMapByDirectoryTab
        report={makeReport(files)}
        onSelectFile={vi.fn()}
      />,
    );
    // First data row should be the "old" directory.
    const dataRows = container.querySelectorAll(
      'div.flex.items-center.py-1\\.5',
    );
    expect(dataRows.length).toBeGreaterThan(0);
    expect(dataRows[0].textContent).toContain('old');
  });

  it("clicking a row calls onSelectFile with the directory's oldest file", () => {
    const onSelectFile = vi.fn();
    const files = [f('a/young.ts', 10, 'fresh'), f('a/old.ts', 350, 'ancient')];
    render(
      <AgeMapByDirectoryTab
        report={makeReport(files)}
        onSelectFile={onSelectFile}
      />,
    );
    fireEvent.click(screen.getByText('a'));
    expect(onSelectFile).toHaveBeenCalledWith('a/old.ts');
  });

  it('renders empty-state copy when no files are tracked', () => {
    render(
      <AgeMapByDirectoryTab report={makeReport([])} onSelectFile={vi.fn()} />,
    );
    expect(screen.getByText(/No directories with age data\./)).toBeTruthy();
  });

  it('represents the repo root as "(root)" in the directory cell', () => {
    render(
      <AgeMapByDirectoryTab
        report={makeReport([f('rootfile.ts', 100, 'aging')])}
        onSelectFile={vi.fn()}
      />,
    );
    expect(screen.getByText('(root)')).toBeTruthy();
  });
});
