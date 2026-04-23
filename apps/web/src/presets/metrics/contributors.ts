import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function contributorsMetrics(report: GitrelicReport): Metric[] {
  const totalAuthors = report.meta.totalAuthors;
  const ghostCount = report.ghostFiles.totalGhostFiles;
  // Total commits across the repo as a rough activity indicator:
  const totalCommits = report.churn.files.reduce((sum, f) => sum + f.commitCount, 0);

  return [
    {
      label: 'Active Contributors',
      value: String(totalAuthors),
      color: 'var(--accent-primary)',
    },
    {
      label: 'Ghost Authors',
      value: String(ghostCount),
      color: ghostCount > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Total Commits',
      value: String(totalCommits),
      color: 'var(--text-primary)',
    },
  ];
}
