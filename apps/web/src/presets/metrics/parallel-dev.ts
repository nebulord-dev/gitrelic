import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function parallelDevMetrics(report: GitrelicReport): Metric[] {
  const { hotFiles, totalParallelFiles, files } = report.parallelDev;
  const topFile = hotFiles[0];
  const topScore = topFile?.parallelScore ?? 0;
  const peakAuthors = files.length > 0 ? Math.max(...files.map((f) => f.peakAuthors)) : 0;

  return [
    {
      label: 'Parallel Files',
      value: fmt(totalParallelFiles),
      color: totalParallelFiles > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Hot Files',
      value: fmt(hotFiles.length),
      color: hotFiles.length > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
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
      color: peakAuthors >= 4 ? 'var(--severity-warning)' : 'var(--accent-primary)',
    },
  ];
}
