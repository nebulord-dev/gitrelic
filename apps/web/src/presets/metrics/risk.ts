import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function riskMetrics(report: GitrelicReport): Metric[] {
  const criticalBusFactor = report.busFactors.criticalFiles.length;
  const ghostFiles = report.ghostFiles.totalGhostFiles;
  const concentrationIndex = Math.round(
    report.knowledgeConcentration.concentrationIndex,
  );
  const highBlastRadius = report.blastRadius.files.filter(
    (f) => f.blastScore > 70,
  ).length;

  const locMap = new Map<string, number>();
  for (const entry of report.loc.files) {
    locMap.set(entry.file, entry.lines);
  }
  const atRiskLoc = report.busFactors.criticalFiles.reduce(
    (sum, f) => sum + (locMap.get(f.file) ?? 0),
    0,
  );

  return [
    {
      label: 'Critical Bus Factor',
      value: String(criticalBusFactor),
      color:
        criticalBusFactor > 0
          ? 'var(--severity-critical)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Ghost Files',
      value: String(ghostFiles),
      color:
        ghostFiles > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Knowledge Concentration',
      value: `${concentrationIndex}%`,
      color:
        concentrationIndex > 60
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'High Blast Radius',
      value: String(highBlastRadius),
      color:
        highBlastRadius > 0
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'At-Risk LOC',
      value: fmt(atRiskLoc),
      color:
        atRiskLoc > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
  ];
}
