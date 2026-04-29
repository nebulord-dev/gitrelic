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

function blastTier(highBlast: number): { variant: BadgeVariant; label: string } {
  if (highBlast === 0) return { variant: 'healthy', label: 'Low Risk' };
  if (highBlast < 10) return { variant: 'warning', label: 'Moderate Risk' };
  return { variant: 'critical', label: 'High Risk' };
}

export function BlastRadiusTab({ report, onApplyPreset }: BlastRadiusTabProps) {
  const { files, topBlasters, summary } = report.blastRadius;
  const highBlast = files.filter((f) => f.blastScore >= HIGH_BLAST_THRESHOLD).length;
  const tier = blastTier(highBlast);
  const top = topBlasters[0];

  return (
    <NarrativeKPI
      bigNumber={String(highBlast)}
      tier={tier}
      metric={`Files ≥${HIGH_BLAST_THRESHOLD} Blast`}
      finding={
        top ? (
          <>
            Top blast file{' '}
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {fileName(top.file)}
            </span>{' '}
            co-changes with{' '}
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-primary)',
                fontWeight: 600,
              }}
            >
              {top.avgCoChangedFiles.toFixed(1)}
            </span>{' '}
            files on average ({top.maxCoChangedFiles} peak)
          </>
        ) : (
          <>No co-change activity in the analyzed window.</>
        )
      }
      subline={summary}
      seeAlso={[
        { label: 'Coupling', presetId: 'coupling' },
        { label: 'Hotspots', presetId: 'hotspots' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
