import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function blastRadiusMetrics(report: GitrelicReport): Metric[] {
  const { files, topBlasters } = report.blastRadius;
  const topScore = topBlasters[0]?.blastScore ?? 0;
  const maxCoChanged = files.reduce(
    (max, f) => (f.maxCoChangedFiles > max ? f.maxCoChangedFiles : max),
    0,
  );
  const avgCoChanged =
    files.length > 0
      ? Math.round((files.reduce((sum, f) => sum + f.avgCoChangedFiles, 0) / files.length) * 10) /
        10
      : 0;

  return [
    {
      label: 'Top Blast Score',
      value: topBlasters.length > 0 ? String(Math.round(topScore)) : '—',
      color:
        topBlasters.length === 0
          ? 'var(--severity-healthy)'
          : topScore >= 70
            ? 'var(--severity-critical)'
            : 'var(--severity-warning)',
    },
    {
      label: 'Max Co-Changed',
      value: files.length > 0 ? fmt(maxCoChanged) : '—',
      color: maxCoChanged > 20 ? 'var(--severity-warning)' : 'var(--text-primary)',
    },
    {
      label: 'Avg Co-Changed',
      value: files.length > 0 ? String(avgCoChanged) : '—',
      color: 'var(--accent-primary)',
    },
    {
      label: 'Files Analyzed',
      value: fmt(files.length),
      color: 'var(--text-primary)',
    },
  ];
}
