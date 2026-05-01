import { aggregateBusFactorByDirectory } from '../../utils/busFactorByDirectory';
import { topDominantOwners } from '../../utils/topDominantOwners';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';

import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface BusFactorTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const TOP_OWNERS_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

// Bus factor tiering: 1 = Critical (single point of failure), 2-3 = High Risk,
// 4+ = Resilient. Anchored on the canonical "bus factor" definition — the
// minimum number of people whose departure would erase ownership of the
// top-N concentrated files.
export const RESILIENT_THRESHOLD = 4;
export const HIGH_RISK_THRESHOLD = 2;

function tierBadge(overallBusFactor: number): { variant: BadgeVariant; label: string } {
  if (overallBusFactor === 0) return { variant: 'healthy', label: 'No Data' };
  if (overallBusFactor < HIGH_RISK_THRESHOLD) return { variant: 'critical', label: 'Critical' };
  if (overallBusFactor < RESILIENT_THRESHOLD) return { variant: 'warning', label: 'High Risk' };
  return { variant: 'healthy', label: 'Resilient' };
}

const monoBold = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  fontWeight: 600,
} as const;

export function BusFactorTab({ report, onApplyPreset }: BusFactorTabProps) {
  const { files, criticalFiles, overallBusFactor } = report.busFactors;
  const tier = tierBadge(overallBusFactor);

  // Tier mix from the analyzer's per-file risk enum (critical/high/medium/low).
  const tierMix = files.reduce(
    (acc, f) => {
      acc[f.risk] = (acc[f.risk] ?? 0) + 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<
      'critical' | 'high' | 'medium' | 'low',
      number
    >,
  );

  const topOwners = topDominantOwners(criticalFiles).slice(0, TOP_OWNERS_COUNT);

  const allDirectoryRows = aggregateBusFactorByDirectory(criticalFiles);
  const directoryRows = allDirectoryRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(0, allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT);
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(overallBusFactor)}
      tier={tier}
      metric="Bus Factor"
      finding={
        topOwners.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Top dominant owners
            </div>
            {topOwners.map((o) => (
              <div key={o.author} style={{ lineHeight: 1.5 }}>
                <span style={{ ...monoBold, color: 'var(--severity-critical)' }}>{o.author}</span>{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>
                  — <strong style={{ color: 'var(--text-primary)' }}>{o.count}</strong>{' '}
                  {o.count === 1 ? 'file' : 'files'} ({(o.share * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        ) : files.length > 0 ? (
          <>No files have a single dominant author — ownership is well distributed.</>
        ) : (
          <>No bus-factor signal in the analysis window.</>
        )
      }
      subline={
        files.length > 0 ? (
          <>
            Tier mix:{' '}
            <strong style={{ color: 'var(--severity-critical)' }}>{tierMix.critical}</strong>{' '}
            critical · <strong style={{ color: '#d27b22' }}>{tierMix.high}</strong> high ·{' '}
            <strong style={{ color: 'var(--severity-warning)' }}>{tierMix.medium}</strong> medium ·{' '}
            <strong style={{ color: 'var(--severity-healthy)' }}>{tierMix.low}</strong> low.
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
        { label: 'Knowledge Silos', presetId: 'knowledge-silos' },
        { label: 'Ghost Files', presetId: 'ghost-files' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
