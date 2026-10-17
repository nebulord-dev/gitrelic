import { startOfUtcWeek, WEEK_MS } from '../time/week';
import type { CommitLike } from '../commits/commitLike';

export interface WeekBin {
  weekStart: Date;
  counts: Record<string, number>;
}

/**
 * Bin commits into weekly buckets grouped by author.
 * Returns week bins and author list sorted by total commits descending.
 */
export function binCommitsByWeek(commits: readonly CommitLike[]): {
  weeks: WeekBin[];
  authors: string[];
} {
  if (commits.length === 0) return { weeks: [], authors: [] };

  // Count commits per author for sorting
  const authorTotals = new Map<string, number>();
  for (const c of commits) {
    authorTotals.set(c.author, (authorTotals.get(c.author) ?? 0) + 1);
  }
  const authors = [...authorTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([email]) => email);

  // Find date range
  let minMs = commits[0].timeMs;
  let maxMs = minMs;
  for (const c of commits) {
    if (c.timeMs < minMs) minMs = c.timeMs;
    if (c.timeMs > maxMs) maxMs = c.timeMs;
  }
  const startMonday = startOfUtcWeek(minMs);

  // Build empty bins
  const bins: WeekBin[] = [];
  for (let t = startMonday; t <= maxMs; t += WEEK_MS) {
    const counts: Record<string, number> = {};
    for (const a of authors) counts[a] = 0;
    bins.push({ weekStart: new Date(t), counts });
  }

  // Fill bins
  for (const c of commits) {
    const weekIdx = Math.floor((c.timeMs - startMonday) / WEEK_MS);
    if (weekIdx >= 0 && weekIdx < bins.length) {
      bins[weekIdx].counts[c.author] =
        (bins[weekIdx].counts[c.author] ?? 0) + 1;
    }
  }

  return { weeks: bins, authors };
}
