import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

const HIGH_STRESS_FILES_THRESHOLD = 5; // matches CommitTimingTab.MODERATE_THRESHOLD
const STRESSED_AUTHOR_SCORE_THRESHOLD = 50; // per-author warning band

export function commitTimingMetrics(report: GitrelicReport): Metric[] {
  const { highStress, authorStress, repoLateNightPercent, repoWeekendPercent } =
    report.commitTiming;

  const stressedAuthors = authorStress.filter(
    (a) => a.stressScore >= STRESSED_AUTHOR_SCORE_THRESHOLD,
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
      label: 'High Stress',
      value: fmt(highStress),
      color:
        highStress === 0
          ? 'var(--severity-healthy)'
          : highStress < HIGH_STRESS_FILES_THRESHOLD
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
    {
      label: 'Stressed Authors',
      value: fmt(stressedAuthors),
      color:
        stressedAuthors === 0
          ? 'var(--severity-healthy)'
          : stressedAuthors <= 2
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
  ];
}
