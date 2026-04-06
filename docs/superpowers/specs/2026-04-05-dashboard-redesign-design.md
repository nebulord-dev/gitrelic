# GitLore Web Dashboard Redesign — Design Spec

> Supersedes the original dashboard design spec. This document defines the IDE-style mission control layout, theming system, information architecture, and interaction model for the GitLore web dashboard.

---

## Design Philosophy

**IDE-style mission control for git archaeology.** Dense, cross-linked, and always-on — every panel is a lens on the same data. The layout draws from developer tools (VS Code, Dataform, Figma) rather than traditional SaaS dashboards. Information density is a feature, not a bug.

**Key principles:**

- **Dense by default** — show as much as possible without requiring navigation
- **Cross-linked, not siloed** — clicking anything updates all panels contextually
- **Progressive depth** — compressed widgets → expandable rows → full inspector
- **Themeable from day one** — CSS token system, not hardcoded colors
- **Desktop-first** — optimized for real monitors, passable on tablets, no mobile

---

## Target Audience

Developers on a team, collectively understanding their codebase's health and individual impact. Optimized for actionable insight over managerial reporting.

---

## Layout Architecture

Four-panel IDE-style layout with a metrics strip:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Top Bar: GITLORE logo │ repo name │ branch │ meta │ ? │ ⚙ │ 🌓  │
├────────┬───────────────────────────────────────────────┬────────────┤
│        │  Metrics Strip (always visible)               │            │
│        │  [Cursed] [Hotspots] [Bus Factor] [Health]... │            │
│        ├───────────────────────────────────────────────┤            │
│  Left  │                                               │   Right    │
│  Side  │  Hero Visualization (switchable)              │  Inspector │
│  bar   │  ┌─────────────────────────────────────────┐  │  Panel     │
│        │  │ Treemap │ Ownership │ Coupling │ Graph  │  │            │
│  Nav   │  │                                         │  │  [File]    │
│        │  │         (large interactive viz)          │  │  [People]  │
│        │  │                                         │  │  [Activity]│
│        │  └─────────────────────────────────────────┘  │            │
│        ├───────────────────────────────────────────────┤            │
│        │  Bottom Panel (tabbed data tables, resizable) │            │
│        │  [Hotspots│Cursed│BusFactor│Blast│Velocity..] │            │
│        │  ┌─────────────────────────────────────────┐  │            │
│        │  │ expandable rows with inline detail      │  │            │
│        │  └─────────────────────────────────────────┘  │            │
├────────┴───────────────────────────────────────────────┴────────────┤
│  (Methodology drawer slides from right when ? is clicked)          │
└─────────────────────────────────────────────────────────────────────┘
```

![alt text](redesign-mock.png)

### Panel Descriptions

#### Top Bar
- GITLORE wordmark (left)
- Repository name, branch, commit count, author count, age
- Right side: Export button, Settings, `?` methodology button, theme toggle (🌓)
- Persistent across all views

#### Left Sidebar (~200px)
Navigation grouped by concern. The sidebar drives a **category-based tab filtering model**: clicking a group header or individual nav item controls which tabs appear in the bottom panel. Clicking an individual item (e.g., "Dead Code") switches to its parent group AND pre-selects that specific tab.

**Groups and their bottom panel tab sets:**

- **Overview**: Dashboard (home), Health Score (T3)
  - Bottom tabs: Hotspots, Cursed Files, Bus Factor, Churn Velocity, Ghost Files (the "greatest hits" — actionable signals a team developer wants at a glance)
- **Code Health**: Hotspots, Cursed Files, Dead Code, Complexity, Rewrites
  - Bottom tabs: Hotspots, Cursed Files, Dead Code, Complexity Trend, Rewrite Ratio, Churn Velocity, Blast Radius
- **Ownership & Risk**: Bus Factor, Coupling, Ghost Files, Knowledge Silos
  - Bottom tabs: Bus Factor, Coupling, Ghost Files, Knowledge Silos
- **Team & Activity**: Contributors, Co-Authors, Timing, Parallel Dev, Shame
  - Bottom tabs: Contributors, Co-Authors, Commit Timing, Parallel Dev, Shame
- **Structure**: Age Map, Languages, Test Coverage, Renames
  - Bottom tabs: Age Map, Languages, Test Coverage, Renames

Nav items show count badges for actionable items (e.g., Hotspots: 12, Cursed: 3, Bus Factor: 6). Items for T2+ features that are not yet implemented show as disabled/grayed until their tab component exists.

#### Metrics Strip (always visible, below top bar)
The "should I be worried?" bar. Never changes when navigating.

| Metric | Source | Color Logic |
|--------|--------|-------------|
| Cursed Files | cursedFiles.length | Red if > 0 |
| Critical Hotspots | hotspots count where severity = critical | Red/amber/green by count |
| Bus Factor Risks | busFactors.criticalFiles.length | Amber if > 0 |
| Contributors | contributors.length | Neutral |
| Health Score | Composite (derived) | Green/amber/red by value |
| Repo Age | First commit date | Neutral |
| Lines of Code | loc.totalLines | Neutral |

#### Hero Visualization (center, switchable)
Large interactive visualization area. A toolbar at the top lets users switch between viz modes. Only one is shown at a time.

| Viz | Description | Tier |
|-----|-------------|------|
| Churn Treemap | Directory tree sized by LOC, colored by hotspot severity | T1 |
| Ownership Map | Treemap colored by dominant author (Tornhill-style) | T3 |
| Coupling Graph | Force-directed temporal co-change graph | T3 |
| Commit Graph | DAG with hotspot coloring | T3 |
| Hotspot Scatter | Churn × complexity scatter plot | T3 |
| Timeline | Commits over time stacked by contributor | T3 |
| Contributor Swimlanes | Horizontal per-person timelines | T3 |

Clicking a node/cell in the hero viz selects that file → bottom panel highlights row → inspector updates.

#### Bottom Panel (tabbed, resizable)
IDE "terminal" zone. Each tab is a ranked list or data table for one analysis dimension. The panel is resizable vertically (drag the top edge).

**Tabs organized by sidebar groups:**

Code Health tabs:
| Tab | Data Source | Tier |
|-----|-------------|------|
| Hotspots | hotspots.topHotspots | T1 |
| Cursed Files | cursedFiles | T1 |
| Dead Code | deadCode.candidates | T2 |
| Complexity Trend | complexityTrend.growingFiles | T2 |
| Rewrite Ratio | rewriteRatio.topRewriters | T2 |
| Churn Velocity | churnVelocity.acceleratingFiles | T2 |
| Blast Radius | blastRadius.topBlasters | T2 |

Ownership & Risk tabs:
| Tab | Data Source | Tier |
|-----|-------------|------|
| Bus Factor | busFactors.criticalFiles | T1 |
| Ghost Files | ghostFiles.files | T2 |
| Knowledge Silos | knowledgeConcentration | T2 |
| Coupling | coupling.topPairs | T1 |

Team & Activity tabs:
| Tab | Data Source | Tier |
|-----|-------------|------|
| Contributors | contributors.contributors | T1 |
| Co-Authors | coAuthors.pairs | T2 |
| Commit Timing | commitTiming.stressFiles | T2 |
| Parallel Dev | parallelDev.hotFiles | T1 |
| Shame | forensics.topShameFiles | T1 |

Structure tabs:
| Tab | Data Source | Tier |
|-----|-------------|------|
| Age Map | ageMap.files | T1 |
| Languages | loc.languages | T2 |
| Test Coverage | testCoverage.directories | T2 |
| Renames | renameTracking.chains | T2 |

#### Right Inspector Panel (~260px)
Context-sensitive detail panel. Shows full information about the currently selected file or contributor. Has its own tab set.

| Tab | Content | Tier |
|-----|---------|------|
| Inspector | All signals for selected file: hotspot score, churn, LOC, bus factor, blast radius, coupling partners, curse score, rewrite ratio, shame score, age, rename history | T1 |
| Contributors | For file: who contributes, ownership %, commits. For person: their files, focus areas, timing | T1 |
| Activity | Recent commits for selected entity, shame keywords highlighted, mini timeline | T2 |
| AI Narrative | "What happened here?" Claude-generated per-file explanation (KAN-55), per-contributor story (KAN-59) | T3 |
| Refactor Brief | AI refactoring suggestions for cursed/hotspot files (KAN-56) | T3 |

#### Methodology Drawer
A global slide-out panel triggered by the `?` button in the top bar. Slides from the right edge, overlaying the inspector panel (inspector state is preserved underneath and restored when the drawer closes).

- Contains explanations for every metric, score, and concept in GitLore
- Has its own internal navigation / table of contents
- Auto-scrolls to the relevant section based on what the user is currently viewing
- Always accessible from the same location — one place for "what does this mean?"
- KAN-79

---

## Interaction Model

### Cross-Linked Selection

Everything is bidirectional. Any panel can drive selection:

- **Hero viz click** (treemap cell, graph node) → selects file → bottom panel highlights row → inspector shows file detail
- **Bottom panel row click** → selects file → inspector updates → hero viz highlights that file
- **Inspector contributor click** → switches to contributor-focused view across all panels
- **Sidebar click** → changes hero viz mode + auto-selects relevant bottom tab

### Expandable Bottom Panel Rows

Bottom panel table rows support **inline expansion** (click to expand):

```
┌────────────────────────────────────────────────────────────────────┐
│ ▸ App.tsx  [critical] [coupling hub] [3 authors]  Score: 100  ... │
├────────────────────────────────────────────────────────────────────┤
│ ▾ App.tsx  [critical] [coupling hub] [3 authors]  Score: 100  ... │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐    │
│  │ OWNERSHIP    │ COUPLED WITH │ SHAME (7)    │ ACTIVITY     │    │
│  │ 2 authors    │ 100% index.. │ "fix(cli):.. │ 14 commits   │    │
│  │ dominant:    │  30% index.. │ fix          │ 602 lines    │    │
│  │ Trace (64%)  │              │              │ score: 100   │    │
│  └──────────────┴──────────────┴──────────────┴──────────────┘    │
└────────────────────────────────────────────────────────────────────┘
```

- **Click row** → expands inline with ownership, coupling, shame, activity summary
- **Double-click or arrow icon** → selects file and loads full detail into right inspector
- Expanded row shows a 4-column grid: Ownership, Coupled With, Shame, Activity
- Only one row expanded at a time (accordion behavior)

### Signal Badges on Rows

Each bottom panel row shows inline signal badges explaining why a file is flagged:

| Badge | Color | Examples |
|-------|-------|----------|
| Severity | Red/Amber | "critical", "warning" |
| Ownership | Purple | "3 authors", "single owner" |
| Coupling | Blue | "coupling hub", "24 clusters" |
| Temporal | Teal | "accelerating", "stale" |
| Process | Amber | "parallel dev", "fix churn" |

### Tooltips & Hover States

Anything truncated or compressed gets a tooltip with the full story:

- **File cells** — full path, hotspot score, dominant author, last modified
- **Author avatars/names** — all contributors with ownership percentages
- **Severity badges** — threshold explanation ("Critical: score > 80")
- **Metrics strip numbers** — breakdown (hovering "12 Hotspots" → "4 critical, 5 warning, 3 moderate")
- **Coupling bars** — file pair, co-commit count, strength percentage
- **Score bars** — exact numeric value and percentile

### Sortable Tables

All bottom panel tables are sortable by clicking column headers. Default sort order per tab:
- Hotspots: by score descending
- Bus Factor: by ownership concentration descending
- Age Map: by age descending
- Contributors: by commit count descending

---

## Theming System

### Token Architecture

All visual values go through CSS custom properties organized into semantic layers. Swapping a theme = swapping a set of variable values.

```css
/* Layer 1: Surface */
--surface-primary     /* main background */
--surface-secondary   /* cards, panels */
--surface-tertiary    /* hover states, subtle emphasis */
--surface-elevated    /* overlays, drawers, tooltips */

/* Layer 2: Borders */
--border-primary      /* default borders */
--border-secondary    /* emphasized borders */
--border-focus        /* focus rings */

/* Layer 3: Text */
--text-primary        /* main body text */
--text-secondary      /* supporting text */
--text-tertiary       /* labels, muted text */
--text-inverse        /* text on colored backgrounds */

/* Layer 4: Severity / Semantic */
--severity-critical        /* red — critical risk */
--severity-critical-bg
--severity-critical-text
--severity-warning         /* amber — warnings */
--severity-warning-bg
--severity-warning-text
--severity-moderate        /* blue — moderate */
--severity-moderate-bg
--severity-moderate-text
--severity-healthy         /* green — healthy/fresh */
--severity-healthy-bg
--severity-healthy-text

/* Layer 5: Accent / Domain */
--accent-ownership         /* purple — contributor/ownership signals */
--accent-ownership-bg
--accent-coupling          /* blue — structural relationships */
--accent-coupling-bg
--accent-temporal          /* teal — time-based signals */
--accent-temporal-bg
--accent-primary           /* brand accent for active states, links */

/* Layer 6: Component-specific */
--panel-resize-handle
--nav-item-active-bg
--nav-badge-bg
--tooltip-bg
--tooltip-text
```

### Default Dark Theme

Ship with a clean blue-black base. Professional, readable, not trying too hard.

- Surface: `#0d1117` → `#161b22` → `#21262d` (GitHub-adjacent blue-blacks)
- Borders: `rgba(255,255,255,0.06)` → `rgba(255,255,255,0.12)`
- Text: `#e6edf3` → `#8b949e` → `#484f58`
- Severity: standard red/amber/blue/green with muted backgrounds

### Default Light Theme

Designed from the same token set. Clean, warm, readable.

- Surface: `#ffffff` → `#f6f8fa` → `#eef1f5`
- Borders: `#d0d7de` → `#afb8c1`
- Text: `#1f2328` → `#656d76` → `#8b949e`
- Severity: same hues, adjusted for light backgrounds

### Extensibility

The token system is designed so alternative themes (Gruvbox, green-on-black, etc.) are just new sets of variable values. A theme file is a single CSS file or JSON object that maps token names to values. No component changes required.

---

## Sidebar Navigation Detail

### Nav Groups and Items

```
OVERVIEW
  ◎ Dashboard              (home view)
  ⚡ Health Score           (T3 — KAN-75)

CODE HEALTH
  🔥 Hotspots              [12]
  ☠ Cursed Files           [3]
  💀 Dead Code             (T2)
  📈 Complexity            (T2)
  🔄 Rewrites              (T2)

OWNERSHIP & RISK
  ⚠ Bus Factor             [6]
  👻 Ghost Files            (T2)
  🧠 Knowledge Silos       (T2)
  🔗 Coupling              (T1)

TEAM & ACTIVITY
  👥 Contributors           (T1)
  🤝 Co-Authors            (T2)
  ⏰ Timing                (T2)
  ⚡ Parallel Dev           (T1)
  😬 Shame                 (T1)

STRUCTURE
  ⏳ Age Map               (T1)
  📊 Languages             (T2)
  🧪 Test Coverage         (T2)
  📎 Renames               (T2)
```

Badges appear on nav items with actionable counts (items that need attention). Items without data or not yet implemented show as disabled/grayed.

### Planned Composite Views (Tier 3)

These are sidebar items that combine multiple data sources into purpose-built views:

- **Risk Dashboard** (KAN-75): Bus factor + ghost files + knowledge silos as a unified risk view
- **Tech Debt Workbench** (KAN-76): Cursed files + hotspots + complexity trends as an actionable work queue
- **Repo Health** (KAN-77): git-sizer metrics + age map + test coverage with green/amber/red indicators

---

## Responsive Strategy

### Desktop (1440px+)
Full four-panel layout as designed. All panels visible simultaneously.

### Laptop (1280px–1440px)
- Right inspector panel collapses to a narrower width (~220px)
- Bottom panel default height slightly reduced
- All panels still visible

### Small Laptop (1024px–1280px)
- Right inspector becomes a slide-over panel (hidden by default, slides in on file selection)
- Left sidebar collapses to icon-only mode (expandable on hover)
- Hero viz and bottom panel get full width

### Tablet (768px–1024px)
- Left sidebar becomes a hamburger menu drawer
- Right inspector becomes a full-screen modal on file selection
- Bottom panel tabs become scrollable
- Hero viz gets full width
- Metrics strip wraps to 2 rows

### Below 768px
Not supported. Show a message suggesting desktop use.

---

## Build Tiers

### Tier 1 — Ship First
Core layout shell + all currently-displayed data sources relocated to the new architecture.

- Four-panel layout skeleton (sidebar, hero, bottom, inspector)
- Metrics strip with 7 metrics
- Churn treemap as default hero viz
- Bottom panel with tabs: Hotspots, Cursed Files, Bus Factor, Coupling, Contributors, Parallel Dev, Shame, Age Map
- Expandable rows in bottom panel
- Right inspector with File and Contributors tabs
- Signal badges on rows
- Cross-linked selection model
- Theme token system + dark theme default
- Sortable tables
- Tooltips on truncated content
- Top bar with repo info and theme toggle

### Tier 2 — Existing Data, Needs Viz
Data already exists in GitloreReport but has no web visualization yet.

- **Sidebar-driven tab filtering**: Restructure sidebar → bottom panel relationship so clicking a sidebar group controls which tabs are visible in the bottom panel. Add `activeGroup` to `useSelection` hook. Dashboard "greatest hits" default: Hotspots, Cursed Files, Bus Factor, Churn Velocity, Ghost Files.
- **Sidebar expansion**: Add new nav items for T2 data sources (Dead Code, Complexity, Rewrites under Code Health; Ghost Files, Knowledge under Ownership & Risk; Co-Authors, Timing under Team & Activity; Languages, Test Coverage, Renames under Structure)
- **12 new bottom panel tabs**: Dead Code, Complexity Trend, Rewrite Ratio, Churn Velocity, Blast Radius, Ghost Files, Knowledge Silos, Co-Authors, Commit Timing, Languages, Test Coverage, Renames
- **Resize divider**: Draggable vertical resize handle on the bottom panel top edge
- Inspector Activity tab
- Light theme
- Methodology drawer (KAN-79)
- Responsive breakpoints (laptop, tablet)

### Tier 3 — Planned Features
Requires new analyzers, AI integration, or complex visualizations.

- Hero vizzes: Ownership Map, Coupling Graph, Commit Graph, Hotspot Scatter, Timeline, Contributor Swimlanes
- Inspector AI tabs: Narrative (KAN-55), Refactor Brief (KAN-56)
- Sidebar composite views: Risk Dashboard (KAN-75), Tech Debt Workbench (KAN-76), Repo Health (KAN-77)
- Health Score composite metric
- File drill-down full history view (KAN-74)
- Alternative themes (Gruvbox, etc.)
- AI codebase summary narrative (KAN-54)

---

## What NOT to Do

- No tab bar as primary navigation — sidebar handles routing
- No separate full-page views per analyzer — everything lives in the panel layout
- No gradients, drop shadows, or glow effects
- No emojis in the rendered UI (icons from a consistent icon set instead)
- No heavy card containers with borders AND shadows — let data breathe
- No mobile-first design — this is a desktop developer tool
- No hardcoded colors — everything through theme tokens
- No tooltip libraries with heavy dependencies — native CSS/lightweight custom tooltips

---

## Jira Ticket Mapping

| Feature | Jira | Tier |
|---------|------|------|
| Dashboard redesign (this spec) | KAN-145 | — |
| Commit graph visualization | KAN-67 | T3 |
| Hotspot scatter plot | KAN-68 | T3 |
| Knowledge map (ownership treemap) | KAN-69 | T3 |
| Directory treemap (churn/curse) | KAN-70 | T1 |
| Coupling graph (force-directed) | KAN-71 | T3 |
| Contributor timeline swimlanes | KAN-72 | T3 |
| Timeline chart (commits over time) | KAN-73 | T3 |
| File drill-down | KAN-74 | T3 |
| Risk & learning curve dashboard | KAN-75 | T3 |
| Technical debt workbench | KAN-76 | T3 |
| Repo health tab | KAN-77 | T3 |
| Language breakdown panel | KAN-78 | T2 |
| Methodology slideout drawer | KAN-79 | T2 |
| Light theme | KAN-124 | T2 |
| AI codebase narrative | KAN-54 | T3 |
| AI per-file narrative | KAN-55 | T3 |
| AI refactor brief | KAN-56 | T3 |
| AI team narrative | KAN-59 | T3 |
