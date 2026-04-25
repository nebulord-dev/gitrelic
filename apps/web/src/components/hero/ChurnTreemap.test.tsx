import { describe, expect, it } from 'vitest';

import { categoryColor } from '../../utils/colors';
import { colorByMode } from './ChurnTreemap';

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

  it('exposes a legend definition for each mode', () => {
    expect(colorByMode.churn.legend.length).toBeGreaterThan(0);
    expect(colorByMode.age.legend.length).toBeGreaterThan(0);
    expect(colorByMode['test-proximity'].legend.length).toBeGreaterThan(0);
  });
});
