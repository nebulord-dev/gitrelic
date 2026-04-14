import { fmt } from '../theme';

import type { DashboardMode } from '../../hooks/useSelection';
import type { GitrelicReport } from '@gitrelic/core';

interface MetricsStripProps {
  report: GitrelicReport;
  dashboardMode: DashboardMode;
}

interface Metric {
  label: string;
  value: string;
  color: string;
}

function getOverviewMetrics(report: GitrelicReport): Metric[] {
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

function getRiskMetrics(report: GitrelicReport): Metric[] {
  const criticalBusFactor = report.busFactors.criticalFiles.length;
  const ghostFiles = report.ghostFiles.totalGhostFiles;
  const concentrationIndex = Math.round(report.knowledgeConcentration.concentrationIndex);
  const highBlastRadius = report.blastRadius.files.filter((f) => f.blastScore > 70).length;

  const locMap = new Map<string, number>();
  for (const entry of report.loc.files) {
    locMap.set(entry.file, entry.lines);
  }
  const atRiskLoc = report.busFactors.criticalFiles.reduce(
    (sum, f) => sum + (locMap.get(f.file) ?? 0),
    0,
  );

  return [
    {
      label: 'Critical Bus Factor',
      value: String(criticalBusFactor),
      color: criticalBusFactor > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Ghost Files',
      value: String(ghostFiles),
      color: ghostFiles > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Knowledge Concentration',
      value: `${concentrationIndex}%`,
      color: concentrationIndex > 60 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'High Blast Radius',
      value: String(highBlastRadius),
      color: highBlastRadius > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'At-Risk LOC',
      value: fmt(atRiskLoc),
      color: atRiskLoc > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
  ];
}

function getTechDebtMetrics(report: GitrelicReport): Metric[] {
  const deadFiles = report.deadCode.totalDeadFiles;
  const growingFiles = report.complexityTrend.growingFiles.length;
  const highRewrite = report.rewriteRatio.topRewriters.length;
  const acceleratingChurn = report.churnVelocity.acceleratingFiles.length;

  const locMap = new Map<string, number>();
  for (const entry of report.loc.files) {
    locMap.set(entry.file, entry.lines);
  }

  const debtFileSet = new Set<string>();
  for (const f of report.deadCode.candidates) {
    debtFileSet.add(f.file);
  }
  for (const f of report.rewriteRatio.topRewriters) {
    debtFileSet.add(f.file);
  }
  const debtLoc = Array.from(debtFileSet).reduce((sum, file) => sum + (locMap.get(file) ?? 0), 0);

  return [
    {
      label: 'Dead Files',
      value: String(deadFiles),
      color: deadFiles > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Growing Files',
      value: String(growingFiles),
      color: growingFiles > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'High Rewrite',
      value: String(highRewrite),
      color: highRewrite > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Accelerating Churn',
      value: String(acceleratingChurn),
      color: acceleratingChurn > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Debt LOC',
      value: fmt(debtLoc),
      color: debtLoc > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
  ];
}

function getMetrics(report: GitrelicReport, mode: DashboardMode): Metric[] {
  switch (mode) {
    case 'risk':
      return getRiskMetrics(report);
    case 'tech-debt':
      return getTechDebtMetrics(report);
    default:
      return getOverviewMetrics(report);
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
