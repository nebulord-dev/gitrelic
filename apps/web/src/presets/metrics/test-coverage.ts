import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function testCoverageMetrics(report: GitrelicReport): Metric[] {
  const { directories, uncoveredDirectories, overallRatio } =
    report.testCoverage;
  const overallPercent = Math.round(overallRatio * 100);

  return [
    {
      label: 'Overall Ratio',
      value: directories.length > 0 ? `${overallPercent}%` : '—',
      color:
        directories.length === 0
          ? 'var(--severity-healthy)'
          : overallRatio >= 0.5
            ? 'var(--severity-healthy)'
            : overallRatio >= 0.2
              ? 'var(--severity-warning)'
              : 'var(--severity-critical)',
    },
    {
      label: 'Uncovered Dirs',
      value: fmt(uncoveredDirectories.length),
      color:
        uncoveredDirectories.length > 0
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Total Dirs',
      value: fmt(directories.length),
      color: 'var(--text-primary)',
    },
    {
      label: 'Covered Dirs',
      value: fmt(Math.max(0, directories.length - uncoveredDirectories.length)),
      color: 'var(--accent-primary)',
    },
  ];
}
