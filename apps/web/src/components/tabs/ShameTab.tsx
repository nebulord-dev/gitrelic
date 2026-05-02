import { aggregateShameByDirectory } from '../../utils/shameByDirectory';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import { fileName } from '../theme';

import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface ShameTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const HIGH_SHAME_THRESHOLD = 70;
const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

function tierBadge(highShameCount: number): { variant: BadgeVariant; label: string } {
  if (highShameCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highShameCount < 10) return { variant: 'warning', label: 'Moderate Shame' };
  return { variant: 'critical', label: 'High Shame' };
}

export function ShameTab({ report, onApplyPreset }: ShameTabProps) {
  const { files, totalShameCommits, keywordTiers } = report.forensics;
  const highShameFiles = files.filter((f) => f.shameScore >= HIGH_SHAME_THRESHOLD);
  const tier = tierBadge(highShameFiles.length);
  // Slice from the threshold-filtered subset, not from the whole-repo list,
  // so the "Top files" header never includes sub-threshold rows. (Lesson from RELIC-315.)
  const topFiles = highShameFiles.slice(0, TOP_FILES_COUNT);
  const allDirectoryRows = aggregateShameByDirectory(highShameFiles);
  const directoryRows = allDirectoryRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(0, allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT);
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(highShameFiles.length)}
      tier={tier}
      metric={`Files ≥${HIGH_SHAME_THRESHOLD} Shame`}
      finding={
        highShameFiles.length > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
              Top shame files
            </div>
            {topFiles.map((f) => (
              <div key={f.file} className="leading-[1.5]">
                <span className="font-mono text-text-primary">{fileName(f.file)}</span>{' '}
                <span className="text-text-tertiary">
                  <span className="font-mono text-text-primary font-semibold">{f.shameScore}</span>{' '}
                  ·{' '}
                  <span className="font-mono text-text-primary font-semibold">
                    {f.shameCommitCount}
                  </span>{' '}
                  shame commit{f.shameCommitCount === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
        ) : files.length > 0 ? (
          <>No files cross the high-shame threshold — commit-message hygiene is healthy.</>
        ) : (
          <>No shame signals detected in the analysis window.</>
        )
      }
      subline={
        totalShameCommits > 0 ? (
          <>
            <strong>{totalShameCommits.toLocaleString()}</strong> shame{' '}
            {totalShameCommits === 1 ? 'commit' : 'commits'} ·{' '}
            <strong className="text-severity-critical">{keywordTiers.critical}</strong> critical
            (revert/hotfix/oops) ·{' '}
            <strong className="text-severity-warning">{keywordTiers.moderate}</strong> moderate
            (hack/workaround) · <strong className="text-[#9b8b3e]">{keywordTiers.mild}</strong> mild
            (fix/bug)
            <div className="mt-1 text-[11px] text-text-tertiary">
              Across <strong className="text-text-secondary">{files.length}</strong>{' '}
              {files.length === 1 ? 'file' : 'files'} with any shame signal.
            </div>
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
                    wrapperStyle={{
                      display: 'block',
                      flex: 1,
                      minWidth: 0,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.directory || '(root)'}
                  </Tooltip>
                  <div className="w-20 h-1 bg-surface-tertiary rounded-xs overflow-hidden shrink-0">
                    <div
                      style={{
                        width: `${(row.count / maxDirCount) * 100}%`,
                        background: 'var(--severity-critical)',
                        opacity: 0.7,
                      }}
                      className="h-full"
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
        { label: 'Cursed Files', presetId: 'cursed-files' },
        { label: 'Bus Factor', presetId: 'bus-factor' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
