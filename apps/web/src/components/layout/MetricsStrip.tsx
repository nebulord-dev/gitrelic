import { fmt } from '../theme';

import type { GitloreReport } from '@gitlore/core';

interface MetricsStripProps {
  report: GitloreReport;
}

interface Metric {
  label: string;
  value: string;
  color: string;
}

function getMetrics(report: GitloreReport): Metric[] {
  const criticalCount = report.hotspots.topHotspots.filter((h) => h.category === 'critical').length;

  return [
    {
      label: 'Cursed Files',
      value: String(report.cursedFiles.length),
      color: report.cursedFiles.length > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Hotspots',
      value: String(criticalCount),
      color:
        criticalCount > 3
          ? 'var(--severity-critical)'
          : criticalCount > 0
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'Bus Factor Risks',
      value: String(report.busFactors.criticalFiles.length),
      color:
        report.busFactors.criticalFiles.length > 0
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Contributors',
      value: String(report.meta.totalAuthors),
      color: 'var(--accent-primary)',
    },
    {
      label: 'Repo Age',
      value: `${(report.meta.ageInDays / 365).toFixed(1)}y`,
      color: 'var(--text-primary)',
    },
    {
      label: 'Lines of Code',
      value: fmt(report.loc.totalLines),
      color: 'var(--text-primary)',
    },
  ];
}

export function MetricsStrip({ report }: MetricsStripProps) {
  const metrics = getMetrics(report);

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
