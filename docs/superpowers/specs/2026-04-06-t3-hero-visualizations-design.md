# T3 Hero Visualizations — Design Spec

> Extends the dashboard redesign spec. Defines 6 new hero visualizations, the switching infrastructure, and cross-linking behavior for the GitLore web dashboard.

---

## Scope

**In scope:** 6 new hero vizzes, hero toolbar refactor, shared color utilities.

**Deferred:** AI features (Narrative, Refactor Brief), composite sidebar views (Risk Dashboard, Tech Debt Workbench, Repo Health), alternative themes.

---

## Hero Viz Switching Infrastructure

### State Addition

`useSelection` gains:

```ts
type HeroViz = 'treemap' | 'ownership' | 'coupling' | 'commit-graph' | 'scatter' | 'timeline' | 'swimlanes';
```

New state: `activeHeroViz` (default: `'treemap'`) with `setActiveHeroViz` setter.

### Toolbar

The Shell's hero toolbar becomes data-driven from an array:

```ts
const HERO_VIZZES: { id: HeroViz; label: string }[] = [
  { id: 'treemap', label: 'Treemap' },
  { id: 'ownership', label: 'Ownership' },
  { id: 'coupling', label: 'Coupling' },
  { id: 'commit-graph', label: 'Graph' },
  { id: 'scatter', label: 'Scatter' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'swimlanes', label: 'Swimlanes' },
];
```

All 7 items render as flat pills in a segmented control. No grouping or overflow — desktop-only on 1280px+ screens.

### Hero Component Contract

Every hero viz receives at minimum:

```ts
interface HeroVizProps {
  report: GitloreReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}
```

Contributor-centric vizzes (Timeline, Swimlanes) additionally receive:

```ts
selectedContributor: string | null;
onSelectContributor: (email: string) => void;
```

The Shell renders a switch on `activeHeroViz`, passing the appropriate props to each component.

---

## Visualizations

### 1. Ownership Bubble Chart

**File:** `OwnershipBubble.tsx`

Packed bubble chart (NYT budget-chart style) showing file ownership concentration.

- **Layout:** `d3-hierarchy` `pack()` — same dependency as ChurnTreemap
- **Hierarchy:** root → directories → files (same tree-building logic as ChurnTreemap)
- **Bubble size:** LOC per file (from `loc.files`)
- **Bubble color:** dominant author, sourced from `busFactors` data. Each file's top contributor gets a color via deterministic hash of their email → hue (stable across reloads)
- **Labels:** file name shown on bubbles above a size threshold
- **Interaction:** click bubble → `onSelectFile`
- **Selected state:** selected bubble gets accent border (same pattern as treemap)

### 2. Hotspot Scatter Plot

**File:** `HotspotScatter.tsx`

Churn × complexity scatter plot identifying danger-zone files.

- **X axis:** churn count (from `churn.files`)
- **Y axis:** LOC (from `loc.files`) as complexity proxy
- **Dot size:** hotspot score
- **Dot color:** severity category (reuses `categoryColor` from shared utils)
- **Axes:** rendered with `d3-scale` (already installed) + SVG text labels
- **Quadrant hints:** top-right = "high churn + high complexity" danger zone, faintly labeled
- **Interaction:** click dot → `onSelectFile`
- **Selected state:** selected dot gets accent ring

### 3. Timeline (Stacked Area)

**File:** `Timeline.tsx`

Commits over time stacked by contributor.

- **Layout:** stacked area chart. X = time (weekly bins), Y = commit count, stacks = contributors
- **Contributor coloring:** top N contributors get individual colors from the shared author palette, remaining grouped as "Others" in a neutral color
- **Rendering:** `d3-scale` for axes, `d3-shape` area generators for stacks, SVG `<path>` elements
- **Hover:** tooltip with contributor name + commit count for that week
- **Interaction:** click a stack → `onSelectContributor`
- **Selected state:** selected contributor's stack gets brighter, others dim
- **New dependency:** `d3-shape`

### 4. Contributor Swimlanes

**File:** `ContributorSwimlanes.tsx`

Horizontal per-person timelines with three visual layers per lane.

**Three layers per lane:**
1. **Activity bars (background):** shaded blocks covering active periods (weeks with commits) vs. gaps
2. **Commit dots (middle):** individual dots positioned along the time axis. Normal dots use the contributor's color; red dots indicate commits touching hotspot files (cross-referenced with `hotspots.files`)
3. **Intensity heatstrip (bottom edge):** thin 8px strip of weekly bins, color intensity = commit volume for that week

**Layout:**
- One row per contributor, sorted by commit count descending
- Left column: contributor name + commit count
- Time axis shared across all lanes
- Scrollable if many contributors

**Ghost contributors:** cross-referenced with `ghostFiles` data. Ghost contributors get a dashed vertical cutoff line at their last active date with an "inactive" label.

**Interaction:**
- Click contributor name → `onSelectContributor`
- Click commit dot → `onSelectFile` (selects the most-changed file in that commit)
- Selected contributor's lane gets a subtle highlight border

**Color:** consistent with Ownership Bubble via shared author palette.

### 5. Coupling Graph (Adaptive)

**Files:** `CouplingGraph.tsx` (wrapper), `CouplingForceGraph.tsx`, `CouplingChord.tsx`

Switches visualization style based on data density.

**Threshold:** count unique files across `coupling.topPairs`. If ≤50 → force-directed graph. If >50 → chord diagram. Threshold is a named constant in `CouplingGraph.tsx`, easily tunable.

No manual toggle between the two modes (for now).

#### Force-Directed Graph (≤50 unique files)

**File:** `CouplingForceGraph.tsx`

- **Nodes:** files appearing in `coupling.topPairs`
- **Edges:** co-change pairs, thickness = coupling strength (co-change percentage)
- **Node size:** hotspot score
- **Node color:** severity category
- **Physics:** `d3-force` simulation with forceLink, forceManyBody, forceCenter
- **Interaction:** drag nodes to rearrange, scroll to zoom, click node → `onSelectFile`
- **New dependency:** `d3-force`

#### Chord Diagram (>50 unique files)

**File:** `CouplingChord.tsx`

- **Arcs:** directories (grouped from coupling file pairs)
- **Chords:** co-change volume between directories, width = coupling strength
- **Hover:** tooltip with directory pair + co-change count
- **Interaction:** click arc → selects files in that directory (filters via bottom panel)
- **New dependency:** `d3-chord`

### 6. Commit Graph (Multi-Mode)

**Files:** `CommitGraph.tsx` (wrapper), `CommitDAG.tsx`, `CommitBranches.tsx`, `CommitHeatmap.tsx`

Three sub-modes selectable via dropdown within the viz area.

**Default selection:** DAG for repos ≤500 commits, Heatmap for >500 commits. Branches always available as middle ground. Dropdown selector is internal to `CommitGraph.tsx` — not exposed to `useSelection`.

#### DAG

**File:** `CommitDAG.tsx`

- Simplified Sugiyama-style layout. Vertical timeline, nodes = commits, edges = parent links
- Colored by contributor (shared author palette)
- Limited to most recent 200 commits to avoid rendering thousands of nodes (configurable constant)
- Scrollable

#### Branches

**File:** `CommitBranches.tsx`

- Horizontal timeline with one lane per branch/contributor
- Dots for commits, connecting lines for merges
- Simpler than full DAG, focused on branch activity patterns

#### Heatmap

**File:** `CommitHeatmap.tsx`

- Grid: week × contributor, cell color = commit density
- Compact, scales to any repo size
- Similar to GitHub contribution graph but per-contributor rows

**Interaction (all sub-modes):** click a commit representation → `onSelectFile` (most-changed file in that commit).

---

## Cross-Linking Behavior

### Selection Model

All hero vizzes participate in the existing `useSelection` cross-linking:

- Hero viz click → `onSelectFile` or `onSelectContributor` → bottom panel highlights row → inspector updates
- Bottom panel row click → sets `selectedFile` → active hero viz highlights that node/dot/bubble
- Each viz handles its own highlight rendering based on `selectedFile` / `selectedContributor` props

### Hero ↔ Sidebar Independence

The sidebar controls the bottom panel tab set. The hero viz is independently controlled by its own toolbar. These are **not locked together** — you can view the Ownership Bubble while the bottom panel shows Coupling data. They are complementary lenses.

### Contributor-Centric Vizzes

Swimlanes and Timeline receive `selectedContributor` as a prop. When a contributor is selected (from any panel), these vizzes highlight that person's lane/stack.

---

## Shared Utilities

### `apps/web/src/utils/colors.ts`

New shared module for color logic used across multiple vizzes.

**Exports:**
- `authorColor(email: string): string` — deterministic hash of email → HSL color. Stable across reloads, visually distinct for up to ~12 authors, gracefully degrades beyond that.
- `categoryColor(category: string, opacity: number): string` — moved from ChurnTreemap. Returns severity-based RGBA color.

ChurnTreemap's inline `categoryColor` function migrates to this shared module.

---

## New Dependencies

| Package | Used By | Purpose |
|---------|---------|---------|
| `d3-force` | CouplingForceGraph | Force simulation for node layout |
| `d3-shape` | Timeline | Area generators for stacked chart |
| `d3-chord` | CouplingChord | Chord diagram layout |

All are `d3` sub-packages, consistent with existing `d3-hierarchy` and `d3-scale` usage.

---

## File Inventory

**New files (12):**

```
apps/web/src/components/hero/OwnershipBubble.tsx
apps/web/src/components/hero/HotspotScatter.tsx
apps/web/src/components/hero/Timeline.tsx
apps/web/src/components/hero/ContributorSwimlanes.tsx
apps/web/src/components/hero/CouplingGraph.tsx
apps/web/src/components/hero/CouplingForceGraph.tsx
apps/web/src/components/hero/CouplingChord.tsx
apps/web/src/components/hero/CommitGraph.tsx
apps/web/src/components/hero/CommitDAG.tsx
apps/web/src/components/hero/CommitBranches.tsx
apps/web/src/components/hero/CommitHeatmap.tsx
apps/web/src/utils/colors.ts
```

**Modified files (3):**

```
apps/web/src/hooks/useSelection.ts  — add HeroViz type + state
apps/web/src/components/layout/Shell.tsx — data-driven toolbar + viz switch
apps/web/src/components/hero/ChurnTreemap.tsx — import categoryColor from shared utils
```

---

## Build Order

Bottom-up, easiest first:

1. Shared utils (`colors.ts`) + `useSelection` + Shell toolbar refactor
2. Ownership Bubble (low — reuses pack layout from d3-hierarchy)
3. Hotspot Scatter (low — standard scatter, d3-scale already available)
4. Timeline (medium — needs d3-shape, stacked area layout)
5. Contributor Swimlanes (medium — three-layer custom layout, ghost cross-referencing)
6. Coupling Graph (high — two modes, d3-force + d3-chord, threshold logic)
7. Commit Graph (high — three sub-modes, DAG layout, dropdown)

Each step produces a working, independently testable viz.

---

## What's NOT In This Spec

- AI features (Narrative, Refactor Brief) — separate design pass
- Composite sidebar views (Risk Dashboard, Tech Debt Workbench, Repo Health) — stretch goal, separate spec if pursued
- Alternative themes — deferred
- Mobile/responsive — desktop-only by design
- Manual coupling mode toggle — auto-threshold only for now
