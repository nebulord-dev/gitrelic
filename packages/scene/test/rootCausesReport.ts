// A React-shaped report for Root causes: seven feature-flag forks that change
// together (all cursed), one near miss, and hubs coupled to them — one of them
// a test file.

import reportJson from './fixtures/report.small.json';
import type { CoupledPair, CursedFile, GitrelicReport } from '@gitrelic/core';

const base = reportJson as unknown as GitrelicReport;

export const FLAGS = [
  'shared/ReactFeatureFlags.js',
  'shared/forks/ReactFeatureFlags.www.js',
  'shared/forks/ReactFeatureFlags.native-fb.js',
  'shared/forks/ReactFeatureFlags.native-oss.js',
  'shared/forks/ReactFeatureFlags.test-renderer.js',
  'shared/forks/ReactFeatureFlags.test-renderer.www.js',
  'shared/forks/ReactFeatureFlags.test-renderer.native-fb.js',
];
export const FIZZ = 'server/ReactFizzServer.js';

export const cursed = (file: string, score: number): CursedFile => ({
  file,
  curseScore: score,
  reasons: ['churn', 'authors'],
  breakdown: [
    { kind: 'churn', label: 'c', points: 35 },
    { kind: 'authors', label: 'a', points: score - 35 },
  ],
  churn: 20,
  authors: 8,
  ageDays: 10,
  narrative: '',
});

export const pair = (
  fileA: string,
  fileB: string,
  coCommits: number,
  totalCommitsA: number,
  totalCommitsB: number,
): CoupledPair => ({
  fileA,
  fileB,
  coCommits,
  totalCommitsA,
  totalCommitsB,
  couplingStrength: Math.round(
    (coCommits / Math.min(totalCommitsA, totalCommitsB)) * 100,
  ),
});

/** A report with these cursed files, near misses, coupling pairs and test files. */
export function withRisk(
  files: CursedFile[],
  nearMisses: CursedFile[],
  pairs: CoupledPair[],
  tests: string[] = [],
): GitrelicReport {
  return {
    ...base,
    cursedFiles: { ...base.cursedFiles, files, nearMisses, threshold: 50 },
    coupling: { ...base.coupling, pairs },
    fileClasses: Object.fromEntries(tests.map((t) => [t, 'test' as const])),
  };
}

/** The React shape: forks at 85–96% of each other, five hubs, a test hub. */
export function reactShaped(): GitrelicReport {
  const files = FLAGS.map((f, i) => cursed(f, 55 - (i % 2) * 5));
  const pairs: CoupledPair[] = [];
  for (let i = 0; i < FLAGS.length; i++)
    for (let j = i + 1; j < FLAGS.length; j++)
      pairs.push(pair(FLAGS[i], FLAGS[j], 24, 28, 27));
  // ReactTypes reaches the flags (3–4 commits) and Fizz.
  for (const f of FLAGS) pairs.push(pair('shared/ReactTypes.js', f, 4, 11, 28));
  pairs.push(pair('shared/ReactTypes.js', FIZZ, 4, 11, 30));
  // A dynamic fork: many commits into the flags only.
  for (const f of FLAGS)
    pairs.push(pair('shared/forks/Dynamic.js', f, 12, 13, 28));
  // A hooks file into two flags.
  pairs.push(pair('reconciler/Hooks.js', FLAGS[0], 3, 40, 28));
  pairs.push(pair('reconciler/Hooks.js', FLAGS[1], 3, 40, 28));
  // A test changing with everything: not a cause.
  for (const f of [...FLAGS, FIZZ])
    pairs.push(pair('reconciler/__tests__/effect-test.js', f, 4, 5, 28));
  // A DOM file into Fizz only.
  pairs.push(pair('dom/ReactDOMBrowser.js', FIZZ, 3, 3, 30));
  return withRisk(files, [cursed(FIZZ, 45)], pairs, [
    'reconciler/__tests__/effect-test.js',
  ]);
}
