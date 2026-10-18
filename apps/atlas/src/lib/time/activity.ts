// Words for a weekly activity series: its first and last month, and a one-line
// summary of how an entity's commits spread over it.

import { WEEK_MS, type WeeklyActivity } from '@gitrelic/scene';

const MONTH = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function spanLabels(a: WeeklyActivity): [string, string] {
  if (a.totals.length === 0) return ['', ''];
  const last = a.start + (a.totals.length - 1) * WEEK_MS;
  return [MONTH.format(a.start), MONTH.format(last)];
}

/** "21 of 33 commits in the recent half", or null when nothing matched. */
export function recentShare(a: WeeklyActivity): string | null {
  const total = a.hits.reduce((s, n) => s + n, 0);
  if (total === 0) return null;
  const half = Math.floor(a.hits.length / 2);
  const recent = a.hits.slice(half).reduce((s, n) => s + n, 0);
  const noun = total === 1 ? 'commit' : 'commits';
  return `${recent} of ${total} ${noun} in the recent half`;
}

/** Weeks with at least one matching commit. */
export function activeWeeks(a: WeeklyActivity): number {
  return a.hits.filter((n) => n > 0).length;
}
