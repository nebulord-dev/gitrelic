import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { fixesReport } from '../../test/riskFixesReport';
import { reactShaped } from '../../test/rootCausesReport';
import { CATALOG } from '../catalog';
import {
  riskFindings,
  riskTable,
  riskView,
  rootCausesLayout,
  stacksLayout,
} from './risk';
import type { CursedFile, GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const input = { report, commits: null };

const text = (segments: readonly (string | { text: string })[]) =>
  segments.map((s) => (typeof s === 'string' ? s : s.text)).join('');

const file = (
  path: string,
  score: number,
  kinds: [CursedFile['breakdown'][number]['kind'], number][],
): CursedFile => ({
  file: path,
  curseScore: score,
  reasons: kinds.map(([k]) => k),
  breakdown: kinds.map(([kind, points]) => ({ kind, label: kind, points })),
  churn: 10,
  authors: 2,
  ageDays: 10,
  narrative: '',
});

function withCursed(
  files: CursedFile[],
  nearMisses: CursedFile[] = [],
): GitrelicReport {
  return {
    ...report,
    cursedFiles: { ...report.cursedFiles, files, nearMisses },
  };
}

describe('riskView', () => {
  it('is the cursed-files lens, named Risk, with score stacks', () => {
    expect(riskView.id).toBe('cursed-files');
    expect(CATALOG.find((e) => e.id === 'cursed-files')).toMatchObject({
      label: 'Risk',
      group: 'code-health',
      atlas: true,
    });
    expect(riskView.layouts[0]).toBe(stacksLayout);
    expect(stacksLayout.caption).toBeTruthy();
    expect(stacksLayout.needsCommits).toBe(false);
  });

  it('has Root causes as its one alternate form', () => {
    expect(riskView.layouts).toEqual([stacksLayout, rootCausesLayout]);
    expect(rootCausesLayout.id).toBe('root-causes');
    expect(rootCausesLayout.caption).toBeTruthy();
    expect(rootCausesLayout.needsCommits).toBe(false);
  });
});

describe('riskFindings', () => {
  it('names the reasons the whole cursed set shares', () => {
    // The fixture has one cursed file: three that share churn, ownership and
    // fix commits.
    const [shared] = riskFindings({ report: fixesReport(), commits: null });
    expect(shared.id).toBe('shared');
    expect(text(shared.segments)).toBe(
      'All 3 cursed files score on churn, ownership and fix commits.',
    );
  });

  it('names the near misses and what the closest is short of', () => {
    const near = riskFindings(input).find((f) => f.id === 'near')!;
    expect(text(near.segments)).toBe(
      '4 files just miss the line at 50: index.ts, api.ts and 2 more. The closest scores on churn and ownership, 5 points short.',
    );
    expect(near.segments).toContainEqual({
      ref: 'file:src/index.ts',
      text: 'index.ts',
    });
  });

  it('names top hotspots just under the line', () => {
    const hot = riskFindings(input).find((f) => f.id === 'hotspots')!;
    expect(text(hot.segments)).toBe(
      'index.ts and api.ts are top hotspots just under the line: their size isn’t in this score.',
    );
  });

  it('names the worst file when the cursed set shares nothing', () => {
    const r = withCursed([
      file('a.ts', 55, [
        ['churn', 35],
        ['fixes', 20],
      ]),
      file('b.ts', 50, [
        ['ownership', 30],
        ['parallel', 20],
      ]),
    ]);
    const [first] = riskFindings({ report: r, commits: null });
    expect(text(first.segments)).toBe(
      '2 cursed files; the worst is a.ts at 55.',
    );
  });

  it('names the hub upstream of the most risky files, a family counted in full', () => {
    const hub = riskFindings({ report: reactShaped(), commits: null }).find(
      (f) => f.id === 'hub',
    )!;
    expect(text(hub.segments)).toBe(
      'ReactTypes.js changes with 8 risky files: ReactFeatureFlags.* (7) and ReactFizzServer.js. No other source file reaches as many.',
    );
    expect(hub.segments[0]).toEqual({
      ref: 'file:shared/ReactTypes.js',
      text: 'ReactTypes.js',
    });
    expect(hub.segments).toContainEqual({
      ref: 'file:shared/ReactFeatureFlags.js',
      text: 'ReactFeatureFlags.* (7)',
    });
  });

  it('names no hub when none reaches two risky nodes', () => {
    expect(riskFindings(input).some((f) => f.id === 'hub')).toBe(false);
  });

  it('says nothing when no file scores 40 or more', () => {
    expect(riskFindings({ report: withCursed([]), commits: null })).toEqual([]);
  });
});

describe('riskTable', () => {
  const table = riskTable(input);

  it('lists cursed files and near misses, highest score first', () => {
    expect(table.rows.map((r) => r.id)).toEqual([
      'file:src/helpers.ts',
      'file:src/index.ts',
      'file:src/api.ts',
      'file:src/config.ts',
      'file:src/auth.ts',
    ]);
    expect(table.sort).toEqual({ column: 'score', descending: true });
  });

  it('gives each reason its points, the hotspot and the status', () => {
    // A report where fix rate rates helpers.ts, so the fixes column has points.
    const fixes = riskTable({ report: fixesReport(), commits: null });
    expect(fixes.rows[0].cells).toEqual({
      file: 'src/helpers.ts',
      score: 85,
      churn: 35,
      owners: 30,
      abandoned: 0,
      fixes: 20,
      parallel: 0,
      hotspot: 100,
      status: 'cursed',
    });
    expect(fixes.rows[3].cells.status).toBe('near miss (5 short)');
    expect(fixes.rows[0].tier).toBe(3);
    expect(fixes.rows[3].tier).toBe(1);
  });

  it('counts many authors under owners', () => {
    const t = riskTable({
      report: withCursed([
        file('a.ts', 55, [
          ['churn', 35],
          ['authors', 10],
          ['parallel', 10],
        ]),
      ]),
      commits: null,
    });
    expect(t.rows[0].cells.owners).toBe(10);
    expect(t.rows[0].tier).toBe(2);
    // The header names both branches, since one column holds either.
    expect(t.columns.find((c) => c.id === 'owners')?.label).toBe(
      'Ownership / authors',
    );
  });
});
