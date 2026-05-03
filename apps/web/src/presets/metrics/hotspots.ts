import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function hotspotsMetrics(report: GitrelicReport): Metric[] {
  const topHotspot = report.hotspots.topHotspots[0];
  const criticalCount = report.hotspots.topHotspots.filter(
    (h) => h.category === 'critical',
  ).length;
  const totalChurn = report.churn.files.reduce(
    (sum, f) => sum + f.commitCount,
    0,
  );
  const avgLoc =
    report.loc.files.length > 0
      ? Math.round(report.loc.totalLines / report.loc.files.length)
      : 0;

  return [
    {
      label: 'Top Score',
      value: topHotspot ? String(Math.round(topHotspot.hotspotScore)) : '—',
      color:
        topHotspot && topHotspot.hotspotScore > 70
          ? 'var(--severity-critical)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Critical Hotspots',
      value: String(criticalCount),
      color:
        criticalCount > 0
          ? 'var(--severity-critical)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Avg LOC',
      value: fmt(avgLoc),
      color: 'var(--text-primary)',
    },
    {
      label: 'Total Churn',
      value: fmt(totalChurn),
      color: 'var(--accent-primary)',
    },
  ];
}
