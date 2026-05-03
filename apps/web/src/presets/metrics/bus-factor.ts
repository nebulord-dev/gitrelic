import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function busFactorMetrics(report: GitrelicReport): Metric[] {
  const criticalCount = report.busFactors.criticalFiles.length;
  const soloOwnedCount = report.busFactors.criticalFiles.filter(
    (f) => f.uniqueAuthors === 1,
  ).length;
  const soloOwnedPct =
    report.loc.totalFiles > 0
      ? Math.round((soloOwnedCount / report.loc.totalFiles) * 100)
      : 0;
  const dominantOwners = new Set(
    report.busFactors.criticalFiles.map((f) => f.dominantAuthor),
  ).size;

  return [
    {
      label: 'Critical Files',
      value: String(criticalCount),
      color:
        criticalCount > 0
          ? 'var(--severity-critical)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Solo-Owned',
      value: String(soloOwnedCount),
      color:
        soloOwnedCount > 0
          ? 'var(--severity-critical)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Solo-Owned %',
      value: `${soloOwnedPct}%`,
      color:
        soloOwnedPct > 20
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Dominant Owners',
      value: String(dominantOwners),
      color: 'var(--accent-primary)',
    },
  ];
}
