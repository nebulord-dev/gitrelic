import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function contributorsMetrics(report: GitrelicReport): Metric[] {
  const {
    activeContributors,
    ghostContributors,
    contributors,
    top3CommitShare,
    newcomers90d,
  } = report.contributors;

  // Slot 1 — Active Contributors (1 critical / 2-5 warning / 6+ healthy)
  const activeCount = activeContributors.length;
  const activeColor =
    activeCount <= 1
      ? 'var(--severity-critical)'
      : activeCount <= 5
        ? 'var(--severity-warning)'
        : 'var(--severity-healthy)';

  // Slot 2 — Top-3 Share (<40% healthy / 40-69% warning / 70%+ critical)
  const sharePercent = Math.round(top3CommitShare);
  const shareColor =
    top3CommitShare < 40
      ? 'var(--severity-healthy)'
      : top3CommitShare < 70
        ? 'var(--severity-warning)'
        : 'var(--severity-critical)';

  // Slot 3 — Ghost Authors (0 healthy / <30% ratio warning / >=30% ratio critical)
  const ghostCount = ghostContributors.length;
  const totalCount = contributors.length;
  const ghostRatio = totalCount === 0 ? 0 : ghostCount / totalCount;
  const ghostColor =
    ghostCount === 0
      ? 'var(--severity-healthy)'
      : ghostRatio < 0.3
        ? 'var(--severity-warning)'
        : 'var(--severity-critical)';

  // Slot 4 — Newcomers (90d) (0 neutral via stale token / 1+ healthy)
  const newcomerColor =
    newcomers90d === 0 ? 'var(--text-tertiary)' : 'var(--severity-healthy)';

  return [
    {
      label: 'Active Contributors',
      value: String(activeCount),
      color: activeColor,
    },
    {
      label: 'Top-3 Share',
      value: `${sharePercent}%`,
      color: shareColor,
    },
    {
      label: 'Ghost Authors',
      value: String(ghostCount),
      color: ghostColor,
    },
    {
      label: 'Newcomers (90d)',
      value: String(newcomers90d),
      color: newcomerColor,
    },
  ];
}
