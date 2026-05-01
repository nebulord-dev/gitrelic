import type { ReactNode } from 'react';

import { severityText } from '../../utils/classMaps';
import { cn } from '../../utils/cn';
import Badge from './Badge';

import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';

export interface SeeAlsoLink {
  label: string;
  presetId: PresetId;
}

interface NarrativeKPIProps {
  bigNumber: string;
  tier: { variant: BadgeVariant; label: string };
  metric: string;
  finding: ReactNode;
  subline?: ReactNode;
  /**
   * Optional content rendered alongside the KPI / finding / subline row and
   * above the sticky see-also footer. On wide containers (≥880px) the extras
   * sit side-by-side with the KPI row; on narrow containers they stack
   * beneath. Use for analyzer-specific drill-downs (directory rollups,
   * secondary callouts) that don't fit the constrained subline area. Leave
   * undefined for the canonical sparse layout.
   */
  extras?: ReactNode;
  seeAlso: [SeeAlsoLink, SeeAlsoLink];
  onApplyPreset: (id: PresetId) => void;
}

const linkClass =
  'bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline';

export function NarrativeKPI({
  bigNumber,
  tier,
  metric,
  finding,
  subline,
  extras,
  seeAlso,
  onApplyPreset,
}: NarrativeKPIProps) {
  return (
    <div className="flex flex-col min-h-full">
      <div className="narrative-kpi-body flex-1 py-3">
        <div className="narrative-kpi-stack">
          <div className="narrative-kpi-row flex gap-6 items-start">
            <div className="text-center min-w-[120px]">
              <div
                data-testid="narrative-kpi-big-number"
                className={cn(
                  'text-[36px] font-bold font-mono leading-none',
                  severityText[tier.variant],
                )}
              >
                {bigNumber}
              </div>
              <div className="mt-1">
                <Badge variant={tier.variant}>{tier.label}</Badge>
              </div>
              <div className="text-[9px] text-text-tertiary mt-1.5 uppercase tracking-[1px]">
                {metric}
              </div>
            </div>
            <div className="flex flex-col gap-2 text-[11px]">
              <div className="text-text-secondary">{finding}</div>
              {subline != null && (
                <div className="text-text-tertiary text-[10px] max-w-[400px]">{subline}</div>
              )}
            </div>
          </div>
          {extras != null && <div className="narrative-kpi-extras">{extras}</div>}
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto bg-surface-primary border-t border-border-primary px-1 py-1.5 text-[10px] text-text-tertiary flex gap-2 items-center">
        See also:{' '}
        <button onClick={() => onApplyPreset(seeAlso[0].presetId)} className={linkClass}>
          {seeAlso[0].label}
        </button>
        ·
        <button onClick={() => onApplyPreset(seeAlso[1].presetId)} className={linkClass}>
          {seeAlso[1].label}
        </button>
      </div>
    </div>
  );
}
