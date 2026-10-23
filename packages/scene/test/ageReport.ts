// The sample repo with an Age it is too young to have: a dormant package,
// orphaned files, a woken file, a test and a fixture. The fixture's own files
// are all fresh, so Age's tests build their input here.

import reportJson from './fixtures/report.small.json';
import type { FileAge, GitrelicReport } from '@gitrelic/core';

const base = reportJson as unknown as GitrelicReport;

type Spec = [
  file: string,
  age: number,
  lines: number,
  extra?: Partial<FileAge>,
];

const SPECS: Spec[] = [
  ['src/legacy.ts', 1600, 50],
  [
    'packages/old/a.ts',
    1250,
    100,
    { orphaned: true, orphanedAuthors: ['Bob'] },
  ],
  [
    'packages/old/b.ts',
    1250,
    100,
    { orphaned: true, orphanedAuthors: ['Bob'] },
  ],
  ['packages/old/c.ts', 1250, 100],
  ['packages/old/d.ts', 1250, 100],
  ['packages/old/e.ts', 1250, 100],
  ['README.md', 900, 30],
  [
    'scripts/release.js',
    800,
    400,
    { orphaned: true, orphanedAuthors: ['Bob', 'Cy'] },
  ],
  ['src/core.test.ts', 400, 200],
  ['src/flags.ts', 30, 20, { wokeAfterDays: 3000 }],
  ['scripts/build.js', 20, 1000],
  ['src/core.ts', 5, 3000],
  ['fixtures/snap.txt', 2000, 10],
];

/** Source: 5,000 lines, 980 of them cold (19.6%), in 8 cold files. */
export function ageReport(
  overrides: Partial<GitrelicReport['ageMap']> = {},
): GitrelicReport {
  const files: FileAge[] = SPECS.map(([file, ageInDays, , extra]) => ({
    file,
    lastCommitDate: '2020-01-01T00:00:00Z',
    ageInDays,
    status: 'ancient',
    ...extra,
  }));
  return {
    ...base,
    fileClasses: {
      'src/core.test.ts': 'test',
      'fixtures/snap.txt': 'fixture',
    },
    loc: {
      ...base.loc,
      files: SPECS.map(([file, , lines]) => ({
        file,
        lines,
        language: 'TypeScript',
      })),
    },
    ageMap: {
      ...base.ageMap,
      files,
      source: 'history',
      dormantPackages: [
        { package: 'packages/old', sourceFiles: 5, newestAgeDays: 1250 },
      ],
      ...overrides,
    },
  };
}
