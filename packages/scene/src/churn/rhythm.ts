// Churn's Rhythm form (docs/atlas-views.md › Churn): the files with the most
// commits, each as its commits week by week over the window, so speeding up
// and slowing down are read off the bars rather than a velocity score.
//
// Weeks are the shared time strip's (Monday-start UTC, first commit to last),
// so a row lines up with the strip under the stage. A file is matched by its
// current path: weeks before a rename are empty, as in churn's own count.

import { startOfUtcWeek, WEEK_MS } from '../time/week';
import { lockstepGroups } from './lockstep';
import { churnSwarmOf, type SwarmFile } from './swarm';
import type { CommitLike } from '../commits/commitLike';
import type { GitrelicReport } from '@gitrelic/core';

/** Files Rhythm draws, most commits first. */
export const RHYTHM_ROWS = 16;

export interface RhythmRow {
  file: SwarmFile;
  /** Its commits per week, aligned with `Rhythm.start`. */
  weeks: number[];
  /** Commits in the later half of the window's weeks. */
  recent: number;
  /** Index into `Rhythm.groups` when it changes in lockstep with others. */
  group: number | null;
}

export interface Rhythm {
  /** Monday 00:00 UTC of the first week, epoch ms (0 with no commits). */
  start: number;
  weekCount: number;
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
  let min = Infinity;
  let max = -Infinity;
  for (const c of commits) {
    if (c.timeMs < min) min = c.timeMs;
    if (c.timeMs > max) max = c.timeMs;
  }
  const start = commits.length > 0 ? startOfUtcWeek(min) : 0;
  const weekCount =
    commits.length > 0 ? Math.floor((max - start) / WEEK_MS) + 1 : 0;

  const slot = new Map(files.map((f, i) => [f.file, i]));
  const weeks = files.map(() => new Array<number>(weekCount).fill(0));
  for (const c of commits) {
    const w = Math.floor((c.timeMs - start) / WEEK_MS);
    for (const path of c.files) {
      const i = slot.get(path);
      if (i !== undefined) weeks[i][w]++;
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

  const half = Math.floor(weekCount / 2);
  return {
    start,
    weekCount,
    groups,
    rows: files.map((file, i) => ({
      file,
      weeks: weeks[i],
      recent: weeks[i].slice(half).reduce((s, v) => s + v, 0),
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
