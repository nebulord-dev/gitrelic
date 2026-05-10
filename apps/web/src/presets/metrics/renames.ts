import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { FileRenameChain, GitrelicReport } from '@gitrelic/core';

export function renamesMetrics(report: GitrelicReport): Metric[] {
  const { chains, totalRenames, filesWithRenames } = report.renameTracking;

  // Tiebreak by full path when renameCounts are tied so the strip's
  // `Most Renamed` agrees with the bottom-panel `Most renamed` top-3.
  // Without the tiebreak we'd silently pick chains[0] (whatever order the
  // analyzer iterated trackedFiles), which on tied-count repos disagrees
  // with any sorted UI surface downstream.
  let topChain: FileRenameChain | undefined;
  for (const c of chains) {
    if (
      !topChain ||
      c.renameCount > topChain.renameCount ||
      (c.renameCount === topChain.renameCount &&
        c.currentPath.localeCompare(topChain.currentPath) < 0)
    ) {
      topChain = c;
    }
  }
  const longest = topChain?.renameCount ?? 0;

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
