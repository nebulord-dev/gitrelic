import { describe, expect, it } from 'vitest';

import reportJson from '../test/fixtures/report.small.json';
import { computeOutlierBadges, RULES } from './badges';
import { CATALOG } from './catalog';
import type { GitrelicReport } from '@gitrelic/core';

const base = reportJson as unknown as GitrelicReport;

/** The fixture with some sections replaced; 100 files unless overridden. */
function report(patch: Record<string, unknown>): GitrelicReport {
  return {
    ...base,
    meta: { ...base.meta, totalFiles: 100 },
    ...patch,
  } as GitrelicReport;
}

const items = <T>(n: number, make: (i: number) => T): T[] =>
  Array.from({ length: n }, (_, i) => make(i));

const fires = (r: GitrelicReport, preset: string) =>
  computeOutlierBadges(r).get(preset)?.count ?? null;

describe('computeOutlierBadges', () => {
  it.each([
    // [preset, patch that sits just under the threshold, patch just over, expected count]
    [
      'hotspots',
      {
        hotspots: {
          ...base.hotspots,
          files: [
            ...items(2, () => ({ category: 'critical' })),
            ...items(98, () => ({ category: 'low' })),
          ],
        },
      },
      {
        hotspots: {
          ...base.hotspots,
          files: [
            ...items(5, () => ({ category: 'critical' })),
            ...items(95, () => ({ category: 'low' })),
          ],
        },
      },
      5,
    ],
    [
      'cursed-files',
      { cursedFiles: { ...base.cursedFiles, files: [{ curseScore: 49 }] } },
      {
        cursedFiles: {
          ...base.cursedFiles,
          files: [{ curseScore: 49 }, { curseScore: 50 }],
        },
      },
      1,
    ],
    [
      'dead-code',
      { deadCode: { ...base.deadCode, totalDeadFiles: 9 } },
      { deadCode: { ...base.deadCode, totalDeadFiles: 10 } },
      10,
    ],
    [
      'shame',
      { forensics: { ...base.forensics, files: [{ shameScore: 69 }] } },
      { forensics: { ...base.forensics, files: [{ shameScore: 70 }] } },
      1,
    ],
    [
      'bus-factor',
      {
        busFactors: {
          ...base.busFactors,
          files: items(8, () => ({})),
          criticalFiles: items(1, () => ({})),
        },
      },
      {
        busFactors: {
          ...base.busFactors,
          files: items(8, () => ({})),
          criticalFiles: items(2, () => ({})),
        },
      },
      2,
    ],
    [
      'knowledge-silos',
      {
        knowledgeConcentration: {
          ...base.knowledgeConcentration,
          singleAuthorFiles: 59,
          totalFiles: 100,
        },
      },
      {
        knowledgeConcentration: {
          ...base.knowledgeConcentration,
          singleAuthorFiles: 60,
          totalFiles: 100,
        },
      },
      60,
    ],
    [
      'ghost-files',
      { ghostFiles: { ...base.ghostFiles, totalGhostFiles: 4 } },
      { ghostFiles: { ...base.ghostFiles, totalGhostFiles: 5 } },
      5,
    ],
    [
      'parallel-dev',
      { parallelDev: { ...base.parallelDev, highParallel: 1 } },
      { parallelDev: { ...base.parallelDev, highParallel: 2 } },
      2,
    ],
    [
      'commit-timing',
      {
        commitTiming: {
          ...base.commitTiming,
          highStress: 1,
          files: items(21, () => ({})),
        },
      },
      {
        commitTiming: {
          ...base.commitTiming,
          highStress: 1,
          files: items(20, () => ({})),
        },
      },
      1,
    ],
    [
      'test-coverage',
      {
        testCoverage: {
          ...base.testCoverage,
          directories: items(4, () => ({})),
          uncoveredDirectories: items(1, () => ({})),
        },
      },
      {
        testCoverage: {
          ...base.testCoverage,
          directories: items(4, () => ({})),
          uncoveredDirectories: items(2, () => ({})),
        },
      },
      2,
    ],
  ])(
    '%s: quiet below the threshold, fires at it',
    (preset, under, over, count) => {
      expect(fires(report(under), preset)).toBeNull();
      expect(fires(report(over), preset)).toBe(count);
    },
  );

  it('has a test row for every rule', () => {
    expect(RULES.map((r) => r.preset).sort()).toEqual([
      'bus-factor',
      'commit-timing',
      'cursed-files',
      'dead-code',
      'ghost-files',
      'hotspots',
      'knowledge-silos',
      'parallel-dev',
      'shame',
      'test-coverage',
    ]);
  });

  it('only badges presets that exist', () => {
    const ids = new Set(CATALOG.map((e) => e.id));
    for (const rule of RULES) expect(ids.has(rule.preset)).toBe(true);
  });

  it('never badges against an empty population', () => {
    expect(
      fires(
        report({
          meta: { ...base.meta, totalFiles: 0 },
          ghostFiles: { ...base.ghostFiles, totalGhostFiles: 3 },
        }),
        'ghost-files',
      ),
    ).toBeNull();
  });

  it('explains each badge in words', () => {
    const badge = computeOutlierBadges(
      report({ deadCode: { ...base.deadCode, totalDeadFiles: 25 } }),
    ).get('dead-code');
    expect(badge?.reason).toBe('25% of files untouched in the window');
  });

  it('stays quiet on a small healthy repo', () => {
    // The sample-repo fixture: 10 files, nothing alarming beyond its size.
    expect([...computeOutlierBadges(base).keys()]).not.toContain('hotspots');
  });
});
