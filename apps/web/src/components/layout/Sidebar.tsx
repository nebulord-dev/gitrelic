import type { DashboardMode, NavItem } from '../../hooks/useSelection';
import type { GitloreReport } from '@gitlore/core';

interface SidebarProps {
  report: GitloreReport;
  activeItem: NavItem;
  onNavigate: (item: NavItem) => void;
  dashboardMode: DashboardMode;
  onDashboardMode: (mode: DashboardMode) => void;
}

interface NavEntry {
  id: NavItem;
  label: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavEntry[];
}

const DASHBOARD_SUB_ITEMS: { mode: DashboardMode; label: string }[] = [
  { mode: 'overview', label: 'Overview' },
  { mode: 'risk', label: 'Risk' },
  { mode: 'tech-debt', label: 'Tech Debt' },
];

function getNavGroups(report: GitloreReport): NavGroup[] {
  return [
    {
      label: 'Overview',
      items: [{ id: 'dashboard', label: 'Dashboard' }],
    },
    {
      label: 'Code Health',
      items: [
        {
          id: 'hotspots',
          label: 'Hotspots',
          badge: report.hotspots.topHotspots.filter((h) => h.category === 'critical').length,
        },
        {
          id: 'cursed-files',
          label: 'Cursed Files',
          badge: report.cursedFiles.length,
        },
        { id: 'dead-code', label: 'Dead Code', badge: report.deadCode.totalDeadFiles },
        { id: 'complexity', label: 'Complexity' },
        { id: 'rewrites', label: 'Rewrites' },
      ],
    },
    {
      label: 'Ownership & Risk',
      items: [
        {
          id: 'bus-factor',
          label: 'Bus Factor',
          badge: report.busFactors.criticalFiles.length,
        },
        { id: 'coupling', label: 'Coupling' },
        { id: 'ghost-files', label: 'Ghost Files', badge: report.ghostFiles.totalGhostFiles },
        { id: 'knowledge', label: 'Knowledge Silos' },
      ],
    },
    {
      label: 'Team & Activity',
      items: [
        { id: 'contributors', label: 'Contributors' },
        { id: 'co-authors', label: 'Co-Authors' },
        { id: 'timing', label: 'Timing' },
        { id: 'parallel-dev', label: 'Parallel Dev' },
        { id: 'shame', label: 'Shame' },
      ],
    },
    {
      label: 'Structure',
      items: [
        { id: 'age-map', label: 'Age Map' },
        { id: 'languages', label: 'Languages' },
        { id: 'test-coverage', label: 'Test Coverage' },
        { id: 'renames', label: 'Renames' },
      ],
    },
  ];
}

export function Sidebar({
  report,
  activeItem,
  onNavigate,
  dashboardMode,
  onDashboardMode,
}: SidebarProps) {
  const groups = getNavGroups(report);
  const isDashboardExpanded = activeItem === 'dashboard';

  return (
    <nav
      style={{
        width: 200,
        minWidth: 200,
        background: 'var(--surface-primary)',
        borderRight: '1px solid var(--border-primary)',
        padding: '12px 0',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {groups.map((group) => (
        <div key={group.label} style={{ marginBottom: 16, padding: '0 12px' }}>
          <div
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              color: 'var(--text-tertiary)',
              marginBottom: 8,
              padding: '0 8px',
            }}
          >
            {group.label}
          </div>
          {group.items.map((item) => {
            const isDashboard = item.id === 'dashboard';
            const isActive = activeItem === item.id;

            return (
              <div key={item.id}>
                <button
                  onClick={() => {
                    if (isDashboard) {
                      onDashboardMode('overview');
                    } else {
                      onNavigate(item.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '6px 8px',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    textAlign: 'left',
                    background: isActive ? 'var(--nav-item-active-bg)' : 'transparent',
                    color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    marginBottom: 2,
                  }}
                >
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isDashboard && (
                    <span
                      style={{
                        fontSize: 10,
                        display: 'inline-block',
                        transform: isDashboardExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s ease',
                        lineHeight: 1,
                      }}
                    >
                      ▶
                    </span>
                  )}
                  {!isDashboard && item.badge != null && item.badge > 0 && (
                    <span
                      style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 8,
                        fontWeight: 600,
                        background: 'var(--nav-badge-critical)',
                        color: '#fff',
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
                {isDashboard && isDashboardExpanded && (
                  <div style={{ marginBottom: 2 }}>
                    {DASHBOARD_SUB_ITEMS.map((sub) => {
                      const isSubActive = dashboardMode === sub.mode;
                      return (
                        <button
                          key={sub.mode}
                          onClick={() => onDashboardMode(sub.mode)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            paddingLeft: 32,
                            paddingRight: 8,
                            paddingTop: 5,
                            paddingBottom: 5,
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 11,
                            textAlign: 'left',
                            background: isSubActive ? 'var(--nav-item-active-bg)' : 'transparent',
                            color: isSubActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            marginBottom: 2,
                          }}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
