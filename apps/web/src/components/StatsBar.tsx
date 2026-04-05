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
  hint: string;
  filterId: StatsFilter;
  active: StatsFilter;
  onFilter: (filter: StatsFilter) => void;
}

function Cell({ label, value, color, hint, filterId, active, onFilter }: CellProps) {
  const isActive = active === filterId;
  return (
    <button
      className="tooltip-wrap"
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
      <span className="tooltip tooltip-wide">{hint}</span>
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
      <Cell
        label="Critical Hotspots" value={criticalHotspots} color="var(--red)"
        hint="Files with high churn and high complexity — the most expensive code to maintain"
        filterId="critical" active={active} onFilter={onFilter}
      />
      <Cell
        label="Warnings" value={warnings} color="var(--amber)"
        hint="Files showing early signs of churn × complexity risk — not critical yet, but worth watching"
        filterId="warning" active={active} onFilter={onFilter}
      />
      <Cell
        label="Cursed Files" value={cursedFiles} color="var(--amber)"
        hint="Files hit by multiple risk signals at once: high churn, concentrated ownership, shame commits, or age anomalies"
        filterId="cursed" active={active} onFilter={onFilter}
      />
      <Cell
        label="Bus Factor Risk" value={busFactorRisk} color="var(--red)"
        hint="Files where a single author owns 80%+ of commits — if they leave, knowledge walks out the door"
        filterId="busfactor" active={active} onFilter={onFilter}
      />
      <Cell
        label="Ghost Authors" value={ghostAuthors} color="var(--fg3)"
        hint="Contributors who haven't committed in 6+ months but still own files in the codebase"
        filterId={null} active={active} onFilter={onFilter}
      />
    </div>
  );
}
