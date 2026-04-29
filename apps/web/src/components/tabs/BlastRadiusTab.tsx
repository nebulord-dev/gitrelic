import { aggregateBlastByDirectory } from '../../utils/blastByDirectory';
import { type BlastTier, HIGH_BLAST_THRESHOLD, blastTierFor } from '../hero/BlastHistogram';
import { NarrativeKPI } from '../shared/NarrativeKPI';
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
function riskBadge(highBlastCount: number): { variant: BadgeVariant; label: string } {
  if (highBlastCount === 0) return { variant: 'healthy', label: 'Low Risk' };
  if (highBlastCount < 10) return { variant: 'warning', label: 'Moderate Risk' };
  return { variant: 'critical', label: 'High Risk' };
}

function countByTier(scores: number[]): Record<BlastTier, number> {
  const counts: Record<BlastTier, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const s of scores) counts[blastTierFor(s)]++;
  return counts;
}

const monoBold = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  fontWeight: 600,
} as const;

export function BlastRadiusTab({ report, onApplyPreset }: BlastRadiusTabProps) {
  const { files, summary } = report.blastRadius;
  const highBlastFiles = files.filter((f) => f.blastScore >= HIGH_BLAST_THRESHOLD);
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
  const hiddenDirectoryCount = Math.max(0, allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT);
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(highBlastFiles.length)}
      tier={tier}
      metric={`Files ≥${HIGH_BLAST_THRESHOLD} Blast`}
      finding={
        highBlastFiles.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Top blast files
            </div>
            {topFiles.map((f) => (
              <div key={f.file} style={{ lineHeight: 1.5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {fileName(f.file)}
                </span>{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>
                  <span style={monoBold}>{f.avgCoChangedFiles.toFixed(1)}</span> avg /{' '}
                  <span style={monoBold}>{f.maxCoChangedFiles}</span> peak
                </span>
              </div>
            ))}
          </div>
        ) : files.length > 0 ? (
          <>No files cross the high-blast threshold — coupling is well-distributed.</>
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
                  <span
                    style={{
                      ...monoBold,
                      minWidth: 32,
                      textAlign: 'right',
                      display: 'inline-block',
                    }}
                  >
                    {row.count}
                  </span>
                  <span
                    style={{
                      color: 'var(--text-tertiary)',
                      fontSize: 10,
                      minWidth: 36,
                      textAlign: 'right',
                      display: 'inline-block',
                    }}
                  >
                    {(row.share * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
            {hiddenDirectoryCount > 0 && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  color: 'var(--text-tertiary)',
                }}
              >
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
