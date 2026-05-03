import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

const STRESS_THRESHOLD = 50;

export function commitTimingMetrics(report: GitrelicReport): Metric[] {
  const { stressFiles, repoLateNightPercent, repoWeekendPercent } =
    report.commitTiming;
  const topStress = stressFiles[0];
  const topStressScore = topStress?.stressScore ?? 0;
  const stressedCount = stressFiles.filter(
    (f) => f.stressScore > STRESS_THRESHOLD,
  ).length;

  return [
    {
      label: 'Late Night %',
      value: `${repoLateNightPercent}%`,
      color:
        repoLateNightPercent >= 20
          ? 'var(--severity-critical)'
          : repoLateNightPercent >= 10
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'Weekend %',
      value: `${repoWeekendPercent}%`,
      color:
        repoWeekendPercent >= 20
          ? 'var(--severity-critical)'
          : repoWeekendPercent >= 10
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'Stress Files',
      value: fmt(stressedCount),
      color:
        stressedCount >= 5
          ? 'var(--severity-critical)'
          : stressedCount > 0
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'Top Stress',
      value: topStress ? String(Math.round(topStressScore)) : '—',
      color: !topStress
        ? 'var(--severity-healthy)'
        : topStressScore >= 70
          ? 'var(--severity-critical)'
          : topStressScore > STRESS_THRESHOLD
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
  ];
}
