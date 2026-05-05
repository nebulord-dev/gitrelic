import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

const STALE = 'var(--text-tertiary)';
const COUPLING = 'var(--accent-coupling)';

function color(nonZero: boolean): string {
  return nonZero ? COUPLING : STALE;
}

export function coAuthorsMetrics(report: GitrelicReport): Metric[] {
  const ca = report.coAuthors;

  return [
    {
      label: 'AI Adoption',
      value: `${ca.aiAdoptionPercent}%`,
      color: color(ca.aiAdoptionPercent > 0),
    },
    {
      label: 'AI Commits',
      value: fmt(ca.aiAssistedCommits),
      color: color(ca.aiAssistedCommits > 0),
    },
    {
      label: 'AI Authors',
      value: fmt(ca.aiAuthors.length),
      color: color(ca.aiAuthors.length > 0),
    },
    {
      label: 'Human Pairs',
      value: fmt(ca.humanPairs.length),
      color: color(ca.humanPairs.length > 0),
    },
    {
      label: 'Co-Author Commits',
      value: fmt(ca.totalCoAuthoredCommits),
      color: color(ca.totalCoAuthoredCommits > 0),
    },
  ];
}
