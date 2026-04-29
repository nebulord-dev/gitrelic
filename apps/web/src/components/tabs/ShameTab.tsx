import { aggregateShameByDirectory } from '../../utils/shameByDirectory';
import { NarrativeKPI } from '../shared/NarrativeKPI';
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

// Mirrors CONFIDENCE_FLOOR in packages/core/src/analyzers/forensics.ts.
const CONFIDENCE_FLOOR = 5;

function tierBadge(highShameCount: number): { variant: BadgeVariant; label: string } {
  if (highShameCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highShameCount < 10) return { variant: 'warning', label: 'Moderate Shame' };
  return { variant: 'critical', label: 'High Shame' };
}

const monoBold = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  fontWeight: 600,
} as const;

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Top shame files
            </div>
            {topFiles.map((f) => (
              <div key={f.file} style={{ lineHeight: 1.5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {fileName(f.file)}
                </span>{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>
                  <span style={monoBold}>{f.shameScore}</span> ·{' '}
                  <span style={monoBold}>{f.shameCommitCount}</span> shame commit
                  {f.shameCommitCount === 1 ? '' : 's'}
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
            <strong style={{ color: 'var(--severity-critical)' }}>{keywordTiers.critical}</strong>{' '}
            critical (revert/hotfix/oops) ·{' '}
            <strong style={{ color: 'var(--severity-warning)' }}>{keywordTiers.moderate}</strong>{' '}
            moderate (hack/workaround) ·{' '}
            <strong style={{ color: '#9b8b3e' }}>{keywordTiers.mild}</strong> mild (fix/bug)
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
              Across <strong style={{ color: 'var(--text-secondary)' }}>{files.length}</strong>{' '}
              {files.length === 1 ? 'file' : 'files'} (after min-commit-confidence floor of{' '}
              {CONFIDENCE_FLOOR}).
            </div>
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
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={row.directory || '(root)'}
                  >
                    {row.directory || '(root)'}
                  </div>
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
                        background: 'var(--severity-critical)',
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
        { label: 'Cursed Files', presetId: 'cursed-files' },
        { label: 'Bus Factor', presetId: 'bus-factor' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
