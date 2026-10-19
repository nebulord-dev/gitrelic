// Files that change in lockstep (docs/atlas-views.md › Churn): one change,
// made several times. The swarm's finding names the biggest group; Rhythm
// marks every group's rows.

import { makeFileKind } from '../files/fileKind';
import type { GitrelicReport } from '@gitrelic/core';

/** Lockstep: a pair shares at least this share of each file's commits… */
export const LOCKSTEP_STRENGTH = 90;
/** …over at least this many commits. */
export const LOCKSTEP_COMMITS = 5;
/** Files a lockstep group needs before it's a finding. */
export const LOCKSTEP_MIN_FILES = 3;

/**
 * Groups of source files that change commit for commit: pairs at
 * LOCKSTEP_STRENGTH over LOCKSTEP_COMMITS, joined into groups, biggest first.
 *
 * Core's `couplingStrength` divides by the quieter file's commits, so a small
 * file always shipped with a busy hub scores 100 while the hub moves alone
 * most of the time. Lockstep measures against the busier file instead: both
 * files must share LOCKSTEP_STRENGTH of their commits. Reads every pair in
 * `report.coupling.pairs`; a trimmed list would lose groups.
 */
export function lockstepGroups(report: GitrelicReport): string[][] {
  const kindOf = makeFileKind(report);
  const parent = new Map<string, string>();
  const find = (f: string): string => {
    let root = f;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(f, root);
    return root;
  };
  for (const p of report.coupling.pairs) {
    if (
      p.coCommits * 100 <
        LOCKSTEP_STRENGTH * Math.max(p.totalCommitsA, p.totalCommitsB) ||
      p.coCommits < LOCKSTEP_COMMITS ||
      kindOf(p.fileA) !== 'source' ||
      kindOf(p.fileB) !== 'source'
    )
      continue;
    for (const f of [p.fileA, p.fileB]) if (!parent.has(f)) parent.set(f, f);
    const a = find(p.fileA);
    const b = find(p.fileB);
    if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
  }
  const groups = new Map<string, string[]>();
  for (const f of parent.keys()) {
    const root = find(f);
    const g = groups.get(root);
    if (g) g.push(f);
    else groups.set(root, [f]);
  }
  return [...groups.values()]
    .filter((g) => g.length >= LOCKSTEP_MIN_FILES)
    .map((g) => g.sort())
    .sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : 1));
}
