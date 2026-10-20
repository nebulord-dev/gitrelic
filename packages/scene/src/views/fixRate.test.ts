import { describe, expect, it } from 'vitest';

import {
  BUILD_HIR,
  fixRateReport,
  PIPELINE,
  rated,
  RUNNER,
} from '../../test/fixRateReport';
import { buildEntityIndex } from '../entities';
import { ids } from '../ids';
import { lensReadings } from '../overview/readings';
import { lensTopEntities } from '../overview/topEntities';
import { fixRateFindings, fixRateTable, fixRateView } from './fixRate';

const input = (report = fixRateReport()) => ({ report, commits: null });

describe('fixRateFindings', () => {
  it('names the files above chance and the repo rate', () => {
    const [finding] = fixRateFindings(input());
    expect(finding.tone).toBe('warning');
    expect(
      finding.segments
        .map((s) => (typeof s === 'string' ? s : s.text))
        .join(''),
    ).toBe(
      '3 files are fixed more often than chance: runner.ts (3 of 8), Pipeline.ts (4 of 18) and BuildHIR.ts (2 of 11). Repo-wide, 1.2% of changes needed a fix within 30 days.',
    );
    expect(finding.segments).toContainEqual({
      ref: ids.file(RUNNER),
      text: 'runner.ts',
    });
  });

  it('counts the rest past three', () => {
    const report = fixRateReport([
      rated('a.ts', 8, 3),
      rated('b.ts', 8, 3),
      rated('c.ts', 8, 3),
      rated('d.ts', 8, 3),
    ]);
    const text = fixRateFindings(input(report))[0]
      .segments.map((s) => (typeof s === 'string' ? s : s.text))
      .join('');
    expect(text).toMatch(
      /^4 files .*a\.ts \(3 of 8\), b\.ts \(3 of 8\), c\.ts \(3 of 8\) and 1 more\. Repo-wide/,
    );
  });

  it('says so when no file is above chance', () => {
    const [finding] = fixRateFindings(
      input(fixRateReport([rated('a.ts', 25, 1)])),
    );
    expect(finding).toEqual({
      id: 'above',
      tone: 'neutral',
      segments: [
        'No file is fixed more often than chance. Repo-wide, 1.2% of changes needed a fix within 30 days.',
      ],
    });
  });

  it('asks for a re-run on a report from before fix rate', () => {
    const old = fixRateReport([], { windowDays: 0, minChanges: 0, rate: null });
    expect(fixRateFindings(input(old))[0].segments).toEqual([
      'This report predates fix rate; re-run gitrelic.',
    ]);
  });
});

describe('fixRateTable', () => {
  it('lists every rated file, above chance first, tiered', () => {
    const table = fixRateTable(input());
    expect(table.rows.slice(0, 3).map((r) => r.id)).toEqual(
      [RUNNER, PIPELINE, BUILD_HIR].map(ids.file),
    );
    expect(table.rows[0]).toMatchObject({
      tier: 3,
      cells: {
        file: RUNNER,
        changes: 8,
        fixed: 3,
        rate: 37.5,
        chance: 'yes',
        latest: '[compiler][snap] Fixes to relative path resolution',
      },
    });
    expect(table.rows).toHaveLength(9);
    expect(table.tierNames).toEqual([
      'No fix',
      'One fix',
      'Several fixes',
      'Above chance',
    ]);
  });
});

describe('fix rate on the Overview', () => {
  const report = fixRateReport();

  it('reads as the count above chance', () => {
    const reading = lensReadings(report).find((r) => r.preset === 'fix-rate')!;
    expect(reading.value).toBe('3 above chance');
    expect(reading.grade).toBeGreaterThan(0);
    const old = fixRateReport([], { windowDays: 0, minChanges: 0, rate: null });
    expect(lensReadings(old).find((r) => r.preset === 'fix-rate')!.value).toBe(
      '—',
    );
  });

  it('fans the files with a fix, above chance first', () => {
    // The index only knows files the report's other analyzers name: index
    // the synthetic files by giving churn a row each.
    const withChurn = {
      ...report,
      churn: {
        ...report.churn,
        files: report.fixRate.files.map((f) => ({
          file: f.file,
          commitCount: f.changes,
          churnScore: 50,
          category: 'warm' as const,
        })),
      },
    };
    const index = buildEntityIndex(withChurn);
    const fanned = lensTopEntities('fix-rate', withChurn, index, 5);
    expect(fanned.map((e) => e.id)).toEqual(
      [RUNNER, PIPELINE, BUILD_HIR]
        .map(ids.file)
        .concat(fanned.slice(3).map((e) => e.id)),
    );
    expect(fanned[0].value).toBe('3 of 8 fixed');
    expect(fanned).toHaveLength(5);
  });
});

describe('fixRateView', () => {
  it('has one layout, re-forming around a selected file, with commits', () => {
    expect(fixRateView.layouts.map((l) => l.id)).toEqual(['funnel']);
    expect(fixRateView.layouts[0].focusKinds).toEqual(['file']);
    expect(fixRateView.layouts[0].needsCommits).toBe(true);
  });
});
