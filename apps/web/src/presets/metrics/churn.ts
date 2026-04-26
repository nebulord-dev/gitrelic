import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function churnMetrics(report: GitrelicReport): Metric[] {
  const files = report.churn?.files ?? [];
  const fileCount = files.length;
  const hotCount = files.filter((f) => f.churnScore > 75).length;
  const topCommitCount = files.reduce((max, f) => (f.commitCount > max ? f.commitCount : max), 0);
  const totalCommits = report.commits?.length ?? 0;
  const topFilePct =
    fileCount > 0 && totalCommits > 0
      ? Math.round((topCommitCount / totalCommits) * 1000) / 10
      : null;

  return [
    {
      label: 'Hot Files',
      value: String(hotCount),
      color: hotCount > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Top File Commits',
      value: fileCount > 0 ? fmt(topCommitCount) : '—',
      color:
        fileCount === 0
          ? 'var(--severity-healthy)'
          : hotCount > 0
            ? 'var(--severity-critical)'
            : 'var(--severity-warning)',
    },
    {
      label: 'Top File Share',
      value: topFilePct != null ? `${topFilePct}%` : '—',
      color: 'var(--accent-primary)',
    },
    {
      label: 'Tracked Files',
      value: fmt(fileCount),
      color: 'var(--accent-primary)',
    },
  ];
}
