import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChurnTab } from './ChurnTab';

import type { GitrelicReport } from '@gitrelic/core';

function makeReport(): GitrelicReport {
  return {
    churn: {
      files: [
        // Source
        {
          file: 'src/components/Header.tsx',
          commitCount: 50,
          churnScore: 90,
          category: 'hot',
        },
        {
          file: 'src/components/Footer.tsx',
          commitCount: 10,
          churnScore: 30,
          category: 'cold',
        },
        {
          file: 'src/utils/format.ts',
          commitCount: 5,
          churnScore: 15,
          category: 'cold',
        },
        {
          file: 'README.md',
          commitCount: 3,
          churnScore: 5,
          category: 'frozen',
        },
        // Tests
        {
          file: 'src/components/__tests__/Header.test.tsx',
          commitCount: 25,
          churnScore: 60,
          category: 'warm',
        },
        {
          file: 'src/utils/format.spec.ts',
          commitCount: 8,
          churnScore: 20,
          category: 'cold',
        },
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
    render(
      <ChurnTab report={makeReport()} onApplyPreset={vi.fn()} mode="source" />,
    );
    expect(screen.getByText('Directory')).toBeTruthy();
    expect(screen.getByText('Commits')).toBeTruthy();
    expect(screen.getByText('Share')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();
    expect(screen.getByText('Top file')).toBeTruthy();
  });

  describe('source mode', () => {
    it('aggregates only non-test files by their parent directory', () => {
      render(
        <ChurnTab
          report={makeReport()}
          onApplyPreset={vi.fn()}
          mode="source"
        />,
      );
      // src/components has 2 source files (50 + 10 = 60 commits) excluding the test file.
      expect(screen.getByText('src/components')).toBeTruthy();
      expect(screen.getByText('60')).toBeTruthy();
      expect(screen.getByText('Header.tsx')).toBeTruthy();
    });

    it('renders (root) for source files at the repository root', () => {
      render(
        <ChurnTab
          report={makeReport()}
          onApplyPreset={vi.fn()}
          mode="source"
        />,
      );
      expect(screen.getByText('(root)')).toBeTruthy();
      expect(screen.getByText('README.md')).toBeTruthy();
    });

    it('excludes test files from the source rollup', () => {
      render(
        <ChurnTab
          report={makeReport()}
          onApplyPreset={vi.fn()}
          mode="source"
        />,
      );
      expect(screen.queryByText('src/components/__tests__')).toBeNull();
      expect(screen.queryByText('Header.test.tsx')).toBeNull();
      expect(screen.queryByText('format.spec.ts')).toBeNull();
    });
  });

  describe('tests mode', () => {
    it('aggregates only test files', () => {
      render(
        <ChurnTab report={makeReport()} onApplyPreset={vi.fn()} mode="tests" />,
      );
      expect(screen.getByText('src/components/__tests__')).toBeTruthy();
      expect(screen.getByText('Header.test.tsx')).toBeTruthy();
      // src/utils row appears too because format.spec.ts is a test by basename pattern.
      expect(screen.getByText('format.spec.ts')).toBeTruthy();
    });

    it('excludes source files from the tests rollup', () => {
      render(
        <ChurnTab report={makeReport()} onApplyPreset={vi.fn()} mode="tests" />,
      );
      expect(screen.queryByText('Header.tsx')).toBeNull();
      expect(screen.queryByText('Footer.tsx')).toBeNull();
      expect(screen.queryByText('format.ts')).toBeNull();
      expect(screen.queryByText('README.md')).toBeNull();
    });

    it('renders an empty-state message when no test files are present', () => {
      const report = {
        churn: {
          files: [
            {
              file: 'src/index.ts',
              commitCount: 10,
              churnScore: 50,
              category: 'warm',
            },
          ],
          topFiles: [],
          hotspotCount: 0,
          summary: '',
        },
      } as unknown as GitrelicReport;
      render(<ChurnTab report={report} onApplyPreset={vi.fn()} mode="tests" />);
      expect(screen.getByText(/No test files detected/)).toBeTruthy();
    });
  });

  describe('see-also footer', () => {
    it('routes a Hotspots click to onApplyPreset', () => {
      const onApplyPreset = vi.fn();
      render(
        <ChurnTab
          report={makeReport()}
          onApplyPreset={onApplyPreset}
          mode="source"
        />,
      );
      screen.getByText('Hotspots').click();
      expect(onApplyPreset).toHaveBeenCalledWith('hotspots');
    });

    it('routes a Cursed Files click to onApplyPreset', () => {
      const onApplyPreset = vi.fn();
      render(
        <ChurnTab
          report={makeReport()}
          onApplyPreset={onApplyPreset}
          mode="source"
        />,
      );
      screen.getByText('Cursed Files').click();
      expect(onApplyPreset).toHaveBeenCalledWith('cursed-files');
    });

    it('renders the see-also footer in tests mode too', () => {
      render(
        <ChurnTab report={makeReport()} onApplyPreset={vi.fn()} mode="tests" />,
      );
      expect(screen.getByText('Hotspots')).toBeTruthy();
      expect(screen.getByText('Cursed Files')).toBeTruthy();
    });
  });
});
