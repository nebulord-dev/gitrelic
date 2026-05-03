import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function knowledgeSilosMetrics(report: GitrelicReport): Metric[] {
  const { singleAuthorFiles, totalFiles, concentrationIndex } =
    report.knowledgeConcentration;
  const roundedIndex = Math.round(concentrationIndex * 10) / 10;

  return [
    {
      label: 'Concentration Index',
      value: totalFiles > 0 ? `${roundedIndex}%` : '—',
      color:
        concentrationIndex >= 30
          ? 'var(--severity-critical)'
          : concentrationIndex >= 15
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'Single-Author Files',
      value: fmt(singleAuthorFiles),
      color:
        singleAuthorFiles > 0
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Total Files',
      value: fmt(totalFiles),
      color: 'var(--text-primary)',
    },
    {
      label: 'Multi-Author Files',
      value: fmt(Math.max(0, totalFiles - singleAuthorFiles)),
      color: 'var(--accent-primary)',
    },
  ];
}
