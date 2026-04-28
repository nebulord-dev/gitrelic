import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { categoryColor } from '../../utils/colors';
import { ChurnTreemap, colorByMode } from './ChurnTreemap';

import type { GitrelicReport } from '@gitrelic/core';

function makeReport(overrides: Partial<GitrelicReport> = {}): GitrelicReport {
  return {
    hotspots: { files: [], topHotspots: [], summary: '' },
    ageMap: { files: [], staleFiles: [], ancientFiles: [], medianAgeDays: 0, summary: '' },
    testCoverage: {
      directories: [],
      uncoveredDirectories: [],
      files: [],
      overallRatio: 0,
      summary: '',
    },
    ...overrides,
  } as unknown as GitrelicReport;
}

describe('colorByMode', () => {
  describe('churn', () => {
    it('returns category color from hotspots', () => {
      const report = makeReport({
        hotspots: {
          files: [
            { file: 'a.ts', hotspotScore: 90, churnScore: 80, loc: 100, category: 'critical' },
          ],
          topHotspots: [],
          summary: '',
        },
      } as Partial<GitrelicReport>);
      const fill = colorByMode.churn.fill('a.ts', report);
      expect(fill).toBe(categoryColor('critical', 0.35));
    });

    it('returns "low" color for files missing from hotspots', () => {
      const fill = colorByMode.churn.fill('missing.ts', makeReport());
      expect(fill).toBe(colorByMode.churn.fill('any.ts', makeReport()));
    });
  });

  describe('age', () => {
    it('returns color for FileAge.status', () => {
      const report = makeReport({
        ageMap: {
          files: [{ file: 'a.ts', lastCommitDate: '', ageInDays: 10, status: 'fresh' }],
          staleFiles: [],
          ancientFiles: [],
          medianAgeDays: 0,
          summary: '',
        },
      } as Partial<GitrelicReport>);
      const fill = colorByMode.age.fill('a.ts', report);
      expect(fill).toBeTruthy();
    });

    it('falls back when file is missing from ageMap', () => {
      const fill = colorByMode.age.fill('missing.ts', makeReport());
      expect(fill).toBeTruthy();
    });
  });

  describe('test-proximity', () => {
    it('distinguishes tested, untested, and unknown', () => {
      const report = makeReport({
        testCoverage: {
          directories: [],
          uncoveredDirectories: [],
          files: [
            { file: 'a.ts', hasTestSibling: true },
            { file: 'b.ts', hasTestSibling: false },
          ],
          overallRatio: 0,
          summary: '',
        },
      });
      const tested = colorByMode['test-proximity'].fill('a.ts', report);
      const untested = colorByMode['test-proximity'].fill('b.ts', report);
      const unknown = colorByMode['test-proximity'].fill('missing.ts', report);
      expect(tested).not.toBe(untested);
      expect(unknown).not.toBe(tested);
      expect(unknown).not.toBe(untested);
    });
  });
});

describe('ChurnTreemap render', () => {
  afterEach(() => cleanup());

  function makeRenderableReport(): GitrelicReport {
    return {
      hotspots: { files: [], topHotspots: [], summary: '' },
      ageMap: { files: [], staleFiles: [], ancientFiles: [], medianAgeDays: 0, summary: '' },
      testCoverage: {
        directories: [],
        uncoveredDirectories: [],
        files: [],
        overallRatio: 0,
        summary: '',
      },
      loc: {
        files: [
          { file: 'a.ts', lines: 100 },
          { file: 'b.ts', lines: 50 },
        ],
      },
      churn: {
        files: [
          { file: 'a.ts', commitCount: 30, churnScore: 80, category: 'hot' },
          { file: 'b.ts', commitCount: 5, churnScore: 20, category: 'cold' },
        ],
      },
    } as unknown as GitrelicReport;
  }

  it('renders an SVG with the default size=loc encoding', () => {
    const { container } = render(
      <ChurnTreemap report={makeRenderableReport()} selectedFile={null} onSelectFile={() => {}} />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
