import { describe, expect, it } from 'vitest';

import { fixRateReport, rated } from '../test/fixRateReport';
import reportJson from '../test/fixtures/report.small.json';
import { ownershipReport } from '../test/ownershipReport';
import { computeOutlierBadges, outlierGrades, RULES } from './badges';
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

/** The ownership fixture with exactly these packages' top contributors quiet. */
const quietOwners = (dirs: string[]) => {
  const own = ownershipReport().ownership;
  return {
    ...own,
    packages: own.packages.map((p) => ({
      ...p,
      topQuiet: dirs.includes(p.package),
    })),
  };
};

/** `n` critical hotspots among 100 rated files. */
const criticalHotspots = (n: number) =>
  report({
    hotspots: {
      ...base.hotspots,
      files: items(100, (i) => ({ category: i < n ? 'critical' : 'low' })),
    },
  });

const fires = (r: GitrelicReport, preset: string) =>
  computeOutlierBadges(r).get(preset)?.count ?? null;

/** Off-hours by package: `above` of `tested` packages above chance. */
const offHoursWith = (above: number, tested: number) => ({
  commits: 0,
  offHours: 0,
  rate: 0.1,
  minCommits: 10,
  packages: items(tested, (i) => ({
    package: `p${i}`,
    commits: 10,
    offHours: 1,
    percent: 10,
    allowed: 3,
    aboveChance: i < above,
  })),
});

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
      // One dormant package is enough: it asks for a decision.
      'age-map',
      { ageMap: { ...base.ageMap, dormantPackages: [] } },
      {
        ageMap: {
          ...base.ageMap,
          dormantPackages: [
            { package: 'packages/old', sourceFiles: 9, newestAgeDays: 1248 },
          ],
        },
      },
      1,
    ],
    [
      // At a 1.2% repo rate: one fix in 8 is chance, three is not.
      'fix-rate',
      { fixRate: fixRateReport([rated('a.ts', 8, 1)]).fixRate },
      {
        fixRate: fixRateReport([rated('a.ts', 8, 1), rated('b.ts', 8, 3)])
          .fixRate,
      },
      1,
    ],
    [
      // One package whose top contributor went quiet fires it.
      'bus-factor',
      { ownership: quietOwners([]) },
      { ownership: quietOwners(['packages/server']) },
      1,
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
          offHours: offHoursWith(2, 21),
        },
      },
      {
        commitTiming: {
          ...base.commitTiming,
          offHours: offHoursWith(2, 20),
        },
      },
      2,
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
      'age-map',
      'bus-factor',
      'commit-timing',
      'cursed-files',
      'fix-rate',
      'hotspots',
      'parallel-dev',
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
          testCoverage: {
            ...base.testCoverage,
            directories: [],
            uncoveredDirectories: items(3, (i) => `d${i}`),
          },
        }),
        'test-coverage',
      ),
    ).toBeNull();
  });

  it('explains each badge in words', () => {
    const badge = computeOutlierBadges(criticalHotspots(25)).get('hotspots');
    expect(badge?.reason).toBe(
      '25 critical hotspots (25% of tracked files that changed)',
    );
  });

  it('never badges Stale Files: its count measures the window, not decay', () => {
    const r = report({ deadCode: { ...base.deadCode, totalDeadFiles: 66 } });
    expect(fires(r, 'dead-code')).toBeNull();
    expect(outlierGrades(r).has('dead-code')).toBe(false);
  });

  it('stays quiet on a small healthy repo', () => {
    // The sample-repo fixture: 10 files, nothing alarming beyond its size.
    expect([...computeOutlierBadges(base).keys()]).not.toContain('hotspots');
  });
});

describe('outlierGrades', () => {
  // Hotspots badges at 5% of rated files, with at least 3.

  it.each([
    [0, 0],
    [2, 0],
    [3, 1],
    [5, 2],
    [9, 2],
    [10, 3],
  ])('a share rule: %i of 100 grades %i', (n, grade) => {
    expect(outlierGrades(criticalHotspots(n)).get('hotspots')?.grade).toBe(
      grade,
    );
  });

  it('an absolute rule grades by count against its minimum', () => {
    const cursed = (n: number) =>
      outlierGrades(
        report({
          cursedFiles: {
            ...base.cursedFiles,
            files: items(n, () => ({ curseScore: 55 })),
          },
        }),
      ).get('cursed-files')?.grade;
    expect(cursed(0)).toBe(0);
    expect(cursed(1)).toBe(2);
    expect(cursed(5)).toBe(3);
  });

  it('agrees with the badges: grade 2 and up is exactly a badge', () => {
    for (const n of [0, 3, 5, 12]) {
      const r = criticalHotspots(n);
      const graded = (outlierGrades(r).get('hotspots')?.grade ?? 0) >= 2;
      expect(computeOutlierBadges(r).has('hotspots')).toBe(graded);
    }
  });
});
