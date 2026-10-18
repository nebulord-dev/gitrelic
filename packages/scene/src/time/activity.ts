// Weekly activity for the time strip and the inspector: how many commits
// landed each week, and how many of those touched one entity (a file, a
// directory, a person). Weeks run Monday to Monday in UTC, from the first
// commit's week to the last's, empty weeks included.

import { entityKey, entityKind, type EntityId } from '../ids';
import { startOfUtcWeek, WEEK_MS } from './week';
import type { CommitLike } from '../commits/commitLike';
import type { GitrelicReport } from '@gitrelic/core';

export interface WeeklyActivity {
  /** Monday 00:00 UTC of the first week, epoch ms (0 when there are none). */
  start: number;
  /** Commits per week. */
  totals: number[];
  /** Of those, the commits that touched the entity (all zero without one). */
  hits: number[];
}

/**
 * Whether a commit touches `id`; null for kinds commits don't touch. A file
 * also matches under `previousNames`, so a renamed file keeps the history it
 * made under its old paths (see `previousNamesOf`).
 */
export function touchesEntity(
  id: EntityId,
  previousNames: readonly string[] = [],
): ((c: CommitLike) => boolean) | null {
  const key = entityKey(id);
  switch (entityKind(id)) {
    case 'file': {
      if (previousNames.length === 0) return (c) => c.files.includes(key);
      const paths = new Set([key, ...previousNames]);
      return (c) => c.files.some((f) => paths.has(f));
    }
    case 'dir': {
      const prefix = `${key}/`;
      return (c) => c.files.some((f) => f.startsWith(prefix));
    }
    case 'person':
      return (c) => c.author === key;
    default:
      return null;
  }
}

/**
 * A file's earlier paths, oldest first, from rename tracking — minus any
 * path a tracked file uses today. Rename chains carry no dates, so a reused
 * name (a.ts → b.ts, then a new a.ts) can't be split by time; dropping
 * names that are live again keeps the new file's commits out.
 */
export function previousNamesOf(
  file: string,
  report: GitrelicReport,
): readonly string[] {
  const names = report.renameTracking.chains.find(
    (c) => c.currentPath === file,
  )?.previousNames;
  if (!names?.length) return [];
  const tracked = new Set(report.loc.files.map((f) => f.file));
  return names.filter((n) => !tracked.has(n));
}

export function weeklyActivity(
  commits: readonly CommitLike[],
  touches: ((c: CommitLike) => boolean) | null = null,
): WeeklyActivity {
  if (commits.length === 0) return { start: 0, totals: [], hits: [] };
  let min = Infinity;
  let max = -Infinity;
  for (const c of commits) {
    if (c.timeMs < min) min = c.timeMs;
    if (c.timeMs > max) max = c.timeMs;
  }
  const start = startOfUtcWeek(min);
  const weeks = Math.floor((max - start) / WEEK_MS) + 1;
  const totals = new Array<number>(weeks).fill(0);
  for (const c of commits) totals[Math.floor((c.timeMs - start) / WEEK_MS)]++;
  return { start, totals, hits: weeklyHits(commits, start, weeks, touches) };
}

/**
 * Just the matching commits per week, over a series `weeklyActivity` already
 * laid out — the totals don't depend on the selection, so a viewer clicking
 * around recomputes only this.
 */
export function weeklyHits(
  commits: readonly CommitLike[],
  start: number,
  weeks: number,
  touches: ((c: CommitLike) => boolean) | null,
): number[] {
  const hits = new Array<number>(weeks).fill(0);
  if (!touches) return hits;
  for (const c of commits) {
    if (touches(c)) hits[Math.floor((c.timeMs - start) / WEEK_MS)]++;
  }
  return hits;
}
