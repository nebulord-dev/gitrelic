import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { fixesReport } from '../../test/riskFixesReport';
import { normalizeReport } from '../report/normalizeReport';
import {
  HOTSPOT_MARK,
  reasonList,
  riskStacks,
  riskStacksOf,
  riskTier,
  sharedReasons,
  signalText,
  stackRowTip,
  segmentTip,
} from './stacks';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;

describe('riskStacks', () => {
  it('lists cursed files first, then near misses, with the threshold', () => {
    const { rows, threshold } = riskStacks(report);
    expect(threshold).toBe(50);
    expect(rows.map((r) => [r.file, r.score, r.cursed])).toEqual([
      ['src/helpers.ts', 65, true],
      ['src/index.ts', 45, false],
      ['src/api.ts', 45, false],
      ['src/config.ts', 45, false],
      ['src/auth.ts', 45, false],
    ]);
  });

  it('carries core’s split and how far a near miss falls short', () => {
    // Fix rate rates no file in the fixture, so a report where it does.
    const { rows } = riskStacks(fixesReport());
    const helpers = rows[0];
    expect(helpers.breakdown.map((b) => [b.kind, b.points])).toEqual([
      ['churn', 35],
      ['ownership', 30],
      ['fixes', 20],
    ]);
    expect(helpers.sum).toBe(85);
    expect(helpers.short).toBe(0);
    expect(rows[3].short).toBe(5);
  });

  it('marks hotspots at HOTSPOT_MARK or more and accelerating churn', () => {
    const { rows } = riskStacks(report);
    const by = new Map(rows.map((r) => [r.file, r]));
    expect(by.get('src/helpers.ts')).toMatchObject({
      hotspot: 100,
      accelerating: true,
    });
    // 50 is in, 46 is out.
    expect(by.get('src/api.ts')!.hotspot).toBe(HOTSPOT_MARK);
    expect(by.get('src/config.ts')!.hotspot).toBeNull();
    expect(signalText(by.get('src/helpers.ts')!)).toBe(
      'hotspot 100 · accelerating',
    );
    expect(signalText(by.get('src/config.ts')!)).toBe('');
  });

  it('keeps the uncapped sum when the reasons pass 100', () => {
    const file = {
      ...report.cursedFiles.files[0],
      curseScore: 100,
      breakdown: [
        { kind: 'churn' as const, label: 'a', points: 35 },
        { kind: 'ownership' as const, label: 'b', points: 30 },
        { kind: 'abandoned' as const, label: 'c', points: 10 },
        { kind: 'fixes' as const, label: 'd', points: 20 },
        { kind: 'parallel' as const, label: 'e', points: 20 },
      ],
    };
    const [row] = riskStacks({
      ...report,
      cursedFiles: { ...report.cursedFiles, files: [file], nearMisses: [] },
    }).rows;
    expect(row.score).toBe(100);
    expect(row.sum).toBe(115);
    expect(stackRowTip(row, 'x')).toContain('115 before the cap at 100');
  });

  it('draws a report without the split from its score alone', () => {
    // normalizeReport backfills an empty breakdown on older reports.
    const { breakdown: _, ...old } = report.cursedFiles.files[0];
    const normalized = normalizeReport({
      ...report,
      cursedFiles: { files: [old], excludedBotFiles: [], summary: '' },
    } as never);
    const [row] = riskStacks(normalized).rows;
    expect(row.breakdown).toEqual([]);
    expect(row.sum).toBe(row.score);
    expect(stackRowTip(row, 'x')).toContain(
      'The split by reason isn’t in this report',
    );
  });

  it('tiers near misses, cursed files, and cursed files at 60+', () => {
    expect(riskTier({ cursed: false, score: 45 })).toBe(1);
    expect(riskTier({ cursed: true, score: 55 })).toBe(2);
    expect(riskTier({ cursed: true, score: 60 })).toBe(3);
  });

  it('is computed once per report', () => {
    expect(riskStacksOf(report)).toBe(riskStacksOf(report));
  });
});

describe('reasons in words', () => {
  it('finds the reasons every row shares, in scoring order', () => {
    // The fixture has one cursed file and no fixes: three that share all three.
    const cursed = riskStacks(fixesReport()).rows.filter((r) => r.cursed);
    expect(cursed).toHaveLength(3);
    expect(sharedReasons(cursed)).toEqual(['churn', 'ownership', 'fixes']);
    expect(sharedReasons([])).toEqual([]);
  });

  it('joins reason names into a list', () => {
    expect(reasonList(['churn'])).toBe('churn');
    expect(reasonList(['churn', 'authors'])).toBe('churn and many authors');
    expect(reasonList(['churn', 'ownership', 'fixes'])).toBe(
      'churn, ownership and fix commits',
    );
  });

  it('names a segment’s reason, points and measurement', () => {
    expect(
      segmentTip({
        kind: 'authors',
        label: '11 different authors',
        points: 10,
      }),
    ).toEqual(['Many authors · 10 pts', '11 different authors']);
  });

  it('a row’s tooltip has its score and each reason with its points', () => {
    const near = riskStacks(report).rows[1];
    expect(stackRowTip(near, 'index.ts')).toEqual([
      'index.ts',
      'Score 45 · 5 short of the line',
      'Churn · 15 pts',
      'Ownership · 30 pts',
      'Not in the score: hotspot 54',
    ]);
  });
});
