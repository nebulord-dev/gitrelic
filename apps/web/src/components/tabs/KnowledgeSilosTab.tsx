import { NarrativeKPI } from '../shared/NarrativeKPI';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface KnowledgeSilosTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

function riskLevel(index: number): { variant: BadgeVariant; label: string } {
  if (index < 40) return { variant: 'healthy', label: 'Low Risk' };
  if (index < 70) return { variant: 'warning', label: 'Moderate Risk' };
  return { variant: 'critical', label: 'High Risk' };
}

export function KnowledgeSilosTab({
  report,
  onApplyPreset,
}: KnowledgeSilosTabProps) {
  const kc = report.knowledgeConcentration;
  const risk = riskLevel(kc.concentrationIndex);

  return (
    <NarrativeKPI
      bigNumber={`${kc.concentrationIndex.toFixed(0)}%`}
      tier={risk}
      metric="Concentration Index"
      finding={
        <>
          <span className="font-mono text-text-primary font-semibold">
            {kc.singleAuthorFiles}
          </span>{' '}
          of {kc.totalFiles} files have a single dominant author (80%+ commits)
        </>
      }
      subline={kc.summary}
      seeAlso={[
        { label: 'Bus Factor', presetId: 'bus-factor' },
        { label: 'Ghost Files', presetId: 'ghost-files' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
