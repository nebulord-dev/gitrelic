# Rewrite Ratio Polish

**Date:** 2026-04-30
**Brainstormed:** 2026-04-30
**Status:** Approved — implementation plan to follow
**Linear:** [RELIC-314 Polish: rewrite-ratio](https://linear.app/nebulord/issue/RELIC-314)

## Problem

The Rewrite Ratio surface ships a `RewriteDivergingBar` hero atop a per-file `SortableTable` — the same "rotated hero" pathology that drove Batch 1. Forensic time on the React fixture (1,153 commits · 2,792 analyzed files) revealed three compounding problems:

1. **The score formula has no volume floor.** `rewriteScore = round(min(ins,del) / max(ins,del) × 100)` gives `+1/-1` and `+116/-116` an identical score of 100. The diverging-bar's top 30 on React is *all* tied at 100 — `ErrorBoundary.js`, `DESIGN_GOALS.md`, single-line test fixtures stand alongside the actual rewrite-heavy files (`ReactFiberHooks.js`, `BabelPlugin.ts`). The metrics-strip "Top Rewriter Score" tile reads 100 and the metrics-strip "High Rewriters" reads 10 (a hard cap from `topRewriters.length`, not a real count). The histogram, panel KPI, and any tier-based signal downstream all consume the noise as if it were signal.

2. **Two of the three hero tabs aren't rewrite-ratio views.** The `Scatter` alt-tab is wired to `HotspotScatter` — the same component the Hotspots tab uses as its default hero (x = churn, y = LOC, r = hotspotScore). The `Debt` alt-tab is wired to `DebtScatter`, which is the curated Tech Debt dashboard's default hero (registry.ts:66). Neither is rewrite-specific; both duplicate views the user can already see one click away. Same pathology blast-radius had with its three sub-tabs in RELIC-315.

3. **The bottom panel is a rotated copy of the hero.** Same files, same insertion/deletion numbers, same ratio bar — just transposed into a SortableTable. The Inspector already covers per-file detail on click (`apps/web/src/components/inspector/FileInspector.tsx`). The aggregate growth-vs-rewrite story unique to this analyzer (how much code gets *replaced* vs added/deleted across the whole repo) is shown nowhere.

The polish ticket scope therefore expanded — beyond the bottom-panel narrative-KPI replacement spec'd in `docs/polish-pattern.md` — to include the formula fix, the hero audit, the metric-strip wording fix, and a backport `<HeroCaption>` for the diverging bar.

A separate, smaller finding while sketching: the metrics-strip "High Rewriters" slot uses `topRewriters.length` (always `min(10, files.length)`), which is a misleading proxy for the high-rewrite count and silently lies on every repo with more than 10 files. Folded in.

## Scope

**In scope (12 items, four tiers):**

- **Tier A — Backend (2):** confidence-multiplier formula fix · expose `totalInsertions` / `totalDeletions` / `highRewrite` aggregates on `RewriteRatioReport`.
- **Tier B — Hero (3):** drop `Scatter` and `Debt` alt-tabs · `HeroCaption` added to `RewriteDivergingBar` · new `RewriteHistogram` distribution alt-tab (mirrors `BlastHistogram`).
- **Tier C — Bottom panel (3):** `RewriteRatioTab` rewritten to consume shared `<NarrativeKPI>` · directory-rollup util `rewriteByDirectory` · sticky see-also footer (Churn · Hotspots).
- **Tier D — Cross-cutting (4):** metrics-strip slot 2 wording + value source fix · preset registry alt-tab swap · Shell viz wiring for the new histogram · new `apps/docs/analyzers/rewrite-ratio.md` analyzer page.

**Out of scope:**

- Generic `<DistributionHistogram>` shared between Blast Radius and Rewrite Ratio. Appealing once a third analyzer wants it; not now.
- Auto-tuning the confidence floor `N`. Locked to `N=30` (lines on the smaller side) for v1, tunable later if real-data feedback says otherwise.
- Removing or refactoring `DebtScatter` / `HotspotScatter` themselves — both still serve their primary tabs (Tech Debt, Hotspots respectively).
- Cross-tab persistence of which Rewrite Ratio hero (Rewrites vs Distribution) was last selected — uses the existing per-preset `defaultViz` reset on navigation.
- Inspector panel content tuning for rewrite-ratio rows.
- New tier labels for the histogram. Reuses Blast Radius's `low/medium/high/critical` cutoffs at `<25 / <50 / ≤75 / >75` for consistency across the two analyzers that share the histogram pattern.

## Decisions

### Tier A — Backend

#### A1 — Confidence-multiplier formula fix

Current formula in `packages/core/src/analyzers/rewrite-ratio.ts:30-32`:

```ts
const maxVal = Math.max(insertions, deletions);
const minVal = Math.min(insertions, deletions);
const ratio = maxVal > 0 ? Math.round((minVal / maxVal) * 100) / 100 : 0;
const rewriteScore = Math.round(ratio * 100);
```

Replace the score line with a confidence-multiplier:

```ts
const CONFIDENCE_FLOOR = 30;
const rawScore = ratio * 100;
const confidence = Math.min(1, minVal / CONFIDENCE_FLOOR);
const rewriteScore = Math.round(rawScore * confidence);
```

The `ratio` field is left unchanged — it remains the raw mathematical ratio, useful for the diverging-bar tooltip and the "% of files balanced" subline calculation. Only `rewriteScore` (the public-facing 0–100 metric that feeds cursed-files, the panel, and the histogram) gets the floor applied.

Worked examples (numbers verified against the data in your screenshot):

| File (React) | +ins | −del | min(ins,del) | rawScore | After (confidence floor) |
|---|---|---|---|---|---|
| ErrorBoundary.js | 1 | 1 | 1 | 100 | **3** |
| DESIGN_GOALS.md | 4 | 4 | 4 | 100 | **13** |
| parseConfigPragma-test.ts | 6 | 6 | 6 | 100 | **20** |
| setupEnv.js | 15 | 15 | 15 | 100 | **50** |
| BabelPlugin.ts | 57 | 57 | 57 | 100 | **100** |
| ReactFiberHooks.js | 116 | 116 | 116 | 100 | **100** |
| (growth file) | 800 | 50 | 50 | 6 | **6** |

The constant `CONFIDENCE_FLOOR = 30` is declared at module scope in `rewrite-ratio.ts` (not exported) so tests assert against it and a future tuning ticket has a single source of truth.

**Why min(ins, del) and not total (ins + del):** The whole semantic point of rewrite-ratio is that the smaller side matches the larger — that's what makes a file "balanced rewrite churn" rather than growth or shrinkage. So the smaller side is also the analyzer-specific confidence basis: "we've seen at least N lines of actual replacement." Shame's `totalCommits / 5` floor uses generic activity volume because Shame's signal is keyword density across any commits; rewrite-ratio's signal is volume of the smaller side specifically.

**Downstream effects:**

- `cursed-files.ts` does not consume `rewriteScore` (verified — its candidate set and scoring read churn / busFactor / ageMap / forensics / parallelDev only). No code or test changes there.
- `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` regenerates. Most rewrite scores will drop; the snapshot diff captures it once.
- Existing `rewrite-ratio.test.ts` tests: `+50/-50 → 100` (unchanged, min=50 ≥ 30), `+100/-10 → 10` (was 10) becomes `round(10 × 10/30) = 3` (test expectation updates), `+5/-100 → 5` (was 5) becomes `round(5 × 5/30) = 1` (test expectation updates), `+30/-20 then +20/-30 accumulated → 100` (unchanged, min=50 ≥ 30 after accumulation). New tests cover the multiplier explicitly: `+30/-30 → 100`, `+15/-15 → 50`, `+1/-1 → 3`, the cutover at `min(ins,del) = 30`.

#### A2 — `RewriteRatioReport` aggregates

Add three fields to `RewriteRatioReport` in `packages/core/src/types.ts`:

```ts
export interface RewriteRatioReport {
  files: FileRewriteRatio[];
  topRewriters: FileRewriteRatio[];
  totalInsertions: number;     // new — repo-wide
  totalDeletions: number;      // new — repo-wide
  highRewrite: number;         // new — count of files with rewriteScore ≥ 70
  summary: string;
}
```

Aggregation in `analyzeRewriteRatio`:

- `totalInsertions` and `totalDeletions` accumulate alongside the per-file `fileStats` Map (same loop, no extra pass).
- `highRewrite` already gets computed inline for the `summary` string (`packages/core/src/analyzers/rewrite-ratio.ts:44`); the assignment is just hoisted into the return object.

The frontend derives `balancedRatio` (% of files with `ratio > 0.5`) from `files[]` cheaply — no backend field needed.

### Tier B — Hero

#### B1 — Drop `Scatter` and `Debt` from alt-tabs

`apps/web/src/presets/registry.ts:299-313` — change:

```ts
'rewrite-ratio': {
  ...
  hero: {
    defaultViz: 'rewrite-diverging-bar',
    altTabs: ['rewrite-diverging-bar', 'scatter', 'debt-scatter'],  // before
    altTabs: ['rewrite-diverging-bar', 'rewrite-histogram'],         // after
  },
  ...
}
```

`HotspotScatter` and `DebtScatter` components are NOT deleted — they remain the default heroes of Hotspots and Tech Debt respectively. Only the registry wiring on `rewrite-ratio` changes.

`apps/web/src/components/layout/Shell.tsx`:

- Add `RewriteHistogram` import + render branch alongside the existing `RewriteDivergingBar` block (search `selection.activeHeroViz === 'rewrite-diverging-bar'` for the insertion point).
- Add `'rewrite-histogram': 'Distribution'` to the viz-id-to-tab-label map (the same map that holds `'rewrite-diverging-bar': 'Rewrites'` at Shell.tsx:118).

#### B2 — `HeroCaption` on `RewriteDivergingBar`

`apps/web/src/components/hero/RewriteDivergingBar.tsx` currently has no caption strip. Wrap the existing return in a column flex container, render the `<svg>` block as before, append `<HeroCaption>` below — exact pattern from `ChurnBar` / `OwnershipBar` / the new Shame heroes.

Caption copy:

- **Primary:** `"Top 30 by rewrite score · bar length = lines added/removed · score on right"`
- **Subtitle:** `"Which files keep getting rewritten? Balanced ins/del = code that doesn't stick."`

The component already reserves `topPad` for header axis labels ("deletions" / "insertions" markers above the bars); those stay. The HeroCaption strip lives below the SVG, not above.

#### B3 — `RewriteHistogram.tsx` (new alt-tab)

Mirrors `apps/web/src/components/hero/BlastHistogram.tsx` 1:1 with these substitutions:

- Reads `report.rewriteRatio.files` instead of `report.blastRadius.files`.
- Bins by `f.rewriteScore` (post-formula-fix).
- Constant `HIGH_REWRITE_THRESHOLD = 70`, exported alongside a `rewriteTierFor(score)` helper that uses Blast's exact cutoffs (`<25 low · <50 medium · ≤75 high · >75 critical`) for cross-analyzer visual consistency.
- HeroCaption copy:
  - **Primary:** `"10-bin histogram · bar height = file count · color = rewrite tier"`
  - **Subtitle:** `"What's the shape of rewrite churn across the repo? How many files actually keep getting rewritten?"`
- aria-label: `"Rewrite-score distribution histogram across {totalFiles} files. {highRewriteCount} {is/are} at or above the high-rewrite threshold of 70."`
- Empty-state message: `"No rewrite-ratio data available."`

Tier color mapping reuses `--severity-healthy / --severity-warning / #d27b22 / --severity-critical` (same `TIER_COLORS` shape Blast uses).

The duplication with `BlastHistogram` is acknowledged and accepted for v1. A generic `<DistributionHistogram>` lives in the follow-up section below.

### Tier C — Bottom panel

#### C1 — `RewriteRatioTab.tsx` rewrite

Replace the entire SortableTable body with `<NarrativeKPI>` consumption. Pattern mirrors `ShameTab.tsx` / `BlastRadiusTab.tsx`. Component shape:

```tsx
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { aggregateRewriteByDirectory } from '../../utils/rewriteByDirectory';
import { fileName } from '../theme';
import { fmt } from '../theme';

const HIGH_REWRITE_THRESHOLD = 70;
const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

function tierBadge(highRewriteCount: number): { variant: BadgeVariant; label: string } {
  if (highRewriteCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highRewriteCount < 5)   return { variant: 'warning', label: 'Moderate' };
  return { variant: 'critical', label: 'High Rewrite' };
}
```

**Tier thresholds:** `0 = Healthy · 1–4 = Moderate · 5+ = High Rewrite`. Slightly tighter than Blast Radius's `1–9 / 10+` because rewrite-heavy files tend to be fewer per repo. Adjustable per real-data feedback.

**Big number:** `report.rewriteRatio.highRewrite` (no client-side filtering — the count is now authoritative on the report).

**Finding (left column under big number):** Top 3 high-rewrite files. **Sliced from the threshold-filtered subset** (`files.filter(f => f.rewriteScore >= HIGH_REWRITE_THRESHOLD)`), not from `topRewriters` — see RELIC-315 lesson, also encoded in `feedback_topn_under_threshold.md`. Each row: file basename + `+fmt(totalInsertions)` / `−fmt(totalDeletions)`.

Empty-state copy:
- `highRewrite === 0 && files.length > 0`: `"No files cross the high-rewrite threshold — code edits skew toward growth or shrink, not replace."`
- `files.length === 0`: `"No rewrite signal in the analysis window."`

**Subline (right column):** Repo balance.

```
Repo balance: +{fmt(totalInsertions)} / −{fmt(totalDeletions)} · net {signed(totalInsertions − totalDeletions)} · {balancedPct}% of files balanced (ratio > 0.5).
```

Where `balancedPct = round((files.filter(f => f.ratio > 0.5).length / files.length) * 100)` — derived in the tab from existing `files[]`. `signed(...)` returns `+N` for positive, `−N` for negative, `0` for zero (handled inline; no helper needed).

**Extras (`NarrativeKPI.extras` slot):** *"Where they live"* — top-5 directory rollup of high-rewrite files. Each row: parent directory · proportional bar (warning color, `--severity-warning`) · count · share %. Uses the same JSX shape and styling as `ShameTab` / `BlastRadiusTab` to preserve visual parity. `+ N more directories` line beneath when `allDirectoryRows.length > DIRECTORY_ROLLUP_LIMIT`.

**See also (sticky footer):** `[{ label: 'Churn', presetId: 'churn' }, { label: 'Hotspots', presetId: 'hotspots' }]`.

The current `apps/web/src/components/tabs/RewriteRatioTab.tsx` (~107 lines) is replaced wholesale; the SortableTable + columns structure goes away. The `Column<FileRewriteRatio>` type usage is no longer needed in this file.

#### C2 — `rewriteByDirectory.ts` util (new)

Exact clone of `apps/web/src/utils/blastByDirectory.ts` and `shameByDirectory.ts` with the type narrowed to `FileRewriteRatio`. Exports:

```ts
export interface RewriteDirectoryRow {
  directory: string;
  count: number;
  share: number;
}

export function aggregateRewriteByDirectory(
  files: ReadonlyArray<FileRewriteRatio>,
): RewriteDirectoryRow[];
```

Aggregation: groups by `parentDirectory(filePath)` (lastIndexOf '/'), sorts by count desc with directory-name tiebreak, returns full sorted list (the consumer `slice(0, DIRECTORY_ROLLUP_LIMIT)`s for display and computes `hiddenDirectoryCount` from the remainder).

#### C3 — Sticky see-also footer

Lives inside `<NarrativeKPI>` already (the shared component handles stickiness). The `RewriteRatioTab` only supplies the `seeAlso` tuple and the `onApplyPreset` callback wired through from `BottomPanel`.

### Tier D — Cross-cutting

#### D1 — Metrics strip slot 2 fix

`apps/web/src/presets/metrics/rewrite-ratio.ts` — change slot 2:

```ts
// Before:
{
  label: 'High Rewriters',
  value: fmt(topRewriters.length),  // capped at 10, lies
  color: topRewriters.length > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
},

// After:
{
  label: 'Files ≥70',
  value: fmt(report.rewriteRatio.highRewrite),
  color: report.rewriteRatio.highRewrite >= 5
    ? 'var(--severity-critical)'
    : report.rewriteRatio.highRewrite > 0
      ? 'var(--severity-warning)'
      : 'var(--severity-healthy)',
},
```

Severity bands match the panel's tier badge (0 / 1–4 / 5+) for a consistent reading. Other slots (Top Rewriter Score, Avg Ratio, Files Analyzed) unchanged.

#### D2 — Preset registry update

Already covered in B1 — single edit at `apps/web/src/presets/registry.ts:306` plus the corresponding viz label addition at `Shell.tsx:118`.

#### D3 — Shell wiring

Already covered in B1 — `RewriteHistogram` import, render branch under `selection.activeHeroViz === 'rewrite-histogram'`.

#### D4 — `apps/docs/analyzers/rewrite-ratio.md`

New analyzer page following the per-analyzer docs pattern set by Churn (`apps/docs/analyzers/churn.md`), Blast Radius (`apps/docs/analyzers/blast-radius.md`), and Shame (`apps/docs/analyzers/shame.md`). Page covers:

- What the analyzer measures (line-volume balance per file, repo-wide growth-vs-rewrite mix).
- Score formula post-fix, including the confidence multiplier and worked examples.
- Hero anatomy (Rewrites + Distribution), with screenshots.
- Bottom-panel anatomy (KPI / finding / subline / extras / see-also), with screenshot.
- How to interpret the metrics strip.
- Cross-references to Churn, Hotspots, Cursed Files.

Bundles in the same PR per `project_analyzer_polish_session_pattern` memory.

## Test coverage

**Core (unit):**
- `packages/core/src/analyzers/rewrite-ratio.test.ts` — existing tests updated for new expected values; new cases cover the multiplier explicitly (`+1/-1 → 3`, `+15/-15 → 50`, `+30/-30 → 100`, the cutover boundary, accumulated-across-commits behavior with mixed sub-floor + above-floor commits).
- `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` — regenerated; diff captures repo-wide score shifts.

**Web (unit + render):**
- `apps/web/src/components/tabs/RewriteRatioTab.test.tsx` — new. Asserts: big number reflects `report.rewriteRatio.highRewrite`; tier badge variant flips at 0 / 1 / 5; finding lists top 3 high-rewrite files (sliced from filtered subset, not `topRewriters`); subline includes formatted totals + balanced %; extras renders directory rows with proportional bars; see-also click fires `onApplyPreset('churn')` and `onApplyPreset('hotspots')`; uses `getByTestId('narrative-kpi-big-number')` not `getByText`.
- `apps/web/src/components/hero/RewriteHistogram.test.tsx` — new. Mirrors `BlastHistogram.test.tsx` shape: bin assignment, threshold zone rendering, tier-color mapping, empty state, aria-label content.
- `apps/web/src/utils/rewriteByDirectory.test.ts` — new. Mirrors `blastByDirectory.test.ts` / `shameByDirectory.test.ts`: aggregation correctness, share calc adds to 1.0 within rounding, empty input returns `[]`, sort stability.
- `apps/web/src/presets/metrics/rewrite-ratio.test.ts` — assert slot 2 label is `"Files ≥70"` and value reflects `report.rewriteRatio.highRewrite`; severity bands at 0 / 1 / 5.

**No new visual-regression infrastructure.** Per `feedback_happy_dom_flex_shorthand` memory: assertions against serialized styles use `flex-grow: 1` not `flex: 1`.

## Side effects on other surfaces

- **Cursed Files** — unaffected. `cursed-files.ts` does not read `rewriteRatio` at all (its candidate set and scoring inputs are churn / busFactor / ageMap / forensics / parallelDev). The formula change is invisible to it.
- **Tech Debt dashboard** — unaffected. `DebtScatter` is still its default hero.
- **Hotspots** — unaffected. `HotspotScatter` is still its default hero.
- **Inspector panel** — unaffected. `FileInspector.tsx:81-83` reads `rr.ratio` (the raw mathematical ratio, unchanged by the formula fix). It does not read `rewriteScore`. No template change.
- **Metrics strip "Top Rewriter Score" (slot 1)** — formula unchanged but its meaning subtly shifts: under the new score formula a sub-floor file can no longer hit 100, so the slot now represents *the highest score among files with at least 30 lines on the smaller side*. The label and code stay; this is a documentation-side observation only.

## Build sequence

Land in this order so each commit's tests stay green:

1. **A1 + A2 together** (one core commit) — formula + new aggregates + updated existing tests + new multiplier tests + snapshot regen + `RewriteRatioReport` type additions.
2. **B3 + B2 together** (one web commit) — `RewriteHistogram.tsx` + util tests + `HeroCaption` on `RewriteDivergingBar` + Shell wiring + registry alt-tab swap + `Distribution` viz label. Histogram renders before the panel rewrite so the alt-tab is functional whether or not the panel is updated.
3. **C1 + C2 + D1** (one web commit) — `rewriteByDirectory.ts` + util tests + `RewriteRatioTab.tsx` rewrite + tab tests + metrics-strip slot 2 fix + metrics tests.
4. **D4** (docs commit) — `apps/docs/analyzers/rewrite-ratio.md`.
5. **`docs/polish-pattern.md` update** — same PR. Move `rewrite-ratio` from Pending to Mapped, add a "shipped — RELIC-314" note documenting the formula-fix scope expansion (mirrors how `blast-radius` and `forensics` are described post-RELIC-315 / RELIC-308).

## Open questions

None. All decisions locked during the brainstorm.

## Out of scope (filed as follow-up)

- **Generic `<DistributionHistogram>` shared between Blast Radius and Rewrite Ratio.** The two histograms are now near-identical; the right time to extract is when a third analyzer wants the pattern. File a Linear ticket if not already tracked.
- **Auto-tuning `CONFIDENCE_FLOOR`.** Same as Shame's `N=5` — locked at 30 for v1. Real-data feedback may push it tighter or looser; ticket if so.
- **Per-tier color encoding on the diverging bar's score number.** Today the score is mono color; coloring it by tier would mirror Shame's leaderboard. Visual-only, low value, defer.
