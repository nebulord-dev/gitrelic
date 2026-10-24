import type { GitrelicReport } from '@gitrelic/core';

/**
 * "Now" for a report's relative dates: its last commit, not the wall clock,
 * since a saved report can be months old. Older reports backfill
 * `meta.lastCommit` as '', so fall back to the newest contributor commit;
 * NaN when there's nothing to go on, and the ages read "—".
 */
export function reportNow(report: GitrelicReport): number {
  const last = Date.parse(report.meta.lastCommit);
  if (Number.isFinite(last)) return last;
  let newest = Number.NaN;
  for (const c of report.contributors.contributors) {
    const t = Date.parse(c.lastCommit);
    if (Number.isFinite(t) && !(t <= newest)) newest = t;
  }
  return newest;
}
