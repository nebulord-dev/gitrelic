import type { FileBusFactor, GitrelicReport } from '@gitrelic/core';

// Shared default order for the bus-factor critical-files list. Used by both
// OwnershipBar (hero) and BusFactorTab (table) so the two views never drift.
//
// Order: highest dominant-author share first, tiebroken by total commit count
// desc. Files missing churn data fall back to zero commits and sort last
// within their share band.
export function sortCriticalByImpact(report: GitrelicReport): FileBusFactor[] {
  const churnByFile = new Map((report.churn?.files ?? []).map((c) => [c.file, c.commitCount]));
  return [...report.busFactors.criticalFiles].sort((a, b) => {
    const pctDiff = b.dominantAuthorPercent - a.dominantAuthorPercent;
    if (pctDiff !== 0) return pctDiff;
    return (churnByFile.get(b.file) ?? 0) - (churnByFile.get(a.file) ?? 0);
  });
}
