# Churn Surface

**Date:** 2026-04-26
**Brainstormed:** 2026-04-26
**Status:** Approved — implementation plan to follow

## Problem

The `analyzeChurn` core analyzer ships a complete `ChurnReport` (`report.churn` — files, commit counts, churn scores, categories) but the web dashboard never gave it a first-class home. The Sidebar renders 19 analyzer presets under five groups; **churn is not one of them**. `apps/web/src/components/layout/Sidebar.tsx:79` literally carries the comment `// NOTE: Stream 3 will add the other Code Health presets here.`

Today, churn data is consumed indirectly:

- `ChurnTreemap` uses churn category as the default tile color, but it lives under the **Hotspots** and **Cursed Files** presets, never standalone.
- `HotspotsTab` shows a single `Churn` column among its hotspot rows.
- Hotspot scoring is `churn × LOC`, so churn is implicitly part of the headline metric.
- `cursed-files`, `tech-debt`, and `overview` dashboards consume `report.churn` for cross-analyzer signal.

This was surfaced when starting RELIC-303 ("Polish: churn"). The polish ticket presupposes a surface to polish; without one, the ticket is unactionable. We need to build the missing surface first, then RELIC-303 picks up the polish pass.

## Scope

**In scope:**

- A new `churn` analyzer preset (`tier: 'analyzer'`, `group: 'code-health'`).
- A new bar-chart hero (`ChurnBar`) as the default viz.
- Wiring of the existing `ChurnTreemap` (with `colorBy='churn'`) as the alt-tab viz.
- A new bottom-panel tab (`ChurnTab`) with a curated cross-analyzer column set.
- A new metrics-strip composer (`churnMetrics`) producing four headline tiles.
- A new sidebar entry under **Code Health**, positioned immediately after **Hotspots**.
- Tests for the new bar hero, the new tab, and the metrics composer.

**Out of scope:**

- Any change to `analyzeChurn` or any other core analyzer.
- Changes to other presets that already consume churn data (`hotspots`, `cursed-files`, `tech-debt`, `overview`).
- The forensic polish pass (RELIC-303) — that runs after this work lands.
- New cross-link panels, new inspector behavior, new keyboard shortcuts.

## Decisions

### Hero pattern: bar default + treemap alt-tab

Two complementary lenses, mirroring the pattern Hotspots already uses (default viz + alt-tabs):

| Slot | Token | Component | Story |
|---|---|---|---|
| `defaultViz` | `churn-bar` (new) | `ChurnBar` (new) | "Which files do we keep editing?" — top-N ranked leaderboard. |
| `altTabs[1]` | `treemap` (existing) | `ChurnTreemap` w/ `colorBy='churn'` (existing) | "Where does churn concentrate structurally?" |

`churn-bar` is a new `HeroViz` token; `treemap` already exists and is wired through Shell. No new code in `ChurnTreemap`.

### Sidebar placement

Code Health group, position 2, between **Hotspots** (position 1) and **Cursed Files** (now position 3):

```
Code Health
  • Hotspots
  • Churn         ← new
  • Cursed Files
  • Stale Files
  • Blast Radius
  • Complexity Trend
  • Age Map
  • Rewrite Ratio
  • Shame
```

Rationale: Hotspots = `churn × LOC`. Putting Churn adjacent makes the relationship discoverable; users who arrive at Hotspots can drill into either factor (Churn here, LOC under Languages).

The sidebar entry's badge counts hot files (`f.churnScore > 75`), matching the severity convention used by neighbors (`hotspots.topHotspots[critical]`, `cursedFiles[≥70]`, etc.).

### Bottom panel: curated cross-analyzer columns

`ChurnTab` uses a `SortableTable` with the following columns, in order:

| Column | Source | Format | Default sort |
|---|---|---|---|
| File | `report.churn.files[].file` | basename + dimmed path (matches HotspotsTab) | — |
| Commits | `report.churn.files[].commitCount` | numeric, right-aligned, monospace | **↓ desc** |
| LOC | `report.loc.files` lookup | numeric via `fmt`, right-aligned | — |
| Authors | `report.busFactors.files` lookup → `uniqueAuthors` | numeric, right-aligned | — |
| Last Touched | `report.ageMap.files` lookup → relative time | "3 days ago" / "2 yrs ago" | — |
| Category | `report.churn.files[].category` | severity Badge | — |

- **No `churnScore` column.** It's just `commitCount / max × 100`; redundant with Commits + Category.
- All cross-analyzer fields tolerate missing entries (return `—` placeholder).
- Click row → `onSelectFile`.
- **Uncapped.** Per [feedback memory: "SortableTable handles full lists"](../../.claude/projects/-Users-tracericochet-Desktop-nebulord-gitrelic/memory/feedback_table_caps.md), the React fixture (~12k churned files) renders fine.

### Metrics strip

Four tiles, in `apps/web/src/presets/metrics/churn.ts`:

| Tile | Value | Color rule |
|---|---|---|
| Hot Files | `count(f.churnScore > 75)` | `severity-critical` if > 0, else `severity-healthy` |
| Top Churn | `max(f.commitCount)` formatted with `fmt` | `severity-critical` if hot files exist, else `severity-warning` if any churn, else `severity-healthy` |
| Top File % | `top.commitCount / report.commits.length × 100`, rounded to 1 dp | `accent-primary` |
| Tracked Files | `report.churn.files.length` formatted with `fmt` | `accent-primary` |

Empty repo (no churn): `Hot Files` = 0 (healthy), the other three render `—`.

### `ChurnBar` component (new hero)

Mirrors `OwnershipBar.tsx`'s structure point-for-point:

- **Pure data prep**: `prepareChurnBarData(report, topN = 100): ChurnBarRow[]` — sorted by `commitCount` desc, ties broken by file path. Exported for testability.
- **Layout**: scroll container, ResizeObserver for width, fixed row height (mirror OwnershipBar constants).
- **Each row**: basename label (left) · category-colored bar (width = `commitCount / max × available`) · trailing label `{n} commits`.
- **Selected row**: accent stroke + scroll-into-view via `useLayoutEffect`.
- **Hover tooltip**: full path · commit count · churn category · top author (when `report.busFactors.files` has an entry).
- **Click**: `onSelectFile(row.file)`.
- **Empty state**: "No file churn detected" + `HeroCaption`.
- **Caption**:
  - Primary: `One row per file · bar = commit count · color = churn category`
  - Subtitle (dynamic):
    - Truncated: `Showing top 100 of N churned files. Sorted by commits, ties broken by file path.`
    - Full: `N churned files. Sorted by commits, ties broken by file path.`

Color map (matches existing `categoryColor` helper):

| Category | Source | Severity |
|---|---|---|
| `hot` | `churnScore > 75` | critical |
| `warm` | `churnScore > 40` | warning |
| `cold` | `churnScore > 10` | moderate / healthy |
| `frozen` | `churnScore ≤ 10` | low |

### Edge states

| Repo shape | Behavior |
|---|---|
| **Empty** (no commits / no churned files) | Hero: empty-state message + caption. Metrics: `Hot=0`, others `—`. Tab: empty `SortableTable`. |
| **Tiny** (< 5 churned files) | Bars render normally. Treemap renders sparsely but correctly. |
| **Huge** (React-scale, ~22k commits, ~12k churned files) | Bars capped at top 100 (mirrors OwnershipBar). Treemap unaffected (already iterates `report.loc.files`). Caption subtitle reflects truncation. |

### Cross-links

None inline. Discoverability is provided by:

- Sidebar adjacency to Hotspots (the natural next click).
- Table column set — `LOC`, `Authors`, `Last Touched` implicitly point at Languages, Bus Factor, Age Map.

No banner, no callout panel, no inspector changes.

## Non-decisions / acknowledged risks

- **`normalizeReport` coverage**: older reports may pre-date the `churn` field. Implementation must verify `normalizeReport.ts` defaults `report.churn` to `{ files: [], topFiles: [], hotspotCount: 0, summary: '' }`. Trivial fix if missing.
- **Churn redundancy with Hotspots**: by design. Hotspots answers "high churn AND high LOC"; Churn answers "high churn period." Adjacency in the sidebar makes the difference discoverable.
- **Top-N cap on bars**: 100 matches OwnershipBar. If user feedback later wants more, raise the cap — no architectural change needed.

## File plan

### New files

| Path | Purpose |
|---|---|
| `apps/web/src/components/hero/ChurnBar.tsx` | Default hero. Mirrors `OwnershipBar.tsx`. Exports `prepareChurnBarData` + `ChurnBar`. |
| `apps/web/src/components/hero/ChurnBar.test.tsx` | Data prep (sort, topN cap, tie-breaking) · empty state · render · click. |
| `apps/web/src/components/tabs/ChurnTab.tsx` | Bottom-panel table per the column spec above. |
| `apps/web/src/presets/metrics/churn.ts` | `churnMetrics(report)` returning 4 `Metric` objects. |
| `apps/web/src/presets/metrics/churn.test.ts` | Representative + empty fixtures, asserting all 4 tile values. |

### Modified files

| Path | Change |
|---|---|
| `apps/web/src/presets/types.ts` | Add `'churn'` to `PresetId`; add `'churn-bar'` to the `HeroViz` union. |
| `apps/web/src/presets/registry.ts` | Add `churn` preset entry (after `'cursed-files'` to keep grouping clean): tier `'analyzer'`, group `'code-health'`, hero `defaultViz: 'churn-bar'`, `altTabs: ['churn-bar', 'treemap']`, bottomPanel `defaultTab: 'churn'`, `metrics: churnMetrics`. |
| `apps/web/src/components/layout/Sidebar.tsx` | Insert Churn entry second in Code Health, badge = hot file count. |
| `apps/web/src/components/layout/BottomPanel.tsx` | Route `'churn'` tab id → `<ChurnTab />`. |
| `apps/web/src/components/layout/Shell.tsx` (or wherever `activeHeroViz` is dispatched) | Add `churn-bar` branch → `<ChurnBar />`. Add `HERO_LABELS['churn-bar'] = 'Top by Commits'` (or similar — verify naming convention from existing labels). |
| `apps/web/src/utils/normalizeReport.ts` | Verify (and add if missing) a default for `report.churn`. |
| `apps/web/src/utils/normalizeReport.test.ts` | Cover the churn default if added. |

## Tests

Per CLAUDE.md ("Add tests to all changes that can benefit from tests"):

- **`ChurnBar.test.tsx`** — `prepareChurnBarData` ordering and topN cap; tie-breaking deterministic; empty state renders the message; representative fixture renders 100 rows; click invokes `onSelectFile`.
- **`churn.test.ts`** — All four tile values for a representative fixture and the empty fixture; severity colors flip correctly when `Hot Files` crosses 0.
- **`ChurnTab.test.tsx`** *(only if non-trivial)* — column rendering, default sort, click handler. If the tab is a thin wrapper over `SortableTable` like `ChurnVelocityTab`, a single render test suffices.
- **`Shell.test.tsx`** — extend if necessary to cover `churn-bar` defaultViz dispatch and the treemap alt-tab path under the `churn` preset.
- **`normalizeReport.test.ts`** — if a churn default is added, cover the older-report path.

Tests live alongside the components they verify (no separate test directory) per existing convention.

## Out of scope, but staged

- **RELIC-303 (Polish: churn)** — picks up after this lands. Polish-pass forensics on real repos: caption wording, tooltip ergonomics, color contrast checks, badge thresholds, copy review. The forensic-audit memory entry already anticipates this for every hero.
- **Alt-tab parity with Hotspots** — Hotspots offers `scatter` and `risk-heatmap` as alt-tabs. The Churn preset deliberately keeps a tighter set (just `churn-bar` + `treemap`). Reconsider once polish ships.

## Build sequence (high-level — full plan to follow)

1. `prepareChurnBarData` + `ChurnBar` + tests.
2. `churnMetrics` + tests.
3. `ChurnTab` + (optional) test.
4. Wire `'churn'` into `types.ts`, `registry.ts`, `Sidebar.tsx`, `BottomPanel.tsx`, Shell hero dispatch.
5. Verify `normalizeReport` covers `report.churn`.
6. Smoke-test against the React fixture (`~/Desktop/react`) per the standard target.
7. Run `pnpm test`, `pnpm lint`, `pnpm format:check`.

A full implementation plan with per-step verification will follow in `docs/superpowers/plans/2026-04-26-churn-surface.md`.
