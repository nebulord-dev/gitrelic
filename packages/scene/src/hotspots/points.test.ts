import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { hotspotReport } from '../../test/hotspotReport';
import {
  commitsForScore,
  hotspotPoints,
  hotspotScale,
  hotspotSummary,
  hotspotTier,
  packageOf,
} from './points';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

describe('hotspotTier', () => {
  it('uses core’s floors', () => {
    expect([0, 24, 25, 49, 50, 74, 75, 100].map(hotspotTier)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3,
    ]);
  });
});

describe('hotspotPoints', () => {
  it('pairs each scored file with its commits, hottest first', () => {
    const points = hotspotPoints(report);
    expect(points).toHaveLength(report.hotspots.files.length);
    expect(points[0]).toMatchObject({ file: 'src/helpers.ts', score: 100 });
    for (let i = 1; i < points.length; i++)
      expect(points[i - 1].score).toBeGreaterThanOrEqual(points[i].score);
    const churn = new Map(
      report.churn.files.map((f) => [f.file, f.commitCount]),
    );
    for (const p of points) expect(p.commits).toBe(churn.get(p.file));
  });

  it('skips a scored file with no churn entry', () => {
    const r = hotspotReport([
      { file: 'a.ts', commits: 3, loc: 100, score: 100 },
    ]);
    r.hotspots.files.push({
      file: 'ghost.ts',
      hotspotScore: 10,
      churnScore: 0,
      loc: 5,
      category: 'low',
    });
    expect(hotspotPoints(r).map((p) => p.file)).toEqual(['a.ts']);
  });
});

describe('hotspotScale', () => {
  it('recovers core’s score from commits and lines (to rounding)', () => {
    const k = hotspotScale(report)!;
    for (const p of hotspotPoints(report)) {
      const predicted = (p.commits * Math.log2(Math.max(1, p.lines))) / k;
      // churnScore and the score are each rounded to an integer in core.
      expect(Math.abs(predicted - p.score)).toBeLessThanOrEqual(
        p.score * 0.06 + 1,
      );
    }
  });

  it('puts a file scoring S on the S curve', () => {
    const k = hotspotScale(report)!;
    const top = hotspotPoints(report)[0];
    expect(commitsForScore(top.score, top.lines, k)).toBeCloseTo(
      top.commits,
      0,
    );
  });

  it('is null with no history', () => {
    const empty = {
      churn: { files: [] },
      hotspots: { files: [] },
    } as unknown as GitrelicReport;
    expect(hotspotScale(empty)).toBeNull();
  });
});

describe('packageOf', () => {
  it('names monorepo packages, top-level folders and the root', () => {
    expect(packageOf('packages/shared/src/x.js')).toBe('packages/shared');
    expect(packageOf('packages/README.md')).toBe('packages');
    expect(packageOf('compiler/a/b.ts')).toBe('compiler');
    expect(packageOf('package.json')).toBe('');
  });
});

describe('hotspotSummary', () => {
  it('counts files per tier', () => {
    expect(hotspotSummary(hotspotPoints(report))).toEqual({
      tiers: [5, 2, 2, 1],
      total: 10,
    });
  });
});
