// Churn's Rhythm form (docs/atlas-views.md › Churn): the files with the most
// commits, each as its commits week by week over the window, so speeding up
// and slowing down are read off the bars rather than a velocity score.
//
// Weeks are the shared time strip's (Monday-start UTC, first commit to last),
// so a row lines up with the strip under the stage. Past MONTHLY_AFTER weeks
// (a `--since all` run) the bins are calendar months instead: ten years of
// weeks is 520 bars a row, a pixel wide each, and thousands of marks. A file
// is matched by its current path: bins before a rename are empty, as in
// churn's own count.

import { timeBins } from '../time/bins';
import { lockstepGroups } from './lockstep';
import { churnSwarmOf, type SwarmFile } from './swarm';
import type { CommitLike } from '../commits/commitLike';
import type { GitrelicReport } from '@gitrelic/core';

/** Files Rhythm draws, most commits first. */
export const RHYTHM_ROWS = 16;
export { MONTHLY_AFTER } from '../time/bins';

export interface RhythmRow {
  file: SwarmFile;
  /** Its commits per bin, aligned with `Rhythm.binStarts`. */
  bins: number[];
  /** Commits in the later half of the window's bins. */
  recent: number;
  /** Index into `Rhythm.groups` when it changes in lockstep with others. */
  group: number | null;
}

export interface Rhythm {
  /** What a bin is: a Monday-start UTC week, or a UTC calendar month. */
  unit: 'week' | 'month';
  /** Each bin's first instant, epoch ms; empty with no commits. */
  binStarts: number[];
  rows: RhythmRow[];
  /** Lockstep groups with at least two members among `rows`, in row order. */
  groups: string[][];
}

/** The files with the most commits, at most `limit`, from the swarm's data. */
export function topChurnFiles(
  report: GitrelicReport,
  limit = RHYTHM_ROWS,
): SwarmFile[] {
  return churnSwarmOf(report)
    .flatMap((r) => r.files)
    .sort((a, b) => b.commits - a.commits || (a.file < b.file ? -1 : 1))
    .slice(0, limit);
}

export function churnRhythm(
  report: GitrelicReport,
  commits: readonly CommitLike[],
  limit = RHYTHM_ROWS,
): Rhythm {
  const files = topChurnFiles(report, limit);
  const { unit, binStarts, binOf } = timeBins(commits);

  const slot = new Map(files.map((f, i) => [f.file, i]));
  const bins = files.map(() => new Array<number>(binStarts.length).fill(0));
  for (const c of commits) {
    const b = binOf(c.timeMs);
    for (const path of c.files) {
      const i = slot.get(path);
      if (i !== undefined) bins[i][b]++;
    }
  }

  // Groups as far as Rhythm can show them: members among its rows, and at
  // least two of them, numbered in the order their first row appears.
  const groups = lockstepGroups(report)
    .map((g) => g.filter((f) => slot.has(f)))
    .filter((g) => g.length >= 2)
    .map((g) => g.sort((a, b) => slot.get(a)! - slot.get(b)!))
    .sort((a, b) => slot.get(a[0])! - slot.get(b[0])!);
  const groupOf = new Map<string, number>();
  groups.forEach((g, k) => g.forEach((f) => groupOf.set(f, k)));

  const half = Math.floor(binStarts.length / 2);
  return {
    unit,
    binStarts,
    groups,
    rows: files.map((file, i) => ({
      file,
      bins: bins[i],
      recent: bins[i].slice(half).reduce((s, v) => s + v, 0),
      group: groupOf.get(file.file) ?? null,
    })),
  };
}

// Commits arrive as one array per load; the report and that array together
// key the result, so switching forms back and forth doesn't recount.
const cache = new WeakMap<
  GitrelicReport,
  WeakMap<readonly CommitLike[], Rhythm>
>();
/** `churnRhythm`, computed once per report and commit list. */
export function churnRhythmOf(
  report: GitrelicReport,
  commits: readonly CommitLike[],
): Rhythm {
  let byCommits = cache.get(report);
  if (!byCommits) {
    byCommits = new WeakMap();
    cache.set(report, byCommits);
  }
  let rhythm = byCommits.get(commits);
  if (!rhythm) {
    rhythm = churnRhythm(report, commits);
    byCommits.set(commits, rhythm);
  }
  return rhythm;
}
