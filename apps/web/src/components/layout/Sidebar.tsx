import type { GitloreReport } from "@gitlore/core";
import type { NavItem } from "../../hooks/useSelection";

interface SidebarProps {
  report: GitloreReport;
  activeItem: NavItem;
  onNavigate: (item: NavItem) => void;
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

function getNavGroups(report: GitloreReport): NavGroup[] {
  return [
    {
      label: "Overview",
      items: [{ id: "dashboard", label: "Dashboard" }],
    },
    {
      label: "Code Health",
      items: [
        {
          id: "hotspots",
          label: "Hotspots",
          badge: report.hotspots.topHotspots.filter(
            (h) => h.category === "critical",
          ).length,
        },
        {
          id: "cursed-files",
          label: "Cursed Files",
          badge: report.cursedFiles.length,
        },
      ],
    },
    {
      label: "Ownership & Risk",
      items: [
        {
          id: "bus-factor",
          label: "Bus Factor",
          badge: report.busFactors.criticalFiles.length,
        },
        { id: "coupling", label: "Coupling" },
      ],
    },
    {
      label: "Team & Activity",
      items: [
        { id: "contributors", label: "Contributors" },
        { id: "parallel-dev", label: "Parallel Dev" },
        { id: "shame", label: "Shame" },
      ],
    },
    {
      label: "Structure",
      items: [{ id: "age-map", label: "Age Map" }],
    },
  ];
}

export function Sidebar({ report, activeItem, onNavigate }: SidebarProps) {
  const groups = getNavGroups(report);

  return (
    <nav
      style={{
        width: 200,
        minWidth: 200,
        background: "var(--surface-primary)",
        borderRight: "1px solid var(--border-primary)",
        padding: "12px 0",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      {groups.map((group) => (
        <div key={group.label} style={{ marginBottom: 16, padding: "0 12px" }}>
          <div
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              color: "var(--text-tertiary)",
              marginBottom: 8,
              padding: "0 8px",
            }}
          >
            {group.label}
          </div>
          {group.items.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 8px",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                textAlign: "left",
                background:
                  activeItem === item.id
                    ? "var(--nav-item-active-bg)"
                    : "transparent",
                color:
                  activeItem === item.id
                    ? "var(--accent-primary)"
                    : "var(--text-secondary)",
                marginBottom: 2,
              }}
            >
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span
                  style={{
                    fontSize: 9,
                    padding: "1px 5px",
                    borderRadius: 8,
                    fontWeight: 600,
                    background: "var(--nav-badge-critical)",
                    color: "#fff",
                  }}
                >
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
