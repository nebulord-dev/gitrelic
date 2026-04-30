import type { CSSProperties, ReactNode } from 'react';

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
   * Optional full-width content rendered below the KPI / finding / subline row
   * and above the sticky see-also footer. Use for analyzer-specific drill-downs
   * (directory rollups, secondary callouts) that don't fit the constrained
   * subline area. Leave undefined for the canonical sparse layout.
   */
  extras?: ReactNode;
  seeAlso: [SeeAlsoLink, SeeAlsoLink];
  onApplyPreset: (id: PresetId) => void;
}

const linkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent-primary)',
  fontSize: 10,
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
};

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
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div className="narrative-kpi-body" style={{ flex: 1, padding: '12px 0' }}>
        <div className="narrative-kpi-stack">
          <div
            className="narrative-kpi-row"
            style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}
          >
            <div style={{ textAlign: 'center', minWidth: 120 }}>
              <div
                data-testid="narrative-kpi-big-number"
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: `var(--severity-${tier.variant})`,
                  lineHeight: 1,
                }}
              >
                {bigNumber}
              </div>
              <div style={{ marginTop: 4 }}>
                <Badge variant={tier.variant}>{tier.label}</Badge>
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: 'var(--text-tertiary)',
                  marginTop: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {metric}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
              <div style={{ color: 'var(--text-secondary)' }}>{finding}</div>
              {subline != null && (
                <div style={{ color: 'var(--text-tertiary)', fontSize: 10, maxWidth: 400 }}>
                  {subline}
                </div>
              )}
            </div>
          </div>
          {extras != null && <div className="narrative-kpi-extras">{extras}</div>}
        </div>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 'auto',
          background: 'var(--surface-primary)',
          borderTop: '1px solid var(--border-primary)',
          padding: '6px 4px',
          fontSize: 10,
          color: 'var(--text-tertiary)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        See also:{' '}
        <button onClick={() => onApplyPreset(seeAlso[0].presetId)} style={linkStyle}>
          {seeAlso[0].label}
        </button>
        ·
        <button onClick={() => onApplyPreset(seeAlso[1].presetId)} style={linkStyle}>
          {seeAlso[1].label}
        </button>
      </div>
    </div>
  );
}
