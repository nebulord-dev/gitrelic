import { describe, expect, it } from 'vitest';

import reportJson from '../../test/fixtures/report.small.json';
import { ADVICE_LIMIT, whatToDo } from './whatToDo';
import type { GitrelicReport } from '@gitrelic/core';

const report = reportJson as unknown as GitrelicReport;
const idsOf = (file: string, r: GitrelicReport = report) =>
  whatToDo(file, r).map((a) => a.id);

describe('whatToDo', () => {
  it('gives at most three actions, most important first', () => {
    // src/helpers.ts: critical hotspot with one dominant author, shame 100,
    // coupled to index.ts, and untested once src/ loses its __tests__ —
    // four rules, three shown.
    const advice = whatToDo('src/helpers.ts', report);
    expect(advice).toHaveLength(ADVICE_LIMIT);
    expect(advice.map((a) => a.id)).toEqual([
      'pair',
      'read-log',
      'change-together',
    ]);
    expect(advice[0]).toMatchObject({
      action: 'Pair on it, or split it, before only one person can change it.',
      evidence: expect.stringMatching(/^7 commits; \S.* wrote \d+%\.$/),
      section: 'people',
    });
    expect(advice[1].why).toMatch(/contract is wrong/);
    expect(advice[1].section).toBe('activity');
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
      forensics: { ...report.forensics, files: [] },
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
      forensics: { ...report.forensics, files: [] },
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
});
