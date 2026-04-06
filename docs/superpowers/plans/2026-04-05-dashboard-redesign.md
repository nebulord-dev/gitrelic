# Dashboard Redesign — T1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tab-based web dashboard with an IDE-style four-panel mission control: sidebar nav, hero visualization (treemap), bottom data panel with tabs, and a right inspector — all cross-linked so clicking anything updates every panel.

**Architecture:** Big-bang rebuild of the web package's presentation layer. `App.tsx` data-loading flow unchanged (fetch `/gitlore-report.json` → render). All existing components under `apps/web/src/components/` are replaced by a new component tree rooted at `Shell.tsx`. A `useSelection` hook manages cross-linked state. CSS custom properties in `index.css` drive theming via a semantic token system. No core package changes.

**Tech Stack:** React 19, Tailwind CSS 4, CSS custom properties, Vite, d3-hierarchy + d3-scale (treemap), Vitest + Testing Library (tests)

**Spec:** `docs/superpowers/specs/2026-04-05-dashboard-redesign-design.md`

---

## File Structure

```
apps/web/
  package.json                         # MODIFY — add d3-hierarchy, d3-scale, vitest, @testing-library/react
  vite.config.ts                       # MODIFY — add vitest config
  src/
    App.tsx                            # MODIFY — replace <Dashboard> with <Shell>
    index.css                          # REWRITE — new semantic token system (dark theme)
    hooks/
      useSelection.ts                  # CREATE — cross-linked selection state
      useSelection.test.ts             # CREATE — tests for selection hook
    components/
      layout/
        Shell.tsx                      # CREATE — four-panel grid container
        TopBar.tsx                     # CREATE — logo, repo info, theme toggle
        Sidebar.tsx                    # CREATE — grouped nav with count badges
        MetricsStrip.tsx               # CREATE — always-visible stat cells
        BottomPanel.tsx                # CREATE — tabbed panel with resize handle
        InspectorPanel.tsx             # CREATE — right panel with tabs
      hero/
        ChurnTreemap.tsx               # CREATE — d3-hierarchy treemap viz
      tabs/
        HotspotsTab.tsx                # CREATE — hotspot table with expandable rows
        CursedFilesTab.tsx             # CREATE — cursed file cards
        BusFactorTab.tsx               # CREATE — ownership concentration table
        CouplingTab.tsx                # CREATE — co-change pairs table
        ContributorsTab.tsx            # CREATE — contributor cards/list
        ParallelDevTab.tsx             # CREATE — parallel editing table
        ShameTab.tsx                   # CREATE — shame leaderboard table
        AgeMapTab.tsx                  # CREATE — age status table
      inspector/
        FileInspector.tsx              # CREATE — all-signals file detail
        ContributorsInspector.tsx      # CREATE — ownership breakdown for file
      shared/
        Badge.tsx                      # KEEP — existing badge component
        Tooltip.tsx                    # CREATE — lightweight hover tooltip
        SortableTable.tsx              # CREATE — reusable sortable table
      theme.ts                         # MODIFY — extend with new token helpers

    # DELETE after migration is complete:
    components/Dashboard.tsx
    components/StatsBar.tsx
    components/HotspotTable.tsx
    components/ContributorsSection.tsx
    components/BusFactorSection.tsx
    components/AgeDistribution.tsx
    components/ShameSection.tsx
    components/HotspotClusters.tsx
```

---

## Phase 1: Foundation

### Task 1: Test Infrastructure + Theme Token System

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Rewrite: `apps/web/src/index.css`
- Modify: `apps/web/src/components/theme.ts`

- [ ] **Step 1: Add test dependencies**

```bash
cd apps/web && pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Configure Vitest**

In `apps/web/vite.config.ts`:

```typescript
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: { port: 7777 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

Create `apps/web/src/test-setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Rewrite index.css with semantic token system**

Replace `apps/web/src/index.css` entirely:

```css
@import "tailwindcss";

/* ═══════════════════════════════════════════════════
   GitLore — Semantic Design Tokens (Dark Theme Default)
   ═══════════════════════════════════════════════════ */

:root {
  /* Layer 1: Surface */
  --surface-primary: #0d1117;
  --surface-secondary: #161b22;
  --surface-tertiary: #21262d;
  --surface-elevated: #2d333b;

  /* Layer 2: Borders */
  --border-primary: rgba(255, 255, 255, 0.06);
  --border-secondary: rgba(255, 255, 255, 0.12);
  --border-focus: #58a6ff;

  /* Layer 3: Text */
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-tertiary: #484f58;
  --text-inverse: #0d1117;

  /* Layer 4: Severity */
  --severity-critical: #f85149;
  --severity-critical-bg: rgba(248, 81, 73, 0.15);
  --severity-critical-text: #ffa198;
  --severity-warning: #d29922;
  --severity-warning-bg: rgba(210, 153, 34, 0.15);
  --severity-warning-text: #e0b040;
  --severity-moderate: #58a6ff;
  --severity-moderate-bg: rgba(88, 166, 255, 0.12);
  --severity-moderate-text: #79c0ff;
  --severity-healthy: #3fb950;
  --severity-healthy-bg: rgba(63, 185, 80, 0.12);
  --severity-healthy-text: #56d364;

  /* Layer 5: Accent / Domain */
  --accent-ownership: #a371f7;
  --accent-ownership-bg: rgba(163, 113, 247, 0.12);
  --accent-ownership-text: #c9b1f7;
  --accent-coupling: #58a6ff;
  --accent-coupling-bg: rgba(88, 166, 255, 0.12);
  --accent-coupling-text: #79c0ff;
  --accent-temporal: #39d353;
  --accent-temporal-bg: rgba(57, 211, 83, 0.12);
  --accent-temporal-text: #6ee77a;
  --accent-primary: #58a6ff;

  /* Layer 6: Component */
  --panel-resize-handle: rgba(255, 255, 255, 0.08);
  --panel-resize-handle-hover: rgba(255, 255, 255, 0.2);
  --nav-item-active-bg: rgba(88, 166, 255, 0.1);
  --nav-badge-critical: #da3633;
  --nav-badge-warning: #9e6a03;
  --tooltip-bg: #2d333b;
  --tooltip-text: #e6edf3;

  /* Spacing */
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui,
    sans-serif;
  --font-mono: "SF Mono", "Cascadia Code", "Fira Code", "JetBrains Mono",
    monospace;

  color-scheme: dark;
}

/* ─── Base ─── */

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
}

html,
body,
#root {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--text-primary);
  background: var(--surface-primary);
  -webkit-font-smoothing: antialiased;
}

/* ─── Scrollbars (thin, subtle) ─── */

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border-secondary);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* ─── Utility ─── */

.font-mono {
  font-family: var(--font-mono);
}
```

- [ ] **Step 4: Update theme.ts with new token helpers**

```typescript
// apps/web/src/components/theme.ts

export type BadgeVariant =
  | "critical"
  | "warning"
  | "moderate"
  | "healthy"
  | "ownership"
  | "coupling"
  | "temporal"
  | "shame"
  | "parallel"
  | "stale";

export const badgeStyles: Record<BadgeVariant, { bg: string; fg: string }> = {
  critical: {
    bg: "var(--severity-critical-bg)",
    fg: "var(--severity-critical-text)",
  },
  warning: {
    bg: "var(--severity-warning-bg)",
    fg: "var(--severity-warning-text)",
  },
  moderate: {
    bg: "var(--severity-moderate-bg)",
    fg: "var(--severity-moderate-text)",
  },
  healthy: {
    bg: "var(--severity-healthy-bg)",
    fg: "var(--severity-healthy-text)",
  },
  ownership: {
    bg: "var(--accent-ownership-bg)",
    fg: "var(--accent-ownership-text)",
  },
  coupling: {
    bg: "var(--accent-coupling-bg)",
    fg: "var(--accent-coupling-text)",
  },
  temporal: {
    bg: "var(--accent-temporal-bg)",
    fg: "var(--accent-temporal-text)",
  },
  shame: {
    bg: "var(--severity-critical-bg)",
    fg: "var(--severity-critical-text)",
  },
  parallel: {
    bg: "var(--severity-warning-bg)",
    fg: "var(--severity-warning-text)",
  },
  stale: { bg: "var(--surface-tertiary)", fg: "var(--text-tertiary)" },
};

export function severityColor(
  category: string,
): "critical" | "warning" | "moderate" | "healthy" {
  switch (category) {
    case "critical":
      return "critical";
    case "warning":
      return "warning";
    case "moderate":
      return "moderate";
    default:
      return "healthy";
  }
}

export function ageColor(
  status: string,
): "healthy" | "warning" | "critical" | "stale" {
  switch (status) {
    case "fresh":
      return "healthy";
    case "aging":
      return "warning";
    case "stale":
      return "critical";
    case "ancient":
      return "stale";
    default:
      return "stale";
  }
}

export function clusterVariant(dimension: string): BadgeVariant {
  switch (dimension) {
    case "ownership":
      return "ownership";
    case "temporal":
      return "warning";
    case "coupling-hub":
      return "coupling";
    case "structural":
      return "temporal";
    default:
      return "stale";
  }
}

/** Format number with locale separators: 1234 → "1,234" */
export function fmt(n: number): string {
  return n.toLocaleString();
}

/** Extract filename from path: "src/foo/bar.ts" → "bar.ts" */
export function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Extract directory from path: "src/foo/bar.ts" → "src/foo/" */
export function filePath(path: string): string {
  const parts = path.split("/");
  parts.pop();
  return parts.length > 0 ? `${parts.join("/")}/` : "";
}
```

- [ ] **Step 5: Verify build**

```bash
cd /Users/danteel/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web build
```

Expected: Build succeeds (styles changed but no component changes yet).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json apps/web/vite.config.ts apps/web/src/index.css apps/web/src/components/theme.ts apps/web/src/test-setup.ts pnpm-lock.yaml
git commit -m "feat(web): add test infrastructure and semantic theme token system"
```

---

### Task 2: Selection State Hook

**Files:**
- Create: `apps/web/src/hooks/useSelection.ts`
- Create: `apps/web/src/hooks/useSelection.test.ts`

- [ ] **Step 1: Write failing tests for useSelection**

```typescript
// apps/web/src/hooks/useSelection.test.ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSelection } from "./useSelection";

describe("useSelection", () => {
  it("starts with no selection", () => {
    const { result } = renderHook(() => useSelection());
    expect(result.current.selectedFile).toBeNull();
    expect(result.current.selectedContributor).toBeNull();
    expect(result.current.activeNavItem).toBe("dashboard");
    expect(result.current.activeBottomTab).toBe("hotspots");
  });

  it("selectFile updates selectedFile and clears contributor", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.selectFile("src/runner.ts"));
    expect(result.current.selectedFile).toBe("src/runner.ts");
    expect(result.current.selectedContributor).toBeNull();
  });

  it("selectContributor updates contributor and clears file", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.selectFile("src/runner.ts"));
    act(() => result.current.selectContributor("dan@example.com"));
    expect(result.current.selectedContributor).toBe("dan@example.com");
    expect(result.current.selectedFile).toBeNull();
  });

  it("navigateTo updates nav item and bottom tab", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.navigateTo("coupling"));
    expect(result.current.activeNavItem).toBe("coupling");
    expect(result.current.activeBottomTab).toBe("coupling");
  });

  it("setActiveBottomTab changes tab without changing nav", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.setActiveBottomTab("shame"));
    expect(result.current.activeBottomTab).toBe("shame");
    expect(result.current.activeNavItem).toBe("dashboard");
  });

  it("clearSelection resets file and contributor", () => {
    const { result } = renderHook(() => useSelection());
    act(() => result.current.selectFile("src/runner.ts"));
    act(() => result.current.clearSelection());
    expect(result.current.selectedFile).toBeNull();
    expect(result.current.selectedContributor).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/web && npx vitest run src/hooks/useSelection.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useSelection**

```typescript
// apps/web/src/hooks/useSelection.ts
import { useCallback, useState } from "react";

export type NavItem =
  | "dashboard"
  | "health-score"
  | "hotspots"
  | "cursed-files"
  | "dead-code"
  | "complexity"
  | "rewrites"
  | "bus-factor"
  | "ghost-files"
  | "knowledge"
  | "coupling"
  | "contributors"
  | "co-authors"
  | "timing"
  | "parallel-dev"
  | "shame"
  | "age-map"
  | "languages"
  | "test-coverage"
  | "renames";

export type BottomTab =
  | "hotspots"
  | "cursed-files"
  | "bus-factor"
  | "coupling"
  | "contributors"
  | "parallel-dev"
  | "shame"
  | "age-map";

/** Maps sidebar nav items to the most relevant bottom panel tab. */
const navToTab: Partial<Record<NavItem, BottomTab>> = {
  dashboard: "hotspots",
  hotspots: "hotspots",
  "cursed-files": "cursed-files",
  "bus-factor": "bus-factor",
  "ghost-files": "bus-factor",
  knowledge: "bus-factor",
  coupling: "coupling",
  contributors: "contributors",
  "co-authors": "contributors",
  timing: "contributors",
  "parallel-dev": "parallel-dev",
  shame: "shame",
  "age-map": "age-map",
};

export type InspectorTab = "file" | "contributors" | "activity";

export interface SelectionState {
  selectedFile: string | null;
  selectedContributor: string | null;
  activeNavItem: NavItem;
  activeBottomTab: BottomTab;
  activeInspectorTab: InspectorTab;
  selectFile: (file: string) => void;
  selectContributor: (email: string) => void;
  clearSelection: () => void;
  navigateTo: (item: NavItem) => void;
  setActiveBottomTab: (tab: BottomTab) => void;
  setActiveInspectorTab: (tab: InspectorTab) => void;
}

export function useSelection(): SelectionState {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedContributor, setSelectedContributor] = useState<string | null>(
    null,
  );
  const [activeNavItem, setActiveNavItem] = useState<NavItem>("dashboard");
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>("hotspots");
  const [activeInspectorTab, setActiveInspectorTab] =
    useState<InspectorTab>("file");

  const selectFile = useCallback((file: string) => {
    setSelectedFile(file);
    setSelectedContributor(null);
    setActiveInspectorTab("file");
  }, []);

  const selectContributor = useCallback((email: string) => {
    setSelectedContributor(email);
    setSelectedFile(null);
    setActiveInspectorTab("contributors");
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setSelectedContributor(null);
  }, []);

  const navigateTo = useCallback((item: NavItem) => {
    setActiveNavItem(item);
    const tab = navToTab[item];
    if (tab) setActiveBottomTab(tab);
  }, []);

  return {
    selectedFile,
    selectedContributor,
    activeNavItem,
    activeBottomTab,
    activeInspectorTab,
    selectFile,
    selectContributor,
    clearSelection,
    navigateTo,
    setActiveBottomTab,
    setActiveInspectorTab,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/web && npx vitest run src/hooks/useSelection.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/
git commit -m "feat(web): add useSelection hook for cross-linked panel state"
```

---

### Task 3: Layout Shell

**Files:**
- Create: `apps/web/src/components/layout/Shell.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Create Shell component**

This is the four-panel grid container. Initially renders placeholder text in each zone so we can validate the layout before building real content.

```tsx
// apps/web/src/components/layout/Shell.tsx
import type { GitloreReport } from "@gitlore/core";
import { useSelection } from "../../hooks/useSelection";
import { BottomPanel } from "./BottomPanel";
import { InspectorPanel } from "./InspectorPanel";
import { MetricsStrip } from "./MetricsStrip";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface ShellProps {
  report: GitloreReport;
}

export function Shell({ report }: ShellProps) {
  const selection = useSelection();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--surface-primary)",
      }}
    >
      {/* Top bar */}
      <TopBar report={report} />

      {/* Body: sidebar + center + inspector */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left sidebar */}
        <Sidebar
          report={report}
          activeItem={selection.activeNavItem}
          onNavigate={selection.navigateTo}
        />

        {/* Center area: metrics + hero + bottom */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <MetricsStrip report={report} />

          {/* Hero visualization */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              padding: "var(--space-md)",
              overflow: "auto",
            }}
          >
            <div
              style={{
                color: "var(--text-tertiary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                fontSize: 12,
              }}
            >
              Hero visualization (treemap) — Task 18
            </div>
          </div>

          {/* Bottom panel */}
          <BottomPanel
            report={report}
            activeTab={selection.activeBottomTab}
            onTabChange={selection.setActiveBottomTab}
            selectedFile={selection.selectedFile}
            onSelectFile={selection.selectFile}
          />
        </div>

        {/* Right inspector */}
        <InspectorPanel
          report={report}
          selectedFile={selection.selectedFile}
          selectedContributor={selection.selectedContributor}
          activeTab={selection.activeInspectorTab}
          onTabChange={selection.setActiveInspectorTab}
          onSelectFile={selection.selectFile}
          onSelectContributor={selection.selectContributor}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create stub components for each panel**

Each panel gets a minimal stub so Shell compiles. These are expanded in later tasks.

```tsx
// apps/web/src/components/layout/TopBar.tsx
import type { GitloreReport } from "@gitlore/core";
import { fmt } from "../theme";

interface TopBarProps {
  report: GitloreReport;
}

export function TopBar({ report }: TopBarProps) {
  const { meta, repoName } = report;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 16px",
        background: "var(--surface-secondary)",
        borderBottom: "1px solid var(--border-primary)",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: 1,
            color: "var(--text-primary)",
          }}
        >
          GITLORE
        </span>
        <span style={{ color: "var(--accent-primary)", fontSize: 12 }}>
          {repoName}
        </span>
        <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>
          • {fmt(meta.totalCommits)} commits • {fmt(meta.totalAuthors)} authors
          • {Math.round(meta.ageInDays / 365 * 10) / 10}y
        </span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button
          style={{
            fontSize: 10,
            color: "var(--text-tertiary)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          ?
        </button>
      </div>
    </div>
  );
}
```

```tsx
// apps/web/src/components/layout/Sidebar.tsx
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
```

```tsx
// apps/web/src/components/layout/MetricsStrip.tsx
import type { GitloreReport } from "@gitlore/core";
import { fmt } from "../theme";

interface MetricsStripProps {
  report: GitloreReport;
}

interface Metric {
  label: string;
  value: string;
  color: string;
}

function getMetrics(report: GitloreReport): Metric[] {
  const criticalCount = report.hotspots.topHotspots.filter(
    (h) => h.category === "critical",
  ).length;

  return [
    {
      label: "Cursed Files",
      value: String(report.cursedFiles.length),
      color:
        report.cursedFiles.length > 0
          ? "var(--severity-critical)"
          : "var(--severity-healthy)",
    },
    {
      label: "Hotspots",
      value: String(criticalCount),
      color:
        criticalCount > 3
          ? "var(--severity-critical)"
          : criticalCount > 0
            ? "var(--severity-warning)"
            : "var(--severity-healthy)",
    },
    {
      label: "Bus Factor Risks",
      value: String(report.busFactors.criticalFiles.length),
      color:
        report.busFactors.criticalFiles.length > 0
          ? "var(--severity-warning)"
          : "var(--severity-healthy)",
    },
    {
      label: "Contributors",
      value: String(report.meta.totalAuthors),
      color: "var(--accent-primary)",
    },
    {
      label: "Repo Age",
      value: `${(report.meta.ageInDays / 365).toFixed(1)}y`,
      color: "var(--text-primary)",
    },
    {
      label: "Lines of Code",
      value: fmt(report.loc.totalLines),
      color: "var(--text-primary)",
    },
  ];
}

export function MetricsStrip({ report }: MetricsStripProps) {
  const metrics = getMetrics(report);

  return (
    <div
      style={{
        display: "flex",
        gap: 1,
        background: "var(--border-primary)",
        borderBottom: "1px solid var(--border-primary)",
        flexShrink: 0,
      }}
    >
      {metrics.map((m) => (
        <div
          key={m.label}
          style={{
            flex: 1,
            padding: "12px 16px",
            background: "var(--surface-primary)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>
            {m.value}
          </div>
          <div
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text-tertiary)",
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
```

```tsx
// apps/web/src/components/layout/BottomPanel.tsx
import type { GitloreReport } from "@gitlore/core";
import type { BottomTab } from "../../hooks/useSelection";
import { AgeMapTab } from "../tabs/AgeMapTab";
import { BusFactorTab } from "../tabs/BusFactorTab";
import { ContributorsTab } from "../tabs/ContributorsTab";
import { CouplingTab } from "../tabs/CouplingTab";
import { CursedFilesTab } from "../tabs/CursedFilesTab";
import { HotspotsTab } from "../tabs/HotspotsTab";
import { ParallelDevTab } from "../tabs/ParallelDevTab";
import { ShameTab } from "../tabs/ShameTab";

interface BottomPanelProps {
  report: GitloreReport;
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const TABS: { id: BottomTab; label: string }[] = [
  { id: "hotspots", label: "Hotspots" },
  { id: "cursed-files", label: "Cursed Files" },
  { id: "bus-factor", label: "Bus Factor" },
  { id: "coupling", label: "Coupling" },
  { id: "contributors", label: "Contributors" },
  { id: "parallel-dev", label: "Parallel Dev" },
  { id: "shame", label: "Shame" },
  { id: "age-map", label: "Age Map" },
];

function TabContent({
  tab,
  report,
  selectedFile,
  onSelectFile,
}: {
  tab: BottomTab;
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}) {
  switch (tab) {
    case "hotspots":
      return (
        <HotspotsTab
          report={report}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
        />
      );
    case "cursed-files":
      return (
        <CursedFilesTab report={report} onSelectFile={onSelectFile} />
      );
    case "bus-factor":
      return (
        <BusFactorTab report={report} onSelectFile={onSelectFile} />
      );
    case "coupling":
      return (
        <CouplingTab report={report} onSelectFile={onSelectFile} />
      );
    case "contributors":
      return <ContributorsTab report={report} />;
    case "parallel-dev":
      return (
        <ParallelDevTab report={report} onSelectFile={onSelectFile} />
      );
    case "shame":
      return (
        <ShameTab report={report} onSelectFile={onSelectFile} />
      );
    case "age-map":
      return (
        <AgeMapTab report={report} onSelectFile={onSelectFile} />
      );
  }
}

export function BottomPanel({
  report,
  activeTab,
  onTabChange,
  selectedFile,
  onSelectFile,
}: BottomPanelProps) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--border-primary)",
        height: 220,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-primary)",
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--border-primary)",
          padding: "0 16px",
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: "8px 14px",
              fontSize: 10,
              border: "none",
              background: "none",
              cursor: "pointer",
              color:
                activeTab === tab.id
                  ? "var(--text-primary)"
                  : "var(--text-tertiary)",
              borderBottom: `2px solid ${
                activeTab === tab.id
                  ? "var(--accent-primary)"
                  : "transparent"
              }`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: "auto", padding: "8px 16px" }}>
        <TabContent
          tab={activeTab}
          report={report}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
        />
      </div>
    </div>
  );
}
```

```tsx
// apps/web/src/components/layout/InspectorPanel.tsx
import type { GitloreReport } from "@gitlore/core";
import type { InspectorTab } from "../../hooks/useSelection";
import { ContributorsInspector } from "../inspector/ContributorsInspector";
import { FileInspector } from "../inspector/FileInspector";

interface InspectorPanelProps {
  report: GitloreReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onSelectFile: (file: string) => void;
  onSelectContributor: (email: string) => void;
}

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "file", label: "Inspector" },
  { id: "contributors", label: "Contributors" },
  { id: "activity", label: "Activity" },
];

export function InspectorPanel({
  report,
  selectedFile,
  selectedContributor,
  activeTab,
  onTabChange,
  onSelectFile,
  onSelectContributor,
}: InspectorPanelProps) {
  const hasSelection = selectedFile != null || selectedContributor != null;

  return (
    <div
      style={{
        width: 260,
        minWidth: 260,
        borderLeft: "1px solid var(--border-primary)",
        background: "var(--surface-primary)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-primary)",
          flexShrink: 0,
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "8px 4px",
              fontSize: 10,
              border: "none",
              background: "none",
              cursor: "pointer",
              color:
                activeTab === tab.id
                  ? "var(--text-primary)"
                  : "var(--text-tertiary)",
              borderBottom: `2px solid ${
                activeTab === tab.id
                  ? "var(--accent-primary)"
                  : "transparent"
              }`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        {!hasSelection ? (
          <div
            style={{
              color: "var(--text-tertiary)",
              fontSize: 11,
              textAlign: "center",
              marginTop: 40,
            }}
          >
            Select a file or contributor to inspect
          </div>
        ) : activeTab === "file" && selectedFile ? (
          <FileInspector
            report={report}
            file={selectedFile}
            onSelectContributor={onSelectContributor}
          />
        ) : activeTab === "contributors" ? (
          <ContributorsInspector
            report={report}
            file={selectedFile}
            contributor={selectedContributor}
            onSelectFile={onSelectFile}
          />
        ) : (
          <div
            style={{
              color: "var(--text-tertiary)",
              fontSize: 11,
              textAlign: "center",
              marginTop: 40,
            }}
          >
            Activity tab — Tier 2
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create stub tab components**

Each tab gets a minimal placeholder. They're fleshed out in Phase 3.

```tsx
// apps/web/src/components/tabs/HotspotsTab.tsx
import type { GitloreReport } from "@gitlore/core";

interface HotspotsTabProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export function HotspotsTab({ report, selectedFile, onSelectFile }: HotspotsTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Hotspots tab — Task 8</div>;
}
```

Create identical stubs for `CursedFilesTab.tsx`, `BusFactorTab.tsx`, `CouplingTab.tsx`, `ContributorsTab.tsx`, `ParallelDevTab.tsx`, `ShameTab.tsx`, `AgeMapTab.tsx` — each accepting `{ report: GitloreReport; onSelectFile: (file: string) => void }` props (except `ContributorsTab` which doesn't need `onSelectFile`).

- [ ] **Step 4: Create stub inspector components**

```tsx
// apps/web/src/components/inspector/FileInspector.tsx
import type { GitloreReport } from "@gitlore/core";

interface FileInspectorProps {
  report: GitloreReport;
  file: string;
  onSelectContributor: (email: string) => void;
}

export function FileInspector({ file }: FileInspectorProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      File inspector for {file} — Task 16
    </div>
  );
}
```

```tsx
// apps/web/src/components/inspector/ContributorsInspector.tsx
import type { GitloreReport } from "@gitlore/core";

interface ContributorsInspectorProps {
  report: GitloreReport;
  file: string | null;
  contributor: string | null;
  onSelectFile: (file: string) => void;
}

export function ContributorsInspector({ file, contributor }: ContributorsInspectorProps) {
  return (
    <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>
      Contributors inspector — Task 17
    </div>
  );
}
```

- [ ] **Step 5: Update App.tsx to render Shell instead of Dashboard**

```tsx
// apps/web/src/App.tsx
import type { GitloreReport } from "@gitlore/core";
import { useEffect, useState } from "react";
import { Shell } from "./components/layout/Shell";

export default function App() {
  const [report, setReport] = useState<GitloreReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/gitlore-report.json")
      .then((r) => {
        if (!r.ok)
          throw new Error(
            "No report found. Run gitlore --web to generate one.",
          );
        return r.json() as Promise<GitloreReport>;
      })
      .then(setReport)
      .catch((err: Error) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: 12,
          color: "var(--text-secondary)",
        }}
      >
        <div style={{ fontSize: 32 }}>☠</div>
        <div>{error}</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          flexDirection: "column",
          gap: 12,
          color: "var(--text-secondary)",
        }}
      >
        <div style={{ fontSize: 18, animation: "spin 1s linear infinite" }}>
          ◌
        </div>
        <div style={{ fontSize: 12 }}>Excavating git history...</div>
      </div>
    );
  }

  return <Shell report={report} />;
}
```

- [ ] **Step 6: Build and verify**

```bash
cd /Users/danteel/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web build
```

Expected: Build succeeds. The four-panel layout skeleton is in place with stub content in each zone.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/
git commit -m "feat(web): add four-panel layout shell with sidebar, metrics, bottom panel, and inspector"
```

---

## Phase 2: Bottom Panel Tabs

Each tab component renders a data table inside the bottom panel. They follow a common pattern: a table with sortable columns, signal badges, and a file-click handler. The first tab (Hotspots) establishes the pattern with expandable rows.

### Task 4: Shared SortableTable Component

**Files:**
- Create: `apps/web/src/components/shared/SortableTable.tsx`

- [ ] **Step 1: Create SortableTable**

A reusable table component with sortable column headers. All bottom panel tabs will use this.

```tsx
// apps/web/src/components/shared/SortableTable.tsx
import { type ReactNode, useCallback, useState } from "react";

export interface Column<T> {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "right" | "center";
  render: (item: T) => ReactNode;
  sortValue?: (item: T) => number | string;
}

interface SortableTableProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: (item: T) => string;
  selectedKey?: string | null;
  onRowClick?: (item: T) => void;
  expandedKey?: string | null;
  renderExpanded?: (item: T) => ReactNode;
  onRowExpand?: (key: string | null) => void;
  maxRows?: number;
}

export function SortableTable<T>({
  data,
  columns,
  rowKey,
  selectedKey,
  onRowClick,
  expandedKey,
  renderExpanded,
  onRowExpand,
  maxRows = 50,
}: SortableTableProps<T>) {
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = useCallback(
    (colKey: string) => {
      if (sortCol === colKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortCol(colKey);
        setSortDir("desc");
      }
    },
    [sortCol],
  );

  let sorted = [...data];
  if (sortCol) {
    const col = columns.find((c) => c.key === sortCol);
    if (col?.sortValue) {
      const sv = col.sortValue;
      sorted.sort((a, b) => {
        const va = sv(a);
        const vb = sv(b);
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
  }
  sorted = sorted.slice(0, maxRows);

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "4px 0",
          borderBottom: "1px solid var(--border-primary)",
        }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            onClick={() => col.sortValue && handleSort(col.key)}
            style={{
              width: col.width,
              flex: col.width ? undefined : 1,
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text-tertiary)",
              cursor: col.sortValue ? "pointer" : "default",
              textAlign: col.align ?? "left",
              padding: "0 4px",
              userSelect: "none",
            }}
          >
            {col.label}
            {sortCol === col.key && (sortDir === "asc" ? " ▲" : " ▼")}
          </div>
        ))}
      </div>

      {/* Rows */}
      {sorted.map((item) => {
        const key = rowKey(item);
        const isSelected = selectedKey === key;
        const isExpanded = expandedKey === key;

        return (
          <div key={key}>
            <div
              onClick={() => {
                if (onRowExpand) {
                  onRowExpand(isExpanded ? null : key);
                }
                onRowClick?.(item);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid var(--border-primary)",
                cursor: "pointer",
                background: isSelected
                  ? "var(--nav-item-active-bg)"
                  : "transparent",
              }}
            >
              {columns.map((col) => (
                <div
                  key={col.key}
                  style={{
                    width: col.width,
                    flex: col.width ? undefined : 1,
                    fontSize: 11,
                    padding: "0 4px",
                    textAlign: col.align ?? "left",
                    minWidth: 0,
                  }}
                >
                  {col.render(item)}
                </div>
              ))}
            </div>

            {/* Expanded detail */}
            {isExpanded && renderExpanded && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--surface-secondary)",
                  borderBottom: "1px solid var(--border-primary)",
                }}
              >
                {renderExpanded(item)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/shared/SortableTable.tsx
git commit -m "feat(web): add reusable SortableTable component with sort and expand"
```

---

### Task 5: Hotspots Tab (with Expandable Rows)

**Files:**
- Modify: `apps/web/src/components/tabs/HotspotsTab.tsx`

- [ ] **Step 1: Implement HotspotsTab**

This is the pattern-setting tab. It shows the hotspot file table with signal badges, score bars, and expandable rows that reveal ownership/coupling/shame/activity detail.

```tsx
// apps/web/src/components/tabs/HotspotsTab.tsx
import type { GitloreReport } from "@gitlore/core";
import type { HotspotEntry } from "@gitlore/core";
import { useState } from "react";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath, fmt, severityColor } from "../theme";

interface HotspotsTabProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

function getSignals(file: string, report: GitloreReport): string[] {
  const signals: string[] = [];
  const hotspot = report.hotspots.topHotspots.find((h) => h.file === file);
  if (hotspot?.category === "critical") signals.push("critical");
  else if (hotspot?.category === "warning") signals.push("warning");

  const bf = report.busFactors.files.find((f) => f.file === file);
  if (bf && bf.uniqueAuthors > 1) signals.push(`${bf.uniqueAuthors} authors`);
  else if (bf && bf.uniqueAuthors === 1) signals.push("single owner");

  const cp = report.coupling.fileProfiles.find((f) => f.file === file);
  if (cp && cp.partners.length > 2) signals.push("coupling hub");

  const pd = report.parallelDev.hotFiles.find((f) => f.file === file);
  if (pd) signals.push("parallel dev");

  return signals;
}

function signalVariant(signal: string): "critical" | "warning" | "ownership" | "coupling" | "parallel" {
  if (signal === "critical") return "critical";
  if (signal === "warning") return "warning";
  if (signal.includes("author") || signal === "single owner") return "ownership";
  if (signal === "coupling hub") return "coupling";
  return "parallel";
}

function ExpandedDetail({ file, report }: { file: string; report: GitloreReport }) {
  const bf = report.busFactors.files.find((f) => f.file === file);
  const cp = report.coupling.fileProfiles.find((f) => f.file === file);
  const sh = report.forensics.files.find((f) => f.file === file);
  const churn = report.churn.files.find((f) => f.file === file);

  const cellStyle = {
    flex: 1,
    minWidth: 0,
    padding: "0 8px",
  };
  const labelStyle = {
    fontSize: 9,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    color: "var(--text-tertiary)",
    marginBottom: 6,
  };
  const valueStyle = { fontSize: 10, color: "var(--text-secondary)" };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div style={cellStyle}>
        <div style={labelStyle}>Ownership</div>
        {bf ? (
          <div style={valueStyle}>
            {bf.uniqueAuthors} author{bf.uniqueAuthors !== 1 ? "s" : ""}
            {bf.dominantAuthor && (
              <div>
                dominant: {bf.dominantAuthor.split("@")[0]} (
                {bf.dominantAuthorPercent}%)
              </div>
            )}
          </div>
        ) : (
          <div style={valueStyle}>—</div>
        )}
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>Coupled With</div>
        {cp && cp.partners.length > 0 ? (
          <div style={valueStyle}>
            {cp.partners.slice(0, 3).map((p) => (
              <div key={p.fileB === file ? p.fileA : p.fileB}>
                {Math.round(p.couplingStrength)}%{" "}
                {fileName(p.fileB === file ? p.fileA : p.fileB)}
              </div>
            ))}
          </div>
        ) : (
          <div style={valueStyle}>—</div>
        )}
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>Shame ({sh?.shameScore ?? 0})</div>
        {sh && sh.topShameCommits.length > 0 ? (
          <div style={valueStyle}>
            <div style={{ fontStyle: "italic" }}>
              "{sh.topShameCommits[0].message.slice(0, 40)}..."
            </div>
            <div>{sh.dominantKeywords.slice(0, 3).join(", ")}</div>
          </div>
        ) : (
          <div style={valueStyle}>—</div>
        )}
      </div>
      <div style={cellStyle}>
        <div style={labelStyle}>Activity</div>
        <div style={valueStyle}>
          {churn ? `${fmt(churn.commitCount)} commits` : "—"}
          {report.loc.files.find((f) => f.file === file) && (
            <div>
              {fmt(report.loc.files.find((f) => f.file === file)!.lines)} lines
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HotspotsTab({
  report,
  selectedFile,
  onSelectFile,
}: HotspotsTabProps) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const columns: Column<HotspotEntry>[] = [
    {
      key: "file",
      label: "File",
      render: (h) => (
        <div style={{ minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-primary)",
            }}
          >
            {fileName(h.file)}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "var(--text-tertiary)",
              marginLeft: 6,
            }}
          >
            {filePath(h.file)}
          </span>
        </div>
      ),
    },
    {
      key: "signals",
      label: "Signals",
      width: "280px",
      render: (h) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {getSignals(h.file, report).map((s) => (
            <Badge key={s} variant={signalVariant(s)}>
              {s}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "score",
      label: "Score",
      width: "120px",
      align: "right",
      sortValue: (h) => h.hotspotScore,
      render: (h) => (
        <div
          style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}
        >
          <div
            style={{
              width: 60,
              height: 4,
              background: "var(--surface-tertiary)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${h.hotspotScore}%`,
                height: "100%",
                borderRadius: 2,
                background: `var(--severity-${severityColor(h.category)})`,
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-secondary)",
              width: 24,
              textAlign: "right",
            }}
          >
            {h.hotspotScore}
          </span>
        </div>
      ),
    },
    {
      key: "churn",
      label: "Churn",
      width: "60px",
      align: "right",
      sortValue: (h) => h.churnScore,
      render: (h) => (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          {h.churnScore}
        </span>
      ),
    },
    {
      key: "loc",
      label: "LOC",
      width: "60px",
      align: "right",
      sortValue: (h) => h.loc,
      render: (h) => (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-secondary)",
          }}
        >
          {fmt(h.loc)}
        </span>
      ),
    },
    {
      key: "severity",
      label: "Severity",
      width: "70px",
      align: "center",
      render: (h) => <Badge variant={severityColor(h.category)}>{h.category}</Badge>,
    },
  ];

  return (
    <SortableTable
      data={report.hotspots.topHotspots}
      columns={columns}
      rowKey={(h) => h.file}
      selectedKey={selectedFile}
      onRowClick={(h) => onSelectFile(h.file)}
      expandedKey={expandedFile}
      onRowExpand={setExpandedFile}
      renderExpanded={(h) => <ExpandedDetail file={h.file} report={report} />}
    />
  );
}
```

- [ ] **Step 2: Update Badge component to use new tokens**

Check if `apps/web/src/components/Badge.tsx` exists and update it to use the `badgeStyles` from `theme.ts`. If it already uses them, no changes needed. If not:

```tsx
// apps/web/src/components/shared/Badge.tsx
import type { ReactNode } from "react";
import { type BadgeVariant, badgeStyles } from "../theme";

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
}

export default function Badge({ variant, children }: BadgeProps) {
  const style = badgeStyles[variant] ?? badgeStyles.stale;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 10,
        padding: "2px 7px",
        borderRadius: 3,
        fontWeight: 500,
        letterSpacing: "0.02em",
        background: style.bg,
        color: style.fg,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/danteel/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tabs/HotspotsTab.tsx apps/web/src/components/shared/Badge.tsx
git commit -m "feat(web): add Hotspots tab with expandable rows and signal badges"
```

---

### Task 6: Remaining Bottom Panel Tabs

**Files:**
- Modify: `apps/web/src/components/tabs/CursedFilesTab.tsx`
- Modify: `apps/web/src/components/tabs/BusFactorTab.tsx`
- Modify: `apps/web/src/components/tabs/CouplingTab.tsx`
- Modify: `apps/web/src/components/tabs/ContributorsTab.tsx`
- Modify: `apps/web/src/components/tabs/ParallelDevTab.tsx`
- Modify: `apps/web/src/components/tabs/ShameTab.tsx`
- Modify: `apps/web/src/components/tabs/AgeMapTab.tsx`

Each tab follows the same pattern established by HotspotsTab: use `SortableTable` with tab-specific columns and data. Implement all 7 remaining tabs in this task.

- [ ] **Step 1: Implement CursedFilesTab**

```tsx
// apps/web/src/components/tabs/CursedFilesTab.tsx
import type { CursedFile, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath, fmt } from "../theme";

interface CursedFilesTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

function reasonVariant(reason: string): "critical" | "warning" | "ownership" | "coupling" | "parallel" {
  if (reason.includes("revert") || reason.includes("shame") || reason.includes("break")) return "critical";
  if (reason.includes("author") || reason.includes("owner")) return "ownership";
  if (reason.includes("coupling") || reason.includes("coordination")) return "coupling";
  if (reason.includes("parallel")) return "parallel";
  return "warning";
}

export function CursedFilesTab({ report, onSelectFile }: CursedFilesTabProps) {
  const columns: Column<CursedFile>[] = [
    {
      key: "file",
      label: "File",
      render: (c) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--severity-critical)" }}>
          {fileName(c.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>{filePath(c.file)}</span>
        </span>
      ),
    },
    {
      key: "reasons",
      label: "Reasons",
      width: "300px",
      render: (c) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {c.reasons.slice(0, 4).map((r) => (
            <Badge key={r} variant={reasonVariant(r)}>{r}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: "score",
      label: "Curse Score",
      width: "80px",
      align: "right",
      sortValue: (c) => c.curseScore,
      render: (c) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--severity-critical)", fontWeight: 600 }}>
          {c.curseScore}
        </span>
      ),
    },
    {
      key: "churn",
      label: "Churn",
      width: "60px",
      align: "right",
      sortValue: (c) => c.churn,
      render: (c) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{fmt(c.churn)}</span>,
    },
    {
      key: "authors",
      label: "Authors",
      width: "60px",
      align: "right",
      sortValue: (c) => c.authors,
      render: (c) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{c.authors}</span>,
    },
  ];

  return (
    <SortableTable
      data={report.cursedFiles}
      columns={columns}
      rowKey={(c) => c.file}
      onRowClick={(c) => onSelectFile(c.file)}
    />
  );
}
```

- [ ] **Step 2: Implement BusFactorTab**

```tsx
// apps/web/src/components/tabs/BusFactorTab.tsx
import type { FileBusFactor, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath } from "../theme";

interface BusFactorTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function BusFactorTab({ report, onSelectFile }: BusFactorTabProps) {
  const columns: Column<FileBusFactor>[] = [
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>{filePath(f.file)}</span>
        </span>
      ),
    },
    {
      key: "dominant",
      label: "Dominant Author",
      width: "180px",
      render: (f) => (
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {f.dominantAuthor.split("@")[0]} ({f.dominantAuthorPercent}%)
        </span>
      ),
    },
    {
      key: "authors",
      label: "Authors",
      width: "60px",
      align: "right",
      sortValue: (f) => f.uniqueAuthors,
      render: (f) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{f.uniqueAuthors}</span>,
    },
    {
      key: "risk",
      label: "Risk",
      width: "70px",
      align: "center",
      sortValue: (f) => f.dominantAuthorPercent,
      render: (f) => <Badge variant={f.risk === "critical" ? "critical" : f.risk === "high" ? "warning" : "moderate"}>{f.risk}</Badge>,
    },
  ];

  return (
    <SortableTable
      data={report.busFactors.criticalFiles}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
```

- [ ] **Step 3: Implement CouplingTab**

```tsx
// apps/web/src/components/tabs/CouplingTab.tsx
import type { CoupledPair, GitloreReport } from "@gitlore/core";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName } from "../theme";

interface CouplingTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function CouplingTab({ report, onSelectFile }: CouplingTabProps) {
  const columns: Column<CoupledPair>[] = [
    {
      key: "fileA",
      label: "File A",
      render: (p) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)", cursor: "pointer" }}
          onClick={(e) => { e.stopPropagation(); onSelectFile(p.fileA); }}>
          {fileName(p.fileA)}
        </span>
      ),
    },
    {
      key: "arrow",
      label: "",
      width: "30px",
      align: "center",
      render: () => <span style={{ color: "var(--text-tertiary)", fontSize: 10 }}>↔</span>,
    },
    {
      key: "fileB",
      label: "File B",
      render: (p) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)", cursor: "pointer" }}
          onClick={(e) => { e.stopPropagation(); onSelectFile(p.fileB); }}>
          {fileName(p.fileB)}
        </span>
      ),
    },
    {
      key: "strength",
      label: "Strength",
      width: "120px",
      align: "right",
      sortValue: (p) => p.couplingStrength,
      render: (p) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          <div style={{ width: 50, height: 4, background: "var(--surface-tertiary)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${p.couplingStrength}%`, height: "100%", borderRadius: 2, background: "var(--accent-coupling)" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-coupling)", fontWeight: 600 }}>
            {Math.round(p.couplingStrength)}%
          </span>
        </div>
      ),
    },
    {
      key: "coCommits",
      label: "Shared",
      width: "60px",
      align: "right",
      sortValue: (p) => p.coCommits,
      render: (p) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{p.coCommits}</span>,
    },
  ];

  return (
    <SortableTable
      data={report.coupling.topPairs}
      columns={columns}
      rowKey={(p) => `${p.fileA}::${p.fileB}`}
    />
  );
}
```

- [ ] **Step 4: Implement ContributorsTab**

```tsx
// apps/web/src/components/tabs/ContributorsTab.tsx
import type { Contributor, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fmt } from "../theme";

interface ContributorsTabProps {
  report: GitloreReport;
}

export function ContributorsTab({ report }: ContributorsTabProps) {
  const columns: Column<Contributor>[] = [
    {
      key: "name",
      label: "Contributor",
      render: (c) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%", background: "var(--surface-tertiary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, color: "var(--text-secondary)", flexShrink: 0,
          }}>
            {c.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-primary)" }}>{c.name}</div>
            <div style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{c.email}</div>
          </div>
          {!c.isActive && <Badge variant="stale">ghost</Badge>}
        </div>
      ),
    },
    {
      key: "commits",
      label: "Commits",
      width: "70px",
      align: "right",
      sortValue: (c) => c.commitCount,
      render: (c) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)", fontWeight: 600 }}>{fmt(c.commitCount)}</span>,
    },
    {
      key: "files",
      label: "Files",
      width: "60px",
      align: "right",
      sortValue: (c) => c.filesOwned,
      render: (c) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{c.filesOwned}</span>,
    },
    {
      key: "focus",
      label: "Focus Areas",
      width: "200px",
      render: (c) => (
        <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
          {c.focusAreas.slice(0, 2).join(", ")}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "50px",
      align: "center",
      render: (c) => (
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: c.isActive ? "var(--severity-healthy)" : "var(--text-tertiary)",
          margin: "0 auto",
        }} />
      ),
    },
  ];

  return (
    <SortableTable
      data={report.contributors.contributors}
      columns={columns}
      rowKey={(c) => c.email}
    />
  );
}
```

- [ ] **Step 5: Implement ParallelDevTab**

```tsx
// apps/web/src/components/tabs/ParallelDevTab.tsx
import type { FileParallelDev, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath } from "../theme";

interface ParallelDevTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function ParallelDevTab({ report, onSelectFile }: ParallelDevTabProps) {
  const columns: Column<FileParallelDev>[] = [
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>{filePath(f.file)}</span>
        </span>
      ),
    },
    {
      key: "score",
      label: "Score",
      width: "80px",
      align: "right",
      sortValue: (f) => f.parallelScore,
      render: (f) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--severity-warning)", fontWeight: 600 }}>{f.parallelScore}</span>,
    },
    {
      key: "weeks",
      label: "Parallel Weeks",
      width: "100px",
      align: "right",
      sortValue: (f) => f.parallelWeeks,
      render: (f) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{f.parallelWeeks}/{f.totalActiveWeeks}</span>,
    },
    {
      key: "peak",
      label: "Peak Authors",
      width: "90px",
      align: "right",
      sortValue: (f) => f.peakAuthors,
      render: (f) => <Badge variant="parallel">{f.peakAuthors} authors</Badge>,
    },
  ];

  return (
    <SortableTable
      data={report.parallelDev.hotFiles}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
```

- [ ] **Step 6: Implement ShameTab**

```tsx
// apps/web/src/components/tabs/ShameTab.tsx
import type { FileForensics, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath } from "../theme";

interface ShameTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function ShameTab({ report, onSelectFile }: ShameTabProps) {
  const columns: Column<FileForensics>[] = [
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>{filePath(f.file)}</span>
        </span>
      ),
    },
    {
      key: "keywords",
      label: "Keywords",
      width: "200px",
      render: (f) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {f.dominantKeywords.slice(0, 3).map((k) => (
            <Badge key={k} variant="shame">{k}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: "score",
      label: "Shame Score",
      width: "80px",
      align: "right",
      sortValue: (f) => f.shameScore,
      render: (f) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--severity-critical)", fontWeight: 600 }}>{f.shameScore}</span>,
    },
    {
      key: "commits",
      label: "Shame Commits",
      width: "100px",
      align: "right",
      sortValue: (f) => f.shameCommitCount,
      render: (f) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{f.shameCommitCount}</span>,
    },
  ];

  return (
    <SortableTable
      data={report.forensics.shameLeaderboard}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
```

- [ ] **Step 7: Implement AgeMapTab**

```tsx
// apps/web/src/components/tabs/AgeMapTab.tsx
import type { FileAge, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { ageColor, fileName, filePath, fmt } from "../theme";

interface AgeMapTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function AgeMapTab({ report, onSelectFile }: AgeMapTabProps) {
  const columns: Column<FileAge>[] = [
    {
      key: "status",
      label: "Status",
      width: "70px",
      render: (f) => <Badge variant={ageColor(f.status)}>{f.status}</Badge>,
    },
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>{filePath(f.file)}</span>
        </span>
      ),
    },
    {
      key: "age",
      label: "Age (days)",
      width: "80px",
      align: "right",
      sortValue: (f) => f.ageInDays,
      render: (f) => <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>{fmt(f.ageInDays)}</span>,
    },
    {
      key: "date",
      label: "Last Commit",
      width: "100px",
      align: "right",
      render: (f) => <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{f.lastCommitDate.slice(0, 10)}</span>,
    },
  ];

  return (
    <SortableTable
      data={report.ageMap.files}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
```

- [ ] **Step 8: Build and verify**

```bash
cd /Users/danteel/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web build
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/tabs/
git commit -m "feat(web): add all 8 bottom panel tab components"
```

---

## Phase 3: Inspector Panels

### Task 7: File Inspector

**Files:**
- Modify: `apps/web/src/components/inspector/FileInspector.tsx`

- [ ] **Step 1: Implement FileInspector**

Shows every signal for a selected file in one panel — the "all-signals-at-a-glance" view.

```tsx
// apps/web/src/components/inspector/FileInspector.tsx
import type { GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { fileName, fmt, severityColor } from "../theme";

interface FileInspectorProps {
  report: GitloreReport;
  file: string;
  onSelectContributor: (email: string) => void;
}

interface InspectorRow {
  label: string;
  value: string;
  color?: string;
}

function getFileData(file: string, report: GitloreReport): InspectorRow[] {
  const rows: InspectorRow[] = [];

  const hotspot = report.hotspots.topHotspots.find((h) => h.file === file);
  if (hotspot) {
    rows.push({
      label: "Hotspot Score",
      value: String(hotspot.hotspotScore),
      color: `var(--severity-${severityColor(hotspot.category)})`,
    });
  }

  const churn = report.churn.files.find((f) => f.file === file);
  if (churn) {
    rows.push({ label: "Churn (commits)", value: fmt(churn.commitCount) });
  }

  const loc = report.loc.files.find((f) => f.file === file);
  if (loc) {
    rows.push({ label: "Lines of Code", value: fmt(loc.lines) });
    rows.push({ label: "Language", value: loc.language });
  }

  const bf = report.busFactors.files.find((f) => f.file === file);
  if (bf) {
    rows.push({
      label: "Bus Factor",
      value: `${bf.uniqueAuthors} (${bf.dominantAuthor.split("@")[0]}: ${bf.dominantAuthorPercent}%)`,
      color: bf.risk === "critical" ? "var(--severity-critical)" : undefined,
    });
  }

  const age = report.ageMap.files.find((f) => f.file === file);
  if (age) {
    rows.push({ label: "Age", value: `${age.ageInDays} days (${age.status})` });
  }

  const blast = report.blastRadius.files.find((f) => f.file === file);
  if (blast) {
    rows.push({
      label: "Blast Radius",
      value: `${blast.avgCoChangedFiles.toFixed(1)} avg files`,
      color: blast.blastScore > 50 ? "var(--severity-warning)" : undefined,
    });
  }

  const cp = report.coupling.fileProfiles.find((f) => f.file === file);
  if (cp && cp.topPartner) {
    rows.push({
      label: "Coupled With",
      value: `${fileName(cp.topPartner)} (${Math.round(cp.couplingScore)}%)`,
    });
  }

  const cursed = report.cursedFiles.find((f) => f.file === file);
  if (cursed) {
    rows.push({
      label: "Curse Score",
      value: String(cursed.curseScore),
      color: "var(--severity-critical)",
    });
  }

  const rr = report.rewriteRatio.files.find((f) => f.file === file);
  if (rr) {
    rows.push({ label: "Rewrite Ratio", value: rr.ratio.toFixed(2) });
  }

  const sh = report.forensics.files.find((f) => f.file === file);
  if (sh && sh.shameScore > 0) {
    rows.push({
      label: "Shame Score",
      value: String(sh.shameScore),
      color: "var(--severity-warning)",
    });
  }

  const cv = report.churnVelocity.files.find((f) => f.file === file);
  if (cv) {
    rows.push({ label: "Churn Trend", value: cv.trend });
  }

  const rename = report.renameTracking.chains.find((c) => c.currentPath === file);
  if (rename && rename.renameCount > 0) {
    rows.push({ label: "Renames", value: `${rename.renameCount} times` });
  }

  return rows;
}

export function FileInspector({ report, file, onSelectContributor }: FileInspectorProps) {
  const rows = getFileData(file, report);
  const hotspot = report.hotspots.topHotspots.find((h) => h.file === file);
  const bf = report.busFactors.files.find((f) => f.file === file);

  return (
    <div>
      {/* Header */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, wordBreak: "break-all", fontFamily: "var(--font-mono)" }}>
        {file}
      </div>

      {hotspot && (
        <div style={{ marginBottom: 12 }}>
          <Badge variant={severityColor(hotspot.category)}>
            {hotspot.category} hotspot
          </Badge>
        </div>
      )}

      {/* Signal rows */}
      {rows.map((row) => (
        <div
          key={row.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "6px 0",
            borderBottom: "1px solid var(--border-primary)",
            fontSize: 10,
          }}
        >
          <span style={{ color: "var(--text-tertiary)" }}>{row.label}</span>
          <span style={{ color: row.color ?? "var(--text-primary)", fontWeight: 500 }}>{row.value}</span>
        </div>
      ))}

      {/* Top contributors for this file */}
      {bf && bf.authors.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 8 }}>Top Contributors</div>
          {bf.authors.slice(0, 5).map((email) => {
            const contributor = report.contributors.contributors.find((c) => c.email === email);
            return (
              <div
                key={email}
                onClick={() => onSelectContributor(email)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 0",
                  borderBottom: "1px solid var(--border-primary)",
                  cursor: "pointer",
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", background: "var(--surface-tertiary)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: "var(--text-secondary)", flexShrink: 0,
                }}>
                  {(contributor?.name ?? email).slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "var(--text-primary)" }}>{contributor?.name ?? email.split("@")[0]}</div>
                </div>
                <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                  {email === bf.dominantAuthor ? `${bf.dominantAuthorPercent}%` : ""}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/inspector/FileInspector.tsx
git commit -m "feat(web): add FileInspector with all-signals detail view"
```

---

### Task 8: Contributors Inspector

**Files:**
- Modify: `apps/web/src/components/inspector/ContributorsInspector.tsx`

- [ ] **Step 1: Implement ContributorsInspector**

```tsx
// apps/web/src/components/inspector/ContributorsInspector.tsx
import type { GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { fileName, fmt } from "../theme";

interface ContributorsInspectorProps {
  report: GitloreReport;
  file: string | null;
  contributor: string | null;
  onSelectFile: (file: string) => void;
}

export function ContributorsInspector({ report, file, contributor, onSelectFile }: ContributorsInspectorProps) {
  // If a contributor is selected, show their profile
  if (contributor) {
    const person = report.contributors.contributors.find((c) => c.email === contributor);
    if (!person) return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Contributor not found</div>;

    // Find files owned by this contributor
    const ownedFiles = report.busFactors.files.filter((f) => f.dominantAuthor === contributor);

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: "50%", background: "var(--surface-tertiary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, color: "var(--text-secondary)", flexShrink: 0,
          }}>
            {person.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{person.name}</div>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{person.email}</div>
          </div>
          {!person.isActive && <Badge variant="stale">ghost</Badge>}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-primary)", fontSize: 10 }}>
          <span style={{ color: "var(--text-tertiary)" }}>Commits</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{fmt(person.commitCount)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-primary)", fontSize: 10 }}>
          <span style={{ color: "var(--text-tertiary)" }}>Active Days</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{fmt(person.activeDays)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-primary)", fontSize: 10 }}>
          <span style={{ color: "var(--text-tertiary)" }}>Files Owned</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{person.filesOwned}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-primary)", fontSize: 10 }}>
          <span style={{ color: "var(--text-tertiary)" }}>Focus Areas</span>
          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{person.focusAreas.slice(0, 2).join(", ")}</span>
        </div>

        {ownedFiles.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 8 }}>Dominant Owner Of</div>
            {ownedFiles.slice(0, 10).map((f) => (
              <div
                key={f.file}
                onClick={() => onSelectFile(f.file)}
                style={{
                  padding: "4px 0", borderBottom: "1px solid var(--border-primary)",
                  fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                {fileName(f.file)}
                <span style={{ color: "var(--text-tertiary)", marginLeft: 8 }}>{f.dominantAuthorPercent}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // If a file is selected, show its contributors
  if (file) {
    const bf = report.busFactors.files.find((f) => f.file === file);
    if (!bf) return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>No contributor data</div>;

    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", marginBottom: 12, fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>
          {file}
        </div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginBottom: 8 }}>
          {bf.uniqueAuthors} contributor{bf.uniqueAuthors !== 1 ? "s" : ""}
        </div>
        {bf.authors.map((email) => {
          const person = report.contributors.contributors.find((c) => c.email === email);
          const isDominant = email === bf.dominantAuthor;
          return (
            <div
              key={email}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 0", borderBottom: "1px solid var(--border-primary)",
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: "50%", background: "var(--surface-tertiary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, color: "var(--text-secondary)", flexShrink: 0,
              }}>
                {(person?.name ?? email).slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: "var(--text-primary)" }}>{person?.name ?? email.split("@")[0]}</div>
              </div>
              {isDominant && (
                <span style={{ fontSize: 10, color: "var(--accent-ownership)", fontWeight: 500 }}>{bf.dominantAuthorPercent}%</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return <div style={{ color: "var(--text-tertiary)", fontSize: 11, textAlign: "center", marginTop: 40 }}>Select a file or contributor</div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/inspector/ContributorsInspector.tsx
git commit -m "feat(web): add ContributorsInspector with file and person views"
```

---

## Phase 4: Hero Visualization

### Task 9: Churn Treemap

**Files:**
- Modify: `apps/web/package.json` (add d3 deps)
- Create: `apps/web/src/components/hero/ChurnTreemap.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx` (replace placeholder)

- [ ] **Step 1: Add d3 dependencies**

```bash
cd apps/web && pnpm add d3-hierarchy d3-scale && pnpm add -D @types/d3-hierarchy @types/d3-scale
```

- [ ] **Step 2: Create ChurnTreemap component**

```tsx
// apps/web/src/components/hero/ChurnTreemap.tsx
import type { GitloreReport } from "@gitlore/core";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";

interface ChurnTreemapProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

interface TreeNode {
  name: string;
  fullPath?: string;
  value?: number;
  hotspotScore?: number;
  category?: string;
  children?: TreeNode[];
}

function buildTree(report: GitloreReport): TreeNode {
  const root: TreeNode = { name: "root", children: [] };
  const dirMap = new Map<string, TreeNode>();

  // Only include files that appear in hotspot or LOC data
  const fileSet = new Map<string, { loc: number; score: number; category: string }>();
  for (const f of report.loc.files) {
    const hotspot = report.hotspots.files.find((h) => h.file === f.file);
    fileSet.set(f.file, {
      loc: f.lines,
      score: hotspot?.hotspotScore ?? 0,
      category: hotspot?.category ?? "low",
    });
  }

  for (const [filePath, data] of fileSet) {
    const parts = filePath.split("/");
    const fName = parts.pop()!;

    // Ensure parent directories exist
    let current = root;
    for (const part of parts) {
      const key = parts.slice(0, parts.indexOf(part) + 1).join("/");
      if (!dirMap.has(key)) {
        const node: TreeNode = { name: part, children: [] };
        dirMap.set(key, node);
        current.children!.push(node);
      }
      current = dirMap.get(key)!;
    }

    current.children!.push({
      name: fName,
      fullPath: filePath,
      value: Math.max(data.loc, 1),
      hotspotScore: data.score,
      category: data.category,
    });
  }

  return root;
}

function categoryColor(category: string, opacity: number): string {
  switch (category) {
    case "critical": return `rgba(248, 81, 73, ${opacity})`;
    case "warning": return `rgba(210, 153, 34, ${opacity})`;
    case "moderate": return `rgba(88, 166, 255, ${opacity})`;
    default: return `rgba(63, 185, 80, ${opacity})`;
  }
}

export function ChurnTreemap({ report, selectedFile, onSelectFile }: ChurnTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const leaves = useMemo(() => {
    const tree = buildTree(report);
    const root = hierarchy(tree)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = treemap<TreeNode>()
      .size([dims.width, dims.height])
      .padding(2)
      .tile(treemapSquarify);

    layout(root);
    return root.leaves();
  }, [report, dims.width, dims.height]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <svg width={dims.width} height={dims.height}>
        {leaves.map((leaf) => {
          const d = leaf.data;
          if (!d.fullPath) return null;
          const w = (leaf.x1 ?? 0) - (leaf.x0 ?? 0);
          const h = (leaf.y1 ?? 0) - (leaf.y0 ?? 0);
          if (w < 2 || h < 2) return null;

          const isSelected = selectedFile === d.fullPath;
          const showLabel = w > 40 && h > 16;

          return (
            <g
              key={d.fullPath}
              onClick={() => onSelectFile(d.fullPath!)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={leaf.x0}
                y={leaf.y0}
                width={w}
                height={h}
                fill={categoryColor(d.category ?? "low", 0.35)}
                stroke={isSelected ? "var(--accent-primary)" : categoryColor(d.category ?? "low", 0.3)}
                strokeWidth={isSelected ? 2 : 1}
                rx={2}
              />
              {showLabel && (
                <text
                  x={(leaf.x0 ?? 0) + 4}
                  y={(leaf.y0 ?? 0) + 12}
                  fontSize={9}
                  fill="rgba(255,255,255,0.7)"
                  style={{ pointerEvents: "none" }}
                >
                  {d.name}
                </text>
              )}
              {showLabel && h > 28 && (
                <text
                  x={(leaf.x0 ?? 0) + 4}
                  y={(leaf.y0 ?? 0) + 23}
                  fontSize={8}
                  fill="rgba(255,255,255,0.4)"
                  style={{ pointerEvents: "none" }}
                >
                  {d.hotspotScore}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 3: Wire treemap into Shell**

In `apps/web/src/components/layout/Shell.tsx`, replace the hero placeholder:

Replace the hero `<div>` that currently says "Hero visualization (treemap) — Task 18" with:

```tsx
import { ChurnTreemap } from "../hero/ChurnTreemap";

// ... inside the hero area:
<div style={{ flex: 1, minHeight: 0, padding: "var(--space-md)", display: "flex", flexDirection: "column" }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexShrink: 0 }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Repository Map</span>
    <div style={{
      display: "flex", gap: 2, background: "var(--surface-tertiary)", borderRadius: 6, padding: 2,
    }}>
      {["Treemap", "Ownership", "Coupling", "Graph"].map((label, i) => (
        <span
          key={label}
          style={{
            padding: "4px 10px", borderRadius: 4, fontSize: 10, cursor: "pointer",
            color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)",
            background: i === 0 ? "var(--surface-elevated)" : "transparent",
          }}
        >
          {label}
        </span>
      ))}
    </div>
  </div>
  <div style={{ flex: 1, minHeight: 0 }}>
    <ChurnTreemap
      report={report}
      selectedFile={selection.selectedFile}
      onSelectFile={selection.selectFile}
    />
  </div>
</div>
```

- [ ] **Step 4: Build and verify**

```bash
cd /Users/danteel/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/components/hero/ apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): add churn treemap hero visualization with d3-hierarchy"
```

---

## Phase 5: Cleanup

### Task 10: Remove Old Components

**Files:**
- Delete: `apps/web/src/components/Dashboard.tsx`
- Delete: `apps/web/src/components/StatsBar.tsx`
- Delete: `apps/web/src/components/HotspotTable.tsx`
- Delete: `apps/web/src/components/ContributorsSection.tsx`
- Delete: `apps/web/src/components/BusFactorSection.tsx`
- Delete: `apps/web/src/components/AgeDistribution.tsx`
- Delete: `apps/web/src/components/ShameSection.tsx`
- Delete: `apps/web/src/components/HotspotClusters.tsx`

- [ ] **Step 1: Verify no imports reference old components**

```bash
cd apps/web && grep -r "from.*Dashboard\|from.*StatsBar\|from.*HotspotTable\|from.*ContributorsSection\|from.*BusFactorSection\|from.*AgeDistribution\|from.*ShameSection\|from.*HotspotClusters" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"
```

Expected: No results (all imports now point to new components).

- [ ] **Step 2: Delete old component files**

```bash
cd apps/web/src/components && rm -f Dashboard.tsx StatsBar.tsx HotspotTable.tsx ContributorsSection.tsx BusFactorSection.tsx AgeDistribution.tsx ShameSection.tsx HotspotClusters.tsx
```

- [ ] **Step 3: Also remove old Badge.tsx if it was replaced**

If `apps/web/src/components/Badge.tsx` still exists alongside `apps/web/src/components/shared/Badge.tsx`, delete the old one and update any remaining imports.

- [ ] **Step 4: Build and verify**

```bash
cd /Users/danteel/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web build
```

Expected: Build succeeds. No references to deleted files.

- [ ] **Step 5: Run tests**

```bash
cd apps/web && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/components/
git commit -m "refactor(web): remove old tab-based dashboard components"
```

---

### Task 11: Tooltip Component

**Files:**
- Create: `apps/web/src/components/shared/Tooltip.tsx`

- [ ] **Step 1: Create Tooltip component**

Lightweight CSS-only tooltip. No library dependencies.

```tsx
// apps/web/src/components/shared/Tooltip.tsx
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: "top" | "bottom";
}

export function Tooltip({ content, children, position = "top" }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setCoords({ x: rect.left + rect.width / 2, y: position === "top" ? rect.top : rect.bottom });
    }
    setVisible(true);
  }, [position]);

  const tooltipStyle: CSSProperties = {
    position: "fixed",
    left: coords.x,
    top: position === "top" ? coords.y - 8 : coords.y + 8,
    transform: position === "top" ? "translate(-50%, -100%)" : "translate(-50%, 0)",
    background: "var(--tooltip-bg)",
    color: "var(--tooltip-text)",
    padding: "4px 8px",
    borderRadius: 4,
    fontSize: 10,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    zIndex: 1000,
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  };

  return (
    <div
      ref={wrapRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
      style={{ display: "inline-block" }}
    >
      {children}
      {visible && <div style={tooltipStyle}>{content}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/shared/Tooltip.tsx
git commit -m "feat(web): add lightweight Tooltip component"
```

---

### Task 12: Final Build Verification + Smoke Test

- [ ] **Step 1: Full build**

```bash
cd /Users/danteel/Desktop/nebulord/gitlore && pnpm build
```

Expected: All packages build successfully.

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

Expected: All tests pass (core tests + new web tests).

- [ ] **Step 3: Lint and format**

```bash
pnpm lint:fix && pnpm format
```

- [ ] **Step 4: Manual smoke test**

```bash
node apps/cli/dist/index.js --path . --web
```

Open the browser. Verify:
- Four-panel layout renders (sidebar, treemap, bottom panel, inspector)
- Metrics strip shows correct numbers
- Sidebar navigation highlights active item
- Bottom panel tabs switch correctly
- Clicking a file in the hotspot table expands the row
- Double-clicking selects the file and updates the inspector
- Treemap renders with color-coded cells
- Clicking a treemap cell selects the file across all panels

- [ ] **Step 5: Commit any lint/format fixes**

```bash
git add -A && git commit -m "chore(web): lint and format dashboard redesign"
```
