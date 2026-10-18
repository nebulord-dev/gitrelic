// Weekly activity for the time strip and the inspector: how many commits
// landed each week, and how many of those touched one entity (a file, a
// directory, a person). Weeks run Monday to Monday in UTC, from the first
// commit's week to the last's, empty weeks included.

import { entityKey, entityKind, type EntityId } from '../ids';
import { startOfUtcWeek, WEEK_MS } from './week';
import type { CommitLike } from '../commits/commitLike';

export interface WeeklyActivity {
  /** Monday 00:00 UTC of the first week, epoch ms (0 when there are none). */
  start: number;
  /** Commits per week. */
  totals: number[];
  /** Of those, the commits that touched the entity (all zero without one). */
  hits: number[];
}

/** Whether a commit touches `id`; null for kinds commits don't touch. */
export function touchesEntity(
  id: EntityId,
): ((c: CommitLike) => boolean) | null {
  const key = entityKey(id);
  switch (entityKind(id)) {
    case 'file':
      return (c) => c.files.includes(key);
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
  const hits = new Array<number>(weeks).fill(0);
  for (const c of commits) {
    const w = Math.floor((c.timeMs - start) / WEEK_MS);
    totals[w]++;
    if (touches?.(c)) hits[w]++;
  }
  return { start, totals, hits };
}
