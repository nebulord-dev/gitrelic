// What to do about a file (docs/atlas-views.md › The inspector): rules on its
// signals, not a model. Each rule reads what the analyzers already report,
// says one action, and states the evidence behind it with the inspector
// section that shows it. The table is in priority order and a file gets at
// most ADVICE_LIMIT actions; with none, the inspector leaves the section out.
// Seeded from the analyzers' docs (cursed-files.md "What action it suggests").

import { COUPLING_HOT, REWRITE_HOT } from '../hotspots/facets';
import { LARGE_FILE } from '../hotspots/points';
import { coupledWith } from '../inspect/coupledWith';
import { fileContributors } from '../inspect/fileContributors';
import type { GitrelicReport } from '@gitrelic/core';

export const ADVICE_LIMIT = 3;
/** Shame's warning bar, as the file inspector colours it. */
export const SHAME_ACT = 40;
/** Shared commits a partner needs before "change them together" is advice. */
export const COUPLING_MIN_COMMITS = 3;

export type AdviceId =
  | 'new-owner'
  | 'pair'
  | 'read-log'
  | 'split'
  | 'add-tests'
  | 'change-together'
  | 'settle-design';

/** The inspector section holding a piece of advice's evidence. */
export type AdviceSection =
  | 'people'
  | 'activity'
  | 'changes-with'
  | 'flagged-by';

export interface Advice {
  id: AdviceId;
  action: string;
  /** Why the action follows, when the action alone doesn't say. */
  why?: string;
  evidence: string;
  section: AdviceSection;
}

const n = (v: number) => v.toLocaleString('en-US');
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const times = (k: number, one: string) => `${n(k)} ${one}${k === 1 ? '' : 's'}`;

function folderHasTests(file: string, report: GitrelicReport): boolean {
  const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '.';
  return report.testCoverage.directories.some(
    (d) =>
      d.testFiles > 0 &&
      (d.directory === dir || d.directory === `${dir}/__tests__`),
  );
}

/** Everything the rules read about one file, looked up once. */
function signalsOf(file: string, report: GitrelicReport) {
  const hotspot = report.hotspots.files.find((h) => h.file === file);
  return {
    file,
    hot: hotspot?.category === 'critical' || hotspot?.category === 'warning',
    commits: report.churn.files.find((c) => c.file === file)?.commitCount ?? 0,
    lines:
      report.loc.files.find((l) => l.file === file)?.lines ?? hotspot?.loc ?? 0,
    owner: report.busFactors.files.find((b) => b.file === file),
    topAuthor: fileContributors(file, report)[0],
    ghost: report.ghostFiles.files.find((g) => g.file === file),
    shame: report.forensics.files.find((f) => f.file === file),
    velocity: report.churnVelocity.files.find((v) => v.file === file),
    // Test coverage's sibling check misses tests kept elsewhere (React
    // tests react-server from react-dom's __tests__), so the folder must
    // hold no tests at all, beside it or in its __tests__.
    untested:
      report.testCoverage.files.find((t) => t.file === file)?.hasTestSibling ===
        false &&
      !report.fileClasses[file] &&
      !folderHasTests(file, report),
    partner: coupledWith(file, report, 1)[0],
    rewrite: report.rewriteRatio.files.find((r) => r.file === file),
    nameOf: (email: string) =>
      report.contributors.contributors.find((c) => c.email === email)?.name ??
      email.split('@')[0],
  };
}

type Signals = ReturnType<typeof signalsOf>;

/** The rules, in priority order. */
const RULES: readonly ((s: Signals) => Advice | null)[] = [
  // Its main author has gone quiet.
  (s) =>
    s.ghost
      ? {
          id: 'new-owner',
          action: 'Find it a new owner.',
          evidence: `${s.nameOf(s.ghost.dominantAuthor)} wrote ${Math.round(s.ghost.dominantAuthorPercent)}% and hasn't committed in ${times(s.ghost.authorInactiveDays, 'day')}.`,
          section: 'people',
        }
      : null,
  // Hot, and one person writes most of it (unless that person already left:
  // the rule above says so).
  (s) =>
    s.hot && s.owner?.risk === 'critical' && !s.ghost && s.topAuthor
      ? {
          id: 'pair',
          action:
            'Pair on it, or split it, before only one person can change it.',
          evidence: `${times(s.commits, 'commit')}; ${s.topAuthor.name} wrote ${Math.round(s.owner.dominantAuthorPercent)}%.`,
          section: 'people',
        }
      : null,
  (s) =>
    s.shame && s.shame.shameScore >= SHAME_ACT
      ? {
          id: 'read-log',
          action: 'Read its commit log before the code.',
          why: 'Repeated fix and revert messages usually mean its contract is wrong, not its implementation.',
          evidence: `${times(s.shame.shameCommitCount, 'commit')} ${s.shame.shameCommitCount === 1 ? 'says' : 'say'} ${(s.shame.dominantKeywords.length > 0 ? s.shame.dominantKeywords.slice(0, 2) : ['fix', 'revert']).join(' or ')}.`,
          section: 'activity',
        }
      : null,
  (s) =>
    s.lines >= LARGE_FILE && s.velocity?.trend === 'accelerating'
      ? {
          id: 'split',
          action: 'Split it before it grows further.',
          evidence: `${n(s.lines)} lines; ${n(s.velocity.recentCommits)} of ${times(s.velocity.totalCommits, 'commit')} in the recent half.`,
          section: 'flagged-by',
        }
      : null,
  (s) =>
    s.hot && s.untested
      ? {
          id: 'add-tests',
          action: 'Add tests before the next change.',
          evidence: `No tests in its folder, and it changed in ${times(s.commits, 'commit')}.`,
          section: 'flagged-by',
        }
      : null,
  (s) =>
    s.partner &&
    s.partner.strength >= COUPLING_HOT &&
    s.partner.coCommits >= COUPLING_MIN_COMMITS
      ? {
          id: 'change-together',
          action: `Change it with ${baseName(s.partner.file)} open.`,
          evidence: `${baseName(s.partner.file)} moved with it in ${times(s.partner.coCommits, 'commit')}.`,
          section: 'changes-with',
        }
      : null,
  (s) =>
    s.rewrite && s.rewrite.rewriteScore >= REWRITE_HOT
      ? {
          id: 'settle-design',
          action: 'Settle the design first: code here doesn’t stick.',
          evidence: `${n(s.rewrite.totalDeletions)} lines deleted for ${n(s.rewrite.totalInsertions)} added.`,
          section: 'flagged-by',
        }
      : null,
];

/** Up to ADVICE_LIMIT actions for `file`, most important first. */
export function whatToDo(file: string, report: GitrelicReport): Advice[] {
  const signals = signalsOf(file, report);
  const out: Advice[] = [];
  for (const rule of RULES) {
    const advice = rule(signals);
    if (advice) out.push(advice);
    if (out.length === ADVICE_LIMIT) break;
  }
  return out;
}
