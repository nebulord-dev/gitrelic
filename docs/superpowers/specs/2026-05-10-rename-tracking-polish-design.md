# Rename Tracking Polish — Design

> **Linear:** [RELIC-321](https://linear.app/nebulord/issue/RELIC-321)
> **Pattern doc:** [`docs/polish-pattern.md`](../../polish-pattern.md) — Rename Tracking entry under "Pending (Batches 2–N)" gets updated when this ships. The doc's prediction (*"Sankey hero; bottom table redundant. Likely narrative-KPI"*) holds.
> **Status:** Approved by Trace, ready for implementation plan.

## Summary

Polish the Rename Tracking analyzer in the GitRelic web view. Drop the bottom-panel `SortableTable` in favor of a **NarrativeKPI** panel headlined by `filesWithRenames`; tighten the **`RenameSankey`** hero so its existing-but-undiscoverable click→Inspector path becomes the primary drill-down (raise the top-N cap, beef up the selected-state, add a `<HeroCaption>` that calls out clickability); ship the analyzer's docs page at `apps/docs/analyzers/renames.md` and align nine cross-link references that currently point at the never-shipped `/analyzers/rename-tracking` slug.

The framing the polish locks: **Rename Tracking is structural-history reconstruction**, not a risk metric. Its job is to *attribute pre-rename history correctly* so other analyzers' caveats ("renames are not followed") have a place to point. The story it tells: *"how much restructuring has this codebase absorbed, and where do the chains live?"* — informational coloring, not severity coloring.

## Why this scope

The current Rename Tracking view ships:

- **Default hero:** `RenameSankey` (per-chain old-name → new-name flow, top-20 chains by `renameCount` desc)
- **Alt heroes:** none
- **Metrics strip:** Files Renamed / Total Renames / Longest Chain / Avg Renames/File / Most Renamed (basename)
- **Bottom panel:** `SortableTable` (`apps/web/src/components/tabs/RenamesTab.tsx`, ~63 lines): three columns — Current Name (basename + faded directory) / Previous Names (basenames as pills) / Renames (count), `onRowClick → onSelectFile` for Inspector drill-down.

A forensic look at the rendered Rename Tracking tab against the React repo (1,083 commits, 81 authors, 12-month window) surfaced four problems:

1. **The `Renames` column is dead signal.** With React's `Longest Chain = 1` and `Avg = 1`, 57 of 58 rows show `Renames: 1`; only `settings.json` shows `2`. The numerical column carries no sort signal, no insight, and no story the metrics strip doesn't already tell.
2. **`Previous Names` drops directory information.** The column renders `fileName(name)` (basename only) as pills. For React — where the dominant rename pattern is *directory restructure* (the `__tests__/fixtures/compiler/error.X-Y.js` → `Y.js` mass-moves visible in the sankey) — losing the directory hides the dominant signal.
3. **`Current Name` cell wraps unsafely.** The basename + faded directory render with `ml-1.5` between two inline spans; in the screenshot they collapse to `settings.jsoncompiler/.claude/` with no visual gap. Cosmetic, but reads like a bug.
4. **The table rotates the hero.** Per `polish-pattern.md` ("the table is often nearly redundant with the hero"), this is the canonical "table is rotated hero" pathology that calls for a narrative-KPI rewrite. The Inspector already aggregates per-file detail on click; the sankey already shows ranked chains; the table's only unique role was carrying per-row click affordance, which the sankey can replicate.

Cross-cutting discoveries during the audit:

5. **The sankey hero already supports click→Inspector** (`RenameSankey.tsx:198` calls `onSelectFile(n.currentPath)` on every node, with selected-state highlighting at `:217`) — but the affordance is undiscoverable. No `<HeroCaption>` exists on the hero (regression vs Churn/Bus Factor/Rewrite Ratio precedent), the cursor-pointer is the only signal, and the selected-state is a 1px stroke easy to miss against the link path opacity.
6. **`prepareSankeyData` caps at `topN = 20`.** For React's 58 chains that leaves 38 files unreachable from the hero. With the table gone, the cap becomes the only barrier between a user and Inspector for those files — needs raising.
7. **The doc page is missing.** `apps/docs/analyzers/` has no `renames.md`. Nine other analyzer pages cross-link to `/analyzers/rename-tracking` (the legacy slug from when the doc was forecast under the analyzer engine's name); the link is currently a placeholder via `ignoreDeadLinks` in `apps/docs/.vitepress/config.ts:19`. Convention across the polish initiative is **doc slug = preset key** (Co-Authors uses `analyzers/co-authors` despite the file being `co-author.ts`), so the page should land at `analyzers/renames` and the 9 cross-links should be updated in lockstep.

## Out of scope

- **Rename-aware analyzer continuity.** Cross-analyzer rename-following ("apply rename history to bus factor / churn / etc.") is a substantial cross-cutting feature, not a polish ticket. Future work, not this PR.
- **Author / commit-message / date columns in the panel.** The `FileRename` event type already carries `commitHash` + `date`, but surfacing per-rename forensic detail belongs in the Inspector (current and future), not the bottom panel — narrative-KPI is the aggregate-truth surface, by definition not a per-row detail surface.
- **Per-rename batching detection** ("commit X renamed N files at once"). A genuine alt-hero opportunity (commit-grouped rename batches surface directory restructures cleanly), but adding a second hero crosses the "does it answer a question the first one doesn't" bar weakly here — the sankey already implies batches via shared destinations. File a follow-up if the analyzer feels under-told post-ship.
- **`RenameTrackingReport` backend additions.** No new aggregates needed. Existing `chains[]`, `renames[]`, `totalRenames`, `filesWithRenames` cover the panel's needs. Pure frontend polish.
- **`Renames By Directory` extras slot.** Considered for the `NarrativeKPI.extras` panel slot (top-5 directories where renames cluster — would surface React's `__tests__/fixtures/compiler/` concentration). Rejected for the initial spec because (a) on React the rollup degenerates to a single dominant directory and (b) keeping the panel sparse (canonical Knowledge Silos / Co-Authors-AI shape) is preferable to padding. **Revisit during smoke** — if the panel feels empty next to a multi-line subline, the extras slot is approved as a follow-on edit in this same PR.

## Architecture

### Bottom panel — narrative-KPI rewrite

**`apps/web/src/components/tabs/RenamesTab.tsx`** — full rewrite, mirroring the canonical `KnowledgeSilosTab.tsx` / `CoAuthorsAiAdoptionTab.tsx` shape (no extras slot). The current SortableTable + `onSelectFile` plumbing goes away entirely; the new tab consumes `report` + `onApplyPreset`.

**Big number:** `report.renameTracking.filesWithRenames`. Read from the existing aggregate; not duplicated in the metrics strip's `Files Renamed` slot in the same way Bus Factor's `overallBusFactor` panel number isn't duplicated by its `Critical Files` strip slot — same metric, different framing (strip is a glanceable snapshot; KPI is the headline story).

**Tier thresholds (informational, not severity):**

| State | Variant | Label | Condition |
|---|---|---|---|
| No renames | `stale` | `No Renames` | `filesWithRenames === 0` |
| Surface renames | `coupling` | `Renames Tracked` | `filesWithRenames > 0 && longestChain <= 1` |
| Multi-step chains | `coupling` | `Tracked Chains` | `filesWithRenames > 0 && longestChain >= 2` |

**Why accent (not severity) coloring:** rename history is a workflow-shape signal, not a risk axis. A repo with many renames isn't unhealthier than one with none — it's just had more restructuring. Mirrors the Co-Authors / AI panel's two-state accent palette (RELIC-320). The dashboard shouldn't color-code "lots of renames" as red.

**Why a third state for chains ≥ 2:** the qualitative story bifurcates at chain length 2. Surface renames (length 1) are a single oldName → newName pair — a flat directory restructure. Multi-step chains mean a file has been renamed *and renamed again*, which is rare and meaningful (see React's `settings.local.json` → `settings.json` chain — only one such chain across the repo's whole history). Surfacing it in the tier label makes the story self-explanatory.

**Finding (right side):** **Top 3 most-renamed files** (sorted by `renameCount` desc, stable basename-alphabetical tiebreaker). Each row click invokes `onSelectFile` for Inspector drill-down. Per-row layout: full path with basename emphasized + `N renames` count. When `chains.length === 0`, render a single short empty-state line (`"No renames detected in this analysis window."`).

> **Top-N discipline:** memory tag `feedback_topn_under_threshold.md` — slice top-3 from `report.renameTracking.chains` directly (analyzer's existing output, no whole-repo backfill). Per-tab logic re-sorts because the analyzer doesn't pre-sort.

**Subline:** Aggregate metrics in one line:
> `<totalRenames> renames · longest chain: <N> step<s> · <pct>% of tracked files have rename history`

`pct = round(filesWithRenames / report.loc.totalFiles * 100)`. Empty-repo guard returns 0% with `loc.totalFiles === 0`. For the React example: `65 renames · longest chain: 1 step · 5% of tracked files have rename history`.

**See also:** `Hotspots`, `Churn`. (Both consume rename-broken file paths; they're the analyzers users hop to most often when rename continuity matters.) Sticky to the bottom of the panel.

**Removed surface:**
- `SortableTable` (~50 lines)
- `Column<FileRenameChain>` import path
- `fileName` / `filePath` imports (no longer needed by the tab)
- `onSelectFile` prop on `RenamesTab` (no row-click affordance left in the panel; sankey hero retains its own `onSelectFile` plumbing in `Shell.tsx`)

**`apps/web/src/components/layout/BottomPanel.tsx:160`** — the wire-up edit:
```tsx
return <RenamesTab report={report} onApplyPreset={onApplyPreset} />;
```
Was: `report={report} onSelectFile={onSelectFile}`. Mirror how `KnowledgeSilosTab` / `BlastRadiusTab` / `GhostFilesTab` are passed `onApplyPreset`.

### Hero polish — `RenameSankey`

Three precise edits to `apps/web/src/components/hero/RenameSankey.tsx`. None changes the data model or component API beyond the topN default — the click path itself is already wired.

1. **Raise the topN cap.** Currently `topN = 20` default in `prepareSankeyData()` (line 54). Change default to `Number.POSITIVE_INFINITY` (effectively no cap) — render every chain. Existing tests that assert `defaults topN to 20` get updated; existing test that asserts `honors topN option` stays as-is. Rationale for no cap: with the table gone, the sankey is the only ranked drill-in surface, so capping silently strands files. Sankey readability degrades gracefully on huge chain sets — the existing `nodePadding(10)` + `nodeWidth(12)` produce dense but legible flows up into the low hundreds; massive repos (2K+ rename chains) can revisit the cap if real-world feedback warrants. Callers wanting the old behavior can pass `topN: 20`.

2. **Beef up the selected state.** Currently:
   ```tsx
   stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
   strokeWidth={isSelected ? 1 : 0}
   ```
   Bump to `strokeWidth = 2.5` and ensure `fillOpacity = 1` on selected. Add a `selected ? '0 0 0 1px var(--accent-primary) outset' : 'none'` halo via a sibling `<rect>` underneath if the 2.5px stroke alone isn't enough during smoke — start with the stroke change.

3. **Add `<HeroCaption>`.** Currently absent — regression vs Churn / Bus Factor / Rewrite Ratio / Co-Authors-AI / Ghost Files (post-polish). Wrap the existing return in `<div className="w-full h-full flex flex-col">` and append `<HeroCaption primary={...} subtitle={...} />` underneath the SVG. Copy:
   - **primary:** `Sankey · old name → current name · width = 1 step · color: terminus = current path`
   - **subtitle:** `Click any node to inspect the file in the right-side panel.`
   The `subtitle` is what carries the click-discoverability fix.

The hover state stays as-is (tooltip-only). A future iteration could add hover opacity bumps for unselected nodes; out of scope for this polish.

### Metrics strip — left as-is

`apps/web/src/presets/metrics/renames.ts` is doing fine. The 5-slot composer surfaces healthy / accent shades on the same axes the panel emphasizes (Files Renamed, Total Renames, Longest Chain, Avg Renames/File, Most Renamed basename). No retune needed.

The only borderline slot is `Most Renamed` (showing `settings.json` for React) — a pure trivia slot at first glance, but the basename is *the* outlier story for any repo with one dominant chain (which is most repos), so it carries weight even at low chain counts. Keep.

> **Why not retune** (vs the Rewrite Ratio / Parallel Dev / Commit Timing precedent of replacing shape-of-data slots with health-tiered counts): rename-tracking has no per-file *score* and no `tierMix` — there's nothing to tier. Every metric here is a count or a label. The shape-of-data framing is the right framing for this analyzer.

### Docs page — `apps/docs/analyzers/renames.md` (NEW)

Following the structure of `co-authors.md` / `ghost-files.md` / `commit-timing.md`:

1. **Frontmatter** — `title: Rename Tracking`, description framing the analyzer as structural-history reconstruction (not a risk metric).
2. **Intro paragraph** — what Rename Tracking measures (chains of `git log --diff-filter=R` events walked back from each tracked file), what question it answers (*"how much restructuring has this codebase absorbed, and where do the chains live?"*), explicit positioning as the *answer* to the "renames are not followed" caveat referenced by 6+ other analyzer pages (Churn / Age Map / Bus Factor / Blast Radius / Rewrite Ratio / Parallel Dev / Shame / Co-Authors).
3. **Quick read** — 10-second tour: metrics strip → sankey hero → narrative-KPI panel → Inspector. Screenshot placeholder per the `::: tip Screenshot` pattern.
4. **How rename chains are reconstructed** — pipeline diagram (mermaid) showing `git log --diff-filter=R --find-renames --name-status` → `parseRenameLog` → `buildRenameChains` walking the reverse map per tracked file. Note the visited-set cycle guard.
5. **The metrics strip** — 5-slot table with formulas + worked examples on a hypothetical repo.
6. **Reading the surfaces** — sankey (default → only) → narrative-KPI panel → Inspector. Explicit "where each piece of information lives" guide. The HeroCaption click-affordance hint is described here.
7. **What action it suggests** — high `filesWithRenames` % → expect cross-analyzer continuity gaps in the affected paths; high `Longest Chain` → archeology candidate (path-history is harder than usual); top-renamed file → spot-check whether the rename was a refactor, a directory move, or a content rewrite that git heuristically matched.
8. **Limitations** — `--find-renames` similarity threshold (git's default 50%) misses heavy rewrites; no follow into pre-rename content history (chain stops at oldest detected oldPath); cycles guarded but rare cycle-like patterns (rename A→B, then B→A) collapse to "no rename"; bot-driven mass-renames (formatter/codemod commits) inflate `totalRenames` without representing meaningful structural change.
9. **Related analyzers** — Hotspots, Churn, Coupling, Cursed Files. Plus an explicit *"this analyzer is what fixes the 'renames are not followed' caveat"* callout linking to the 6+ analyzers that cite it.

**`apps/docs/.vitepress/config.ts`:**
- Add `{ text: 'Renames', link: '/analyzers/renames' }` to the Analyzers sidebar — alphabetical position between `Parallel Dev` and `Rewrite Ratio`.
- **Drop** `'/analyzers/rename-tracking'` from `ignoreDeadLinks` (line 19). The legacy URL no longer needs allow-listing once cross-links are updated to the new slug.

**Cross-link updates** — the 9 references in 7 files currently pointing at `/analyzers/rename-tracking` get rewritten to `/analyzers/renames`:
- `apps/docs/analyzers/age-map.md` (lines 53, 147)
- `apps/docs/analyzers/blast-radius.md` (lines 56, 119)
- `apps/docs/analyzers/bus-factor.md` (lines 59, 171)
- `apps/docs/analyzers/churn.md` (lines 52, 150)
- `apps/docs/analyzers/co-authors.md` (line 213)
- `apps/docs/analyzers/parallel-dev.md` (lines 53, 155)
- `apps/docs/analyzers/rewrite-ratio.md` (lines 57, 164, 165)
- `apps/docs/analyzers/shame.md` (lines 83, 152)

Slug rationale: doc URLs match the **preset key**, not the analyzer engine name. Co-Authors set the precedent (`co-author.ts` → `analyzers/co-authors`). Aligning lets every name in the user-visible chain (sidebar label, panel tab id, doc URL, preset key) read consistently.

### Web wiring — registry change

**`apps/web/src/presets/registry.ts` — `renames` entry (lines 397–411):**

```ts
renames: {
  id: 'renames',
  tier: 'analyzer',
  label: 'Renames',
  group: 'structure',
  hero: {
    defaultViz: 'rename-sankey',
    altTabs: ['rename-sankey'],
  },
  bottomPanel: {
    defaultTab: 'renames',
    altTabs: ['renames'],
  },
  metrics: renamesMetrics,
  docsPath: 'analyzers/renames',     // NEW
},
```

The `docsPath` field is what causes the right-anchored `Docs ↗` link to render in the bottom-panel tab bar (per the per-analyzer docs-links feature shipped in #69). Conditional on `docsPath` being declared on the preset; `registry.test.ts` enforces that if `docsPath` is set, the docs file must exist on disk — so the implementation order below is gated.

### Empty / small / huge repo states

- **Empty repo / no renames:** `chains = []`, `filesWithRenames = 0`, `totalRenames = 0`. Tier badge = `No Renames` (`stale` variant); big number `0`; finding renders the empty-state line; subline reads `"0 renames · longest chain: 0 steps · 0% of tracked files have rename history"`. Sankey hero falls through to its existing empty-state ("No rename history detected").
- **Small repo (1–5 chains, length-1):** Tier = `Renames Tracked`; finding lists all chains as the top-3 (with fewer rows); subline reads e.g. `"3 renames · longest chain: 1 step · 0.4% of tracked files…"`. Sankey renders the few flows cleanly with raised cap.
- **Huge repo (200+ chains):** Tier = `Tracked Chains` if any chain ≥ 2 steps else `Renames Tracked`. Sankey now renders all chains (was capped at 20); the layout's auto `nodePadding(10)` shrinks per-node height proportionally. If real-world testing surfaces a sankey-readability cliff at some N (≈ 300?), revisit with a saner default cap and a `Top N shown` caption hint.

## Tests

Following polish-pattern.md ("tests should match the existing pattern, not invent new ceremony"):

| File | Coverage |
|---|---|
| `apps/web/src/components/tabs/RenamesTab.test.tsx` *(NEW)* | Renders `narrative-kpi-big-number` testid with `filesWithRenames`; tier badge text matches band (`No Renames` / `Renames Tracked` / `Tracked Chains`); top-3 finding renders chain rows with click-on-row firing `onSelectFile`-style behavior — actually, since the tab no longer takes `onSelectFile`, top-3 rows are read-only text in this tab; verify they render correctly with renameCount counts; subline carries `totalRenames` + `longestChain` + `pct`; sticky see-also footer fires `onApplyPreset` with `hotspots` / `churn`; empty-state when `chains.length === 0`. |
| `apps/web/src/components/hero/RenameSankey.test.tsx` *(UPDATE)* | Update `'defaults topN to 20 when unspecified'` test to `'defaults topN to all chains when unspecified'`; assert that 25 input chains produce 25 links (was: 20). The `'honors topN option'` test stays unchanged. Add a smoke for the new `<HeroCaption>` integration if straightforward (existing tests are pure-data, so a render test would need a new harness — defer to the tab-test for caption coverage). |
| `apps/web/src/presets/registry.test.ts` | Existing DoD assertion auto-fails if `docsPath` set without docs file — satisfies itself once docs page lands. No new test needed. |

**Top-3 row click affordance:** the spec drops `onSelectFile` from the tab. Top-3 rows in the finding are display-only (rendered as text, not clickable). The Inspector path runs through the sankey hero exclusively (`onSelectFile` plumbed through Shell → RenameSankey, untouched by this PR). No tab-test needs to assert click behavior on the finding rows.

## Removes

- `RenamesTab`'s entire current `SortableTable` rendering + the three-column array (~50 lines): `Column<FileRenameChain>` import, `SortableTable` import, `fileName` + `filePath` imports, `onRowClick` callback, `onSelectFile` prop.
- `'/analyzers/rename-tracking'` entry from `ignoreDeadLinks` in `apps/docs/.vitepress/config.ts`.
- Default `topN = 20` cap in `prepareSankeyData` — replaced with no-cap default.
- Cross-link references to `/analyzers/rename-tracking` (9 instances across 7 docs pages — replaced with `/analyzers/renames`).

## Versioning

Ships as `feat:` (minor bump per `.releaserc.json` pre-1.0 rule). No data-model change to `RenameTrackingReport`. The web-side `topN` default change is a behavior change for any external caller of `prepareSankeyData` (none exist — it's an internal helper consumed only by `RenameSankey.tsx`), so no `feat!:` trigger. Old report JSONs load unchanged via `normalizeReport.ts` — `renameTracking` defaults already cover the existing aggregate fields.

## Implementation order

1. **Bottom-panel rewrite** — `RenamesTab.tsx` (NarrativeKPI + finding + subline + see-also), `BottomPanel.tsx:160` wiring (`onSelectFile` → `onApplyPreset`), tab test. Smallest, contained to the panel surface.
2. **Hero polish** — `RenameSankey.tsx` (raise topN default, beef selected stroke, add HeroCaption), update `RenameSankey.test.tsx` (`defaults topN` test). Independent of step 1.
3. **Docs page** — `apps/docs/analyzers/renames.md` (full page) + sidebar entry in `.vitepress/config.ts`.
4. **Cross-link rewrites** — sweep 9 `/analyzers/rename-tracking` references → `/analyzers/renames` across the 7 analyzer docs pages.
5. **Registry update** — set `docsPath: 'analyzers/renames'` on the `renames` preset; drop `'/analyzers/rename-tracking'` from `ignoreDeadLinks`. **Gate:** step 3 must have landed first (`registry.test.ts` fails CI otherwise).
6. **Smoke** — build the CLI in the worktree, run `gitrelic --path ~/Desktop/react --web`, eyeball: NarrativeKPI renders the new big number + tier + finding + subline + sticky see-also; sankey shows all 58 chains (was 20); selected node has visibly-thicker stroke after a click; HeroCaption strip reads with the click-to-inspect hint; `Docs ↗` link renders right-anchored in the panel tab bar and resolves to `/gitrelic/analyzers/renames` in the dev preview.

Each step is independently testable. Step 5 is the gate — don't set `docsPath` until step 3 (docs page) lands, or `registry.test.ts` will fail CI.
