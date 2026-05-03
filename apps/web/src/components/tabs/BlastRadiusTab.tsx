import { aggregateBlastByDirectory } from '../../utils/blastByDirectory';
import {
  type BlastTier,
  HIGH_BLAST_THRESHOLD,
  blastTierFor,
} from '../hero/BlastHistogram';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import { fileName } from '../theme';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface BlastRadiusTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

// Maps the count of high-blast files (≥70) to a Badge config. Distinct from
// `blastTierFor`, which maps an individual file's score to a `BlastTier` string.
function riskBadge(highBlastCount: number): {
  variant: BadgeVariant;
  label: string;
} {
  if (highBlastCount === 0) return { variant: 'healthy', label: 'Low Risk' };
  if (highBlastCount < 10)
    return { variant: 'warning', label: 'Moderate Risk' };
  return { variant: 'critical', label: 'High Risk' };
}

function countByTier(scores: number[]): Record<BlastTier, number> {
  const counts: Record<BlastTier, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  for (const s of scores) counts[blastTierFor(s)]++;
  return counts;
}

export function BlastRadiusTab({ report, onApplyPreset }: BlastRadiusTabProps) {
  const { files, summary } = report.blastRadius;
  const highBlastFiles = files.filter(
    (f) => f.blastScore >= HIGH_BLAST_THRESHOLD,
  );
  const tier = riskBadge(highBlastFiles.length);
  // Slice from `highBlastFiles`, not from `topBlasters`, so the "Top blast
  // files" header never includes sub-threshold files — `topBlasters` is the
  // whole-repo top-10 by score, which can pull in files below 70 when only
  // 1–2 files are actually above the threshold. `files` is sorted desc by
  // blastScore in the core analyzer, so `highBlastFiles` preserves that order.
  const topFiles = highBlastFiles.slice(0, TOP_FILES_COUNT);
  const tierCounts = countByTier(files.map((f) => f.blastScore));
  const allDirectoryRows = aggregateBlastByDirectory(highBlastFiles);
  const directoryRows = allDirectoryRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(
    0,
    allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT,
  );
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(highBlastFiles.length)}
      tier={tier}
      metric={`Files ≥${HIGH_BLAST_THRESHOLD} Blast`}
      finding={
        highBlastFiles.length > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
              Top blast files
            </div>
            {topFiles.map((f) => (
              <div key={f.file} className="leading-[1.5]">
                <span className="font-mono text-text-primary">
                  {fileName(f.file)}
                </span>{' '}
                <span className="text-text-tertiary">
                  <span className="font-mono text-text-primary font-semibold">
                    {f.avgCoChangedFiles.toFixed(1)}
                  </span>{' '}
                  avg /{' '}
                  <span className="font-mono text-text-primary font-semibold">
                    {f.maxCoChangedFiles}
                  </span>{' '}
                  peak
                </span>
              </div>
            ))}
          </div>
        ) : files.length > 0 ? (
          <>
            No files cross the high-blast threshold — coupling is
            well-distributed.
          </>
        ) : (
          <>No co-change activity in the analyzed window.</>
        )
      }
      subline={
        files.length > 0 ? (
          <>
            Tier mix: <strong>{tierCounts.low.toLocaleString()}</strong> low ·{' '}
            <strong>{tierCounts.medium.toLocaleString()}</strong> medium ·{' '}
            <strong>{tierCounts.high.toLocaleString()}</strong> high ·{' '}
            <strong>{tierCounts.critical.toLocaleString()}</strong> critical
          </>
        ) : (
          summary
        )
      }
      extras={
        directoryRows.length > 0 ? (
          <div>
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px] mb-2">
              Where they live
            </div>
            <div className="flex flex-col gap-1">
              {directoryRows.map((row) => (
                <div
                  key={row.directory}
                  className="flex items-center gap-3 text-[11px] leading-[1.4]"
                >
                  <Tooltip
                    content={row.directory || '(root)'}
                    wrapperClassName="block flex-1 min-w-0 font-mono text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    {row.directory || '(root)'}
                  </Tooltip>
                  <div className="w-20 h-1 bg-surface-tertiary rounded-xs overflow-hidden shrink-0">
                    <div
                      className="h-full bg-severity-critical opacity-70"
                      style={{ width: `${(row.count / maxDirCount) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-text-primary font-semibold inline-block min-w-8 text-right">
                    {row.count}
                  </span>
                  <span className="text-text-tertiary text-[10px] inline-block min-w-9 text-right">
                    {(row.share * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
            {hiddenDirectoryCount > 0 && (
              <div className="mt-1.5 text-[10px] text-text-tertiary">
                + {hiddenDirectoryCount} more{' '}
                {hiddenDirectoryCount === 1 ? 'directory' : 'directories'}
              </div>
            )}
          </div>
        ) : undefined
      }
      seeAlso={[
        { label: 'Coupling', presetId: 'coupling' },
        { label: 'Hotspots', presetId: 'hotspots' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
