// A React-shaped fix-rate report (its last 12 months): three files above
// chance at a 1.2% repo rate, two with one fix each, and a floor of files
// with none. The scene fixture's repo is too small to rate any file.

import reportJson from './fixtures/report.small.json';
import type { CommitLike } from '../src/commits/commitLike';
import type {
  FileFixRate,
  FixRateFix,
  FixRateReport,
  GitrelicReport,
} from '@gitrelic/core';

const base = reportJson as unknown as GitrelicReport;

export const REPO_RATE = 0.0121;
export const RUNNER = 'compiler/packages/snap/src/runner.ts';
export const PIPELINE =
  'compiler/packages/babel-plugin-react-compiler/src/Entrypoint/Pipeline.ts';
export const BUILD_HIR =
  'compiler/packages/babel-plugin-react-compiler/src/HIR/BuildHIR.ts';
export const FRAGMENT_TEST =
  'packages/react-dom/src/__tests__/ReactDOMFragmentRefs-test.js';
export const FLAGS_WWW = 'packages/shared/forks/ReactFeatureFlags.www.js';

const DAY = 86_400_000;
export const START = Date.parse('2025-10-01T00:00:00Z');
export const at = (day: number) => START + day * DAY;
/** A 40-character hash for commit `n` of the synthetic history. */
export const hashOf = (n: number) =>
  n.toString(16).padStart(6, '0').padEnd(40, 'f');

const fix = (
  n: number,
  day: number,
  message: string,
  causes: number[],
): FixRateFix => ({
  hash: hashOf(n),
  message,
  date: new Date(at(day)).toISOString(),
  revert: message.startsWith('Revert'),
  causes: causes.map(hashOf),
});

export const rated = (
  file: string,
  changes: number,
  fixedAfter: number,
  fixes: FixRateFix[] = [],
): FileFixRate => ({
  file,
  changes,
  fixedAfter,
  rate: fixedAfter / changes,
  fixes,
});

// runner.ts: commits 101–108 on days 0–70, then fixes 109 and 110, which
// repaired 102, 104 and 105. Commit 111 (day 300) is too recent to rate.
export const RUNNER_COMMITS = [
  { n: 101, day: 0 },
  { n: 102, day: 10 },
  { n: 103, day: 20 },
  { n: 104, day: 30 },
  { n: 105, day: 40 },
  { n: 106, day: 50 },
  { n: 107, day: 60 },
  { n: 108, day: 70 },
  { n: 109, day: 45 },
  { n: 110, day: 35 },
  { n: 111, day: 300 },
];
export const RUNNER_FIXES = [
  fix(
    109,
    45,
    '[compiler][snap] Fixes to relative path resolution',
    [102, 105],
  ),
  fix(110, 35, 'Revert "[snap] watch mode"', [104]),
];

export function fixRateReport(
  files: FileFixRate[] = [
    rated(RUNNER, 8, 3, RUNNER_FIXES),
    rated(PIPELINE, 18, 4, [
      fix(201, 90, '[compiler] fix remaining throws', [200]),
    ]),
    rated(BUILD_HIR, 11, 2),
    rated(FRAGMENT_TEST, 8, 1),
    rated(FLAGS_WWW, 25, 1),
    rated('packages/react/src/a.js', 8, 0),
    rated('packages/react/src/b.js', 8, 0),
    rated('packages/react/src/c.js', 12, 0),
    rated('packages/react/src/d.js', 20, 0),
  ],
  over: Partial<FixRateReport> = {},
): GitrelicReport {
  return {
    ...base,
    fixRate: {
      files,
      unratedFiles: 1169,
      changes: 2971,
      fixedAfter: 36,
      rate: REPO_RATE,
      byMonth: [],
      fixCommits: 103,
      reverts: 1,
      sweepingSkipped: 5,
      blameTimeouts: 0,
      windowDays: 30,
      minChanges: 8,
      summary: '',
      ...over,
    },
  };
}

/** The repo's commits, oldest first: runner.ts's, plus one other file's last. */
export function fixRateCommits(): CommitLike[] {
  return [
    ...RUNNER_COMMITS.map(({ n, day }) => ({
      timeMs: at(day),
      author: 'ann@corp.com',
      files: [RUNNER],
      hash: hashOf(n).slice(0, 12),
    })),
    {
      timeMs: at(320),
      author: 'bob@corp.com',
      files: ['other.ts'],
      hash: hashOf(999).slice(0, 12),
    },
  ].sort((a, b) => a.timeMs - b.timeMs);
}
