# Risk Dashboard & Tech Debt Workbench — Design Spec

**Jira:** KAN-75, KAN-76
**Branch:** `gitlore-redesign`
**Date:** 2026-04-06

## Overview

Two new composite dashboard views that recombine existing analyzer data into focused lenses. Neither requires new core analyzers — all data already exists in `GitloreReport`.

- **Risk Dashboard (KAN-75)** — People & ownership problems. "What breaks when someone leaves?"
- **Tech Debt Workbench (KAN-76)** — Code quality problems. "What files are rotting, growing, or getting rewritten?"

## Navigation

The sidebar "Dashboard" item expands into a collapsible tree with three sub-items:

```
OVERVIEW
  Dashboard
    Overview        ← current default behavior
    Risk            ← KAN-75
    Tech Debt       ← KAN-76
CODE HEALTH
  Hotspots
  ...
```

### Behavior

- Dashboard starts collapsed, showing just "Dashboard" (current behavior preserved).
- Clicking Dashboard expands the tree and selects "Overview."
- Clicking Risk or Tech Debt selects that sub-item and reconfigures the center area (hero viz, bottom panel tabs, metrics strip).
- Clicking any other sidebar item outside Dashboard collapses the tree.
- The expanded/collapsed state is local UI state only (no persistence needed).

### Implementation

- Add a `DashboardMode` type: `'overview' | 'risk' | 'tech-debt'` to `useSelection`.
- Add `dashboardMode` state and `setDashboardMode` setter.
- Add `isDashboardExpanded` derived state (true when `activeNavItem` is `'dashboard'`).
- Sidebar renders sub-items conditionally when expanded.
- `navigateTo('dashboard')` expands and defaults to overview; navigating away collapses.

## Risk Dashboard (KAN-75)

### Metrics Strip

When `dashboardMode === 'risk'`, the `MetricsStrip` shows:

| Metric | Source | Computation |
|--------|--------|-------------|
| Critical Bus Factor | `busFactors.criticalFiles` | `.length` |
| Ghost Files | `ghostFiles.files` | `.length` |
| Knowledge Concentration | `knowledgeConcentration` | `.concentrationIndex` (already 0–100) |
| High Blast Radius | `blastRadius.files` | count where `blastScore > 70` |
| At-Risk LOC | `busFactors.criticalFiles` + `loc.files` | sum LOC of files in critical bus factor list |

### Hero Visualizations

Two hero viz options, selectable via the existing viz switcher pattern:

#### 1. Risk Heatmap (default)

- **X-axis:** Risk dimensions — Bus Factor, Ghost Risk, Knowledge Concentration, Blast Radius
- **Y-axis:** Files, sorted by composite risk score (highest at top), limited to top 30
- **Cell color:** Green (low) → Yellow (medium) → Red (critical), continuous gradient
- **Cell values:**
  - Bus Factor: map risk level to 0–100 (critical=100, high=75, medium=50, low=25)
  - Ghost Risk: 100 if file's dominant author is ghost, 0 otherwise
  - Knowledge Concentration: dominant author percent (0–100)
  - Blast Radius: blast score (already 0–100)
- **Interactions:** Click a row to select the file (populates inspector). Hover cell for tooltip showing the raw value and explanation.
- **Component:** `apps/web/src/components/hero/RiskHeatmap.tsx`
- **Dependencies:** No d3 needed — pure CSS grid with computed colors.

#### 2. Ownership Sunburst

- **Inner ring:** Contributors, sized by number of owned files
- **Outer ring:** Files owned by each contributor, colored by bus factor risk level
- **Interactions:** Click a contributor segment to select them. Click a file segment to select the file.
- **Component:** `apps/web/src/components/hero/OwnershipSunburst.tsx`
- **Dependencies:** `d3-hierarchy` (already installed) for partition layout, `d3-shape` for arc generator.

### Bottom Panel

Tabs: **Risk Register** | Bus Factor | Ghost Files | Knowledge Silos

#### Risk Register (new composite table)

A `SortableTable` where each row is a file with columns blending multiple analyzer outputs:

| Column | Source | Display |
|--------|--------|---------|
| File | — | monospace filename + path |
| Bus Factor | `busFactors.files` | Badge: critical/high/medium/low |
| Ghost | `ghostFiles.files` | Badge: "orphaned" if in ghost list, "active" otherwise |
| Concentration | `busFactors.files` | `dominantAuthorPercent` as percentage |
| Blast Radius | `blastRadius.files` | `blastScore` numeric |
| Risk Score | computed | Composite: `(busFactor * 0.35) + (ghost * 0.25) + (concentration * 0.25) + (blast * 0.15)` |

**Data source:** Start with `busFactors.files`, enrich each row by looking up the same file in ghost files, blast radius, and knowledge concentration data. Filter to files that appear in at least one risk category (bus factor >= medium OR ghost OR concentration > 80% OR blast > 70). Sort by risk score descending.

**Component:** `apps/web/src/components/tabs/RiskRegisterTab.tsx`

The remaining tabs (Bus Factor, Ghost Files, Knowledge Silos) are the existing tab components, reused as-is.

## Tech Debt Workbench (KAN-76)

### Metrics Strip

When `dashboardMode === 'tech-debt'`, the `MetricsStrip` shows:

| Metric | Source | Computation |
|--------|--------|-------------|
| Dead Files | `deadCode` | `.totalDeadFiles` |
| Growing Files | `complexityTrend.growingFiles` | `.length` |
| High Rewrite | `rewriteRatio.topRewriters` | `.length` |
| Accelerating Churn | `churnVelocity.acceleratingFiles` | `.length` |
| Debt LOC | `deadCode.candidates` + `rewriteRatio.topRewriters` + `loc.files` | sum LOC of files appearing in dead code or top rewriters |

### Hero Visualizations

Two hero viz options:

#### 1. Growth Timeline (default)

- **Type:** Stacked area chart showing cumulative complexity growth over time
- **X-axis:** Months (from `complexityTrend.files[].buckets[].month`)
- **Y-axis:** Cumulative net lines
- **Series:** Top 10 growing files by `recentGrowthRate`, each a separate colored area/line
- **Interactions:** Hover a series to highlight it and show file name + growth rate in tooltip. Click a series to select the file.
- **Component:** `apps/web/src/components/hero/GrowthTimeline.tsx`
- **Dependencies:** `d3-scale`, `d3-shape` for area/line generators, `d3-array` for extent. All already available via d3-hierarchy's transitive deps or easily added.

#### 2. Debt Scatter

- **X-axis:** File age in days (`ageMap.files[].ageInDays`)
- **Y-axis:** Rewrite ratio (`rewriteRatio.files[].rewriteScore`)
- **Bubble size:** LOC (`loc.files[].lines`)
- **Bubble color:** Churn velocity trend — red for accelerating, yellow for stable, green for decelerating
- **Quadrant labels:** Top-right = "Legacy Debt" (old + constantly rewritten), Bottom-right = "Stable Legacy", Top-left = "Active Churn" (new but high rewrite), Bottom-left = "Healthy"
- **Interactions:** Click bubble to select file. Hover for tooltip with file name, age, rewrite score, LOC.
- **Component:** `apps/web/src/components/hero/DebtScatter.tsx`
- **Dependencies:** Same d3 scales as existing `HotspotScatter.tsx` — follow that pattern.

### Bottom Panel

Tabs: **Debt Inventory** | Dead Code | Complexity | Rewrite Ratio | Churn Velocity

#### Debt Inventory (new composite table)

A `SortableTable` where each row is a file with columns blending debt-related analyzer outputs:

| Column | Source | Display |
|--------|--------|---------|
| File | — | monospace filename + path |
| Age | `ageMap.files` | days, formatted as "Xd" / "X.Xy" |
| Rewrite | `rewriteRatio.files` | `rewriteScore` with severity badge |
| Growth | `complexityTrend.files` | `recentGrowthRate` as "+N/mo" |
| Churn Vel. | `churnVelocity.files` | Badge: accelerating/stable/decelerating |
| Shame | `forensics.files` | `shameScore` numeric |
| Debt Score | computed | Composite: `(rewrite * 0.3) + (growth * 0.25) + (churnVel * 0.2) + (shame * 0.15) + (age * 0.1)` |

**Data source:** Start with all files that appear in at least one debt signal (dead code candidates, growing files, top rewriters, or accelerating churn). Enrich each row by looking up across analyzers. Sort by debt score descending.

**Normalization for debt score:** Each component needs 0–100 normalization before weighting:
- Rewrite: `rewriteScore` is already 0–100
- Growth: `recentGrowthRate` normalized relative to max across all files
- Churn velocity: `velocityScore` is already 0–100
- Shame: `shameScore` is already 0–100
- Age: `ageInDays` normalized relative to repo age (`meta.ageInDays`)

**Component:** `apps/web/src/components/tabs/DebtInventoryTab.tsx`

The remaining tabs (Dead Code, Complexity, Rewrite Ratio, Churn Velocity) are existing tab components, reused as-is.

## Shared Implementation Notes

### useSelection changes

```
DashboardMode = 'overview' | 'risk' | 'tech-debt'

New state:
  dashboardMode: DashboardMode (default: 'overview')
  setDashboardMode: (mode: DashboardMode) => void

New GROUP_TABS entries:
  'risk': ['risk-register', 'bus-factor', 'ghost-files', 'knowledge-silos']
  'tech-debt': ['debt-inventory', 'dead-code', 'complexity-trend', 'rewrite-ratio', 'churn-velocity']

New BottomTab values:
  'risk-register', 'debt-inventory'

HeroViz additions:
  'risk-heatmap', 'ownership-sunburst', 'growth-timeline', 'debt-scatter'
```

### MetricsStrip changes

`MetricsStrip` receives `dashboardMode` as a prop. It switches between three metric sets based on mode. Each mode's metrics are computed inline from the report — no new core functions needed.

### Shell changes

`Shell` passes `dashboardMode` to `MetricsStrip` and uses it to determine which hero vizzes are available in the switcher. The hero viz switcher array becomes dynamic based on mode:

- Overview: existing 7 vizzes (treemap, ownership, coupling, etc.)
- Risk: risk-heatmap, ownership-sunburst
- Tech Debt: growth-timeline, debt-scatter

### Sidebar changes

`Sidebar` renders Dashboard sub-items when expanded. The sub-items use the same button style but indented. An expand/collapse chevron icon (pure CSS triangle) indicates the tree state.

## New Files

| File | Purpose |
|------|---------|
| `apps/web/src/components/hero/RiskHeatmap.tsx` | Risk heatmap hero viz |
| `apps/web/src/components/hero/OwnershipSunburst.tsx` | Ownership sunburst hero viz |
| `apps/web/src/components/hero/GrowthTimeline.tsx` | Complexity growth timeline hero viz |
| `apps/web/src/components/hero/DebtScatter.tsx` | Debt scatter plot hero viz |
| `apps/web/src/components/tabs/RiskRegisterTab.tsx` | Composite risk register table |
| `apps/web/src/components/tabs/DebtInventoryTab.tsx` | Composite debt inventory table |

## Modified Files

| File | Changes |
|------|---------|
| `apps/web/src/hooks/useSelection.ts` | Add `DashboardMode`, new tabs, new hero vizzes |
| `apps/web/src/components/layout/Sidebar.tsx` | Dashboard tree expansion |
| `apps/web/src/components/layout/Shell.tsx` | Dynamic hero viz switcher, pass mode to MetricsStrip |
| `apps/web/src/components/layout/MetricsStrip.tsx` | Mode-aware metric sets |
| `apps/web/src/components/layout/BottomPanel.tsx` | Register new tab components |

## Out of Scope

- New core analyzers — everything uses existing `GitloreReport` data
- Persisting dashboard mode across sessions
- The broken coupling heatmap (separate issue)
- Mobile/responsive layout for these views
