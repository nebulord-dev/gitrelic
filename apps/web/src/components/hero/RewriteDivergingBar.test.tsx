import { describe, expect, it } from 'vitest';

import { prepareRewriteData } from './RewriteDivergingBar';

import type { GitrelicReport } from '@gitrelic/core';

interface RewriteFixture {
  file: string;
  rewriteScore: number;
  totalInsertions: number;
  totalDeletions: number;
  ratio: number;
}

function makeReport(files: RewriteFixture[]): GitrelicReport {
  return {
    rewriteRatio: { files, topRewriters: [], summary: '' },
  } as unknown as GitrelicReport;
}

describe('prepareRewriteData', () => {
  it('sorts rows by rewriteScore desc', () => {
    const { rows } = prepareRewriteData(
      makeReport([
        {
          file: 'a',
          rewriteScore: 30,
          totalInsertions: 100,
          totalDeletions: 50,
          ratio: 0.5,
        },
        {
          file: 'b',
          rewriteScore: 80,
          totalInsertions: 200,
          totalDeletions: 180,
          ratio: 0.9,
        },
        {
          file: 'c',
          rewriteScore: 50,
          totalInsertions: 150,
          totalDeletions: 100,
          ratio: 0.66,
        },
      ]),
    );
    expect(rows.map((r) => r.file)).toEqual(['b', 'c', 'a']);
  });

  it('caps at 30 rows by default', () => {
    const many: RewriteFixture[] = Array.from({ length: 50 }, (_, i) => ({
      file: `f${i}`,
      rewriteScore: 100 - i,
      totalInsertions: 100,
      totalDeletions: 50,
      ratio: 0.5,
    }));
    const { rows } = prepareRewriteData(makeReport(many));
    expect(rows).toHaveLength(30);
  });

  it('returns maxAbs as the largest absolute insertion or deletion across rendered rows', () => {
    const { maxAbs } = prepareRewriteData(
      makeReport([
        {
          file: 'a',
          rewriteScore: 90,
          totalInsertions: 100,
          totalDeletions: 50,
          ratio: 0.5,
        },
        {
          file: 'b',
          rewriteScore: 80,
          totalInsertions: 40,
          totalDeletions: 250,
          ratio: 6,
        },
        {
          file: 'c',
          rewriteScore: 70,
          totalInsertions: 200,
          totalDeletions: 200,
          ratio: 1,
        },
      ]),
    );
    expect(maxAbs).toBe(250);
  });

  it('returns 0 maxAbs and [] rows for an empty report', () => {
    const { rows, maxAbs } = prepareRewriteData(makeReport([]));
    expect(rows).toEqual([]);
    expect(maxAbs).toBe(0);
  });

  it('only counts maxAbs across post-cap rows, not the discarded tail', () => {
    const huge: RewriteFixture[] = Array.from({ length: 35 }, (_, i) => ({
      file: `f${i}`,
      rewriteScore: 100 - i,
      totalInsertions: i === 34 ? 9999 : 100,
      totalDeletions: 50,
      ratio: 0.5,
    }));
    const { maxAbs } = prepareRewriteData(makeReport(huge));
    expect(maxAbs).toBe(100);
  });

  it('does not mutate the input files array', () => {
    const original: RewriteFixture[] = [
      {
        file: 'a',
        rewriteScore: 30,
        totalInsertions: 100,
        totalDeletions: 50,
        ratio: 0.5,
      },
      {
        file: 'b',
        rewriteScore: 80,
        totalInsertions: 200,
        totalDeletions: 180,
        ratio: 0.9,
      },
    ];
    const before = original.map((f) => f.file);
    prepareRewriteData(makeReport(original));
    expect(original.map((f) => f.file)).toEqual(before);
  });
});
