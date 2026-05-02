# Age Map Polish — Design

> **Linear ticket:** [RELIC-305](https://linear.app/nebulord/issue/RELIC-305/polish-age-map)
> **Polish Initiative pattern doc:** [`docs/polish-pattern.md`](../../polish-pattern.md)
> **Status:** Approved 2026-05-02. Implementation plan to follow via `superpowers:writing-plans`.

## Context

The Age Map analyzer surfaces `daysSinceLastCommit` for every tracked file, classified into `fresh / aging / stale / ancient` tiers based on repo-age-relative thresholds (8% / 33% / 66% of `repoAgeDays`). Every other surface on the page is doing some work, but the hero and the bottom panel both have problems on real data.

A forensic pass against the React repo (1,124 commits, 1,800+ tracked files) revealed the following pathologies:

### Hero pathologies

The page currently ships **two treemap heroes**, both implemented by `ChurnTreemap.tsx` re-used with different `colorBy` modes:

1. **`treemap-age` (default)** — sized by LOC, colored by `AgeStatus` tier (`fresh / aging / stale / ancient`). The colors are non-token hex (`#1f4e7a`, `#3a6b8c`, `#7a4a1f`, `#a06222`), no legend is rendered, and on a mature repo most files fall outside the analysis window — the chart becomes a wash of orange/blue with no clear signal beyond "yes, lots of stuff is old" (which the metrics strip's `986 ancient` already says). The labels overlap badly at scale and the right-third becomes an unreadable wall of `compiler/__tests__/fixtures/...` rects.

2. **`treemap` (alt)** — same component with `colorBy='churn'`. **Pure duplication** of `Hotspots`' default scatter and `Cursed Files`' default treemap. Indefensible — same redundant-alt pathology Bus Factor / Blast Radius / Rewrite Ratio cut in their respective polish tickets.

Both treemaps are also **performance-expensive** — every leaf is an SVG `<g>` with hover, ~1,800 rects on the React repo, React reconciles every dimension change. Visible UI sluggishness reported by Dan during the polish session.

### Bottom panel pathology

`AgeMapTab.tsx` is a generic `SortableTable` (Status · File · Age · Last Commit). Pure rotated-hero pathology: same unit of analysis as the hero (per-file), no explanatory chips, no precision the histogram couldn't show. On real data it's worse — rows 1–8 are all `compiler/__tests__/fixtures` files dated within hours of each other, so the "leaderboard of oldest files" is a wall of identical-aged fixture entries. The Inspector already covers per-file detail on click. The table fails the polish-pattern doc's three "earn its space" tests (chips / different unit / precision) on every front.

### Strip is fine

The metrics strip (Median Age · Ancient · Stale · Fresh) is preserved as-is. **The polished panel must avoid duplicating any strip slot.** This rules out `medianAgeDays` and raw `Ancient count` as narrative-KPI big-number candidates — both would render twice on the same screen.

## Goals

1. **Cut both treemap heroes.** Replace with a single `AgeHistogram` — distribution of `ageInDays` across all tracked files, tier-colored, ≥`staleLimit` zone shaded. Mirrors the established histogram family (Blast / Rewrite / Bus Factor).
2. **Replace the bottom-panel SortableTable** with two BottomTabs:
   - **Tab 1 (default):** `Age Map` — `<NarrativeKPI>` with a "% cold" big number and "Where they live" directory rollup extras.
   - **Tab 2:** `By Directory` — sortable table with per-directory age stats. Different unit from the hero (per-dir, not per-file) — earns its space.
3. **Strip preservation.** No changes to `ageMapMetrics()` slots.
4. **Repo-age-relative threshold awareness.** Histogram zone shading and panel tier badging both respect the analyzer's repo-scaled `staleLimit` / `ancientLimit`, not hardcoded day counts.
5. **Add hero caption** matching the pattern established by `BlastHistogram` / `RewriteHistogram` / `BusFactorHistogram` (single-sentence explainer with key dynamic numbers bolded).
6. **Performance win.** Replacing two ~1,800-rect treemaps with one ~12-bin histogram is a meaningful runtime improvement on large repos.

## Out of scope

- The metrics strip stays as-is. No reshuffling slots.
- No changes to other analyzers' presets or heroes (Hotspots, Cursed Files, Test Coverage, etc.) even though they also use treemaps.
- `colorByMode.churn` and `colorByMode.test-proximity` in `ChurnTreemap.tsx` stay — they're used by Cursed Files / Hotspots / Overview / Test Coverage and Test Coverage's polish ticket isn't in this PR.
- No new analyzer in core. `getAgeStatus` thresholds and the `AgeMapReport` shape are reused with one small additive field (see Backend changes).
- The Inspector's existing Age chip stays untouched.
- VitePress docs page for Age Map (per `polish-tasks.md` item 6) is a follow-up — not blocking the polish PR.

## Hero — `AgeHistogram`

### Visual design

Mirrors `BlastHistogram.tsx` / `RewriteHistogram.tsx` / `BusFactorHistogram.tsx` 1:1 in component shape and event surface.

- **Bins:** Fixed 30-day buckets from 0 up to `min(repoAgeDays, 540)`, with a final overflow bin labelled `540+ days` if `repoAgeDays > 540`. Rationale for fixed-month bins (vs repo-age-relative): readable across repo sizes. A 90-day repo gets 3 bins, a 365-day repo gets ~12, a 540-day repo gets 18, a 1,000-day repo gets 18 + overflow. All use the same intuitive unit ("month buckets") so the chart is comparable across repos.
- **Bar color:** by tier of bin midpoint, applied via the analyzer's repo-scaled thresholds:
  - `fresh` → `var(--severity-healthy)` (green)
  - `aging` → `var(--accent-primary)` (blue/neutral)
  - `stale` → `var(--severity-warning)` (orange)
  - `ancient` → `var(--severity-critical)` (red)
- **Threshold zone shading:** ≥`staleLimit` zone shaded with a faint `var(--severity-warning)` overlay, labelled "going cold". This is the analyzer's actual transition point and the visual cue for "everything to the right of here needs investigation." Mirrors the ≥70 zone shading on Blast / Rewrite / Bus Factor histograms.
- **Axes:** X = `Days since last commit`. Y = `Files`. Standard tick rendering as in the other histograms.
- **Hover:** tooltip shows bin range, file count, share-of-total %.
- **Click:** clicking a bar selects no file (bins aren't files); selectedFile is unaffected. **Do not** invent click-to-filter behaviour — out of scope.
- **Legend:** four-tier legend strip (`fresh / aging / stale / ancient`) at the top of the chart, dot + label, mirroring the existing `StalenessScatter` legend.
- **Empty state:** "No tracked files in the repository." (Matches `BlastHistogram` / `RewriteHistogram` empty-state copy style.)

### Hero caption

New `<HeroCaption>` block beneath the histogram, reusing the existing shared component (same as `ChurnBar` / `BlastHistogram` / `RewriteDivergingBar`). Format:

> **818 stale** (>{staleLimit} days) · **986 ancient** (>{ancientLimit} days) · **{freshCount} fresh** (≤{freshLimit} days). Median: **{medianAgeDays}** days.

Bolded numbers, dynamic from report. The caption frames the histogram for users who don't know the tier definitions yet.

### Component file

New `apps/web/src/components/hero/AgeHistogram.tsx`. Co-located test `AgeHistogram.test.tsx` mirrors the existing `BlastHistogram.test.tsx` shape — render test, bin computation test, threshold-zone shading test.

Export a `STALE_ZONE_THRESHOLD` constant or compute it from the report at render time. Implementation choice; either works.

## Bottom panel — Two BottomTabs

### Tab 1 — `Age Map` (default, narrative-KPI)

Reference precedent: `BusFactorTab.tsx`, `RewriteRatioTab.tsx`, `BlastRadiusTab.tsx`.

- **Big number:** `% stale-or-ancient` — `(staleFiles.length + ancientFiles.length) / files.length`, rendered as a percentage (e.g., `82%`). Frontend-derived, no backend change.
- **Tier thresholds (from the % cold value):**
  - `< 25%` = `Healthy`
  - `25–49%` = `Moderate`
  - `50–74%` = `High`
  - `≥ 75%` = `Critical`
- **Metric label (under big number):** `% Cold` (uppercase, tracking-[1px], small uppercase per the existing `<NarrativeKPI>` slot).
- **Finding (top of the right column):** Top-3 directories by *median age*, descending. Format per row:
  > `<dir-basename>` *(or `(root)`)* — **{medianAgeDays}** days median · **{ancientCount}** ancient
  Why directories not files: avoids the fixture-noise pathology (top-N files all dated to the same fixture commit). Files-by-age is what the Inspector + histogram cover.
- **Subline:** Tier mix headline:
  > Tier mix: **{freshCount}** fresh · **{agingCount}** aging · **{staleCount}** stale · **{ancientCount}** ancient.
  Tier counts derived in the frontend from `files[].status`. No backend change.
- **Extras (`<NarrativeKPI extras={...}>`):** "Where they live" — top-5 directories by *ancient-file count*. Same shape as Bus Factor / Rewrite Ratio / Shame / Blast Radius — five panels now share this layout. New utility `apps/web/src/utils/ageByDirectory.ts` (see Frontend changes).
- **See also:** `Stale Files` (preset id `dead-code`), `Cursed Files` (preset id `cursed-files`). Sticky to the bottom of the panel via the existing `<NarrativeKPI>` footer.

#### Empty state

When `files.length === 0` (empty repo, no tracked files): finding becomes `No age signal in the analysis window.`, subline omitted, extras omitted, big number renders as `0%` with `Healthy` tier badge. Matches the empty-state behaviour Bus Factor and Rewrite Ratio ship.

### Tab 2 — `By Directory` (sortable table)

A different unit of analysis from the histogram (per-directory, not per-file). Surfaces the per-directory data Dan wants without falling into per-file fixture-noise hell.

- **Component:** new `apps/web/src/components/tabs/AgeMapByDirectoryTab.tsx`.
- **Columns** (left to right):
  | Column | Source | Width / align |
  |---|---|---|
  | Directory | row.directory (or `(root)` if empty) | flexible, left, mono, truncated with `<Tooltip>` |
  | Files | row.fileCount | 60px, right, mono |
  | Median Age (days) | row.medianAgeDays | 90px, right, mono, tier-colored based on the row's median against the analyzer's repo-scaled `staleLimit` / `ancientLimit` (warning text when stale, critical when ancient) |
  | Ancient | row.ancientCount | 70px, right, mono, severity-critical text when > 0 |
  | Stale | row.staleCount | 70px, right, mono, severity-warning text when > 0 |
  | Fresh | row.freshCount | 70px, right, mono |
  | Oldest File | basename of row.oldestFile, with directory tail in tertiary text | flexible, left, mono |
- **Sort default:** `medianAgeDays` desc.
- **Row count:** all directories — let `<SortableTable>` virtualize / scroll. Avoid arbitrary top-N caps; the table component already handles long lists.
- **Click row:** `onSelectFile(row.oldestFile)` — opens the directory's oldest file in the Inspector. Same click-to-inspector pattern the existing `AgeMapTab` uses.
- **Empty state:** when `files.length === 0`, render the standard SortableTable empty state ("No directories with age data.").

### BottomPanel routing

Updates to `apps/web/src/components/layout/BottomPanel.tsx`:

- Add `'age-map-by-directory'` to the `BottomTab` enum (in `apps/web/src/presets/types.ts`).
- Add a `TAB_LABELS['age-map-by-directory'] = 'By Directory'` entry.
- Add a switch case routing `'age-map-by-directory'` to `<AgeMapByDirectoryTab>`.
- The `'age-map'` case continues to route to `<AgeMapTab>` (which now renders the narrative-KPI instead of the SortableTable).

### Registry preset update

`apps/web/src/presets/registry.ts`:

```ts
'age-map': {
  id: 'age-map',
  tier: 'analyzer',
  label: 'Age Map',
  group: 'code-health',
  hero: {
    defaultViz: 'age-histogram',
    altTabs: ['age-histogram'],
  },
  bottomPanel: {
    defaultTab: 'age-map',
    altTabs: ['age-map', 'age-map-by-directory'],
  },
  metrics: ageMapMetrics,
},
```

`HeroViz` enum gets a new entry `'age-histogram'`. `'treemap-age'` is removed from the type. Shell.tsx routing updated.

## Backend changes

**One additive field, no behaviour change:**

Add `thresholds` to `AgeMapReport`:

```ts
export interface AgeMapReport {
  files: FileAge[];
  staleFiles: FileAge[];
  ancientFiles: FileAge[];
  medianAgeDays: number;
  thresholds: {           // NEW
    freshLimit: number;   // ≤ this = fresh (in days)
    agingLimit: number;   // ≤ this = aging
    staleLimit: number;   // ≤ this = stale; > this = ancient
  };
  summary: string;
}
```

Populated by `analyzeAgeMap()` from the existing `getAgeStatus` formula (`Math.round(repoAgeDays * 0.08)`, `* 0.33`, `* 0.66`). Single source of truth — frontend reads `report.ageMap.thresholds` for histogram zone shading and hero caption labels instead of duplicating the formula.

**No new aggregates needed:**
- `% stale-or-ancient` derives in the frontend from `staleFiles.length + ancientFiles.length` / `files.length`.
- Tier-mix counts derive from `files.filter(f => f.status === ...)`.
- Directory rollups derive from `files[]` in the frontend (new utility).

**Backward compatibility:** older reports won't have `thresholds`. `apps/web/src/utils/normalizeReport.ts` fills a default — frontend uses `report.meta.ageInDays` as a fallback to compute thresholds inline if `report.ageMap.thresholds` is absent.

**Snapshot test:** `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` regenerates to include the new `thresholds` field. No score / status changes — purely additive.

## Frontend changes

### New files

| File | Purpose |
|---|---|
| `apps/web/src/components/hero/AgeHistogram.tsx` | Histogram hero component |
| `apps/web/src/components/hero/AgeHistogram.test.tsx` | Render + bin + threshold tests |
| `apps/web/src/components/tabs/AgeMapByDirectoryTab.tsx` | Per-directory sortable table |
| `apps/web/src/components/tabs/AgeMapByDirectoryTab.test.tsx` | Render + sort tests |
| `apps/web/src/utils/ageByDirectory.ts` | Aggregator: `aggregateAgeByDirectory(files)` returns full per-dir stats |
| `apps/web/src/utils/ageByDirectory.test.ts` | Aggregation correctness, sorting, edge cases |

### Modified files

| File | Change |
|---|---|
| `apps/web/src/components/tabs/AgeMapTab.tsx` | Replace SortableTable with `<NarrativeKPI>` (full rewrite) |
| `apps/web/src/components/tabs/AgeMapTab.test.tsx` (new) | Render test for KPI tier rendering, tier-mix subline, see-also wiring, empty state |
| `apps/web/src/components/hero/ChurnTreemap.tsx` | Remove `colorByMode.age`, `AGE_COLORS`, the `'age'` branch of `colorBy`. Keep `colorByMode.churn` and `colorByMode.test-proximity` (used elsewhere). |
| `apps/web/src/components/hero/ChurnTreemap.test.tsx` | Remove `colorBy='age'` test cases |
| `apps/web/src/components/layout/Shell.tsx` | Remove `'treemap-age'` route; add `'age-histogram'` route. `HERO_LABELS` updated. |
| `apps/web/src/components/layout/BottomPanel.tsx` | Add `'age-map-by-directory'` switch case + tab label |
| `apps/web/src/presets/registry.ts` | Update `'age-map'` preset (hero defaultViz + altTabs, bottomPanel altTabs) |
| `apps/web/src/presets/types.ts` | Update `HeroViz` (drop `'treemap-age'`, add `'age-histogram'`); update `BottomTab` (add `'age-map-by-directory'`) |
| `apps/web/src/utils/normalizeReport.ts` | Fill default `thresholds` from `meta.ageInDays` when missing |
| `apps/web/src/utils/normalizeReport.test.ts` | Cover the threshold fallback path |
| `apps/web/src/presets/metrics/age-map.ts` | No change. Strip preserved. |

### `aggregateAgeByDirectory(files)` shape

```ts
export interface AgeDirectoryRow {
  directory: string;       // parent directory or '' for root
  fileCount: number;
  medianAgeDays: number;
  freshCount: number;
  agingCount: number;
  staleCount: number;
  ancientCount: number;
  oldestFile: string;      // full path; tab renders basename + tail
  oldestFileAgeDays: number;
}
```

Returns rows sorted by `medianAgeDays` desc, ties broken by `directory` asc.

The narrative-KPI's "Where they live" extras consumes the same util, slicing top-5 by `ancientCount` desc — see Bus Factor / Rewrite Ratio for the precedent (different util, same pattern).

## Tests

### Core (Vitest)

- `packages/core/src/analyzers/age-map.test.ts` — add cases verifying `thresholds` population for 365-day repo (29/121/241), 90-day repo (7/30/59), 0-day repo (all zeros).
- `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` — auto-regenerates with the new `thresholds` field. Diff should be additive only.

### Web (Vitest)

- `apps/web/src/utils/ageByDirectory.test.ts` — aggregation correctness, empty input, single-file dirs, mixed-tier dirs, root-file handling.
- `apps/web/src/components/hero/AgeHistogram.test.tsx` — render, bin computation across repo sizes, threshold zone shading, tier coloring, empty state, hover tooltip data, hero caption rendering.
- `apps/web/src/components/tabs/AgeMapByDirectoryTab.test.tsx` — column rendering, default sort order, click-row → `onSelectFile(oldestFile)`, empty state.
- `apps/web/src/components/tabs/AgeMapTab.test.tsx` — narrative-KPI rendering across tier thresholds (Healthy/Moderate/High/Critical), tier-mix subline accuracy, "Where they live" extras for ≥1 ancient files, empty repo case, see-also `onApplyPreset` callback wiring.
- `apps/web/src/utils/normalizeReport.test.ts` — threshold fallback path when `report.ageMap.thresholds` is absent.

## Removes

- `colorByMode.age` and `AGE_COLORS` from `ChurnTreemap.tsx` (~15 lines)
- `treemap-age` and `treemap` routes for the Age Map preset in `Shell.tsx` (~12 lines)
- The existing `AgeMapTab.tsx` SortableTable body (~40 lines, rewritten as narrative-KPI)
- `'treemap-age'` from `HeroViz` enum and `HERO_LABELS`
- The Age Map preset's `altTabs: ['treemap-age', 'treemap']` becomes `altTabs: ['age-histogram']`

Net code change: ~+250 lines added (new histogram + by-directory tab + utilities + tests), ~-80 lines removed (treemap routing + old SortableTable + dead colorBy mode). Roughly +170 net.

## See-also wiring

- **From Age Map → `Stale Files` (dead-code)**: tighter cousin — Stale Files filters age × LOC × churn for "this might be dead." Age Map answers "what's old"; Stale Files answers "what's old AND probably abandoned."
- **From Age Map → `Cursed Files`**: cross-analyzer risk view — old files that are also high-churn / single-owned earn the curse.

Both pre-existing presets in the registry. No registry changes for see-also wiring.

## Pre-1.0 versioning

Ships as `feat:` (minor bump per `.releaserc.json`). Removing `'treemap-age'` from the `HeroViz` enum is technically a public-type narrowing, but the published surface is the CLI binary — the Web `HeroViz` type isn't user-consumed. Sidebar deep-links pinning the old `treemap-age` default will fall through to the new `age-histogram` (registry resolves to the new defaultViz). No CLI-flag breakage.

## Open questions

None blocking. The following are implementation-time decisions that don't change the design:

- Histogram bin count cap: 18 vs 24 month buckets — pick during implementation based on visual fit.
- Whether to expose `STALE_ZONE_THRESHOLD` as an exported constant from `AgeHistogram.tsx` (mirror of `HIGH_REWRITE_THRESHOLD` exported by `RewriteHistogram.tsx`) for cross-component reuse — likely yes, follow precedent.
- Big-number metric label copy: `% Cold` vs `Cold Codebase` vs `% Stale or Ancient` — pick during implementation, default to `% Cold`.

## Definition of done

- [ ] Both treemap heroes removed; `AgeHistogram` is the only Age Map hero.
- [ ] Hero caption renders dynamic counts and thresholds from the report.
- [ ] `AgeMapTab` renders `<NarrativeKPI>` with `% Cold` big number, tier badge, tier mix subline, and `Where they live` extras.
- [ ] `AgeMapByDirectoryTab` renders sortable table with default sort by median age desc.
- [ ] Strip slots unchanged (median age + counts).
- [ ] All new components have render tests; new utility has unit tests.
- [ ] Core test suite passes including snapshot regeneration.
- [ ] Web test suite passes.
- [ ] Manual QA against the React repo: page renders quickly (no treemap perf complaints), histogram tells the distribution-shape story, narrative-KPI tier reads correctly at 80%+ cold share, By Directory tab makes the fixture concentration legible.
