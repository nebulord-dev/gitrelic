import { GitloreReport } from '@gitlore/core';
import { fmt } from './theme';

export type StatsFilter = 'critical' | 'warning' | 'cursed' | 'busfactor' | null;

interface StatsBarProps {
  report: GitloreReport;
  active: StatsFilter;
  onFilter: (filter: StatsFilter) => void;
}

interface CellProps {
  label: string;
  value: number;
  color: string;
  filterId: StatsFilter;
  active: StatsFilter;
  onFilter: (filter: StatsFilter) => void;
}

function Cell({ label, value, color, filterId, active, onFilter }: CellProps) {
  const isActive = active === filterId;
  return (
    <button
      onClick={() => onFilter(filterId)}
      style={{
        background: isActive ? 'var(--bg3)' : 'var(--bg)',
        padding: '14px 16px',
        border: 'none',
        cursor: filterId ? 'pointer' : 'default',
        textAlign: 'left',
        outline: isActive ? '1.5px solid var(--border2)' : 'none',
        outlineOffset: -1,
        transition: 'background 0.15s',
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
    </button>
  );
}

export function StatsBar({ report, active, onFilter }: StatsBarProps) {
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
    <div className="grid-stats">
      <Cell label="Critical Hotspots" value={criticalHotspots} color="var(--red)" filterId="critical" active={active} onFilter={onFilter} />
      <Cell label="Warnings" value={warnings} color="var(--amber)" filterId="warning" active={active} onFilter={onFilter} />
      <Cell label="Cursed Files" value={cursedFiles} color="var(--amber)" filterId="cursed" active={active} onFilter={onFilter} />
      <Cell label="Bus Factor Risk" value={busFactorRisk} color="var(--red)" filterId="busfactor" active={active} onFilter={onFilter} />
      <Cell label="Ghost Authors" value={ghostAuthors} color="var(--fg3)" filterId={null} active={active} onFilter={onFilter} />
    </div>
  );
}
