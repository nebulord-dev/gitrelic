import { aggregateRewriteByDirectory } from '../../utils/rewriteByDirectory';
import { HIGH_REWRITE_THRESHOLD } from '../hero/RewriteHistogram';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import { fileName, fmt } from '../theme';

import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface RewriteRatioTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

// Headcount tiering: 0 = Healthy, 1 to MODERATE_THRESHOLD-1 = Moderate, ≥MODERATE_THRESHOLD = High Rewrite.
// Shared with rewriteRatioMetrics so the panel badge and metrics-strip slot 2 color cannot drift.
export const MODERATE_THRESHOLD = 5;

function tierBadge(highRewriteCount: number): {
  variant: BadgeVariant;
  label: string;
} {
  if (highRewriteCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highRewriteCount < MODERATE_THRESHOLD)
    return { variant: 'warning', label: 'Moderate' };
  return { variant: 'critical', label: 'High Rewrite' };
}

function signed(n: number): string {
  if (n > 0) return `+${fmt(n)}`;
  if (n < 0) return `−${fmt(-n)}`;
  return '0';
}

export function RewriteRatioTab({
  report,
  onApplyPreset,
}: RewriteRatioTabProps) {
  const { files, totalInsertions, totalDeletions, highRewrite } =
    report.rewriteRatio;
  // Slice top files from the threshold-filtered subset (per RELIC-315 lesson):
  // never include sub-threshold files in the "Top rewrite files" header.
  const highRewriteFiles = files.filter(
    (f) => f.rewriteScore >= HIGH_REWRITE_THRESHOLD,
  );
  const tier = tierBadge(highRewrite);
  const topFiles = highRewriteFiles.slice(0, TOP_FILES_COUNT);

  // Subline shows raw edit balance, not the dampened display score — `ratio` is the
  // undampened min/max ratio (intent: "is this codebase shaped like growth or rewrite?").
  const balancedCount = files.filter((f) => f.ratio > 0.5).length;
  const balancedPct =
    files.length > 0 ? Math.round((balancedCount / files.length) * 100) : 0;

  const allDirectoryRows = aggregateRewriteByDirectory(highRewriteFiles);
  const directoryRows = allDirectoryRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(
    0,
    allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT,
  );
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(highRewrite)}
      tier={tier}
      metric={`Files ≥${HIGH_REWRITE_THRESHOLD} Rewrite`}
      finding={
        highRewrite > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
              Top rewrite files
            </div>
            {topFiles.map((f) => (
              <div key={f.file} className="leading-[1.5]">
                <span className="font-mono text-text-primary">
                  {fileName(f.file)}
                </span>{' '}
                <span className="text-text-tertiary">
                  <span className="font-mono font-semibold text-severity-healthy">
                    +{fmt(f.totalInsertions)}
                  </span>{' '}
                  /{' '}
                  <span className="font-mono font-semibold text-severity-critical">
                    −{fmt(f.totalDeletions)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : files.length > 0 ? (
          <>
            No files cross the high-rewrite threshold — code edits skew toward
            growth or shrink, not replace.
          </>
        ) : (
          <>No rewrite signal in the analysis window.</>
        )
      }
      subline={
        files.length > 0 ? (
          <>
            Repo balance:{' '}
            <strong className="text-severity-healthy">
              +{fmt(totalInsertions)}
            </strong>{' '}
            /{' '}
            <strong className="text-severity-critical">
              −{fmt(totalDeletions)}
            </strong>{' '}
            · net <strong>{signed(totalInsertions - totalDeletions)}</strong> ·{' '}
            <strong>{balancedPct}%</strong> of files balanced (ratio &gt; 0.5).
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
                      className="h-full bg-severity-warning opacity-70"
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
        { label: 'Churn', presetId: 'churn' },
        { label: 'Hotspots', presetId: 'hotspots' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
