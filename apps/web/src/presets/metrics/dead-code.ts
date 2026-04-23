import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function deadCodeMetrics(report: GitrelicReport): Metric[] {
  const { totalDeadFiles, totalDeadLines, candidates } = report.deadCode;
  const oldestAgeDays = candidates.length > 0 ? Math.max(...candidates.map((c) => c.ageInDays)) : 0;
  const avgAgeDays =
    candidates.length > 0
      ? Math.round(candidates.reduce((sum, c) => sum + c.ageInDays, 0) / candidates.length)
      : 0;

  return [
    {
      label: 'Dead Files',
      value: fmt(totalDeadFiles),
      color: totalDeadFiles > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Dead LOC',
      value: fmt(totalDeadLines),
      color: totalDeadLines > 1000 ? 'var(--severity-warning)' : 'var(--text-primary)',
    },
    {
      label: 'Oldest (days)',
      value: totalDeadFiles > 0 ? fmt(oldestAgeDays) : '—',
      color: oldestAgeDays > 365 ? 'var(--severity-warning)' : 'var(--text-primary)',
    },
    {
      label: 'Avg Age (days)',
      value: totalDeadFiles > 0 ? fmt(avgAgeDays) : '—',
      color: 'var(--accent-primary)',
    },
  ];
}
