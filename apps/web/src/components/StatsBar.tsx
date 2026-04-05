import { GitloreReport } from '@gitlore/core';
import { fmt } from './theme';

interface StatsBarProps {
  report: GitloreReport;
}

interface CellProps {
  label: string;
  value: number;
  color: string;
}

function Cell({ label, value, color }: CellProps) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          color: 'var(--fg3)',
          letterSpacing: '0.08em',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 500,
          color,
        }}
      >
        {fmt(value)}
      </div>
    </div>
  );
}

export function StatsBar({ report }: StatsBarProps) {
  const criticalHotspots = report.hotspots.topHotspots.filter(
    (f) => f.category === 'critical',
  ).length;
  const warnings = report.hotspots.topHotspots.filter(
    (f) => f.category === 'warning',
  ).length;
  const cursedFiles = report.cursedFiles.length;
  const busFactorRisk = report.busFactors.criticalFiles.length;
  const ghostAuthors = report.contributors.ghostContributors.length;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 1,
        background: 'var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <Cell label="Critical Hotspots" value={criticalHotspots} color="var(--red)" />
      <Cell label="Warnings" value={warnings} color="var(--amber)" />
      <Cell label="Cursed Files" value={cursedFiles} color="var(--amber)" />
      <Cell label="Bus Factor Risk" value={busFactorRisk} color="var(--red)" />
      <Cell label="Ghost Authors" value={ghostAuthors} color="var(--fg3)" />
    </div>
  );
}
