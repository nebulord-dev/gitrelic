import { aggregateCommitTimingByDirectory } from '../../utils/commitTimingByDirectory';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface CommitTimingTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;
export const HIGH_STRESS_THRESHOLD = 70;

// Headcount tiering: 0 = Healthy, 1..MODERATE_THRESHOLD-1 = Moderate, ≥MODERATE_THRESHOLD = High Stress.
// Same shape as Parallel Dev — Team & Activity group consistency.
export const MODERATE_THRESHOLD = 5;

function tierBadge(highStressCount: number): {
  variant: BadgeVariant;
  label: string;
} {
  if (highStressCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highStressCount < MODERATE_THRESHOLD)
    return { variant: 'warning', label: 'Moderate' };
  return { variant: 'critical', label: 'High Stress' };
}

export function CommitTimingTab({
  report,
  onApplyPreset,
}: CommitTimingTabProps) {
  const {
    highStress,
    authorStress,
    files,
    repoLateNightPercent,
    repoWeekendPercent,
  } = report.commitTiming;

  const totalCommits = files.reduce((sum, f) => sum + f.totalCommits, 0);
  const tier = tierBadge(highStress);
  const topAuthors = authorStress.slice(0, TOP_FILES_COUNT);

  const highStressFiles = files.filter(
    (f) => f.stressScore >= HIGH_STRESS_THRESHOLD,
  );
  const allDirectoryRows = aggregateCommitTimingByDirectory(highStressFiles);
  const directoryRows = allDirectoryRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(
    0,
    allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT,
  );
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(highStress)}
      tier={tier}
      metric={`Files ≥${HIGH_STRESS_THRESHOLD} Stress`}
      finding={
        topAuthors.length > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
              Top stressed contributors
            </div>
            {topAuthors.map((a) => (
              <div key={a.email} className="leading-[1.5]">
                <span className="text-text-primary">{a.name}</span>{' '}
                <span className="text-text-tertiary">
                  · Late:{' '}
                  <span className="font-mono text-text-primary font-semibold">
                    {a.lateNightPercent}%
                  </span>{' '}
                  · Weekend:{' '}
                  <span className="font-mono text-text-primary font-semibold">
                    {a.weekendPercent}%
                  </span>{' '}
                  ·{' '}
                  <span className="font-mono text-text-primary font-semibold">
                    {a.totalCommits}
                  </span>{' '}
                  commits
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            No contributors with sufficient commit history to score (need ≥5
            commits per author).
          </>
        )
      }
      subline={
        totalCommits > 0 || authorStress.length > 0 ? (
          <>
            <strong>{repoLateNightPercent}%</strong> late-night ·{' '}
            <strong>{repoWeekendPercent}%</strong> weekend across the analyzed
            window
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
        { label: 'Shame', presetId: 'shame' },
        { label: 'Hotspots', presetId: 'hotspots' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
