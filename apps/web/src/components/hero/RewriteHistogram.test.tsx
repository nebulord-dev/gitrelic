import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  HIGH_REWRITE_THRESHOLD,
  RewriteHistogram,
  prepareRewriteHistogramData,
  rewriteTierFor,
} from './RewriteHistogram';

import type { GitrelicReport } from '@gitrelic/core';

const makeReport = (files: Array<{ file: string; rewriteScore: number }> = []): GitrelicReport =>
  ({
    rewriteRatio: {
      files: files.map((f) => ({
        ...f,
        totalInsertions: 100,
        totalDeletions: 100,
        ratio: 1,
      })),
      topRewriters: [],
      totalInsertions: 0,
      totalDeletions: 0,
      highRewrite: files.filter((f) => f.rewriteScore >= 70).length,
      summary: '',
    },
  }) as unknown as GitrelicReport;

describe('rewriteTierFor', () => {
  it('partitions scores into low/medium/high/critical at <25 / <50 / ≤75 / >75', () => {
    expect(rewriteTierFor(0)).toBe('low');
    expect(rewriteTierFor(24)).toBe('low');
    expect(rewriteTierFor(25)).toBe('medium');
    expect(rewriteTierFor(49)).toBe('medium');
    expect(rewriteTierFor(50)).toBe('high');
    expect(rewriteTierFor(75)).toBe('high');
    expect(rewriteTierFor(76)).toBe('critical');
    expect(rewriteTierFor(100)).toBe('critical');
  });
});

describe('prepareRewriteHistogramData', () => {
  it('produces ten contiguous bins of width 10', () => {
    const data = prepareRewriteHistogramData(makeReport([{ file: 'x.ts', rewriteScore: 50 }]));
    expect(data.buckets).toHaveLength(10);
    expect(data.buckets[0]).toMatchObject({ rangeStart: 0, rangeEnd: 9 });
    expect(data.buckets[9]).toMatchObject({ rangeStart: 90, rangeEnd: 100 });
  });

  it('counts files into the correct bucket', () => {
    const data = prepareRewriteHistogramData(
      makeReport([
        { file: 'a.ts', rewriteScore: 0 },
        { file: 'b.ts', rewriteScore: 9 },
        { file: 'c.ts', rewriteScore: 35 },
        { file: 'd.ts', rewriteScore: 100 },
      ]),
    );
    expect(data.buckets[0].count).toBe(2);
    expect(data.buckets[3].count).toBe(1);
    expect(data.buckets[9].count).toBe(1);
  });

  it('reports highRewriteCount across files >= 70', () => {
    const data = prepareRewriteHistogramData(
      makeReport([
        { file: 'a.ts', rewriteScore: 70 },
        { file: 'b.ts', rewriteScore: 95 },
        { file: 'c.ts', rewriteScore: 50 },
      ]),
    );
    expect(data.highRewriteCount).toBe(2);
  });

  it('uses HIGH_REWRITE_THRESHOLD as the inclusive boundary (>=70 counts, 69 does not)', () => {
    const data = prepareRewriteHistogramData(
      makeReport([
        { file: 'a.ts', rewriteScore: HIGH_REWRITE_THRESHOLD },
        { file: 'b.ts', rewriteScore: HIGH_REWRITE_THRESHOLD - 1 },
      ]),
    );
    expect(data.highRewriteCount).toBe(1);
  });

  it('reports totalFiles and maxCount correctly', () => {
    const data = prepareRewriteHistogramData(
      makeReport([
        { file: 'a.ts', rewriteScore: 5 },
        { file: 'b.ts', rewriteScore: 5 },
        { file: 'c.ts', rewriteScore: 5 },
        { file: 'd.ts', rewriteScore: 80 },
      ]),
    );
    expect(data.totalFiles).toBe(4);
    expect(data.maxCount).toBe(3);
  });

  it('handles an empty file list', () => {
    const data = prepareRewriteHistogramData(makeReport([]));
    expect(data.buckets.every((b) => b.count === 0)).toBe(true);
    expect(data.maxCount).toBe(0);
    expect(data.totalFiles).toBe(0);
    expect(data.highRewriteCount).toBe(0);
  });
});

describe('RewriteHistogram render', () => {
  afterEach(() => cleanup());

  it('renders an empty-state caption when no files exist', () => {
    render(<RewriteHistogram report={makeReport([])} />);
    expect(screen.getByText(/No rewrite-ratio data available/i)).toBeTruthy();
  });

  it('renders the hero caption in both populated and empty states', () => {
    const populated = render(
      <RewriteHistogram report={makeReport([{ file: 'a.ts', rewriteScore: 50 }])} />,
    );
    expect(populated.getByText(/10-bin histogram/)).toBeTruthy();
    cleanup();

    const empty = render(<RewriteHistogram report={makeReport([])} />);
    expect(empty.getByText(/10-bin histogram/)).toBeTruthy();
  });

  it('renders an aria-label that announces the threshold count', () => {
    const report = makeReport([
      { file: 'a.ts', rewriteScore: 90 },
      { file: 'b.ts', rewriteScore: 85 },
      { file: 'c.ts', rewriteScore: 30 },
    ]);
    const { container } = render(<RewriteHistogram report={report} />);
    const svg = container.querySelector('svg[role="img"]') as SVGElement | null;
    expect(svg?.getAttribute('aria-label')).toMatch(/distribution histogram across 3 files/i);
    expect(svg?.getAttribute('aria-label')).toMatch(
      /2 files.*at or above the high-rewrite threshold of 70/i,
    );
  });
});
