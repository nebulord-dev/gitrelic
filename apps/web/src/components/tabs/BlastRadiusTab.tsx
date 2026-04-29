import { type BlastTier, blastTierFor } from '../hero/BlastHistogram';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { fileName } from '../theme';

import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface BlastRadiusTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const HIGH_BLAST_THRESHOLD = 70;
const TOP_FILES_COUNT = 3;

function blastTier(highBlast: number): { variant: BadgeVariant; label: string } {
  if (highBlast === 0) return { variant: 'healthy', label: 'Low Risk' };
  if (highBlast < 10) return { variant: 'warning', label: 'Moderate Risk' };
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
  const { files, topBlasters, summary } = report.blastRadius;
  const highBlast = files.filter((f) => f.blastScore >= HIGH_BLAST_THRESHOLD).length;
  const tier = blastTier(highBlast);
  const topFiles = topBlasters.slice(0, TOP_FILES_COUNT);
  const tierCounts = countByTier(files.map((f) => f.blastScore));

  return (
    <NarrativeKPI
      bigNumber={String(highBlast)}
      tier={tier}
      metric={`Files ≥${HIGH_BLAST_THRESHOLD} Blast`}
      finding={
        topFiles.length > 0 ? (
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
      seeAlso={[
        { label: 'Coupling', presetId: 'coupling' },
        { label: 'Hotspots', presetId: 'hotspots' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
