import { describe, expect, it } from 'vitest';

import { rewriteRatioMetrics } from './rewrite-ratio';

import type { FileRewriteRatio, GitrelicReport, RewriteRatioReport } from '@gitrelic/core';

function makeFile(overrides: Partial<FileRewriteRatio> = {}): FileRewriteRatio {
  return {
    file: 'a.ts',
    rewriteScore: 50,
    totalInsertions: 200,
    totalDeletions: 100,
    ratio: 0.5,
    ...overrides,
  };
}

function makeReport(rewriteRatio: Partial<RewriteRatioReport>): GitrelicReport {
  return {
    rewriteRatio: {
      files: rewriteRatio.files ?? [],
      topRewriters: rewriteRatio.topRewriters ?? [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('rewriteRatioMetrics', () => {
  it('returns healthy/em-dash values when no files are analyzed', () => {
    const metrics = rewriteRatioMetrics(makeReport({}));
    expect(metrics).toHaveLength(4);
    expect(metrics[0].value).toBe('—');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1].value).toBe('0');
    expect(metrics[1].color).toBe('var(--severity-healthy)');
    expect(metrics[2].value).toBe('—');
    expect(metrics[3].value).toBe('0');
  });

  it('surfaces rounded top rewriter score with critical color at/above 70', () => {
    const topRewriters = [makeFile({ rewriteScore: 82 })];
    const metrics = rewriteRatioMetrics(makeReport({ files: [makeFile()], topRewriters }));
    expect(metrics[0].value).toBe('82');
    expect(metrics[0].color).toBe('var(--severity-critical)');
  });

  it('warns below 70 when there is a top rewriter', () => {
    const topRewriters = [makeFile({ rewriteScore: 55 })];
    const metrics = rewriteRatioMetrics(makeReport({ files: [makeFile()], topRewriters }));
    expect(metrics[0].color).toBe('var(--severity-warning)');
  });

  it('computes avg ratio with two-decimal rounding', () => {
    const files = [makeFile({ ratio: 0.33 }), makeFile({ ratio: 0.66 }), makeFile({ ratio: 1.0 })];
    const metrics = rewriteRatioMetrics(makeReport({ files }));
    expect(metrics[2].value).toBe('0.66');
    expect(metrics[3].value).toBe('3');
  });

  it('returns em-dash for Top Rewriter Score when topRewriters is empty but files exist', () => {
    const metrics = rewriteRatioMetrics(makeReport({ files: [makeFile()], topRewriters: [] }));
    expect(metrics[0].value).toBe('—');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
  });
});
