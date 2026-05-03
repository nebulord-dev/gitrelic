import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function coAuthorsMetrics(report: GitrelicReport): Metric[] {
  const { pairs, totalCoAuthoredCommits } = report.coAuthors;
  const pairCount = pairs.length;

  const collaborators = new Set<string>();
  let topPair = 0;
  let pairSum = 0;
  for (const p of pairs) {
    collaborators.add(p.authorA);
    collaborators.add(p.authorB);
    pairSum += p.coAuthoredCommits;
    if (p.coAuthoredCommits > topPair) topPair = p.coAuthoredCommits;
  }

  const avgPerPair = pairCount > 0 ? Math.round(pairSum / pairCount) : 0;

  return [
    {
      label: 'Pairs',
      value: String(pairCount),
      color:
        pairCount > 0 ? 'var(--accent-primary)' : 'var(--severity-healthy)',
    },
    {
      label: 'Co-commits',
      value: fmt(totalCoAuthoredCommits),
      color:
        totalCoAuthoredCommits > 0
          ? 'var(--accent-primary)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Collaborators',
      value: String(collaborators.size),
      color:
        collaborators.size > 0
          ? 'var(--accent-primary)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Avg Commits/Pair',
      value: pairCount > 0 ? String(avgPerPair) : '—',
      color:
        pairCount > 0 ? 'var(--accent-primary)' : 'var(--severity-healthy)',
    },
    {
      label: 'Top Pair Commits',
      value: pairCount > 0 ? String(topPair) : '—',
      color:
        pairCount > 0 ? 'var(--accent-primary)' : 'var(--severity-healthy)',
    },
  ];
}
