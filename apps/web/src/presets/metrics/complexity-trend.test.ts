import { describe, expect, it } from 'vitest';

import { complexityTrendMetrics } from './complexity-trend';

import type { ComplexityTrendReport, FileComplexityTrend, GitrelicReport } from '@gitrelic/core';

function makeFile(overrides: Partial<FileComplexityTrend> = {}): FileComplexityTrend {
  return {
    file: 'a.ts',
    buckets: [],
    totalNetLines: 100,
    recentGrowthRate: 50,
    trend: 'growing',
    ...overrides,
  };
}

function makeReport(complexityTrend: Partial<ComplexityTrendReport>): GitrelicReport {
  return {
    complexityTrend: {
      files: complexityTrend.files ?? [],
      growingFiles: complexityTrend.growingFiles ?? [],
      shrinkingFiles: complexityTrend.shrinkingFiles ?? [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('complexityTrendMetrics', () => {
  it('returns healthy zeros when nothing is growing or shrinking', () => {
    const metrics = complexityTrendMetrics(makeReport({}));
    expect(metrics).toHaveLength(4);
    expect(metrics[0].value).toBe('0');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[2].value).toBe('—');
    expect(metrics[3].value).toBe('—');
  });

  it('computes totals from files/growing/shrinking arrays', () => {
    const files = [
      makeFile({ file: 'a.ts', totalNetLines: 300 }),
      makeFile({ file: 'b.ts', totalNetLines: -50, trend: 'shrinking' }),
    ];
    const growingFiles = [makeFile({ file: 'a.ts', recentGrowthRate: 120 })];
    const shrinkingFiles = [makeFile({ file: 'b.ts', trend: 'shrinking' })];
    const metrics = complexityTrendMetrics(makeReport({ files, growingFiles, shrinkingFiles }));
    expect(metrics[0].value).toBe('1');
    expect(metrics[0].color).toBe('var(--severity-warning)');
    expect(metrics[1].value).toBe('1');
    expect(metrics[2].value).toBe('120');
    expect(metrics[2].color).toBe('var(--severity-warning)');
    expect(metrics[3].value).toBe('250');
  });

  it('rounds fractional top growth rates', () => {
    const growingFiles = [makeFile({ recentGrowthRate: 87.6 })];
    const metrics = complexityTrendMetrics(makeReport({ files: [makeFile()], growingFiles }));
    expect(metrics[2].value).toBe('88');
  });
});
