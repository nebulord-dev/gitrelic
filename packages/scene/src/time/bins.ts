// The time strip's bins for history views (Churn's Rhythm, Contributors'
// Lanes): Monday-start UTC weeks from the first commit to the last, so a row
// lines up with the strip under the stage, or calendar months past
// MONTHLY_AFTER weeks (a `--since all` run), where ten years of weeks would be
// 520 one-pixel bars a row and thousands of marks.

import { startOfUtcWeek, WEEK_MS } from './week';
import type { CommitLike } from '../commits/commitLike';

/** Windows longer than this many weeks are binned by month. */
export const MONTHLY_AFTER = 104;

export interface TimeBins {
  /** What a bin is: a Monday-start UTC week, or a UTC calendar month. */
  unit: 'week' | 'month';
  /** Each bin's first instant, epoch ms; empty with no commits. */
  binStarts: number[];
  /** The bin an instant falls in (within the commits' span). */
  binOf: (ms: number) => number;
}

export function timeBins(commits: readonly CommitLike[]): TimeBins {
  let min = Infinity;
  let max = -Infinity;
  for (const c of commits) {
    if (c.timeMs < min) min = c.timeMs;
    if (c.timeMs > max) max = c.timeMs;
  }
  if (commits.length === 0)
    return { unit: 'week', binStarts: [], binOf: () => 0 };
  const start = startOfUtcWeek(min);
  const weekCount = Math.floor((max - start) / WEEK_MS) + 1;
  if (weekCount <= MONTHLY_AFTER) {
    return {
      unit: 'week',
      binStarts: Array.from(
        { length: weekCount },
        (_, w) => start + w * WEEK_MS,
      ),
      binOf: (ms) => Math.floor((ms - start) / WEEK_MS),
    };
  }
  const monthIndex = (ms: number) => {
    const d = new Date(ms);
    return d.getUTCFullYear() * 12 + d.getUTCMonth();
  };
  const first = monthIndex(min);
  const binStarts: number[] = [];
  for (let m = first; m <= monthIndex(max); m++)
    binStarts.push(Date.UTC(Math.floor(m / 12), m % 12, 1));
  return { unit: 'month', binStarts, binOf: (ms) => monthIndex(ms) - first };
}
