import { PRESETS } from '../../presets/registry';

import type { PresetId, SidebarGroupLabel } from '../../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

interface SidebarProps {
  report: GitrelicReport;
  activePresetId: PresetId;
  onApplyPreset: (id: PresetId) => void;
}

interface NavEntry {
  id: PresetId;
  label: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  groupId: SidebarGroupLabel | 'dashboard-group';
  items: NavEntry[];
}

function getNavGroups(report: GitrelicReport): NavGroup[] {
  const dashboardPresets = (['overview', 'risk', 'tech-debt'] as const).map((id) => ({
    id,
    label: PRESETS[id].label,
  })) satisfies NavEntry[];

  return [
    {
      label: 'Overview',
      groupId: 'dashboard-group',
      items: dashboardPresets,
    },
    {
      label: 'Code Health',
      groupId: 'code-health',
      items: [
        {
          id: 'hotspots',
          label: 'Hotspots',
          badge: report.hotspots.topHotspots.filter((h) => h.category === 'critical').length,
        },
        {
          id: 'cursed-files',
          label: 'Cursed Files',
          badge: report.cursedFiles.filter((c) => c.curseScore >= 70).length,
        },
        {
          id: 'dead-code',
          label: 'Stale Files',
          badge: report.deadCode.totalDeadFiles,
        },
        {
          id: 'blast-radius',
          label: 'Blast Radius',
        },
        {
          id: 'complexity-trend',
          label: 'Complexity Trend',
          badge: report.complexityTrend.growingFiles.length,
        },
        {
          id: 'age-map',
          label: 'Age Map',
          badge: report.ageMap.ancientFiles.length,
        },
        {
          id: 'rewrite-ratio',
          label: 'Rewrite Ratio',
          badge: report.rewriteRatio.topRewriters.length,
        },
        // NOTE: Stream 3 will add the other Code Health presets here.
      ],
    },
    {
      label: 'Ownership & Risk',
      groupId: 'ownership-risk',
      items: [
        {
          id: 'bus-factor',
          label: 'Bus Factor',
          badge: report.busFactors.criticalFiles.length,
        },
        {
          id: 'coupling',
          label: 'Coupling',
        },
        {
          id: 'knowledge-silos',
          label: 'Knowledge Silos',
          badge: report.knowledgeConcentration.singleAuthorFiles,
        },
      ],
    },
    {
      label: 'Team & Activity',
      groupId: 'team-activity',
      items: [
        { id: 'contributors', label: 'Contributors' },
        {
          id: 'parallel-dev',
          label: 'Parallel Dev',
          badge: report.parallelDev.hotFiles.length,
        },
        {
          id: 'commit-timing',
          label: 'Commit Timing',
          badge: report.commitTiming.stressFiles.filter((f) => f.stressScore > 50).length,
        },
      ],
    },
    {
      label: 'Structure',
      groupId: 'structure',
      items: [
        { id: 'languages', label: 'Languages' },
        {
          id: 'test-coverage',
          label: 'Test Coverage',
          badge: report.testCoverage.uncoveredDirectories.length,
        },
      ],
    },
  ];
}

export function Sidebar({ report, activePresetId, onApplyPreset }: SidebarProps) {
  const groups = getNavGroups(report);

  return (
    <nav
      aria-label="Dashboard navigation"
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
            const isActive = activePresetId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onApplyPreset(item.id)}
                aria-current={isActive ? 'page' : undefined}
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
                {item.badge != null && item.badge > 0 && (
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
            );
          })}
        </div>
      ))}
    </nav>
  );
}
