import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { type BadgeVariant, fileName, filePath, fmt } from '../theme';

import type { GitloreReport } from '@gitlore/core';

interface DebtInventoryTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

interface DebtRow {
  file: string;
  ageDays: number;
  rewriteScore: number;
  growthRate: number;
  churnVelocityScore: number;
  churnTrend: string;
  shameScore: number;
  debtScore: number;
}

function churnTrendVariant(trend: string): BadgeVariant {
  switch (trend) {
    case 'accelerating':
      return 'critical';
    case 'stable':
      return 'moderate';
    case 'decelerating':
      return 'healthy';
    default:
      return 'moderate';
  }
}

function formatAge(days: number): string {
  if (days >= 365) {
    return `${(days / 365).toFixed(1)}y`;
  }
  return `${days}d`;
}

function ageColor(days: number): string {
  if (days >= 365) return 'var(--severity-critical)';
  if (days >= 180) return 'var(--severity-warning)';
  return 'var(--text-secondary)';
}

function rewriteVariant(score: number): BadgeVariant {
  if (score > 70) return 'critical';
  if (score > 40) return 'warning';
  return 'healthy';
}

export function DebtInventoryTab({ report, onSelectFile }: DebtInventoryTabProps) {
  // Collect all files appearing in any debt signal
  const fileSet = new Set<string>();
  for (const f of report.deadCode.candidates) fileSet.add(f.file);
  for (const f of report.complexityTrend.growingFiles) fileSet.add(f.file);
  for (const f of report.rewriteRatio.topRewriters) fileSet.add(f.file);
  for (const f of report.churnVelocity.acceleratingFiles) fileSet.add(f.file);

  // Build lookup maps
  const ageMap = new Map(report.ageMap.files.map((f) => [f.file, f.ageInDays]));
  const rewriteMap = new Map(report.rewriteRatio.files.map((f) => [f.file, f.rewriteScore]));
  const complexityMap = new Map(
    report.complexityTrend.files.map((f) => [f.file, f.recentGrowthRate]),
  );
  const churnVelMap = new Map(
    report.churnVelocity.files.map((f) => [f.file, { score: f.velocityScore, trend: f.trend }]),
  );
  const shameMap = new Map(report.forensics.files.map((f) => [f.file, f.shameScore]));

  // Compute max absolute growth rate for normalization
  const allGrowthRates = report.complexityTrend.files.map((f) => Math.abs(f.recentGrowthRate));
  const maxGrowth = Math.max(...allGrowthRates, 1);
  const repoAgeDays = report.meta.ageInDays;

  const rows: DebtRow[] = Array.from(fileSet).map((file) => {
    const ageDays = ageMap.get(file) ?? 0;
    const rewriteScore = rewriteMap.get(file) ?? 0;
    const rawGrowthRate = complexityMap.get(file) ?? 0;
    const growthNorm = Math.min(100, (Math.abs(rawGrowthRate) / maxGrowth) * 100);
    const churnVel = churnVelMap.get(file) ?? { score: 0, trend: 'stable' };
    const shameScore = shameMap.get(file) ?? 0;
    const ageNorm = Math.min(100, (ageDays / repoAgeDays) * 100);

    const debtScore = Math.round(
      rewriteScore * 0.3 +
        growthNorm * 0.25 +
        churnVel.score * 0.2 +
        shameScore * 0.15 +
        ageNorm * 0.1,
    );

    return {
      file,
      ageDays,
      rewriteScore,
      growthRate: rawGrowthRate,
      churnVelocityScore: churnVel.score,
      churnTrend: churnVel.trend,
      shameScore,
      debtScore,
    };
  });

  rows.sort((a, b) => b.debtScore - a.debtScore);

  const columns: Column<DebtRow>[] = [
    {
      key: 'file',
      label: 'File',
      render: (r) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          {fileName(r.file)}
          <span style={{ color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 10 }}>
            {filePath(r.file)}
          </span>
        </span>
      ),
    },
    {
      key: 'age',
      label: 'Age',
      width: '60px',
      align: 'right',
      sortValue: (r) => r.ageDays,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: ageColor(r.ageDays),
          }}
        >
          {formatAge(r.ageDays)}
        </span>
      ),
    },
    {
      key: 'rewrite',
      label: 'Rewrite',
      width: '70px',
      align: 'center',
      sortValue: (r) => r.rewriteScore,
      render: (r) => (
        <Badge variant={rewriteVariant(r.rewriteScore)}>{(r.rewriteScore / 100).toFixed(2)}</Badge>
      ),
    },
    {
      key: 'growth',
      label: 'Growth',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.growthRate,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: r.growthRate > 0 ? 'var(--severity-critical)' : 'var(--text-secondary)',
          }}
        >
          {r.growthRate > 0 ? '+' : ''}
          {Math.round(r.growthRate)}/mo
        </span>
      ),
    },
    {
      key: 'churnVelocity',
      label: 'Churn Vel.',
      width: '80px',
      align: 'center',
      sortValue: (r) => r.churnVelocityScore,
      render: (r) => <Badge variant={churnTrendVariant(r.churnTrend)}>{r.churnTrend}</Badge>,
    },
    {
      key: 'shame',
      label: 'Shame',
      width: '55px',
      align: 'right',
      sortValue: (r) => r.shameScore,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: r.shameScore > 50 ? 'var(--severity-warning)' : 'var(--text-secondary)',
          }}
        >
          {fmt(r.shameScore)}
        </span>
      ),
    },
    {
      key: 'debtScore',
      label: 'Debt Score',
      width: '80px',
      align: 'right',
      sortValue: (r) => r.debtScore,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 700,
            color:
              r.debtScore > 70
                ? 'var(--severity-critical)'
                : r.debtScore > 40
                  ? 'var(--severity-warning)'
                  : 'var(--text-secondary)',
          }}
        >
          {r.debtScore}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.file}
      onRowClick={(r) => onSelectFile(r.file)}
    />
  );
}
