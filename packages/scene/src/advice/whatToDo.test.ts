import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { ADVICE_LIMIT, whatToDo } from './whatToDo';
import type { GitrelicReport } from '@gitrelic/core';

const fixture = reportJson as unknown as GitrelicReport;
// The fixture's repo is too small to rate a file: give helpers.ts a fix rate
// chance can't explain (3 of 8 at 1.2%).
const report: GitrelicReport = {
  ...fixture,
  fixRate: {
    ...fixture.fixRate,
    rate: 0.0121,
    windowDays: 30,
    minChanges: 8,
    files: [
      {
        file: 'src/helpers.ts',
        changes: 8,
        fixedAfter: 3,
        rate: 3 / 8,
        fixes: [],
      },
    ],
  },
};
const idsOf = (file: string, r: GitrelicReport = report) =>
  whatToDo(file, r).map((a) => a.id);

describe('whatToDo', () => {
  it('gives at most three actions, most important first', () => {
    // src/helpers.ts: critical hotspot with one dominant author, fixed more
    // often than chance, coupled to index.ts, and untested once src/ loses
    // its __tests__ — four rules, three shown.
    const advice = whatToDo('src/helpers.ts', report);
    expect(advice).toHaveLength(ADVICE_LIMIT);
    expect(advice.map((a) => a.id)).toEqual([
      'pair',
      'review-changes',
      'change-together',
    ]);
    expect(advice[0]).toMatchObject({
      action: 'Pair on it, or split it, before only one person can change it.',
      evidence: expect.stringMatching(/^7 commits; \S.* wrote \d+%\.$/),
      section: 'people',
    });
    expect(advice[1]).toMatchObject({
      action: 'Review its changes closely.',
      evidence: '3 of 8 changes needed a fix within 30 days; 1.2% repo-wide.',
      section: 'activity',
    });
  });

  it('says nothing about a generated file, however hot', () => {
    expect(idsOf('src/helpers.ts')).not.toEqual([]);
    const generated: GitrelicReport = {
      ...report,
      fileClasses: { ...report.fileClasses, 'src/helpers.ts': 'generated' },
    };
    expect(whatToDo('src/helpers.ts', generated)).toEqual([]);
  });

  it('says nothing about a file no rule fits', () => {
    expect(whatToDo('nope.ts', report)).toEqual([]);
  });

  it('asks for a new owner when the main author left, instead of pairing', () => {
    const ghosted: GitrelicReport = {
      ...report,
      ghostFiles: {
        ...report.ghostFiles,
        files: [
          {
            file: 'src/api.ts',
            dominantAuthor: report.contributors.contributors[0].email,
            dominantAuthorPercent: 80,
            lastAuthorCommitDate: '2025-01-01T00:00:00Z',
            authorInactiveDays: 400,
            loc: 50,
          },
        ],
      },
    };
    const advice = whatToDo('src/api.ts', ghosted);
    expect(advice[0]).toMatchObject({
      id: 'new-owner',
      evidence: `${report.contributors.contributors[0].name} wrote 80% and hasn't committed in 400 days.`,
    });
    expect(advice.map((a) => a.id)).not.toContain('pair');
  });

  it('tells a large, accelerating file to split', () => {
    const big: GitrelicReport = {
      ...report,
      loc: {
        ...report.loc,
        files: report.loc.files.map((f) =>
          f.file === 'src/api.ts' ? { ...f, lines: 1500 } : f,
        ),
      },
      churnVelocity: {
        ...report.churnVelocity,
        files: report.churnVelocity.files.map((f) =>
          f.file === 'src/api.ts'
            ? {
                ...f,
                trend: 'accelerating' as const,
                recentCommits: 4,
                totalCommits: 5,
              }
            : f,
        ),
      },
    };
    expect(whatToDo('src/api.ts', big)).toContainEqual(
      expect.objectContaining({
        id: 'split',
        evidence: '1,500 lines; 4 of 5 commits in the recent half.',
      }),
    );
  });

  it('asks for tests only on hot source files in folders without any', () => {
    // src/ has a __tests__ folder, so nothing there is told to add tests.
    expect(idsOf('src/helpers.ts')).not.toContain('add-tests');
    const bare: GitrelicReport = {
      ...report,
      testCoverage: {
        ...report.testCoverage,
        directories: report.testCoverage.directories.filter(
          (d) => d.directory !== 'src/__tests__',
        ),
      },
      // Quiet the higher rules so add-tests makes the top three.
      fixRate: fixture.fixRate,
    };
    expect(whatToDo('src/helpers.ts', bare)).toContainEqual(
      expect.objectContaining({
        id: 'add-tests',
        evidence: 'No tests in its folder, and it changed in 7 commits.',
      }),
    );
    // api.ts has a test beside it; config.ts is only moderate.
    expect(idsOf('src/api.ts', bare)).not.toContain('add-tests');
    expect(idsOf('src/config.ts', bare)).not.toContain('add-tests');
    // A test or fixture file is never told to get tests.
    const asTest: GitrelicReport = {
      ...bare,
      fileClasses: { ...report.fileClasses, 'src/helpers.ts': 'test' },
    };
    expect(idsOf('src/helpers.ts', asTest)).not.toContain('add-tests');
  });

  it('names a tightly coupled partner', () => {
    // Without the higher rules, helpers.ts's partner (3 shared, 60%) shows.
    const calm: GitrelicReport = {
      ...report,
      busFactors: { ...report.busFactors, files: [] },
      fixRate: fixture.fixRate,
      testCoverage: { ...report.testCoverage, files: [] },
    };
    expect(whatToDo('src/helpers.ts', calm)).toEqual([
      {
        id: 'change-together',
        action: 'Change it with index.ts open.',
        evidence: 'index.ts moved with it in 3 commits.',
        section: 'changes-with',
      },
    ]);
  });

  it('flags code that does not stick', () => {
    const churned: GitrelicReport = {
      ...report,
      rewriteRatio: {
        ...report.rewriteRatio,
        files: report.rewriteRatio.files.map((f) =>
          f.file === 'src/types.ts'
            ? {
                ...f,
                rewriteScore: 85,
                totalDeletions: 900,
                totalInsertions: 1000,
              }
            : f,
        ),
      },
    };
    expect(whatToDo('src/types.ts', churned)).toContainEqual(
      expect.objectContaining({
        id: 'settle-design',
        evidence: '900 lines deleted for 1,000 added.',
      }),
    );
  });

  it('finds a strong partner behind a busier, weaker one', () => {
    const pair = (
      fileB: string,
      coCommits: number,
      couplingStrength: number,
    ) => ({
      fileA: 'src/types.ts',
      fileB,
      coCommits,
      totalCommitsA: 12,
      totalCommitsB: 7,
      couplingStrength,
    });
    const coupled: GitrelicReport = {
      ...report,
      coupling: {
        ...report.coupling,
        pairs: [pair('src/a.ts', 10, 20), pair('src/b.ts', 6, 90)],
      },
    };
    expect(whatToDo('src/types.ts', coupled)).toContainEqual(
      expect.objectContaining({
        id: 'change-together',
        action: 'Change it with b.ts open.',
      }),
    );
  });

  it('counts a top-level __tests__ folder for a root file', () => {
    // A hot root file; core names the top-level test folder plain '__tests__'.
    const rooted = (directory: string): GitrelicReport => ({
      ...report,
      hotspots: {
        ...report.hotspots,
        files: [
          ...report.hotspots.files,
          {
            file: 'main.ts',
            hotspotScore: 90,
            churnScore: 90,
            loc: 40,
            category: 'critical',
          },
        ],
      },
      testCoverage: {
        ...report.testCoverage,
        files: [{ file: 'main.ts', hasTestSibling: false }],
        directories: [
          {
            directory,
            sourceFiles: 0,
            testFiles: 1,
            coverageRatio: 0,
            hasTests: true,
          },
        ],
      },
    });
    expect(idsOf('main.ts', rooted('__tests__'))).not.toContain('add-tests');
    expect(idsOf('main.ts', rooted('elsewhere/__tests__'))).toContain(
      'add-tests',
    );
  });

  it('asks for a review only when chance can’t explain its fixes', () => {
    const withRate = (changes: number, fixedAfter: number): GitrelicReport => ({
      ...report,
      fixRate: {
        ...report.fixRate,
        files: [
          {
            file: 'src/api.ts',
            changes,
            fixedAfter,
            rate: fixedAfter / changes,
            fixes: [],
          },
        ],
      },
    });
    // One fix in 25 is chance at 1.2%; three in 8 isn't.
    expect(idsOf('src/api.ts', withRate(25, 1))).not.toContain(
      'review-changes',
    );
    expect(idsOf('src/api.ts', withRate(8, 3))).toContain('review-changes');
  });
});
