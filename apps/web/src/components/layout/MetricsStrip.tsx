import { overviewMetrics } from '../../presets/metrics/overview';
import { riskMetrics } from '../../presets/metrics/risk';
import { techDebtMetrics } from '../../presets/metrics/tech-debt';

import type { DashboardMode } from '../../hooks/useSelection';
import type { Metric } from '../../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

interface MetricsStripProps {
  report: GitrelicReport;
  dashboardMode: DashboardMode;
}

function getMetrics(report: GitrelicReport, mode: DashboardMode): Metric[] {
  switch (mode) {
    case 'risk':
      return riskMetrics(report);
    case 'tech-debt':
      return techDebtMetrics(report);
    default:
      return overviewMetrics(report);
  }
}

export function MetricsStrip({ report, dashboardMode }: MetricsStripProps) {
  const metrics = getMetrics(report, dashboardMode);

  return (
    <div
      style={{
        display: 'flex',
        gap: 1,
        background: 'var(--border-primary)',
        borderBottom: '1px solid var(--border-primary)',
        flexShrink: 0,
      }}
    >
      {metrics.map((m) => (
        <div
          key={m.label}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'var(--surface-primary)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
          <div
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--text-tertiary)',
              marginTop: 2,
            }}
          >
            {m.label}
          </div>
        </div>
      ))}
    </div>
  );
}
