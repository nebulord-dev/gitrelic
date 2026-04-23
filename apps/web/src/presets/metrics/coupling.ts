import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function couplingMetrics(report: GitrelicReport): Metric[] {
  const pairs = report.coupling.pairs;
  const pairCount = pairs.length;
  const topPair = report.coupling.topPairs[0];
  const hubCounts = pairs.reduce((hubs, p) => {
    hubs.set(p.fileA, (hubs.get(p.fileA) ?? 0) + 1);
    hubs.set(p.fileB, (hubs.get(p.fileB) ?? 0) + 1);
    return hubs;
  }, new Map<string, number>());
  const topHub = [...hubCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Three metrics here; deliberately not padded. Exercises the 1-5 metric-strip flexibility.
  return [
    {
      label: 'Coupled Pairs',
      value: String(pairCount),
      color: pairCount > 0 ? 'var(--accent-primary)' : 'var(--severity-healthy)',
    },
    {
      label: 'Top Coupling',
      value: topPair ? `${Math.round(topPair.couplingStrength * 100)}%` : '—',
      color:
        topPair && topPair.couplingStrength > 0.7
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Hub File',
      value: topHub ? `${topHub[0].split('/').pop()} (${topHub[1]})` : '—',
      color: 'var(--text-primary)',
    },
  ];
}
