# Dashboard Design: Analyzer Presets

**Status:** Design validated 2026-04-22 via `superpowers:brainstorming`. Ready for implementation planning (`superpowers:writing-plans` is the next step).

**Date:** 2026-04-19 (initial), 2026-04-22 (validation pass — Resolved Decisions, Registry Contract, Stream Decomposition added).

**Jira:** KAN-6 (epic). Related tickets: KAN-170 (fullscreen charts / collapsible sidebars), KAN-175 ("what is this graph?" helper), KAN-172 (tab → guide panel sync), KAN-169 (scrollable bottom tables). New child tickets for the three streams below will be created against KAN-6.

## Context

GitRelic's dashboard has five content regions driven by a left sidebar:

- **Metric strip** (top, 5 numeric summaries)
- **Hero chart** (main visualization, with its own alt-tab row: Treemap / Ownership / Coupling / Graph / Scatter / Timeline / Swimlanes)
- **Bottom table** (with its own tab row: Hotspots / Cursed Files / Bus Factor / …)
- **Inspector panel** (right, with Inspector / Contributors / Activity tabs)
- **Guide panel** (right-bottom, with Guide / Narrative / Refactor tabs; last two unimplemented)

Two tiers of user testing (two colleagues so far) love the data and have lots of ideas, but no comments on interaction — which could mean "fine" or "haven't used it deeply enough yet."

## Resolved Decisions (2026-04-22)

Validation pass resolved the load-bearing architectural choices. Recorded here up front so downstream sections stay consistent.

| Decision | Choice | Why |
|---|---|---|
| State architecture | **Registry-driven**. `PRESETS: Record<PresetId, PresetDefinition>` in a new `apps/web/src/presets/` module. `useSelection` exposes a single `applyPreset(id)` + two override setters. Tier 1 and Tier 2 presets use the same shape. | Spec's "same behavior, different composition" principle becomes literally true in the code. Adding an analyzer = adding a data row. Tier 3 later is free. See Registry Contract section. |
| Panel override persistence | **Reset on every sidebar click.** No per-preset memory, no localStorage. Overrides (hero alt-tab, bottom tab) are session-scoped and clear whenever `applyPreset` runs. | Matches the snap-to-defaults mental model exactly; avoids invisible state. Easy to upgrade to per-preset stickiness later if users ask. Resolves Open Q #3. |
| Metric strip length | **Variable 1–5 cells.** Registry declares whatever metrics make sense; strip stretches/shrinks. No padding, no filler. | Honest restraint over maximalism; three sharp metrics beat five with filler. Keeps the registry shape simple (`metrics: Metric[]`). Resolves Open Q #1. |
| Validation analyzer set for Stream 2 | **Hotspots, Bus Factor, Coupling, Contributors.** One analyzer per sidebar group, all using heroes that already exist. Exercises pair-based metrics (Coupling) and contributor-keyed selection (Contributors) to validate the data contract. | Proves the framework end-to-end without pulling new-hero work into the framework PR. Stream 3 handles the 18 remaining analyzers plus the new heroes (Co-Authors / Shame / Renames). |
| Stream decomposition | **Three streams that can land independently:** Focus Mode → Preset framework + 4 analyzers → Full rollout. | Mirrors the user's decomposition. Focus Mode has no content-state dependency; Preset framework is the refactor; rollout is N small PRs atop the framework. See Stream Decomposition section. |

## The Observation

The sidebar has **two tiers of items with different interaction weights**, not currently distinguished:

| Tier | Items | Current behavior | Intended behavior |
|---|---|---|---|
| 1 — Dashboard presets | Overview / Risk / Tech Debt | Reshapes metric strip + hero + hero alt-tabs + bottom table tabs (all 4 content panels) | ✓ Already correct |
| 2 — Analyzer links | Hotspots, Cursed Files, Bus Factor, Coupling, …(22 analyzers) | Changes the bottom-table tab only. Some don't even do that if the tab is already in the open table | Should reshape all 4 content panels, scoped to one analyzer |

The architecture for "snap-to-defaults across multiple panels" **already exists** — Dashboard → Risk / Tech Debt prove it. The chart's alt-tab row is already per-preset (Heatmap/Sunburst for Risk; Timeline/Scatter for Tech Debt), not a global control. This resolves an earlier concern about "don't rip the user's chart out from under them": the chart tabs belong to the current preset, not to the user's long-lived layout state.

The gap is that the 22 analyzer links are a weaker, inconsistent pattern on top of the same sidebar.

## Proposed Direction

### Core Pattern: Snap-to-Defaults + Sticky Overrides

- **Sidebar click = explicit navigation** → reset all content panels to the target preset's defaults
- **In-panel controls (chart alt-tabs, table tabs)** → per-panel override, sticks until the next sidebar click
- **Layout state (collapsed / fullscreen panels)** → orthogonal to content; preserved across navigation

This is what the Dataform reference the user shared does: clicking a file in the tree snaps the editor, outline, and schema panels to that file's context; users can still override any single panel without losing the overall context.

### Two-Tier Preset Model

- **Tier 1 — Curated presets** (Dashboard group: Overview / Risk / Tech Debt). Stitch together multiple analyzers into a themed "executive" view.
- **Tier 2 — Single-analyzer presets** (every analyzer link). Reshape to deep-dive a single analyzer. Same panel-reshape mechanics, narrower scope.

Both tiers use the same preset-definition shape. The difference is how they're composed and labeled, not how they behave.

### Future tier (don't design against it)

- **Tier 3 — Group presets.** Clicking a section header (Code Health / Ownership & Risk / Team & Activity / Structure) shows a preset that combines the highest-signal finding from each analyzer in that group. Natural extension; build later.

## Analyzer Preset Sketch

First-pass mapping. Many are obvious; a handful are TBD and need design work.

| Analyzer | Hero (default) | Hero alt-tabs | Table (default → alt) | Metric strip (rough) |
|---|---|---|---|---|
| Hotspots | HotspotScatter | ChurnTreemap, RiskHeatmap | Hotspots → Hotspot Clustering | Top hotspot score, hotspot count, avg LOC, total churn |
| Cursed Files | RiskHeatmap | DebtScatter, ChurnTreemap | Cursed Files | Cursed count, avg curse score, worst file, authors involved |
| Stale Files | Timeline (age axis) | ChurnTreemap colored by age | Stale Files → Age Map | Stale count, oldest file age, median age, stale LOC |
| Complexity | ComplexityTrend timeline | Growth timeline | Complexity Trend | Growing files, shrinking files, biggest growth, debt LOC |
| Rewrites | DebtScatter (rewrite ratio × churn) | Timeline | Rewrite Ratio | High rewrite count, avg ratio, top rewrite file |
| Bus Factor | RiskHeatmap (bus-factor column) | OwnershipBubble | Bus Factor → Knowledge Silos | Critical bus factor, at-risk files, solo-owned %, active owners |
| Coupling | CouplingForceGraph | CouplingHeatmap | Coupling | Top coupled pair strength, coupling hub file, pair count |
| Ghost Files | OwnershipSunburst filtered to ghosts | ChurnTreemap colored by ghost-score | Ghost Files | Ghost file count, ghost authors, ghost LOC |
| Knowledge Silos | OwnershipBubble | OwnershipSunburst | Knowledge Silos | Solo-owned count, concentration %, silo authors |
| Contributors | OwnershipBubble | ContributorSwimlanes, OwnershipSunburst | Contributors | Active contributors, top contributor share, ghost count |
| Co-Authors | Author force graph (nodes = contributors, edges = co-auth strength) | Chord diagram, Author matrix heatmap | Co-Authors | Pair count, strongest pair, avg co-authors per file |
| Timing | CommitHeatmap (calendar) | ContributorSwimlanes | Commit Timing | Late-night %, weekend %, peak hour, stress index |
| Parallel Dev | ContributorSwimlanes | Timeline | Parallel Dev | Parallel weeks, peak overlap, files in overlap |
| Shame | Shame leaderboard (horizontal bar by author) | Author scatter (commits × shame), Timeline of shame events | Shame | Shame score total, top commit, top author |
| Age Map | ChurnTreemap colored by age | Timeline | Age Map | Oldest file, median age, stale %, fresh count |
| Languages | ChurnTreemap colored by language | Sunburst | Languages | Language count, dominant language, LOC per language |
| Test Coverage | ChurnTreemap colored by proximity | — | Test Coverage | Coverage %, uncovered files, avg proximity |
| Renames | Sankey diagram (rename flows, source → destination) | Directory migration heatmap, Chain small-multiple | Renames | Chain count, longest chain, rename freq |

## Hero Decisions (rationale)

First-pass mapping deliberately resolved the three ambiguous analyzers. Captured here so the reasoning survives refactors.

### Co-Authors — Author force graph

**Considered:** author force graph, chord diagram, author-pair matrix heatmap.

**Chose:** force graph as default; chord diagram and author matrix as alt-tabs.

**Why:** users already understand force graphs from `CouplingForceGraph`. Moving from "which files co-change" to "which people co-author" is a natural leap using the same visual language. Chord diagrams make a nice presentation alternative for small teams but feel less at home as a default. The matrix is precise but low-energy for a hero slot.

**Risk:** force layouts get busy past ~30 contributors. Mitigate with a min-pair-strength filter (default: drop pairs with <3 shared commits).

### Shame — Contributor leaderboard

**Considered:** shame leaderboard, author scatter (commits × shame), shame timeline, ChurnTreemap colored by shame.

**Chose:** horizontal-bar leaderboard as default; scatter and timeline as alt-tabs.

**Why:** Shame lives under **Team & Activity** in the sidebar, so the center of gravity is people, not files. The treemap was rejected because it makes shame a file attribute, which contradicts where the analyzer is grouped. The scatter ("prolific *and* shameful" vs "occasional offender") is a useful drill-down as an alt-tab. The timeline catches team-level trend shifts.

### Renames — Sankey diagram

**Considered:** sankey, directory migration heatmap, chain small-multiple, timeline.

**Chose:** sankey as default; directory heatmap and chain small-multiple as alt-tabs.

**Why:** the data is inherently flow-shaped (file name → file name → file name through time). Sankey reads naturally as motion through the codebase. Directory heatmap answers the "we reorganized X into Y" question at a different zoom. Chain small-multiples stay honest to individual chains when you want detail.

**Dependency:** adds `d3-sankey` to `@gitrelic/web`. Accepted — not restricting views to a single library. Matches the project's philosophy of using the right visualization per analyzer rather than reusing a generic chart.

## Registry Contract

The `PresetDefinition` type is the framework's load-bearing interface. Every Tier 1 and Tier 2 preset fills one out. Lives in a new `apps/web/src/presets/` module.

```typescript
// apps/web/src/presets/types.ts

type PresetTier = 'dashboard' | 'analyzer';

interface PresetDefinition {
  id: PresetId;                    // stable string key, url-safe
  tier: PresetTier;                // 'dashboard' for Overview/Risk/Tech-Debt, 'analyzer' for the 22
  label: string;                   // sidebar label
  group: SidebarGroupLabel;        // which sidebar section it lives under

  hero: {
    defaultViz: HeroViz;
    altTabs: HeroViz[];            // includes defaultViz; drives the hero alt-tab row
  };
  bottomPanel: {
    defaultTab: BottomTab;
    altTabs: BottomTab[];          // includes defaultTab; drives the bottom tab row
  };
  metrics: (report: GitrelicReport) => Metric[];  // 1-5 entries, variable length
}
```

**Deferred to planning:** the exact definition strategy for the referenced string-literal types (`PresetId`, `HeroViz`, `BottomTab`, `SidebarGroupLabel`, `Metric`). Options include hand-maintained string-literal unions, `keyof typeof PRESETS` for `PresetId`, or type-inference tricks. The plan should pick and commit one approach for type safety consistency.

```typescript
// apps/web/src/presets/registry.ts
export const PRESETS: Record<PresetId, PresetDefinition> = {
  overview:    { /* migrated from handleSetDashboardMode */ },
  risk:        { /* migrated */ },
  'tech-debt': { /* migrated */ },

  hotspots: {
    id: 'hotspots', tier: 'analyzer', label: 'Hotspots', group: 'code-health',
    hero: { defaultViz: 'scatter', altTabs: ['scatter', 'treemap', 'risk-heatmap'] },
    bottomPanel: { defaultTab: 'hotspots', altTabs: ['hotspots' /* + hotspot-clustering when built */] },
    metrics: getHotspotMetrics,
  },
  // ...
};
```

### `useSelection` refactor

State collapses to:

- `activePresetId: PresetId` (replaces `activeNavItem`, `activeGroup`, `dashboardMode`)
- `heroOverride: HeroViz | null` (reset on `applyPreset`)
- `bottomTabOverride: BottomTab | null` (reset on `applyPreset`)
- `selectedFile`, `selectedContributor`, `activeInspectorTab` (unchanged)

Derived, not stored:

- `activeHeroViz = heroOverride ?? PRESETS[activePresetId].hero.defaultViz`
- `activeBottomTab = bottomTabOverride ?? PRESETS[activePresetId].bottomPanel.defaultTab`
- `heroAltTabs = PRESETS[activePresetId].hero.altTabs`
- `bottomAltTabs = PRESETS[activePresetId].bottomPanel.altTabs`
- `metrics = PRESETS[activePresetId].metrics(report)`

Single public API surface:

- `applyPreset(id)` — sets `activePresetId`, clears both overrides
- `setHeroOverride(viz)` / `setBottomTabOverride(tab)` — wire the alt-tab row clicks

**Removed during the refactor:** `handleSetDashboardMode`, `navigateTo`, `setActiveHeroViz`, `setActiveBottomTab`, `GROUP_TABS`, `navToGroupTab`, the `DashboardMode` / `NavItem` / `SidebarGroup` types (the last lives on only as a literal string on `PresetDefinition.group`).

**Unchanged:** selection (`selectedFile`, `selectedContributor`) is orthogonal to mode state. `applyPreset` does NOT clear selection — users carry their focus file across preset switches.

### Testing contract

- **Registry unit:** for every `PresetId`, `PRESETS[id]` produces a definition whose `defaultViz ∈ altTabs` and `defaultTab ∈ altTabs` (self-consistency invariant).
- **Hook unit:** `applyPreset(id)` → `{ activeHeroViz, activeBottomTab, heroAltTabs, bottomAltTabs, metrics }` equal the registry values.
- **Hook unit:** overrides clear on `applyPreset`. Set hero override → apply new preset → override is null, derived hero is the new default.
- **Hook unit:** selection survives preset change.
- **Component:** Shell sidebar click invokes `applyPreset(id)` exactly once per click. Alt-tab click invokes `setHeroOverride` exactly once and not `applyPreset`.

## Stream Decomposition

Three independent streams. Each ships as its own PR set and can land without the others.

### Stream 1 — Focus Mode

Layout state orthogonal to content. No registry dependency.

**New state (local to `Shell.tsx`, not in `useSelection`):**
- `layoutMode: 'default' | 'focus-canvas' | 'fullscreen-hero' | 'fullscreen-table' | 'canvas-minimal'`
- Derived `PanelVisibility = { sidebar, bottomPanel, inspector }`

**New components:**
- `components/layout/LayoutControls.tsx` — top-right toggle icons + layout preset dropdown
- `components/layout/PanelMaximize.tsx` — small "max this panel" button each panel can render

**Modifications:** `Shell.tsx` reads `layoutMode`, conditionally renders panels, installs global keyboard handlers (`⌘.`, `⌘⇧.`, `⌘⇧,`, `Esc`). `TopBar.tsx` slots in `LayoutControls`.

**Tests:** correct panels render per mode; shortcuts hit the right toggles; panel-maximize sets correct mode; `Esc` returns to prior mode.

### Stream 2 — Preset framework + 4 analyzers

Ships the registry, refactors `useSelection`, migrates Tier 1, adds 4 Tier 2 presets (Hotspots, Bus Factor, Coupling, Contributors).

**New files:**
- `apps/web/src/presets/types.ts` — `PresetDefinition`, `PresetId`, `Metric` (moved from `MetricsStrip.tsx`)
- `apps/web/src/presets/registry.ts` — exports `PRESETS` with 3 Tier 1 + 4 Tier 2 entries
- `apps/web/src/presets/metrics/overview.ts`, `risk.ts`, `tech-debt.ts` — migrated from `MetricsStrip.tsx`
- `apps/web/src/presets/metrics/hotspots.ts`, `bus-factor.ts`, `coupling.ts`, `contributors.ts` — new
- `apps/web/src/presets/registry.test.ts` — contract tests

**Modified files:**
- `apps/web/src/hooks/useSelection.ts` — state collapse per Registry Contract above
- `apps/web/src/hooks/useSelection.test.ts` — new tests for `applyPreset` determinism + override reset
- `apps/web/src/components/layout/Sidebar.tsx` — every item (Dashboard sub-items + 22 analyzer links) calls `onApplyPreset(id)`; single code path
- `apps/web/src/components/layout/Shell.tsx` — consume derived values, pass `metrics` array to `MetricsStrip`, pass `altTabs` to `BottomPanel`
- `apps/web/src/components/layout/MetricsStrip.tsx` — takes `metrics: Metric[]`, renders 1–5 cells, metric composition lifted out
- `apps/web/src/components/layout/BottomPanel.tsx` — takes `altTabs: BottomTab[]` (replaces `activeGroup` + `GROUP_TABS`)

**Definition of done:** clicking any of the 7 registered presets in the sidebar reshapes all 4 content panels; in-panel overrides work and reset correctly on navigation; all existing Tier 1 behavior is preserved; selection survives preset changes; 29 web tests pass plus the new registry/hook/component tests.

### Stream 3 — Full preset rollout

18 remaining Tier 2 presets. Each PR adds one registry entry plus at most one new component. Suggested PR grouping:

- **Data-only batch (no new components):** Age Map, Languages, Test Coverage, Cursed Files, Stale Files, Complexity, Rewrites, Knowledge Silos, Parallel Dev, Commit Timing, Blast Radius. (Blast Radius is a late addition not in the original Analyzer Preset Sketch table above; when its PR lands the sketch table should be extended with a row for it.)
- **One new hero per PR:** Ghost Files (`OwnershipSunburst` `filter: 'ghosts'` prop), Co-Authors (new `AuthorForceGraph.tsx`), Shame (new `ShameLeaderboard.tsx`), Renames (new `RenameSankey.tsx` + adds `d3-sankey` + `@types/d3-sankey` to `apps/web/package.json`).
- **ChurnTreemap color-by variants** (not additional presets — an implementation-choice note about Age Map / Languages / Test Coverage / Shame entries in the data-only batch). Decide per analyzer whether to add a `colorBy` prop to `ChurnTreemap` or spawn variant components.

No single "done" for Stream 3 — it's a rolling set of small PRs.

## Visual Distinction Between Tiers

Tier 1 and Tier 2 behave the same but mean different things. Some options to communicate:

- **Icons** for the Dashboard presets (a small chart icon next to Overview / Risk / Tech Debt), nothing for Tier 2 analyzers
- **Section label treatment** — Dashboard is a dropdown/accordion; the rest are flat lists. Keep that distinction, maybe strengthen it
- **Color accent** — Tier 1 has a subtle left-border accent when active; Tier 2 uses a different accent
- **Nothing visual** — rely on position (Tier 1 at top in a distinct "OVERVIEW" section, everything below is Tier 2). Simplest; may be enough

Decision deferred until preset behavior is implemented and tested.

## Focus Mode (layout presets)

A complementary feature, not a conflict with content presets. Two orthogonal axes:

- **Content preset** — which analyzer you're looking at (Tier 1 or Tier 2 from above)
- **Layout preset** — which panels are visible

They multiply cleanly: "looking at Coupling, focused on just the hero + table" is a coherent, describable state.

### Layout presets (starting set)

| Preset | Visible | Hidden | Shortcut idea |
|---|---|---|---|
| **Default** | Everything | Nothing | `Esc` to return |
| **Focus canvas** | Hero + bottom table | Sidebar, inspector, guide | `⌘.` |
| **Fullscreen hero** | Just the hero chart | Everything else | `⌘⇧.` |
| **Fullscreen table** | Just the bottom table | Everything else | `⌘⇧,` |

Additionally, each panel gets a "maximize this panel" affordance (matching the three-icon pattern from the Dataform reference) that expands it fullscreen from wherever it lives.

### State preservation

- Entering Focus mode **preserves everything**: current content preset, selection, panel-level overrides
- Exiting returns to the prior state exactly
- Focus mode itself is **transient**, not persisted across page loads. It's a presentation state, not a preference
- Panel-level overrides (e.g. "I switched the hero to ChurnTreemap") are preserved across focus-mode toggles but reset on content-preset navigation (see Open Question #3)

### Implementation independence

Focus mode doesn't depend on preset work. Three discrete pieces:

1. Per-panel visibility state in `Shell.tsx` — a small `LayoutMode` enum or a set of booleans
2. Top-right toggle icons (sidebar / bottom panel / right panel) plus a fourth "maximize" affordance on each panel
3. Keyboard shortcuts wrapping the toggles

No D3 changes. No `GitrelicReport` shape changes. Could ship ahead of the preset pattern as a standalone usability win, and the preset work would slot in cleanly after.

### Related ticket

KAN-170 covers "Fullscreen charts and collapsible sidebars" — this section is the detailed design for that ticket.

### Fifth preset: "Canvas minimal"

Worth adding as a sibling to Fullscreen hero:

| Preset | Visible | Hidden |
|---|---|---|
| **Canvas minimal** | Metric strip + hero | Sidebar, bottom table, inspector, guide |

Identical to Fullscreen hero except the metric strip stays pinned. This matches the user's original minimalist design vision (see "Design Tension" below) — the app's default state is data-maximalist, but a single keystroke gets the user to a stats+hero-only view for presentation, screenshotting, or focused thinking.

## Design Tension: Maximalist vs Minimalist

GitRelic's current layout is **data-maximalist**: every panel populated, everything visible at once (sidebar, metric strip, hero, bottom table, inspector, guide). This maximizes discoverability and gives power users a cockpit.

The original design vision was the **polar opposite**: minimalist — just a metric strip at the top and a hero chart filling the rest, with all other data sliding in on demand. Reference: route-map-style layout with six typographic metric columns above a single dark canvas.

Both poles have merit:

| | Data-maximalist (current) | Minimalist (original vision) |
|---|---|---|
| Strength | Everything at your fingertips; great for exploration; mirrors dashboards like Sentry / DataDog / Grafana | Focus; beauty; presentation mode; lower cognitive load |
| Weakness | Busy; harder for a first-time viewer to parse | Slower to answer "is anything wrong?" without expanding panels |
| Best for | Analyst / investigator use | Executive review, screenshots, ambient "dashboard on a TV" use |

**Focus Mode is the bridge.** The data-maximalist layout is the default on app load; users who want the minimalist experience hit a single shortcut (`⌘.` → Focus canvas, or the new Canvas minimal preset) and get arbitrarily close to the original vision. The spec intentionally preserves both directions rather than picking one — neither was wrong; they're two modes of the same tool.

This also reframes a future design question: the metric strip treatment (see below) should match whichever layout it's MOST commonly seen in. That's likely the maximalist default, but the minimalist reference has a cleaner typographic approach worth learning from.

## Metric Strip Treatment

The reference image uses a **restrained typographic style**: six columns of text, each with a large label (city name), a small secondary label (state), and two lines of detail (miles, route). No cards, no colored number blocks, no borders.

GitRelic's current metric strip is louder — five cells with big colored numbers (critical red, warning amber, etc.) above small uppercase labels. It competes visually with the hero chart.

Worth a small design exploration: could the metric strip adopt the reference's more restrained treatment? The information is the same; the visual weight is the question. Colored numbers still make sense when they indicate severity, but the default treatment could be quieter so "red" actually means something.

This is a standalone polish task, independent of the preset pattern and Focus Mode. Probably small Jira ticket.

## Inspirations from Dataform Reference

The user's reference image (Dataform IDE layout) suggests three additional patterns worth considering **separately** from the core preset model:

1. **Top-right panel-toggle icons** (hide sidebar / hide bottom panel / hide right panel). Matches KAN-170 directly. Cheap to adopt verbatim.
2. **Accordion sections inside the inspector.** The inspector currently renders a flat list of metrics (Hotspot Score → Churn → LOC → …). Grouping into collapsible accordion sections (Code Health / Ownership & Risk / Structure) would compress vertical space and let users focus on the dimensions they care about per analyzer.
3. **Bottom panel as master-detail.** Dataform's Schemas tab has a list on the left and a detail pane on the right. Applied to GitRelic, clicking a row in the bottom table could expand inline detail (commit history, per-file breakdown). This is a natural home for **KAN-160 / KAN-74 (file drill-down)** that doesn't require a new page.

## Open Design Questions

Resolved in the 2026-04-22 validation pass (see Resolved Decisions at top):

- ~~**#1 Metric strip when preset has few metrics.**~~ Resolved: variable 1–5 cells, no padding.
- ~~**#3 Panel override persistence scope.**~~ Resolved: reset on every sidebar click.

Still open, but explicitly **deferred** — none of these block Streams 1–3:

1. **"Dashboard" dropdown vs. flat top-level items.** Keep Dashboard as a dropdown with Overview/Risk/Tech Debt nested, or promote the three presets to top-level sidebar items (like the VS Code activity bar — Dashboards, Code Health, Ownership, …)? The registry supports either — it's a Sidebar rendering question, not a preset-model question.

2. **Inspector defaults on preset change.** Sidebar navigation currently does NOT auto-select a file. Should it (the top-ranked file in the preset's primary table)? `applyPreset` deliberately leaves selection alone; adding an opt-in auto-select is a small follow-up.

3. **Deep links.** Each preset already has a stable `PresetId` key. Adding URL state (`?preset=cursed-files&file=apps/cli/src/index.tsx`) is a small follow-up once the registry lands.

4. **Tier 3 (group presets) — when to build?** Registry supports it natively (add 4 more entries with composed metrics). Build if Tier 2 uptake suggests users want the "highest-signal finding per section" aggregate view.

5. **localStorage preset overrides.** Upgrade path from the current "reset on every sidebar click" behavior if users ask for per-preset memory.

## Non-Goals for This Design

- **No full-page-per-analyzer layout.** We're not turning each analyzer into a dedicated page (option B from the original three-direction discussion). Current single-canvas dashboard is the keeper; we're just extending its preset mechanism.
- **No chart library rewrite.** Heroes stay as D3. The preset model is entirely a navigation and state shape — no rendering changes required.
- **No analyzer output changes.** This is purely UI/UX; `GitrelicReport` shape is unaffected.

## Next Steps

1. ~~Keep refining this spec~~ — done in the 2026-04-22 validation pass.
2. ~~Brainstorm to validate the preset model~~ — done 2026-04-22 via `superpowers:brainstorming`.
3. Run `superpowers:writing-plans` to convert this spec into an implementation plan at `docs/superpowers/plans/2026-04-22-analyzer-presets.md`. The plan should be structured around the three streams in Stream Decomposition.
4. Create Jira tickets as children of KAN-6, one per stream (Focus Mode, Preset framework + 4 analyzers, Full rollout). The Full rollout ticket will fan out into per-analyzer sub-issues as Stream 3 progresses.
5. After implementation lands, run the package-scoped audit skills (`audit-web`, `audit-architecture`) before merging the Stream 2 framework PR.
