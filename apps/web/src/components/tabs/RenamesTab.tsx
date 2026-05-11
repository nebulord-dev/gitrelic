import { useMemo } from 'react';

import { NarrativeKPI } from '../shared/NarrativeKPI';
import { fmt } from '../theme';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { FileRenameChain, GitrelicReport } from '@gitrelic/core';

interface RenamesTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

interface TierResult {
  variant: BadgeVariant;
  label: string;
}

function rangeTier(filesWithRenames: number, longestChain: number): TierResult {
  if (filesWithRenames === 0) return { variant: 'stale', label: 'No Renames' };
  if (longestChain >= 2)
    return { variant: 'coupling', label: 'Tracked Chains' };
  return { variant: 'coupling', label: 'Renames Detected' };
}

function topRenamed(chains: FileRenameChain[], n: number): FileRenameChain[] {
  // Tiebreak by full path so this surface agrees with the metrics-strip
  // `Most Renamed` slot when renameCounts are tied (the common degenerate
  // case on repos where every chain is a single old → new pair).
  return [...chains]
    .sort((a, b) => {
      if (b.renameCount !== a.renameCount) return b.renameCount - a.renameCount;
      return a.currentPath.localeCompare(b.currentPath);
    })
    .slice(0, n);
}

function TopRenamedList({ rows }: { rows: FileRenameChain[] }) {
  if (rows.length === 0) {
    return (
      <p className="max-w-md text-sm text-text-secondary">
        No renames detected in this analysis window.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
        Most renamed
      </div>
      {rows.map((r) => {
        const basename = r.currentPath.split('/').pop() ?? r.currentPath;
        const dir = r.currentPath.slice(
          0,
          Math.max(0, r.currentPath.length - basename.length - 1),
        );
        return (
          <div key={r.currentPath} className="leading-[1.5]">
            <span className="font-mono text-text-primary">{basename}</span>
            {dir.length > 0 && (
              <>
                {' '}
                <span className="font-mono text-text-tertiary text-[10px]">
                  {dir}
                </span>
              </>
            )}
            {' · '}
            <span className="text-text-tertiary">
              <span className="font-mono text-text-primary">
                {fmt(r.renameCount)}
              </span>{' '}
              rename{r.renameCount === 1 ? '' : 's'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RenamesTab({ report, onApplyPreset }: RenamesTabProps) {
  const rt = report.renameTracking;
  const totalFiles = report.loc.totalFiles;

  const longestChain = useMemo(
    () => rt.chains.reduce((max, c) => Math.max(max, c.renameCount), 0),
    [rt.chains],
  );

  const top = useMemo(() => topRenamed(rt.chains, 3), [rt.chains]);
  const tier = rangeTier(rt.filesWithRenames, longestChain);
  const pct =
    totalFiles > 0 ? Math.round((rt.filesWithRenames / totalFiles) * 100) : 0;

  return (
    <NarrativeKPI
      bigNumber={fmt(rt.filesWithRenames)}
      tier={tier}
      metric="FILES RENAMED"
      finding={<TopRenamedList rows={top} />}
      subline={
        <span>
          <span className="font-mono text-text-primary">
            {fmt(rt.totalRenames)}
          </span>{' '}
          rename event{rt.totalRenames === 1 ? '' : 's'} · longest chain:{' '}
          <span className="font-mono">{longestChain}</span> step
          {longestChain === 1 ? '' : 's'} ·{' '}
          <span className="font-mono">{pct}%</span> of tracked files have rename
          history
        </span>
      }
      seeAlso={[
        { label: 'Hotspots', presetId: 'hotspots' },
        { label: 'Churn', presetId: 'churn' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
