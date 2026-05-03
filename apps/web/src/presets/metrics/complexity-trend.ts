import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function complexityTrendMetrics(report: GitrelicReport): Metric[] {
  const { files, growingFiles, shrinkingFiles } = report.complexityTrend;
  const topGrowthRate = growingFiles[0]?.recentGrowthRate ?? 0;
  const netLines = files.reduce((sum, f) => sum + f.totalNetLines, 0);

  return [
    {
      label: 'Growing Files',
      value: fmt(growingFiles.length),
      color:
        growingFiles.length > 0
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Shrinking Files',
      value: fmt(shrinkingFiles.length),
      color: 'var(--accent-primary)',
    },
    {
      label: 'Top Growth (lines/mo)',
      value: growingFiles.length > 0 ? fmt(Math.round(topGrowthRate)) : '—',
      color:
        topGrowthRate > 100 ? 'var(--severity-warning)' : 'var(--text-primary)',
    },
    {
      label: 'Net Lines',
      value: files.length > 0 ? fmt(netLines) : '—',
      color: 'var(--text-primary)',
    },
  ];
}
