import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function churnMetrics(report: GitrelicReport): Metric[] {
  const files = report.churn.files;
  const hotCount = report.churn.hotspotCount;
  const topFile = report.churn.topFiles[0];
  const totalCommits = files.reduce((sum, f) => sum + f.commitCount, 0);
  const avgChurnScore =
    files.length > 0
      ? Math.round(files.reduce((sum, f) => sum + f.churnScore, 0) / files.length)
      : 0;

  return [
    {
      label: 'Hot Files',
      value: String(hotCount),
      color: hotCount > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Top Churn Score',
      value: topFile ? String(Math.round(topFile.churnScore)) : '—',
      color:
        topFile && topFile.churnScore > 75 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Avg Churn Score',
      value: files.length > 0 ? String(avgChurnScore) : '—',
      color: avgChurnScore > 50 ? 'var(--severity-warning)' : 'var(--text-primary)',
    },
    {
      label: 'Total Commits',
      value: fmt(totalCommits),
      color: 'var(--accent-primary)',
    },
  ];
}
