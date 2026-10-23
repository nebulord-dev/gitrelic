import { describe, expect, it } from 'vitest';

import { ageReport } from '../../test/ageReport';
import reportJson from '../../test/fixtures/report.small.json';
import { CATALOG } from '../catalog';
import { buildEntityIndex } from '../entities';
import { lensTopEntities } from './topEntities';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const index = buildEntityIndex(report);

describe('lensTopEntities', () => {
  it("ranks a lens's entities, each one the index resolves", () => {
    const hot = lensTopEntities('hotspots', report, index);
    expect(hot.length).toBeGreaterThan(0);
    for (const e of hot) expect(index.get(e.id)).toBeDefined();
    const scores = hot.map((e) => Number(e.value.replace('score ', '')));
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('fans people for people lenses', () => {
    const people = lensTopEntities('contributors', report, index);
    expect(people[0].id.startsWith('person:')).toBe(true);
  });

  it('respects the limit and never repeats an entity', () => {
    const files = lensTopEntities('hotspots', report, index, 3);
    expect(files).toHaveLength(3);
    expect(new Set(files.map((f) => f.id)).size).toBe(3);
  });

  it('fans Commit Timing’s packages, above chance first, leaving out the root', () => {
    const withOffHours = {
      ...report,
      commitTiming: {
        ...report.commitTiming,
        offHours: {
          commits: 100,
          offHours: 12,
          rate: 0.12,
          minCommits: 10,
          packages: [
            {
              package: 'packages/server',
              commits: 40,
              offHours: 12,
              percent: 30,
              allowed: 8,
              aboveChance: true,
            },
            {
              package: '',
              commits: 20,
              offHours: 2,
              percent: 10,
              allowed: 5,
              aboveChance: false,
            },
            {
              package: 'src',
              commits: 30,
              offHours: 3,
              percent: 10,
              allowed: 7,
              aboveChance: false,
            },
          ],
        },
      },
      loc: {
        ...report.loc,
        files: [
          { file: 'packages/server/a.ts', lines: 1, language: 'TypeScript' },
          { file: 'src/b.ts', lines: 1, language: 'TypeScript' },
        ],
      },
    } as GitrelicReport;
    const top = lensTopEntities(
      'commit-timing',
      withOffHours,
      buildEntityIndex(withOffHours),
    );
    expect(top.map((e) => [e.id, e.value])).toEqual([
      ['dir:packages/server', '30% off-hours'],
      ['dir:src', '10% off-hours'],
    ]);
  });

  it('returns nothing for lenses without entities, or unknown ones', () => {
    expect(lensTopEntities('languages', report, index)).toEqual([]);
    expect(lensTopEntities('nope', report, index)).toEqual([]);
  });

  it('drops ids the index does not know', () => {
    const withStranger = {
      ...report,
      churn: {
        ...report.churn,
        topFiles: [
          { file: 'not/in/the/repo.ts', commitCount: 999 },
          ...report.churn.topFiles,
        ],
      },
    } as GitrelicReport;
    const fanned = lensTopEntities('churn', withStranger, index);
    expect(fanned.some((e) => e.id === 'file:not/in/the/repo.ts')).toBe(false);
  });

  it('every lens outside Overview has a source (Languages by design empty)', () => {
    for (const e of CATALOG.filter((c) => c.group !== 'overview')) {
      const fanned = lensTopEntities(e.id, report, index);
      expect(Array.isArray(fanned)).toBe(true);
    }
  });

  it('labels directories by their last two segments', () => {
    const r = {
      ...report,
      testCoverage: {
        ...report.testCoverage,
        uncoveredDirectories: [
          {
            directory: 'src',
            sourceFiles: 7,
            testFiles: 0,
            coverageRatio: 0,
            hasTests: false,
          },
        ],
      },
    } as GitrelicReport;
    const [dir] = lensTopEntities('test-coverage', r, index);
    expect(dir).toMatchObject({ id: 'dir:src', label: 'src/' });
  });

  it('prepends the folder when two fanned files share a name', () => {
    const twins = {
      ...report,
      churn: {
        ...report.churn,
        topFiles: [
          { file: 'src/api.ts', commitCount: 9 },
          { file: 'src/__tests__/api.ts', commitCount: 8 },
        ],
      },
    } as GitrelicReport;
    const idx = buildEntityIndex({
      ...twins,
      loc: {
        ...twins.loc,
        files: [
          ...twins.loc.files,
          { file: 'src/__tests__/api.ts', lines: 5, language: 'TypeScript' },
        ],
      },
    } as GitrelicReport);
    const labels = lensTopEntities('churn', twins, idx).map((e) => e.label);
    expect(labels).toEqual(['src/api.ts', '__tests__/api.ts']);
  });

  it('reads Rewrite Ratio as deletions per insertion, whichever is larger', () => {
    const rewrite = (totalInsertions: number, totalDeletions: number) =>
      lensTopEntities(
        'rewrite-ratio',
        {
          ...report,
          rewriteRatio: {
            ...report.rewriteRatio,
            topRewriters: [
              {
                file: 'src/api.ts',
                rewriteScore: 10,
                ratio: 0.1,
                totalInsertions,
                totalDeletions,
              },
            ],
          },
        } as GitrelicReport,
        index,
      )[0].value;
    // ratio is min/max (0.10 for both), but the files tell opposite stories.
    expect(rewrite(10, 100)).toBe('10.00 deleted per line added');
    expect(rewrite(100, 10)).toBe('0.10 deleted per line added');
    expect(rewrite(0, 5)).toBe('5 deleted, none added');
  });

  it('counts silos strictly over 80%, as core does', () => {
    const silos = (pct: number) =>
      lensTopEntities(
        'knowledge-silos',
        {
          ...report,
          busFactors: {
            ...report.busFactors,
            files: [
              { ...report.busFactors.files[0], dominantAuthorPercent: pct },
            ],
          },
        } as GitrelicReport,
        index,
      ).length;
    expect(silos(80)).toBe(0);
    expect(silos(81)).toBe(1);
  });

  it('tells two people with the same display name apart by email', () => {
    const base = report.contributors.contributors[0];
    const twins = {
      ...report,
      contributors: {
        ...report.contributors,
        contributors: [
          { ...base, name: 'Sam', email: 'sam@a.dev', commitCount: 9 },
          { ...base, name: 'Sam', email: 'sam@b.dev', commitCount: 8 },
        ],
      },
    } as GitrelicReport;
    const labels = lensTopEntities(
      'contributors',
      twins,
      buildEntityIndex(twins),
    ).map((e) => e.label);
    expect(labels).toEqual(['Sam (sam@a.dev)', 'Sam (sam@b.dev)']);
  });

  it('fans Age’s dormant packages first, then orphaned files, oldest first', () => {
    const aged = ageReport();
    const fanned = lensTopEntities('age-map', aged, buildEntityIndex(aged));
    expect(fanned.map((e) => [e.id, e.value])).toEqual([
      ['dir:packages/old', 'dormant 3.4 years'],
      ['file:packages/old/a.ts', 'orphaned, 3.4 years old'],
      ['file:packages/old/b.ts', 'orphaned, 3.4 years old'],
      ['file:scripts/release.js', 'orphaned, 2.2 years old'],
    ]);
  });
});
