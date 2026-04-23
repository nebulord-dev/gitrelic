import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function ageMapMetrics(report: GitrelicReport): Metric[] {
  const { files, staleFiles, ancientFiles, medianAgeDays } = report.ageMap;
  const freshCount = files.filter((f) => f.status === 'fresh').length;

  return [
    {
      label: 'Median Age (days)',
      value: files.length > 0 ? fmt(medianAgeDays) : '—',
      color: medianAgeDays > 365 ? 'var(--severity-warning)' : 'var(--text-primary)',
    },
    {
      label: 'Ancient Files',
      value: fmt(ancientFiles.length),
      color: ancientFiles.length > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Stale Files',
      value: fmt(staleFiles.length),
      color: staleFiles.length > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Fresh Files',
      value: fmt(freshCount),
      color: 'var(--accent-primary)',
    },
  ];
}
