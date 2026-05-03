import { MODERATE_THRESHOLD } from '../../components/tabs/ParallelDevTab';
import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function parallelDevMetrics(report: GitrelicReport): Metric[] {
  const { hotFiles, totalParallelFiles, highParallel, files } =
    report.parallelDev;
  const topFile = hotFiles[0];
  const topScore = topFile?.parallelScore ?? 0;
  const peakAuthors = files.reduce(
    (max, f) => (f.peakAuthors > max ? f.peakAuthors : max),
    0,
  );

  return [
    {
      label: 'Parallel Files',
      value: fmt(totalParallelFiles),
      color:
        totalParallelFiles > 0
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'High Parallel',
      value: fmt(highParallel),
      color:
        highParallel === 0
          ? 'var(--severity-healthy)'
          : highParallel < MODERATE_THRESHOLD
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
    {
      label: 'Top Score',
      value: topFile ? String(Math.round(topScore)) : '—',
      color: !topFile
        ? 'var(--severity-healthy)'
        : topScore >= 70
          ? 'var(--severity-critical)'
          : 'var(--severity-warning)',
    },
    {
      label: 'Peak Authors',
      value: peakAuthors > 0 ? String(peakAuthors) : '—',
      color:
        peakAuthors >= 4 ? 'var(--severity-warning)' : 'var(--accent-primary)',
    },
  ];
}
