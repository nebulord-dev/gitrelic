import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function languagesMetrics(report: GitrelicReport): Metric[] {
  const { totalFiles, totalLines, languages } = report.loc;
  const topLanguage = languages[0];

  return [
    {
      label: 'Languages',
      value: fmt(languages.length),
      color: 'var(--accent-primary)',
    },
    {
      label: 'Top Language',
      value: topLanguage ? topLanguage.language : '—',
      color: 'var(--text-primary)',
    },
    {
      label: 'Top Share',
      value: topLanguage ? `${Math.round(topLanguage.percentage)}%` : '—',
      color: 'var(--text-primary)',
    },
    {
      label: 'Total Files',
      value: fmt(totalFiles),
      color: 'var(--text-primary)',
    },
    {
      label: 'Total Lines',
      value: fmt(totalLines),
      color: 'var(--text-primary)',
    },
  ];
}
