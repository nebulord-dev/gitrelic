import { describe, expect, it } from 'vitest';

import { normalizeReport } from './normalizeReport';

describe('normalizeReport', () => {
  it('defaults testCoverage.files to empty array when raw report omits it', () => {
    const raw = {
      testCoverage: {
        directories: [],
        uncoveredDirectories: [],
        overallRatio: 0,
        summary: 'old report',
      },
    };
    const out = normalizeReport(raw as any);
    expect(out.testCoverage.files).toEqual([]);
  });

  it('preserves testCoverage.files when present', () => {
    const raw = {
      testCoverage: {
        directories: [],
        uncoveredDirectories: [],
        files: [{ file: 'a.ts', hasTestSibling: true }],
        overallRatio: 0,
        summary: '',
      },
    };
    const out = normalizeReport(raw as any);
    expect(out.testCoverage.files).toHaveLength(1);
    expect(out.testCoverage.files[0].hasTestSibling).toBe(true);
  });

  it('defaults entire testCoverage when missing', () => {
    const out = normalizeReport({} as any);
    expect(out.testCoverage.files).toEqual([]);
    expect(out.testCoverage.directories).toEqual([]);
  });

  it('fills empty defaults for new forensics aggregates on older reports', () => {
    const result = normalizeReport({});
    expect(result.forensics.keywordTiers).toEqual({
      critical: 0,
      moderate: 0,
      mild: 0,
    });
    expect(result.forensics.byMonth).toEqual([]);
  });

  it('fills ageMap.thresholds from meta.ageInDays when the field is absent (older report)', () => {
    const result = normalizeReport({
      meta: { ageInDays: 365 } as never,
      ageMap: {
        files: [],
        staleFiles: [],
        ancientFiles: [],
        medianAgeDays: 0,
        summary: '',
      } as never,
    });
    expect(result.ageMap.thresholds).toEqual({
      freshLimit: 29,
      agingLimit: 120,
      staleLimit: 241,
    });
  });

  it('preserves ageMap.thresholds from a fresh report and does not overwrite', () => {
    const result = normalizeReport({
      meta: { ageInDays: 100 } as never,
      ageMap: {
        files: [],
        staleFiles: [],
        ancientFiles: [],
        medianAgeDays: 0,
        thresholds: { freshLimit: 8, agingLimit: 33, staleLimit: 66 },
        summary: '',
      } as never,
    });
    expect(result.ageMap.thresholds).toEqual({
      freshLimit: 8,
      agingLimit: 33,
      staleLimit: 66,
    });
  });
});
