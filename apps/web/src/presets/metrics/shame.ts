import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function shameMetrics(report: GitrelicReport): Metric[] {
  const files = report.forensics.files;
  const total = files.length;

  let topScore = 0;
  let critical = 0;
  let scoreSum = 0;
  for (const f of files) {
    if (f.shameScore > topScore) topScore = f.shameScore;
    if (f.shameScore >= 70) critical += 1;
    scoreSum += f.shameScore;
  }

  const avgScore = total > 0 ? Math.round(scoreSum / total) : 0;

  return [
    {
      label: 'Shameful Files',
      value: String(total),
      color: total > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Top Score',
      value: total > 0 ? String(topScore) : '—',
      color:
        total === 0
          ? 'var(--severity-healthy)'
          : topScore >= 70
            ? 'var(--severity-critical)'
            : 'var(--severity-warning)',
    },
    {
      label: 'Critical (≥70)',
      value: String(critical),
      color:
        critical > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Shame Commits',
      value: fmt(report.forensics.totalShameCommits),
      color:
        report.forensics.totalShameCommits > 0
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Avg Score',
      value: total > 0 ? String(avgScore) : '—',
      color:
        total === 0
          ? 'var(--severity-healthy)'
          : avgScore >= 70
            ? 'var(--severity-critical)'
            : avgScore >= 40
              ? 'var(--severity-warning)'
              : 'var(--severity-healthy)',
    },
  ];
}
