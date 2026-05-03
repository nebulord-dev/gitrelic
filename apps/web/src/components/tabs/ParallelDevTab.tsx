import { aggregateParallelDevByDirectory } from '../../utils/parallelDevByDirectory';
import { HIGH_PARALLEL_THRESHOLD } from '../hero/ParallelScoreHistogram';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import { fileName } from '../theme';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface ParallelDevTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

// Headcount tiering: 0 = Healthy, 1..MODERATE_THRESHOLD-1 = Moderate, ≥MODERATE_THRESHOLD = High Concurrency.
// Same shape as Rewrite Ratio's panel — concurrent-work files are uncommon at any repo size.
export const MODERATE_THRESHOLD = 5;

function tierBadge(highParallelCount: number): {
  variant: BadgeVariant;
  label: string;
} {
  if (highParallelCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highParallelCount < MODERATE_THRESHOLD)
    return { variant: 'warning', label: 'Moderate' };
  return { variant: 'critical', label: 'High Concurrency' };
}

export function ParallelDevTab({ report, onApplyPreset }: ParallelDevTabProps) {
  const { files, highParallel, tierMix } = report.parallelDev;
  // Slice top files from the threshold-filtered subset (per RELIC-315 lesson).
  const highParallelFiles = files.filter(
    (f) => f.parallelScore >= HIGH_PARALLEL_THRESHOLD,
  );
  const tier = tierBadge(highParallel);
  const topFiles = highParallelFiles.slice(0, TOP_FILES_COUNT);

  // Subline collapses tierMix's 4 storage buckets into 3 display labels per
  // polish-pattern.md: low (0–24), moderate (25–49), high+critical (50+).
  // Bus Factor / Blast Radius display 4 separately; this analyzer's spec
  // calls for 3 because "critical" doesn't add forensic information for
  // concurrency risk over "high" (the tier where defect-correlation kicks in).
  const sublineHigh = tierMix.high + tierMix.critical;

  const allDirectoryRows = aggregateParallelDevByDirectory(highParallelFiles);
  const directoryRows = allDirectoryRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(
    0,
    allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT,
  );
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(highParallel)}
      tier={tier}
      metric={`Files ≥${HIGH_PARALLEL_THRESHOLD} Parallel`}
      finding={
        highParallel > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
              Top parallel files
            </div>
            {topFiles.map((f) => (
              <div key={f.file} className="leading-[1.5]">
                <span className="font-mono text-text-primary">
                  {fileName(f.file)}
                </span>{' '}
                <span className="text-text-tertiary">
                  <span className="font-mono text-text-primary font-semibold">
                    {f.parallelWeeks}
                  </span>{' '}
                  parallel weeks ·{' '}
                  <span className="font-mono text-text-primary font-semibold">
                    {f.peakAuthors}
                  </span>{' '}
                  peak authors
                </span>
              </div>
            ))}
          </div>
        ) : files.length > 0 ? (
          <>
            No files cross the high-parallel threshold — concurrent edits are
            spread across distinct weeks.
          </>
        ) : (
          <>No parallel-development signal in the analyzed window.</>
        )
      }
      subline={
        files.length > 0 ? (
          <>
            Tier mix: <strong>{sublineHigh.toLocaleString()}</strong> high ·{' '}
            <strong>{tierMix.medium.toLocaleString()}</strong> moderate ·{' '}
            <strong>{tierMix.low.toLocaleString()}</strong> low
          </>
        ) : null
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
        { label: 'Co-Authors', presetId: 'co-authors' },
        { label: 'Coupling', presetId: 'coupling' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
