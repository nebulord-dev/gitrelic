// A synthetic report for Parallel Dev: the sample repo has no two people on
// one file in one week. Four people: ann and bob collide most (three weeks,
// on flags), bob and cy twice, cy and dee once; eve collided with nobody.

import type {
  Contributor,
  FileParallelDev,
  GitrelicReport,
  ParallelPair,
} from '@gitrelic/core';

const person = (
  email: string,
  commitCount: number,
  status: 'active' | 'quiet' | 'ghost' = 'active',
): Contributor => ({
  email,
  name: email.split('@')[0],
  commitCount,
  firstCommit: '2026-01-05T00:00:00Z',
  lastCommit: '2026-03-02T00:00:00Z',
  filesOwned: 0,
  linesChanged: 0,
  activeDays: 1,
  focusAreas: [],
  isActive: status === 'active',
  isGhost: status === 'ghost',
});

const window = (weekStart: string, authors: string[]) => ({
  weekStart,
  authors,
  commitCount: authors.length,
});

const file = (
  path: string,
  parallelWeeks: number,
  totalActiveWeeks: number,
  parallelScore: number,
): FileParallelDev => {
  const w = window('2026-01-05T00:00:00.000Z', ['ann@x', 'bob@x']);
  return {
    file: path,
    parallelScore,
    totalActiveWeeks,
    parallelWeeks,
    peakAuthors: 2,
    peakWindow: w,
    topWindows: [w],
    windows: [w],
    narrative: '',
  };
};

export const PAIRS: ParallelPair[] = [
  {
    a: 'ann@x',
    b: 'bob@x',
    weeks: 3,
    files: ['src/flags.js', 'src/flags.www.js', 'src/flags.native.js'],
  },
  { a: 'bob@x', b: 'cy@x', weeks: 2, files: ['src/loop.ts'] },
  { a: 'cy@x', b: 'dee@x', weeks: 1, files: ['src/dom.ts'] },
];

export function parallelReport(
  pairs: ParallelPair[] = PAIRS,
  leftOut = { sweepingCommits: 3, botCommits: 1 },
): GitrelicReport {
  const files = [
    file('src/flags.js', 3, 8, 40),
    file('src/loop.ts', 2, 10, 20),
  ];
  return {
    meta: { lastCommit: '2026-03-02T00:00:00Z' },
    contributors: {
      contributors: [
        person('ann@x', 9),
        person('bob@x', 7, 'ghost'),
        person('cy@x', 5, 'quiet'),
        person('dee@x', 3),
        person('eve@x', 2),
      ],
    },
    parallelDev: {
      files,
      hotFiles: files,
      totalParallelFiles: files.length,
      highParallel: 0,
      tierMix: { low: 1, medium: 1, high: 0, critical: 0 },
      byMonth: [],
      pairs,
      leftOut,
      summary: '',
    },
    // The three flag files change in lockstep (Churn's rule: 90% of both
    // files' commits, five or more): one family.
    coupling: {
      pairs: [
        ['src/flags.js', 'src/flags.www.js'],
        ['src/flags.js', 'src/flags.native.js'],
      ].map(([fileA, fileB]) => ({
        fileA,
        fileB,
        coCommits: 6,
        totalCommitsA: 6,
        totalCommitsB: 6,
        couplingStrength: 100,
      })),
    },
    fileClasses: {},
    // Enough for buildEntityIndex: the files the pairs name.
    loc: { files: [] },
    churn: {
      files: [
        'src/flags.js',
        'src/flags.www.js',
        'src/flags.native.js',
        'src/loop.ts',
        'src/dom.ts',
      ].map((file) => ({ file })),
    },
  } as unknown as GitrelicReport;
}
