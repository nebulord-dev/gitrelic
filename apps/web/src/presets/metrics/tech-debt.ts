import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function techDebtMetrics(report: GitrelicReport): Metric[] {
  const deadFiles = report.deadCode.totalDeadFiles;
  const growingFiles = report.complexityTrend.growingFiles.length;
  const highRewrite = report.rewriteRatio.topRewriters.length;
  const acceleratingChurn = report.churnVelocity.acceleratingFiles.length;

  const locMap = new Map<string, number>();
  for (const entry of report.loc.files) {
    locMap.set(entry.file, entry.lines);
  }

  const debtFileSet = new Set<string>();
  for (const f of report.deadCode.candidates) {
    debtFileSet.add(f.file);
  }
  for (const f of report.rewriteRatio.topRewriters) {
    debtFileSet.add(f.file);
  }
  const debtLoc = Array.from(debtFileSet).reduce(
    (sum, file) => sum + (locMap.get(file) ?? 0),
    0,
  );

  return [
    {
      label: 'Dead Files',
      value: String(deadFiles),
      color:
        deadFiles > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Growing Files',
      value: String(growingFiles),
      color:
        growingFiles > 0
          ? 'var(--severity-critical)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'High Rewrite',
      value: String(highRewrite),
      color:
        highRewrite > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Accelerating Churn',
      value: String(acceleratingChurn),
      color:
        acceleratingChurn > 0
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Debt LOC',
      value: fmt(debtLoc),
      color:
        debtLoc > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
  ];
}
