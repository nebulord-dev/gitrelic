import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function renamesMetrics(report: GitrelicReport): Metric[] {
  const { chains, totalRenames, filesWithRenames } = report.renameTracking;

  let longest = 0;
  let topChain = chains[0];
  for (const c of chains) {
    if (c.renameCount > longest) {
      longest = c.renameCount;
      topChain = c;
    }
  }

  const avg =
    filesWithRenames > 0 ? Math.round(totalRenames / filesWithRenames) : 0;
  const topBasename = topChain
    ? (topChain.currentPath.split('/').pop() ?? topChain.currentPath) ||
      topChain.currentPath
    : '';

  return [
    {
      label: 'Files Renamed',
      value: String(filesWithRenames),
      color:
        filesWithRenames > 0
          ? 'var(--accent-primary)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Total Renames',
      value: fmt(totalRenames),
      color:
        totalRenames > 0 ? 'var(--accent-primary)' : 'var(--severity-healthy)',
    },
    {
      label: 'Longest Chain',
      value: chains.length > 0 ? String(longest) : '—',
      color:
        chains.length === 0
          ? 'var(--severity-healthy)'
          : longest >= 5
            ? 'var(--severity-warning)'
            : 'var(--accent-primary)',
    },
    {
      label: 'Avg Renames/File',
      value: filesWithRenames > 0 ? String(avg) : '—',
      color:
        filesWithRenames > 0
          ? 'var(--accent-primary)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Most Renamed',
      value: topChain ? topBasename : '—',
      color: topChain ? 'var(--accent-primary)' : 'var(--severity-healthy)',
    },
  ];
}
