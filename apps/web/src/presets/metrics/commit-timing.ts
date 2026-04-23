import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function commitTimingMetrics(report: GitrelicReport): Metric[] {
  const { stressFiles, repoLateNightPercent, repoWeekendPercent } = report.commitTiming;
  const topStress = stressFiles[0];
  const topStressScore = topStress?.stressScore ?? 0;

  return [
    {
      label: 'Late Night %',
      value: `${repoLateNightPercent.toFixed(0)}%`,
      color:
        repoLateNightPercent >= 20
          ? 'var(--severity-critical)'
          : repoLateNightPercent >= 10
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'Weekend %',
      value: `${repoWeekendPercent.toFixed(0)}%`,
      color:
        repoWeekendPercent >= 20
          ? 'var(--severity-critical)'
          : repoWeekendPercent >= 10
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'Stress Files',
      value: fmt(stressFiles.length),
      color: stressFiles.length > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Top Stress',
      value: topStress ? String(Math.round(topStressScore)) : '—',
      color: !topStress
        ? 'var(--severity-healthy)'
        : topStressScore >= 70
          ? 'var(--severity-critical)'
          : 'var(--severity-warning)',
    },
  ];
}
