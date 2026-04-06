# T2: Sidebar-Driven Tab Filtering + 12 New Tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat tab bar with a sidebar-driven category filtering model, add 12 new bottom panel tabs for T2 data, and add a draggable resize handle on the bottom panel.

**Architecture:** The `useSelection` hook gains an `activeGroup` field derived from nav item clicks. `BottomPanel` reads `activeGroup` to filter which tabs to render. Sidebar gets expanded with T2 nav items. 12 new tab components follow the existing `SortableTable` + `Column<T>[]` pattern. A resize handle on the bottom panel uses `mousedown` + `mousemove` for drag.

**Tech Stack:** React 19, TypeScript, CSS custom properties, existing `SortableTable` and `Badge` components

**Spec:** `docs/superpowers/specs/2026-04-05-dashboard-redesign-design.md` — Tier 2 section

---

## File Structure

```
apps/web/src/
  hooks/
    useSelection.ts              # MODIFY — add activeGroup, expand BottomTab type, group-based tab mapping
  components/
    layout/
      Sidebar.tsx                # MODIFY — add T2 nav items (Dead Code, Complexity, Rewrites, Ghost Files, Knowledge, Co-Authors, Timing, Languages, Test Coverage, Renames)
      BottomPanel.tsx            # MODIFY — filter tabs by activeGroup, add resize handle, wire 12 new tabs
    tabs/
      DeadCodeTab.tsx            # CREATE
      ComplexityTrendTab.tsx     # CREATE
      RewriteRatioTab.tsx        # CREATE
      ChurnVelocityTab.tsx       # CREATE
      BlastRadiusTab.tsx         # CREATE
      GhostFilesTab.tsx          # CREATE
      KnowledgeSilosTab.tsx      # CREATE
      CoAuthorsTab.tsx           # CREATE
      CommitTimingTab.tsx        # CREATE
      LanguagesTab.tsx           # CREATE
      TestCoverageTab.tsx        # CREATE
      RenamesTab.tsx             # CREATE
```

---

## Task 1: Expand `useSelection` with Group-Based Tab Filtering

**Files:**
- Modify: `apps/web/src/hooks/useSelection.ts`

- [ ] **Step 1: Add new BottomTab values and SidebarGroup type**

Add the 12 new tab IDs to `BottomTab` and define the group type + mapping:

```typescript
export type BottomTab =
  | "hotspots"
  | "cursed-files"
  | "bus-factor"
  | "coupling"
  | "contributors"
  | "parallel-dev"
  | "shame"
  | "age-map"
  | "dead-code"
  | "complexity-trend"
  | "rewrite-ratio"
  | "churn-velocity"
  | "blast-radius"
  | "ghost-files"
  | "knowledge-silos"
  | "co-authors"
  | "commit-timing"
  | "languages"
  | "test-coverage"
  | "renames";

export type SidebarGroup =
  | "overview"
  | "code-health"
  | "ownership-risk"
  | "team-activity"
  | "structure";

export const GROUP_TABS: Record<SidebarGroup, BottomTab[]> = {
  overview: ["hotspots", "cursed-files", "bus-factor", "churn-velocity", "ghost-files"],
  "code-health": ["hotspots", "cursed-files", "dead-code", "complexity-trend", "rewrite-ratio", "churn-velocity", "blast-radius"],
  "ownership-risk": ["bus-factor", "coupling", "ghost-files", "knowledge-silos"],
  "team-activity": ["contributors", "co-authors", "commit-timing", "parallel-dev", "shame"],
  structure: ["age-map", "languages", "test-coverage", "renames"],
};
```

- [ ] **Step 2: Update `navToTab` to return group + tab**

Replace the old `navToTab` with a `navToGroupTab` mapping that returns both group and default tab:

```typescript
const navToGroupTab: Record<NavItem, { group: SidebarGroup; tab: BottomTab }> = {
  dashboard: { group: "overview", tab: "hotspots" },
  "health-score": { group: "overview", tab: "hotspots" },
  hotspots: { group: "code-health", tab: "hotspots" },
  "cursed-files": { group: "code-health", tab: "cursed-files" },
  "dead-code": { group: "code-health", tab: "dead-code" },
  complexity: { group: "code-health", tab: "complexity-trend" },
  rewrites: { group: "code-health", tab: "rewrite-ratio" },
  "bus-factor": { group: "ownership-risk", tab: "bus-factor" },
  coupling: { group: "ownership-risk", tab: "coupling" },
  "ghost-files": { group: "ownership-risk", tab: "ghost-files" },
  knowledge: { group: "ownership-risk", tab: "knowledge-silos" },
  contributors: { group: "team-activity", tab: "contributors" },
  "co-authors": { group: "team-activity", tab: "co-authors" },
  timing: { group: "team-activity", tab: "commit-timing" },
  "parallel-dev": { group: "team-activity", tab: "parallel-dev" },
  shame: { group: "team-activity", tab: "shame" },
  "age-map": { group: "structure", tab: "age-map" },
  languages: { group: "structure", tab: "languages" },
  "test-coverage": { group: "structure", tab: "test-coverage" },
  renames: { group: "structure", tab: "renames" },
};
```

- [ ] **Step 3: Add `activeGroup` state and update `navigateTo`**

Add `activeGroup` to `SelectionState` and update the hook:

```typescript
export interface SelectionState {
  selectedFile: string | null;
  selectedContributor: string | null;
  activeNavItem: NavItem;
  activeGroup: SidebarGroup;
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
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  const [activeNavItem, setActiveNavItem] = useState<NavItem>("dashboard");
  const [activeGroup, setActiveGroup] = useState<SidebarGroup>("overview");
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>("hotspots");
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("file");

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
    const mapping = navToGroupTab[item];
    setActiveGroup(mapping.group);
    setActiveBottomTab(mapping.tab);
  }, []);

  return {
    selectedFile,
    selectedContributor,
    activeNavItem,
    activeGroup,
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

- [ ] **Step 4: Verify the build compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: Type errors in `BottomPanel.tsx` (new tab cases not handled yet) — that's fine, will fix in Task 3.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useSelection.ts
git commit -m "feat(web): add group-based tab filtering to useSelection hook"
```

---

## Task 2: Expand Sidebar with T2 Nav Items

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add T2 nav items to `getNavGroups`**

```typescript
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
        { id: "dead-code", label: "Dead Code", badge: report.deadCode.totalDeadFiles },
        { id: "complexity", label: "Complexity" },
        { id: "rewrites", label: "Rewrites" },
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
        { id: "ghost-files", label: "Ghost Files", badge: report.ghostFiles.totalGhostFiles },
        { id: "knowledge", label: "Knowledge Silos" },
      ],
    },
    {
      label: "Team & Activity",
      items: [
        { id: "contributors", label: "Contributors" },
        { id: "co-authors", label: "Co-Authors" },
        { id: "timing", label: "Timing" },
        { id: "parallel-dev", label: "Parallel Dev" },
        { id: "shame", label: "Shame" },
      ],
    },
    {
      label: "Structure",
      items: [
        { id: "age-map", label: "Age Map" },
        { id: "languages", label: "Languages" },
        { id: "test-coverage", label: "Test Coverage" },
        { id: "renames", label: "Renames" },
      ],
    },
  ];
}
```

- [ ] **Step 2: Verify in browser**

Run: `pnpm --filter @gitlore/web dev`
Expected: Sidebar now shows all T2 nav items. Clicking them navigates correctly (tab content will be empty until Task 3+).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat(web): expand sidebar with T2 navigation items"
```

---

## Task 3: Update BottomPanel with Group Filtering + Resize Handle

**Files:**
- Modify: `apps/web/src/components/layout/BottomPanel.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx`

- [ ] **Step 1: Add group filtering to BottomPanel**

Replace the static `TABS` array with the group-based system. Add imports for all 12 new tab components (they don't exist yet — create empty placeholder exports first, then fill in Tasks 4-15).

```typescript
import type { GitloreReport } from "@gitlore/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BottomTab, SidebarGroup } from "../../hooks/useSelection";
import { GROUP_TABS } from "../../hooks/useSelection";
import { AgeMapTab } from "../tabs/AgeMapTab";
import { BlastRadiusTab } from "../tabs/BlastRadiusTab";
import { BusFactorTab } from "../tabs/BusFactorTab";
import { ChurnVelocityTab } from "../tabs/ChurnVelocityTab";
import { CoAuthorsTab } from "../tabs/CoAuthorsTab";
import { CommitTimingTab } from "../tabs/CommitTimingTab";
import { ComplexityTrendTab } from "../tabs/ComplexityTrendTab";
import { ContributorsTab } from "../tabs/ContributorsTab";
import { CouplingTab } from "../tabs/CouplingTab";
import { CursedFilesTab } from "../tabs/CursedFilesTab";
import { DeadCodeTab } from "../tabs/DeadCodeTab";
import { GhostFilesTab } from "../tabs/GhostFilesTab";
import { HotspotsTab } from "../tabs/HotspotsTab";
import { KnowledgeSilosTab } from "../tabs/KnowledgeSilosTab";
import { LanguagesTab } from "../tabs/LanguagesTab";
import { ParallelDevTab } from "../tabs/ParallelDevTab";
import { RenamesTab } from "../tabs/RenamesTab";
import { RewriteRatioTab } from "../tabs/RewriteRatioTab";
import { ShameTab } from "../tabs/ShameTab";
import { TestCoverageTab } from "../tabs/TestCoverageTab";

interface BottomPanelProps {
  report: GitloreReport;
  activeGroup: SidebarGroup;
  activeTab: BottomTab;
  onTabChange: (tab: BottomTab) => void;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

const TAB_LABELS: Record<BottomTab, string> = {
  hotspots: "Hotspots",
  "cursed-files": "Cursed Files",
  "bus-factor": "Bus Factor",
  coupling: "Coupling",
  contributors: "Contributors",
  "parallel-dev": "Parallel Dev",
  shame: "Shame",
  "age-map": "Age Map",
  "dead-code": "Dead Code",
  "complexity-trend": "Complexity Trend",
  "rewrite-ratio": "Rewrite Ratio",
  "churn-velocity": "Churn Velocity",
  "blast-radius": "Blast Radius",
  "ghost-files": "Ghost Files",
  "knowledge-silos": "Knowledge Silos",
  "co-authors": "Co-Authors",
  "commit-timing": "Commit Timing",
  languages: "Languages",
  "test-coverage": "Test Coverage",
  renames: "Renames",
};
```

- [ ] **Step 2: Add the resize handle**

Add a draggable resize handle at the top of the bottom panel:

```typescript
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;
const DEFAULT_HEIGHT = 220;

export function BottomPanel({
  report,
  activeGroup,
  activeTab,
  onTabChange,
  selectedFile,
  onSelectFile,
}: BottomPanelProps) {
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startHeight: height };

      const handleMouseMove = (e: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startY - e.clientY;
        const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragRef.current.startHeight + delta));
        setHeight(newHeight);
      };

      const handleMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [height],
  );

  const visibleTabs = GROUP_TABS[activeGroup];

  // If activeTab is not in the current group, select the first tab in this group
  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      onTabChange(visibleTabs[0]);
    }
  }, [activeGroup, activeTab, onTabChange, visibleTabs]);

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-primary)",
        height,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-primary)",
        position: "relative",
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          position: "absolute",
          top: -3,
          left: 0,
          right: 0,
          height: 6,
          cursor: "row-resize",
          zIndex: 10,
        }}
      />

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
        {visibleTabs.map((tabId) => (
          <button
            key={tabId}
            onClick={() => onTabChange(tabId)}
            style={{
              padding: "8px 14px",
              fontSize: 10,
              border: "none",
              background: "none",
              cursor: "pointer",
              color:
                activeTab === tabId
                  ? "var(--text-primary)"
                  : "var(--text-tertiary)",
              borderBottom: `2px solid ${
                activeTab === tabId ? "var(--accent-primary)" : "transparent"
              }`,
            }}
          >
            {TAB_LABELS[tabId]}
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

- [ ] **Step 3: Expand TabContent switch with all 20 tabs**

```typescript
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
      return <HotspotsTab report={report} selectedFile={selectedFile} onSelectFile={onSelectFile} />;
    case "cursed-files":
      return <CursedFilesTab report={report} onSelectFile={onSelectFile} />;
    case "bus-factor":
      return <BusFactorTab report={report} onSelectFile={onSelectFile} />;
    case "coupling":
      return <CouplingTab report={report} onSelectFile={onSelectFile} />;
    case "contributors":
      return <ContributorsTab report={report} />;
    case "parallel-dev":
      return <ParallelDevTab report={report} onSelectFile={onSelectFile} />;
    case "shame":
      return <ShameTab report={report} onSelectFile={onSelectFile} />;
    case "age-map":
      return <AgeMapTab report={report} onSelectFile={onSelectFile} />;
    case "dead-code":
      return <DeadCodeTab report={report} onSelectFile={onSelectFile} />;
    case "complexity-trend":
      return <ComplexityTrendTab report={report} onSelectFile={onSelectFile} />;
    case "rewrite-ratio":
      return <RewriteRatioTab report={report} onSelectFile={onSelectFile} />;
    case "churn-velocity":
      return <ChurnVelocityTab report={report} onSelectFile={onSelectFile} />;
    case "blast-radius":
      return <BlastRadiusTab report={report} onSelectFile={onSelectFile} />;
    case "ghost-files":
      return <GhostFilesTab report={report} onSelectFile={onSelectFile} />;
    case "knowledge-silos":
      return <KnowledgeSilosTab report={report} />;
    case "co-authors":
      return <CoAuthorsTab report={report} />;
    case "commit-timing":
      return <CommitTimingTab report={report} onSelectFile={onSelectFile} />;
    case "languages":
      return <LanguagesTab report={report} />;
    case "test-coverage":
      return <TestCoverageTab report={report} />;
    case "renames":
      return <RenamesTab report={report} onSelectFile={onSelectFile} />;
  }
}
```

- [ ] **Step 4: Update Shell to pass `activeGroup` to BottomPanel**

In `Shell.tsx`, add `activeGroup` to the BottomPanel props:

```typescript
<BottomPanel
  report={report}
  activeGroup={selection.activeGroup}
  activeTab={selection.activeBottomTab}
  onTabChange={selection.setActiveBottomTab}
  selectedFile={selection.selectedFile}
  onSelectFile={selection.selectFile}
/>
```

- [ ] **Step 5: Create placeholder files for all 12 new tabs**

Create each tab file with a minimal placeholder so the build passes. Each follows this pattern (example for DeadCodeTab):

```typescript
// apps/web/src/components/tabs/DeadCodeTab.tsx
import type { GitloreReport } from "@gitlore/core";

interface DeadCodeTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function DeadCodeTab({ report, onSelectFile }: DeadCodeTabProps) {
  return <div style={{ color: "var(--text-tertiary)", fontSize: 11 }}>Dead Code — {report.deadCode.candidates.length} candidates</div>;
}
```

Create all 12 placeholders:
- `DeadCodeTab.tsx` — `report.deadCode.candidates.length`
- `ComplexityTrendTab.tsx` — `report.complexityTrend.growingFiles.length`
- `RewriteRatioTab.tsx` — `report.rewriteRatio.topRewriters.length`
- `ChurnVelocityTab.tsx` — `report.churnVelocity.acceleratingFiles.length`
- `BlastRadiusTab.tsx` — `report.blastRadius.topBlasters.length`
- `GhostFilesTab.tsx` — `report.ghostFiles.files.length`
- `KnowledgeSilosTab.tsx` (no `onSelectFile`) — `report.knowledgeConcentration.concentrationIndex`
- `CoAuthorsTab.tsx` (no `onSelectFile`) — `report.coAuthors.pairs.length`
- `CommitTimingTab.tsx` — `report.commitTiming.stressFiles.length`
- `LanguagesTab.tsx` (no `onSelectFile`) — `report.loc.languages.length`
- `TestCoverageTab.tsx` (no `onSelectFile`) — `report.testCoverage.directories.length`
- `RenamesTab.tsx` — `report.renameTracking.chains.length`

- [ ] **Step 6: Build and verify**

Run: `pnpm --filter @gitlore/web build`
Expected: Build succeeds. Sidebar navigation now filters bottom panel tabs by group.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/hooks/useSelection.ts apps/web/src/components/layout/BottomPanel.tsx apps/web/src/components/layout/Shell.tsx apps/web/src/components/tabs/DeadCodeTab.tsx apps/web/src/components/tabs/ComplexityTrendTab.tsx apps/web/src/components/tabs/RewriteRatioTab.tsx apps/web/src/components/tabs/ChurnVelocityTab.tsx apps/web/src/components/tabs/BlastRadiusTab.tsx apps/web/src/components/tabs/GhostFilesTab.tsx apps/web/src/components/tabs/KnowledgeSilosTab.tsx apps/web/src/components/tabs/CoAuthorsTab.tsx apps/web/src/components/tabs/CommitTimingTab.tsx apps/web/src/components/tabs/LanguagesTab.tsx apps/web/src/components/tabs/TestCoverageTab.tsx apps/web/src/components/tabs/RenamesTab.tsx
git commit -m "feat(web): add group-based tab filtering with resize handle and 12 tab placeholders"
```

---

## Task 4: Dead Code Tab

**Files:**
- Modify: `apps/web/src/components/tabs/DeadCodeTab.tsx`

**Core type:** `DeadCodeCandidate` — `file`, `lastCommitDate`, `ageInDays`, `language`, `loc`

- [ ] **Step 1: Implement the full tab**

```typescript
import type { DeadCodeCandidate, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath, fmt } from "../theme";

interface DeadCodeTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function DeadCodeTab({ report, onSelectFile }: DeadCodeTabProps) {
  const columns: Column<DeadCodeCandidate>[] = [
    {
      key: "file",
      label: "File",
      render: (d) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(d.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>
            {filePath(d.file)}
          </span>
        </span>
      ),
    },
    {
      key: "language",
      label: "Language",
      width: "100px",
      render: (d) => (
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{d.language}</span>
      ),
    },
    {
      key: "loc",
      label: "LOC",
      width: "70px",
      align: "right",
      sortValue: (d) => d.loc,
      render: (d) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmt(d.loc)}
        </span>
      ),
    },
    {
      key: "age",
      label: "Days Untouched",
      width: "120px",
      align: "right",
      sortValue: (d) => d.ageInDays,
      render: (d) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
          <Badge variant={d.ageInDays > 365 ? "critical" : d.ageInDays > 180 ? "warning" : "stale"}>
            {d.ageInDays > 365 ? "ancient" : d.ageInDays > 180 ? "stale" : "dormant"}
          </Badge>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
            {fmt(d.ageInDays)}d
          </span>
        </div>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.deadCode.candidates}
      columns={columns}
      rowKey={(d) => d.file}
      onRowClick={(d) => onSelectFile(d.file)}
    />
  );
}
```

- [ ] **Step 2: Verify in browser**

Navigate to Code Health → Dead Code tab. Expected: Table renders with file, language, LOC, age columns.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tabs/DeadCodeTab.tsx
git commit -m "feat(web): implement Dead Code tab with age badges"
```

---

## Task 5: Complexity Trend Tab

**Files:**
- Modify: `apps/web/src/components/tabs/ComplexityTrendTab.tsx`

**Core type:** `FileComplexityTrend` — `file`, `totalNetLines`, `recentGrowthRate`, `trend` (GrowthTrend)

- [ ] **Step 1: Implement the full tab**

```typescript
import type { FileComplexityTrend, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath, fmt } from "../theme";

interface ComplexityTrendTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

function trendVariant(trend: string): "critical" | "warning" | "healthy" | "stale" {
  switch (trend) {
    case "growing": return "critical";
    case "stable": return "healthy";
    case "shrinking": return "healthy";
    default: return "stale";
  }
}

export function ComplexityTrendTab({ report, onSelectFile }: ComplexityTrendTabProps) {
  const columns: Column<FileComplexityTrend>[] = [
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: "trend",
      label: "Trend",
      width: "100px",
      render: (f) => <Badge variant={trendVariant(f.trend)}>{f.trend}</Badge>,
    },
    {
      key: "growthRate",
      label: "Growth Rate",
      width: "100px",
      align: "right",
      sortValue: (f) => f.recentGrowthRate,
      render: (f) => (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: f.recentGrowthRate > 0 ? "var(--severity-critical)" : "var(--severity-healthy)",
        }}>
          {f.recentGrowthRate > 0 ? "+" : ""}{f.recentGrowthRate.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "netLines",
      label: "Net Lines",
      width: "90px",
      align: "right",
      sortValue: (f) => f.totalNetLines,
      render: (f) => (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: f.totalNetLines > 0 ? "var(--severity-warning)" : "var(--text-secondary)",
        }}>
          {f.totalNetLines > 0 ? "+" : ""}{fmt(f.totalNetLines)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.complexityTrend.growingFiles}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tabs/ComplexityTrendTab.tsx
git commit -m "feat(web): implement Complexity Trend tab"
```

---

## Task 6: Rewrite Ratio Tab

**Files:**
- Modify: `apps/web/src/components/tabs/RewriteRatioTab.tsx`

**Core type:** `FileRewriteRatio` — `file`, `rewriteScore`, `totalInsertions`, `totalDeletions`, `ratio`

- [ ] **Step 1: Implement the full tab**

```typescript
import type { FileRewriteRatio, GitloreReport } from "@gitlore/core";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath, fmt } from "../theme";

interface RewriteRatioTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function RewriteRatioTab({ report, onSelectFile }: RewriteRatioTabProps) {
  const columns: Column<FileRewriteRatio>[] = [
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: "ratio",
      label: "Ratio",
      width: "100px",
      align: "right",
      sortValue: (f) => f.rewriteScore,
      render: (f) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          <div style={{ width: 50, height: 4, background: "var(--surface-tertiary)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${f.rewriteScore}%`, height: "100%", borderRadius: 2, background: "var(--severity-warning)" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", width: 28, textAlign: "right" }}>
            {f.rewriteScore}
          </span>
        </div>
      ),
    },
    {
      key: "insertions",
      label: "Insertions",
      width: "90px",
      align: "right",
      sortValue: (f) => f.totalInsertions,
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--severity-healthy)" }}>
          +{fmt(f.totalInsertions)}
        </span>
      ),
    },
    {
      key: "deletions",
      label: "Deletions",
      width: "90px",
      align: "right",
      sortValue: (f) => f.totalDeletions,
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--severity-critical)" }}>
          -{fmt(f.totalDeletions)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.rewriteRatio.topRewriters}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tabs/RewriteRatioTab.tsx
git commit -m "feat(web): implement Rewrite Ratio tab"
```

---

## Task 7: Churn Velocity Tab

**Files:**
- Modify: `apps/web/src/components/tabs/ChurnVelocityTab.tsx`

**Core type:** `FileChurnVelocity` — `file`, `velocityScore`, `trend` (ChurnTrend), `recentCommits`, `olderCommits`, `totalCommits`

- [ ] **Step 1: Implement the full tab**

```typescript
import type { FileChurnVelocity, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath } from "../theme";

interface ChurnVelocityTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

function trendVariant(trend: string): "critical" | "warning" | "healthy" {
  switch (trend) {
    case "accelerating": return "critical";
    case "stable": return "warning";
    case "decelerating": return "healthy";
    default: return "warning";
  }
}

export function ChurnVelocityTab({ report, onSelectFile }: ChurnVelocityTabProps) {
  const columns: Column<FileChurnVelocity>[] = [
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: "trend",
      label: "Trend",
      width: "110px",
      render: (f) => <Badge variant={trendVariant(f.trend)}>{f.trend}</Badge>,
    },
    {
      key: "velocity",
      label: "Velocity",
      width: "80px",
      align: "right",
      sortValue: (f) => f.velocityScore,
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {f.velocityScore}
        </span>
      ),
    },
    {
      key: "recent",
      label: "Recent",
      width: "70px",
      align: "right",
      sortValue: (f) => f.recentCommits,
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {f.recentCommits}
        </span>
      ),
    },
    {
      key: "older",
      label: "Older",
      width: "70px",
      align: "right",
      sortValue: (f) => f.olderCommits,
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-tertiary)" }}>
          {f.olderCommits}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.churnVelocity.acceleratingFiles}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tabs/ChurnVelocityTab.tsx
git commit -m "feat(web): implement Churn Velocity tab"
```

---

## Task 8: Blast Radius Tab

**Files:**
- Modify: `apps/web/src/components/tabs/BlastRadiusTab.tsx`

**Core type:** `FileBlastRadius` — `file`, `blastScore`, `avgCoChangedFiles`, `maxCoChangedFiles`, `totalCommits`

- [ ] **Step 1: Implement the full tab**

```typescript
import type { FileBlastRadius, GitloreReport } from "@gitlore/core";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath, fmt } from "../theme";

interface BlastRadiusTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function BlastRadiusTab({ report, onSelectFile }: BlastRadiusTabProps) {
  const columns: Column<FileBlastRadius>[] = [
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: "score",
      label: "Score",
      width: "100px",
      align: "right",
      sortValue: (f) => f.blastScore,
      render: (f) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          <div style={{ width: 50, height: 4, background: "var(--surface-tertiary)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${f.blastScore}%`, height: "100%", borderRadius: 2, background: "var(--severity-warning)" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", width: 24, textAlign: "right" }}>
            {f.blastScore}
          </span>
        </div>
      ),
    },
    {
      key: "avg",
      label: "Avg Co-change",
      width: "110px",
      align: "right",
      sortValue: (f) => f.avgCoChangedFiles,
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {f.avgCoChangedFiles.toFixed(1)} files
        </span>
      ),
    },
    {
      key: "peak",
      label: "Peak",
      width: "70px",
      align: "right",
      sortValue: (f) => f.maxCoChangedFiles,
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmt(f.maxCoChangedFiles)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.blastRadius.topBlasters}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tabs/BlastRadiusTab.tsx
git commit -m "feat(web): implement Blast Radius tab"
```

---

## Task 9: Ghost Files Tab

**Files:**
- Modify: `apps/web/src/components/tabs/GhostFilesTab.tsx`

**Core type:** `GhostFile` — `file`, `dominantAuthor`, `dominantAuthorPercent`, `lastAuthorCommitDate`, `authorInactiveDays`, `loc`

- [ ] **Step 1: Implement the full tab**

```typescript
import type { GhostFile, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath, fmt } from "../theme";

interface GhostFilesTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function GhostFilesTab({ report, onSelectFile }: GhostFilesTabProps) {
  const columns: Column<GhostFile>[] = [
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: "owner",
      label: "Owner",
      width: "140px",
      render: (f) => (
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {f.dominantAuthor.split(" <")[0]}
        </span>
      ),
    },
    {
      key: "ownership",
      label: "Ownership",
      width: "90px",
      align: "right",
      sortValue: (f) => f.dominantAuthorPercent,
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-ownership)" }}>
          {f.dominantAuthorPercent}%
        </span>
      ),
    },
    {
      key: "inactive",
      label: "Days Inactive",
      width: "110px",
      align: "right",
      sortValue: (f) => f.authorInactiveDays,
      render: (f) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
          <Badge variant={f.authorInactiveDays > 180 ? "critical" : "warning"}>
            {f.authorInactiveDays > 365 ? "ghost" : "fading"}
          </Badge>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
            {fmt(f.authorInactiveDays)}d
          </span>
        </div>
      ),
    },
    {
      key: "loc",
      label: "LOC",
      width: "60px",
      align: "right",
      sortValue: (f) => f.loc,
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmt(f.loc)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.ghostFiles.files}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tabs/GhostFilesTab.tsx
git commit -m "feat(web): implement Ghost Files tab"
```

---

## Task 10: Knowledge Silos Tab

**Files:**
- Modify: `apps/web/src/components/tabs/KnowledgeSilosTab.tsx`

**Core type:** `KnowledgeConcentrationReport` — `singleAuthorFiles`, `totalFiles`, `concentrationIndex`, `summary`

This is a repo-wide metric, not a file list. Display it as a summary card rather than a table.

- [ ] **Step 1: Implement the summary view**

```typescript
import type { GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";

interface KnowledgeSilosTabProps {
  report: GitloreReport;
}

function riskLevel(index: number): { variant: "healthy" | "warning" | "critical"; label: string } {
  if (index < 40) return { variant: "healthy", label: "Low Risk" };
  if (index < 70) return { variant: "warning", label: "Moderate Risk" };
  return { variant: "critical", label: "High Risk" };
}

export function KnowledgeSilosTab({ report }: KnowledgeSilosTabProps) {
  const kc = report.knowledgeConcentration;
  const risk = riskLevel(kc.concentrationIndex);

  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* Index display */}
        <div style={{ textAlign: "center", minWidth: 120 }}>
          <div style={{
            fontSize: 36,
            fontWeight: 700,
            fontFamily: "var(--font-mono)",
            color: `var(--severity-${risk.variant})`,
            lineHeight: 1,
          }}>
            {kc.concentrationIndex.toFixed(0)}%
          </div>
          <div style={{ marginTop: 4 }}>
            <Badge variant={risk.variant}>{risk.label}</Badge>
          </div>
          <div style={{ fontSize: 9, color: "var(--text-tertiary)", marginTop: 6, textTransform: "uppercase", letterSpacing: 1 }}>
            Concentration Index
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 11 }}>
          <div style={{ color: "var(--text-secondary)" }}>
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600 }}>
              {kc.singleAuthorFiles}
            </span>{" "}
            of {kc.totalFiles} files have a single dominant author (80%+ commits)
          </div>
          <div style={{ color: "var(--text-tertiary)", fontSize: 10, maxWidth: 400 }}>
            {kc.summary}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tabs/KnowledgeSilosTab.tsx
git commit -m "feat(web): implement Knowledge Silos tab with concentration index"
```

---

## Task 11: Co-Authors Tab

**Files:**
- Modify: `apps/web/src/components/tabs/CoAuthorsTab.tsx`

**Core type:** `CoAuthorPair` — `authorA`, `authorB`, `coAuthoredCommits`, `files`

- [ ] **Step 1: Implement the full tab**

```typescript
import type { CoAuthorPair, GitloreReport } from "@gitlore/core";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fmt } from "../theme";

interface CoAuthorsTabProps {
  report: GitloreReport;
}

export function CoAuthorsTab({ report }: CoAuthorsTabProps) {
  const columns: Column<CoAuthorPair>[] = [
    {
      key: "pair",
      label: "Pair",
      render: (p) => (
        <span style={{ fontSize: 11, color: "var(--text-primary)" }}>
          {p.authorA.split(" <")[0]}
          <span style={{ color: "var(--text-tertiary)", margin: "0 6px" }}>&</span>
          {p.authorB.split(" <")[0]}
        </span>
      ),
    },
    {
      key: "commits",
      label: "Co-commits",
      width: "100px",
      align: "right",
      sortValue: (p) => p.coAuthoredCommits,
      render: (p) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmt(p.coAuthoredCommits)}
        </span>
      ),
    },
    {
      key: "files",
      label: "Shared Files",
      width: "100px",
      align: "right",
      sortValue: (p) => p.files.length,
      render: (p) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {p.files.length}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.coAuthors.pairs}
      columns={columns}
      rowKey={(p) => `${p.authorA}|${p.authorB}`}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tabs/CoAuthorsTab.tsx
git commit -m "feat(web): implement Co-Authors tab"
```

---

## Task 12: Commit Timing Tab

**Files:**
- Modify: `apps/web/src/components/tabs/CommitTimingTab.tsx`

**Core type:** `FileTimingProfile` — `file`, `totalCommits`, `lateNightPercent`, `weekendPercent`, `peakHour`, `peakDay`, `stressScore`

- [ ] **Step 1: Implement the full tab**

```typescript
import type { FileTimingProfile, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath } from "../theme";

interface CommitTimingTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

export function CommitTimingTab({ report, onSelectFile }: CommitTimingTabProps) {
  const columns: Column<FileTimingProfile>[] = [
    {
      key: "file",
      label: "File",
      render: (f) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(f.file)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>
            {filePath(f.file)}
          </span>
        </span>
      ),
    },
    {
      key: "lateNight",
      label: "Late Night %",
      width: "100px",
      align: "right",
      sortValue: (f) => f.lateNightPercent,
      render: (f) => (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: f.lateNightPercent > 30 ? "var(--severity-warning)" : "var(--text-secondary)",
        }}>
          {f.lateNightPercent.toFixed(0)}%
        </span>
      ),
    },
    {
      key: "weekend",
      label: "Weekend %",
      width: "100px",
      align: "right",
      sortValue: (f) => f.weekendPercent,
      render: (f) => (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: f.weekendPercent > 30 ? "var(--severity-warning)" : "var(--text-secondary)",
        }}>
          {f.weekendPercent.toFixed(0)}%
        </span>
      ),
    },
    {
      key: "peak",
      label: "Peak Time",
      width: "110px",
      render: (f) => (
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {DAYS[f.peakDay]} {formatHour(f.peakHour)}
        </span>
      ),
    },
    {
      key: "stress",
      label: "Stress",
      width: "80px",
      align: "right",
      sortValue: (f) => f.stressScore,
      render: (f) => (
        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
          {f.stressScore > 50 && <Badge variant="warning">stress</Badge>}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
            {f.stressScore.toFixed(0)}
          </span>
        </div>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.commitTiming.stressFiles}
      columns={columns}
      rowKey={(f) => f.file}
      onRowClick={(f) => onSelectFile(f.file)}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tabs/CommitTimingTab.tsx
git commit -m "feat(web): implement Commit Timing tab with stress scores"
```

---

## Task 13: Languages Tab

**Files:**
- Modify: `apps/web/src/components/tabs/LanguagesTab.tsx`

**Core type:** `LanguageBreakdown` — `language`, `files`, `lines`, `percentage`

- [ ] **Step 1: Implement the full tab**

```typescript
import type { GitloreReport, LanguageBreakdown } from "@gitlore/core";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fmt } from "../theme";

interface LanguagesTabProps {
  report: GitloreReport;
}

export function LanguagesTab({ report }: LanguagesTabProps) {
  const columns: Column<LanguageBreakdown>[] = [
    {
      key: "language",
      label: "Language",
      render: (l) => (
        <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 500 }}>
          {l.language}
        </span>
      ),
    },
    {
      key: "percentage",
      label: "% of Codebase",
      width: "160px",
      sortValue: (l) => l.percentage,
      render: (l) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 80, height: 4, background: "var(--surface-tertiary)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${l.percentage}%`, height: "100%", borderRadius: 2, background: "var(--accent-primary)" }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", width: 40 }}>
            {l.percentage.toFixed(1)}%
          </span>
        </div>
      ),
    },
    {
      key: "files",
      label: "Files",
      width: "70px",
      align: "right",
      sortValue: (l) => l.files,
      render: (l) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmt(l.files)}
        </span>
      ),
    },
    {
      key: "lines",
      label: "Lines",
      width: "80px",
      align: "right",
      sortValue: (l) => l.lines,
      render: (l) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmt(l.lines)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.loc.languages}
      columns={columns}
      rowKey={(l) => l.language}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tabs/LanguagesTab.tsx
git commit -m "feat(web): implement Languages tab with percentage bars"
```

---

## Task 14: Test Coverage Tab

**Files:**
- Modify: `apps/web/src/components/tabs/TestCoverageTab.tsx`

**Core type:** `DirectoryCoverage` — `directory`, `sourceFiles`, `testFiles`, `coverageRatio`, `hasTests`

- [ ] **Step 1: Implement the full tab**

```typescript
import type { DirectoryCoverage, GitloreReport } from "@gitlore/core";
import Badge from "../shared/Badge";
import { type Column, SortableTable } from "../shared/SortableTable";

interface TestCoverageTabProps {
  report: GitloreReport;
}

export function TestCoverageTab({ report }: TestCoverageTabProps) {
  const columns: Column<DirectoryCoverage>[] = [
    {
      key: "directory",
      label: "Directory",
      render: (d) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-primary)" }}>
          {d.directory}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "90px",
      render: (d) => (
        <Badge variant={d.hasTests ? (d.coverageRatio >= 0.5 ? "healthy" : "warning") : "critical"}>
          {d.hasTests ? (d.coverageRatio >= 0.5 ? "covered" : "low") : "untested"}
        </Badge>
      ),
    },
    {
      key: "source",
      label: "Source Files",
      width: "90px",
      align: "right",
      sortValue: (d) => d.sourceFiles,
      render: (d) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {d.sourceFiles}
        </span>
      ),
    },
    {
      key: "test",
      label: "Test Files",
      width: "80px",
      align: "right",
      sortValue: (d) => d.testFiles,
      render: (d) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {d.testFiles}
        </span>
      ),
    },
    {
      key: "ratio",
      label: "Ratio",
      width: "100px",
      align: "right",
      sortValue: (d) => d.coverageRatio,
      render: (d) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
          <div style={{ width: 50, height: 4, background: "var(--surface-tertiary)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              width: `${Math.min(100, d.coverageRatio * 100)}%`,
              height: "100%",
              borderRadius: 2,
              background: d.coverageRatio >= 0.5 ? "var(--severity-healthy)" : "var(--severity-warning)",
            }} />
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", width: 32, textAlign: "right" }}>
            {(d.coverageRatio * 100).toFixed(0)}%
          </span>
        </div>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.testCoverage.directories}
      columns={columns}
      rowKey={(d) => d.directory}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tabs/TestCoverageTab.tsx
git commit -m "feat(web): implement Test Coverage tab with ratio bars"
```

---

## Task 15: Renames Tab

**Files:**
- Modify: `apps/web/src/components/tabs/RenamesTab.tsx`

**Core type:** `FileRenameChain` — `currentPath`, `previousNames`, `renameCount`

- [ ] **Step 1: Implement the full tab**

```typescript
import type { FileRenameChain, GitloreReport } from "@gitlore/core";
import { type Column, SortableTable } from "../shared/SortableTable";
import { fileName, filePath, fmt } from "../theme";

interface RenamesTabProps {
  report: GitloreReport;
  onSelectFile: (file: string) => void;
}

export function RenamesTab({ report, onSelectFile }: RenamesTabProps) {
  const columns: Column<FileRenameChain>[] = [
    {
      key: "file",
      label: "Current Name",
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {fileName(r.currentPath)}
          <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>
            {filePath(r.currentPath)}
          </span>
        </span>
      ),
    },
    {
      key: "previous",
      label: "Previous Names",
      width: "280px",
      render: (r) => (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {r.previousNames.map((name) => (
            <span
              key={name}
              style={{
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 4,
                background: "var(--surface-tertiary)",
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {fileName(name)}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: "count",
      label: "Renames",
      width: "80px",
      align: "right",
      sortValue: (r) => r.renameCount,
      render: (r) => (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)" }}>
          {fmt(r.renameCount)}
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={report.renameTracking.chains}
      columns={columns}
      rowKey={(r) => r.currentPath}
      onRowClick={(r) => onSelectFile(r.currentPath)}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/tabs/RenamesTab.tsx
git commit -m "feat(web): implement Renames tab with history chains"
```

---

## Task 16: Final Build Verification

- [ ] **Step 1: Full build**

Run: `pnpm --filter @gitlore/web build`
Expected: Clean build, no errors.

- [ ] **Step 2: Visual verification**

Run: `pnpm --filter @gitlore/web dev`
Walk through each sidebar group and verify:
1. Clicking sidebar groups changes the bottom panel tab set
2. Clicking individual sidebar items pre-selects the correct tab
3. Dashboard shows the 5 "greatest hits" tabs
4. Resize handle on bottom panel works (drag up/down)
5. All 12 new tabs render data from the report
6. All 8 existing tabs still work

- [ ] **Step 3: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore(web): T2 tabs build verification and cleanup"
```
