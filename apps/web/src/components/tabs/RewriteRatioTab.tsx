import { aggregateRewriteByDirectory } from '../../utils/rewriteByDirectory';
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

const HIGH_REWRITE_THRESHOLD = 70;
const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

function tierBadge(highRewriteCount: number): { variant: BadgeVariant; label: string } {
  if (highRewriteCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highRewriteCount < 5) return { variant: 'warning', label: 'Moderate' };
  return { variant: 'critical', label: 'High Rewrite' };
}

const monoBold = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  fontWeight: 600,
} as const;

function signed(n: number): string {
  if (n > 0) return `+${fmt(n)}`;
  if (n < 0) return `−${fmt(-n)}`;
  return '0';
}

export function RewriteRatioTab({ report, onApplyPreset }: RewriteRatioTabProps) {
  const { files, totalInsertions, totalDeletions, highRewrite } = report.rewriteRatio;
  // Slice top files from the threshold-filtered subset (per RELIC-315 lesson):
  // never include sub-threshold files in the "Top rewrite files" header.
  const highRewriteFiles = files.filter((f) => f.rewriteScore >= HIGH_REWRITE_THRESHOLD);
  const tier = tierBadge(highRewrite);
  const topFiles = highRewriteFiles.slice(0, TOP_FILES_COUNT);

  const balancedCount = files.filter((f) => f.ratio > 0.5).length;
  const balancedPct = files.length > 0 ? Math.round((balancedCount / files.length) * 100) : 0;

  const allDirectoryRows = aggregateRewriteByDirectory(highRewriteFiles);
  const directoryRows = allDirectoryRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(0, allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT);
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(highRewrite)}
      tier={tier}
      metric={`Files ≥${HIGH_REWRITE_THRESHOLD} Rewrite`}
      finding={
        highRewrite > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Top rewrite files
            </div>
            {topFiles.map((f) => (
              <div key={f.file} style={{ lineHeight: 1.5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {fileName(f.file)}
                </span>{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>
                  <span style={{ ...monoBold, color: 'var(--severity-healthy)' }}>
                    +{fmt(f.totalInsertions)}
                  </span>{' '}
                  /{' '}
                  <span style={{ ...monoBold, color: 'var(--severity-critical)' }}>
                    −{fmt(f.totalDeletions)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : files.length > 0 ? (
          <>
            No files cross the high-rewrite threshold — code edits skew toward growth or shrink, not
            replace.
          </>
        ) : (
          <>No rewrite signal in the analysis window.</>
        )
      }
      subline={
        files.length > 0 ? (
          <>
            Repo balance:{' '}
            <strong style={{ color: 'var(--severity-healthy)' }}>+{fmt(totalInsertions)}</strong> /{' '}
            <strong style={{ color: 'var(--severity-critical)' }}>−{fmt(totalDeletions)}</strong> ·
            net <strong>{signed(totalInsertions - totalDeletions)}</strong> ·{' '}
            <strong>{balancedPct}%</strong> of files balanced (ratio &gt; 0.5).
          </>
        ) : null
      }
      extras={
        directoryRows.length > 0 ? (
          <div>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              Where they live
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {directoryRows.map((row) => (
                <div
                  key={row.directory}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: 11,
                    lineHeight: 1.4,
                  }}
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
                  <div
                    style={{
                      width: 80,
                      height: 4,
                      background: 'var(--surface-tertiary)',
                      borderRadius: 2,
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: `${(row.count / maxDirCount) * 100}%`,
                        height: '100%',
                        background: 'var(--severity-warning)',
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span style={{ ...monoBold, minWidth: 32, textAlign: 'right' }}>{row.count}</span>
                  <span
                    style={{
                      color: 'var(--text-tertiary)',
                      fontSize: 10,
                      minWidth: 36,
                      textAlign: 'right',
                    }}
                  >
                    {(row.share * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
            {hiddenDirectoryCount > 0 && (
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
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
