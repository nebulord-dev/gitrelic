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
});
