import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';

import type { GitloreReport } from '@gitlore/core';

interface RiskRegisterTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

interface RiskRow {
  file: string;
  busFactorRisk: string;
  busFactorScore: number;
  isGhost: boolean;
  concentration: number;
  blastScore: number;
  riskScore: number;
}

function busFacValue(risk: string): number {
  switch (risk) {
    case 'critical':
      return 100;
    case 'high':
      return 75;
    case 'medium':
      return 50;
    default:
      return 25;
  }
}

function busFactorVariant(risk: string): 'critical' | 'warning' | 'moderate' | 'healthy' {
  switch (risk) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'warning';
    case 'medium':
      return 'moderate';
    default:
      return 'healthy';
  }
}

export function RiskRegisterTab({ report, onSelectFile }: RiskRegisterTabProps) {
  const ghostSet = new Set(report.ghostFiles.files.map((g) => g.file));
  const blastMap = new Map(report.blastRadius.files.map((b) => [b.file, b.blastScore]));

  const rows: RiskRow[] = report.busFactors.files
    .map((f) => {
      const ghost = ghostSet.has(f.file);
      const blast = blastMap.get(f.file) ?? 0;
      const concentration = f.dominantAuthorPercent;
      const bfScore = busFacValue(f.risk);

      const riskScore = Math.round(
        bfScore * 0.35 + (ghost ? 100 : 0) * 0.25 + concentration * 0.25 + blast * 0.15,
      );

      return {
        file: f.file,
        busFactorRisk: f.risk,
        busFactorScore: bfScore,
        isGhost: ghost,
        concentration,
        blastScore: blast,
        riskScore,
      };
    })
    .filter(
      (r) =>
        r.busFactorRisk === 'critical' ||
        r.busFactorRisk === 'high' ||
        r.busFactorRisk === 'medium' ||
        r.isGhost ||
        r.concentration > 80 ||
        r.blastScore > 70,
    )
    .sort((a, b) => b.riskScore - a.riskScore);

  const columns: Column<RiskRow>[] = [
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
      key: 'busFactor',
      label: 'Bus Factor',
      width: '90px',
      align: 'center',
      sortValue: (r) => r.busFactorScore,
      render: (r) => <Badge variant={busFactorVariant(r.busFactorRisk)}>{r.busFactorRisk}</Badge>,
    },
    {
      key: 'ghost',
      label: 'Ghost',
      width: '80px',
      align: 'center',
      sortValue: (r) => (r.isGhost ? 1 : 0),
      render: (r) =>
        r.isGhost ? (
          <Badge variant="critical">orphaned</Badge>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--severity-healthy)' }}>active</span>
        ),
    },
    {
      key: 'concentration',
      label: 'Concentration',
      width: '90px',
      align: 'right',
      sortValue: (r) => r.concentration,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: r.concentration > 80 ? 'var(--severity-warning)' : 'var(--text-secondary)',
          }}
        >
          {r.concentration}%
        </span>
      ),
    },
    {
      key: 'blast',
      label: 'Blast',
      width: '60px',
      align: 'right',
      sortValue: (r) => r.blastScore,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: r.blastScore > 70 ? 'var(--severity-warning)' : 'var(--text-secondary)',
          }}
        >
          {fmt(r.blastScore)}
        </span>
      ),
    },
    {
      key: 'riskScore',
      label: 'Risk Score',
      width: '80px',
      align: 'right',
      sortValue: (r) => r.riskScore,
      render: (r) => (
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 700,
            color:
              r.riskScore > 70
                ? 'var(--severity-critical)'
                : r.riskScore > 40
                  ? 'var(--severity-warning)'
                  : 'var(--text-secondary)',
          }}
        >
          {r.riskScore}
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
