# Shame (forensics) Polish

**Date:** 2026-04-29
**Brainstormed:** 2026-04-29
**Status:** Approved — implementation plan to follow
**Linear:** [RELIC-308 Polish: Forensics](https://linear.app/nebulord/issue/RELIC-308)

## Problem

The Shame surface ships a `ShameLeaderboard` hero (10 horizontal bars) atop a per-file `SortableTable` — the same "rotated hero" pathology that drove the Batch 1 polish work. Forensic time on the React fixture (1,153 commits · 1,063 shameful files · 442 critical · 177 shame commits) revealed three concrete, compounding problems:

1. **The score formula is broken at the tail.** `shameScore = round((rawShamePoints / totalCommitsForFile) × 100)` with a hard cap at 100. A file with one commit whose message says "fix" earns the maximum score (1 / 1 × 100 = 100). React's leaderboard is *all* tied at 100 — `compiler_bug_report.yml`, `link-compiler.sh`, `DESIGN_GOALS.md`, single-commit YAMLs and shell scripts. The metrics-strip "Top Score" tile reads 100 — meaningless when dozens of files tie at the cap.

2. **The polish-pattern.md spec inherits the brokenness.** Its proposed Big Number was "Top file's shame score (out of 100)" — which on this repo would render literally as "100" with no severity meaning. The spec needs to change to match a fix to the formula.

3. **The screen has no temporal dimension.** Current hero (Leaderboard) and Inspector both answer per-file questions. Metrics strip is right-now snapshot. The orthogonal lens nothing else surfaces is *temporal* — is shame trending up, and is the severity mix shifting?

The polish ticket scope therefore expanded — beyond replacing the bottom table — to address the formula, add a temporal hero, and re-think the bottom-panel headline. The Shame analyzer's unique angle is its **keyword-tier weighting** (revert/hotfix/oops are critical · hack/workaround are moderate · fix/bug are mild), but until now no UI surface has actually shown the tier breakdown.

A fourth, unrelated finding while sketching: `BlastHistogram` (shipped two days ago in RELIC-315) lacks a `<HeroCaption>` strip. Churn (`ChurnBar`) and Bus Factor (`OwnershipBar`) both have one. The new Shame heroes will use the caption pattern, so backporting the same caption to BlastHistogram is a no-cost cleanup that prevents the pattern from drifting.

## Scope

**In scope (12 items, four tiers):**

- **Tier A — Backend (3):** confidence-multiplier formula fix · `keywordTiers` aggregate · `byMonth` aggregate.
- **Tier B — Hero (4):** new `ShameTrend` component (default) · revised `ShameLeaderboard` (filtered + tier-color) · hero tab switcher wired through preset registry · `HeroCaption` on both Shame heroes.
- **Tier C — Bottom panel (3):** `ShameTab` rewritten to consume shared `<NarrativeKPI>` · directory-rollup util `shameByDirectory` · sticky see-also footer (Cursed Files · Bus Factor).
- **Tier D — Cross-cutting (2):** `HeroCaption` backported to `BlastHistogram` · new `apps/docs/analyzers/shame.md` page.

**Out of scope:**

- Inspector panel content tuning (file detail surface, separate ticket).
- Trend granularity toggle (week / quarter); locked to monthly buckets for v1.
- Auto-tuning the confidence floor `N`; locked to `N=5` for v1, tunable later if React data shows we want it tighter or looser.
- Cross-tab persistence of which Shame hero (Trend vs Leaderboard) was last selected — uses the existing per-preset `defaultViz` reset on navigation.
- Adding new shame keywords or changing tier weights. Existing keyword sets in `forensics.ts` are kept.
- Surfacing per-commit detail (which messages got flagged) anywhere in the tab — Inspector already shows `topShameCommits` per file when a row is clicked.

## Decisions

### Tier A — Backend

#### A1 — Confidence-multiplier formula fix

Current formula in `packages/core/src/analyzers/forensics.ts:115`:

```ts
const shameScore = Math.min(Math.round((rawShamePoints / fileCommitList.length) * 100), 100);
```

Replace with confidence-multiplier:

```ts
const CONFIDENCE_FLOOR = 5;
const rawScore = (rawShamePoints / fileCommitList.length) * 100;
const confidence = Math.min(1, fileCommitList.length / CONFIDENCE_FLOOR);
const shameScore = Math.min(Math.round(rawScore * confidence), 100);
```

Worked examples:

| Case | Before | After |
|---|---|---|
| 1 commit, 1 mild "fix" (1 pt) | 100 | 20 |
| 3 commits, 3 mild "fix" (3 pts) | 100 | 60 |
| 5 commits, 5 mild "fix" (5 pts) | 100 | 100 |
| 20 commits, 8 shame at avg 1 pt (8 pts) | 40 | 40 |
| 50 commits, 10 reverts at avg 3 pts (30 pts) | 60 | 60 |

The constant `CONFIDENCE_FLOOR = 5` is exported from `forensics.ts` so tests can assert against it (and so a future tuning ticket has a single source of truth). The formula's existing JSDoc comment is updated to describe the multiplier.

**Why this approach (vs. hard cutoff or Bayesian prior):** Smoothest gradient — files reach the same scores they used to once they have enough history. Cursed-files' existing 75/50/25 thresholds (`packages/core/src/analyzers/cursed-files.ts:91-99`) keep meaning the same thing. Snapshot blast radius is minimal compared to a Bayesian prior, which would reshape *every* score.

**Leaderboard semantic redefinition (lands in A1's commit).** Today `forensics.ts` builds `shameLeaderboard` as `files.slice(0, 10)` after sorting `files[]` by score desc. After A1, that gives mostly-same output but can still include sub-floor files when their dampened score still ranks top-10 (rare on real repos but possible on tiny ones). Tighten to: rank `files[]` desc, then take top 10 *from the subset where `fileCommitList.length >= CONFIDENCE_FLOOR`*. Sub-floor files remain in `files[]` (so `cursed-files.ts` can reference their dampened scores), they just don't seed the leaderboard. This is a backend change and lands in the same commit as the formula fix so the snapshot regenerates once.

#### A2 — `keywordTiers` aggregate

Add to `ForensicsReport` in `packages/core/src/types.ts`:

```ts
export interface ForensicsReport {
  files: FileForensics[];
  shameLeaderboard: FileForensics[];
  totalShameCommits: number;
  keywordTiers: { critical: number; moderate: number; mild: number }; // new
  byMonth: ShameByMonth[];                                              // new (see A3)
  summary: string;
}
```

`keywordTiers` counts the number of *distinct shame commits* (by hash) whose top-tier-keyword falls in each bucket. A commit that contains both "revert" and "fix" counts as **critical** (top tier wins). Aggregation happens in `analyzeForensics` while iterating `commits` — the existing `allShameHashes` `Set` already de-duplicates per-commit, we just classify each commit's max-tier alongside.

Implementation detail: `scoreMessage` in `forensics.ts:51` already returns the keywords that fired. Extend to also return the highest tier (or compute it from the keyword list against `SHAME_KEYWORDS`). Then increment the corresponding `keywordTiers` counter once per unique commit hash.

Sub-line text in the bottom panel reads as:

> `177 shame commits · 14 critical (revert/hotfix/oops) · 33 moderate (hack/workaround) · 130 mild (fix/bug)`

#### A3 — `byMonth` aggregate (Trend hero data)

Add to `ForensicsReport`:

```ts
export interface ShameByMonth {
  month: string; // ISO YYYY-MM (e.g. "2026-04")
  critical: number;
  moderate: number;
  mild: number;
}
```

Aggregation: same per-commit classification as A2, bucketed by `commit.date`'s `YYYY-MM` substring. Months with zero shame commits are still emitted (with all-zero counts) so the trend hero can render contiguous bars without gaps. The range is `min(commit.date)` → `max(commit.date)` of all *shame* commits. If no shame commits exist, `byMonth` is `[]`.

Bucket edge case: commit dates are ISO 8601 in `RawCommit` (already parsed by `git.ts`). Take `.slice(0, 7)` for the month key — no timezone math needed.

### Tier B — Hero

#### B1 — `ShameTrend.tsx` (new default hero)

New file: `apps/web/src/components/hero/ShameTrend.tsx`. Stacked vertical bar chart, one bar per `byMonth` entry, three layers per bar (mild bottom, moderate middle, critical top). Tier colors:

- `critical` → `var(--severity-critical)`
- `moderate` → `var(--severity-warning)`
- `mild` → existing `--severity-healthy` is too green — use a custom muted yellow already adjacent in the theme; pick the closest token during implementation, default fallback `#9b8b3e` if none exists.

Mechanics:

- Resize observer pattern (mirror `BlastHistogram.tsx` and `ShameLeaderboard.tsx`).
- X-axis: month labels at first and last bars only (avoids crowding); intermediate ticks if the count is ≤8 months.
- Y-axis: implicit (no axis line); tooltip on hover shows `month: YYYY-MM · critical N · moderate N · mild N · total N`.
- Empty state: `report.forensics.byMonth.length === 0` → centered "No shame commits in the analysis window."
- HeroCaption (B4) wired in below the chart.

Selection model: `ShameTrend` does not select files (no per-file granularity in this view). Click on a bar is a no-op for v1 (could later filter the Leaderboard tab to that month — out of scope).

#### B2 — `ShameLeaderboard.tsx` revised

Revisions to existing file:

- **Filter input set** to files with `shameCommitCount > 0` AND `totalCommits ≥ CONFIDENCE_FLOOR`. The component continues to consume `report.forensics.shameLeaderboard`; the floor-passing redefinition of that field lives in A1's commit (see Tier A above), so this hero just renders what core gives it.
- **Bar color = file's dominant keyword tier** (not severity bucket). Compute in `prepareShameData` by mapping `f.dominantKeywords[0]` to a tier via the same tier-classification helper used in A2/A3. This gives the hero its tier-color encoding (red/orange/yellow), the unique-to-Shame visual signal that the existing severity-by-score coloring doesn't carry.
- **Top-of-bar inline keyword text** (currently rendered when `barWidth > 60`) is preserved — extends Shame's identity.
- **HeroCaption** (B4) wired in.

#### B3 — Hero tab switcher (preset wiring)

Three changes:

1. `apps/web/src/presets/types.ts`: extend `HeroViz` union to include `'shame-trend'` (currently only `'shame-leaderboard'`).
2. `apps/web/src/presets/registry.ts:359-372` — update Shame preset:
   ```ts
   shame: {
     // ...
     hero: {
       defaultViz: 'shame-trend',
       altTabs: ['shame-trend', 'shame-leaderboard'],
     },
     // ...
   }
   ```
3. `apps/web/src/components/layout/Shell.tsx`:
   - `HERO_LABELS`: add `'shame-trend': 'Trend'`; change `'shame-leaderboard': 'Shame'` → `'shame-leaderboard': 'Leaderboard'` (now a label inside the Shame preset, "Leaderboard" reads better than the analyzer name).
   - Add a dispatch block for `'shame-trend'` mirroring the existing `'shame-leaderboard'` block (line 380).
   - Spike before committing: confirm Churn's preset entry actually has `heroLabel` set (RELIC-303 introduced the field but the implementation may have only widened the type). If yes, set `heroLabel: 'Shame — commit-message forensics'` on the Shame preset; if no, defer to follow-up so the per-preset hero-label rollout happens uniformly across analyzers.

#### B4 — `<HeroCaption>` on both Shame heroes

The shared component already exists at `apps/web/src/components/shared/HeroCaption.tsx` and is consumed by `ChurnBar.tsx` and `OwnershipBar.tsx`. Wire identical pattern (above any sticky footer if present, below the SVG container) on:

- `ShameTrend.tsx`:
  - **primary:** "One bar per month · stack = commit count by tier · color = severity"
  - **subtitle:** "Is shame trending up — and is the severity mix shifting toward worse tiers?"
- `ShameLeaderboard.tsx`:
  - **primary:** `One row per file · bar = shame score · color = dominant tier · files with ≥${CONFIDENCE_FLOOR} commits` (template literal sourced from the constant exported from `forensics.ts`)
  - **subtitle:** "Which files actually carry sustained shame, ranked by severity-weighted commit messages?"

Empty-state wording uses a parallel pair (per ChurnBar's pattern): primary unchanged, subtitle replaced with the empty explainer.

### Tier C — Bottom panel

#### C1 — `ShameTab.tsx` rewritten as `<NarrativeKPI>` consumer

Replace the existing `ShameTab` (95 lines, SortableTable-based) with a `<NarrativeKPI>` consumer mirroring `BlastRadiusTab.tsx`'s shape (which is the canonical post-RELIC-315 pattern):

```tsx
const HIGH_SHAME_THRESHOLD = 70;
const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

function tierBadge(highShameCount: number): { variant: BadgeVariant; label: string } {
  if (highShameCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highShameCount < 10) return { variant: 'warning', label: 'Moderate Shame' };
  return { variant: 'critical', label: 'High Shame' };
}
```

Composition:

- **Big number:** `highShameFiles.length` where `highShameFiles = files.filter(f => f.shameScore >= HIGH_SHAME_THRESHOLD)`. Slicing rule: `topShameFiles = highShameFiles.slice(0, TOP_FILES_COUNT)` — slice from the high-shame subset, not from the whole-repo top-10 (per the lessons-learned memory `feedback_topn_under_threshold.md` from RELIC-315 review).
- **Tier badge:** as defined above (mirrors blast-radius's absolute-count thresholds).
- **Metric label:** `Files ≥${HIGH_SHAME_THRESHOLD} Shame`.
- **Finding (right of big-number):** when `highShameFiles.length > 0`, list the top 3 files by file basename + score (e.g., `renderer.js · 87`); otherwise fallback `No files cross the high-shame threshold — commit-message hygiene is healthy.` or `No shame signals detected in the analysis window.` for fully-empty reports.
- **Subline:** `${totalShameCommits} shame commits · ${critical} critical (revert/hotfix/oops) · ${moderate} moderate (hack/workaround) · ${mild} mild (fix/bug)` with each count tier-colored. Sub-sub-line: `Across ${totalFiles} files (after min-commit-confidence floor of ${CONFIDENCE_FLOOR}).`
- **Extras:** Directory rollup of high-shame files (see C2).
- **See also:** `[ { label: 'Cursed Files', presetId: 'cursed-files' }, { label: 'Bus Factor', presetId: 'bus-factor' } ]`.

#### C2 — `shameByDirectory.ts` aggregator

New file `apps/web/src/utils/shameByDirectory.ts`. Mirror exactly the shape of `apps/web/src/utils/blastByDirectory.ts`:

```ts
export interface ShameDirectoryRow {
  directory: string;
  count: number;
  share: number; // fraction of high-shame files in this directory
}

export function aggregateShameByDirectory(
  highShameFiles: FileForensics[],
): ShameDirectoryRow[] {
  // Group by each file's immediate parent directory.
  // Sort by count desc; secondary alpha by directory name for deterministic output.
}
```

Test fixture *patterned after* `blastByDirectory.test.ts` (not lifted into a shared helper — third-consumer rule from RELIC-315 still applies). Empty input → empty array.

`BlastRadiusTab` and `ShameTab` both render the same visual shape (proportional bar + count + share), but the rendering is inline in each tab (per RELIC-315's polish — the layout is small enough that lifting to a shared component would be premature). If the third Batch 1 analyzer to use this layout (rewrite-ratio, possibly forensics future) shows up, lift then. Note in code comments above each inline render.

#### C3 — Sticky "See also" footer

Already part of the `<NarrativeKPI>` API as the `seeAlso` + `onApplyPreset` props. No new work — just pass `[Cursed Files, Bus Factor]`. The shared component takes care of stickiness.

### Tier D — Cross-cutting

#### D1 — `HeroCaption` backport to `BlastHistogram`

Wire `<HeroCaption>` into `apps/web/src/components/hero/BlastHistogram.tsx` mirroring the Churn/Bus Factor pattern:

- **primary:** "10-bin histogram · bar height = file count · color = blast tier (low/medium/high/critical)"
- **subtitle:** "What's the shape of blast risk across the repo? How many files actually carry architectural coupling?"

Empty-state subtitle parallel to ChurnBar's.

This is a regression-fix, not net-new work — but bundling it with Shame keeps the caption-pattern uniform across the four shipped polish heroes.

#### D2 — `apps/docs/analyzers/shame.md`

New documentation page following the Churn / Blast-Radius template at `apps/docs/analyzers/`. Include:

- **What it measures** — the keyword tier system (3 / 2 / 1 weights, confidence multiplier formula).
- **How to read the dashboard** — annotated screenshots of Trend hero, Leaderboard hero, and the NarrativeKPI bottom panel (each with a caption strip explanation).
- **What action it suggests** — escalation path (high-tier files → review for refactor; trend rising → retro on commit-message hygiene).
- **Limitations** — keyword matching is heuristic (false positives on unrelated uses of "fix" in branch names, etc.); confidence floor means new files take time to register signal; tier weights are tunable but not user-configurable.
- **Cross-links** — to Cursed Files, Bus Factor, and back to the Web Dashboard section.

Sidebar entry added in `apps/docs/.vitepress/config.ts` under the analyzers section, alphabetically beside Blast Radius / Churn.

### Other locked decisions

- **Tier color tokens.** Critical = `--severity-critical` (red), moderate = `--severity-warning` (orange), mild = a muted-yellow specific to Shame. If the existing palette doesn't have a clean mild-yellow variant, declare a local `--shame-tier-mild: #9b8b3e` (or final pick) in the Shame components rather than expanding the global palette.
- **No new metric tiles.** `apps/web/src/presets/metrics/shame.ts` keeps its current five tiles. The "Top Score" tile becomes informative again post-formula-fix (no longer pegged at 100). Verify against React data during smoke; if it still feels misleading, replace with `Critical (≥70)` or similar — but plan as a defer-if-needed, not a v1 ask.
- **Empty / small-repo states.** `byMonth = []` → `ShameTrend` shows centered "No shame commits in the analysis window."; `highShameFiles.length === 0` → `ShameTab` finding renders the Healthy fallback. Both states verified manually against a clean-history fixture.

## Non-decisions / acknowledged risks

- **Snapshot churn in `fixture-regression.test.ts.snap`.** The formula change moves ~10 score values in the snapshot. Regenerate via `vitest -u` and review the diff in the PR. No semantic test changes expected — the snapshot is canonical.
- **Cursed-files test impact.** `cursed-files.test.ts` mocks file forensics with `shameScore: 90` and `shameScore: 80` (lines 249, 286, 292 etc.) — these are direct mocks, not derived from the formula, so they don't break. But fixture-driven tests using actual `analyzeForensics` output may shift. Run the full core test suite and update expectations only where the formula change is genuinely the cause.
- **`mild` tier color.** A muted yellow that reads as "low concern but still flagged" on a dark-mode theme is finicky. Bench during implementation against the React fixture; iterate once before locking.
- **Trend hero on quiet repos.** A repo with 12 shame commits over 6 months looks visually sparse — fine. A repo with 0 shame commits shows the empty state, also fine. The mid case (1–2 commits per month) renders as a few thin slivers; this is honest, not broken.
- **`heroLabel` change.** Adding a Shame-specific hero label is additive and doesn't affect other presets. Skip if the per-preset heroLabel pattern wasn't fully shipped in earlier polish work — verify Churn's preset has `heroLabel` set, then mirror.
- **Backward-compat for older reports.** `apps/web/src/utils/normalizeReport.ts` already fills missing analyzer fields with empty defaults so older reports don't crash. Add `keywordTiers: { critical: 0, moderate: 0, mild: 0 }` and `byMonth: []` to its Shame default block.

## File plan

### New files

| Path | Responsibility |
|---|---|
| `apps/web/src/components/hero/ShameTrend.tsx` | Stacked tier-by-month bar chart + HeroCaption. |
| `apps/web/src/components/hero/ShameTrend.test.tsx` | Render smoke + tier coloring + bucketing + empty state. |
| `apps/web/src/components/hero/ShameLeaderboard.test.tsx` | Render smoke + tier-color encoding (tracked file: currently no test exists; add). |
| `apps/web/src/utils/shameByDirectory.ts` | High-shame directory aggregator (parallel to `blastByDirectory.ts`). |
| `apps/web/src/utils/shameByDirectory.test.ts` | Aggregation correctness + sort stability + empty input. |
| `apps/docs/analyzers/shame.md` | Per-analyzer docs page (D2). |

### Modified files

| Path | Changes (item refs) |
|---|---|
| `packages/core/src/analyzers/forensics.ts` | A1 confidence-multiplier formula · A2 keywordTiers aggregation · A3 byMonth aggregation |
| `packages/core/src/analyzers/forensics.test.ts` | A1/A2/A3 unit tests for formula behavior, tier counts, monthly bucketing |
| `packages/core/src/types.ts` | A2 add `keywordTiers` · A3 add `ShameByMonth` and `byMonth` |
| `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` | A1 regenerated score values |
| `packages/core/src/analyzers/cursed-files.test.ts` | A1 expectation tweaks if fixture-driven cases shift |
| `apps/web/src/components/hero/ShameLeaderboard.tsx` | B2 filter to floor + tier-color bars · B4 HeroCaption |
| `apps/web/src/components/hero/BlastHistogram.tsx` | D1 HeroCaption backport |
| `apps/web/src/components/tabs/ShameTab.tsx` | C1 NarrativeKPI rewrite (replaces SortableTable) |
| `apps/web/src/components/layout/Shell.tsx` | B3 dispatch `shame-trend` · HERO_LABELS update |
| `apps/web/src/presets/registry.ts` | B3 update Shame preset's `defaultViz`/`altTabs` · optional `heroLabel` |
| `apps/web/src/presets/types.ts` | B3 extend `HeroViz` union with `'shame-trend'` |
| `apps/web/src/presets/metrics/shame.ts` | None planned — verify "Top Score" tile reads sensibly post-fix; revisit only if necessary |
| `apps/web/src/utils/normalizeReport.ts` | A2/A3 default fields for missing aggregates on older reports |
| `apps/docs/.vitepress/config.ts` | D2 sidebar entry |
| `docs/polish-pattern.md` | Already updated (Shame section rewritten in this brainstorm pass) |

### Possibly modified

| Path | Notes |
|---|---|
| `apps/web/src/components/layout/Shell.test.tsx` | If existing test asserts on Shame preset's hero dispatch, update to new tokens. |
| `apps/web/src/utils/normalizeReport.test.ts` | Cover the new default fields. |

## Tests

Per CLAUDE.md (`Add tests to all changes that can benefit from tests`):

- **`forensics.test.ts`** — verify confidence multiplier behavior across thresholds (1/3/5/20 commits at varying shame ratios); verify `keywordTiers` deduplicates per commit hash and respects max-tier-wins; verify `byMonth` bucketing fills empty months between min/max; verify `byMonth = []` on a no-shame report.
- **`cursed-files.test.ts`** — re-verify shame-reason injection still triggers at the 75/50/25 thresholds (directly mocked, should not need changes; fixture-driven cases verified post-snapshot regeneration).
- **`fixture-regression.test.ts.snap`** — regenerated via `vitest -u`, diff-reviewed.
- **`ShameTrend.test.tsx`** — render smoke (3 months mock); empty-state branch; HeroCaption renders.
- **`ShameLeaderboard.test.tsx`** *(new)* — render smoke; tier-color bars assertion (each row's stroke/fill matches its dominant-keyword tier); HeroCaption renders.
- **`shameByDirectory.test.ts`** — aggregation correctness on 5-file fixture; share sums to 1.0 (within rounding); empty input → empty output; deterministic alphabetical secondary sort.
- **`ShameTab.test.tsx`** — extend if exists or add new — verify NarrativeKPI receives correct big-number, tier badge, finding, subline, extras props for representative report; verify see-also links call `onApplyPreset` with `cursed-files` and `bus-factor`.
- **`shame.test.ts` (metrics)** — re-verify after formula change; "Top Score" tile likely shifts on fixture data, update assertion.
- **`normalizeReport.test.ts`** — cover `keywordTiers` and `byMonth` defaulting on a report missing those fields.

## Out of scope, but staged

- **Trend granularity toggle** (week / quarter) — bigger UX consideration, defer.
- **`shameByDirectory` lift to shared component** — wait for the third consumer.
- **Click-on-trend-bar to filter Leaderboard** — interaction model is a separate decision; defer.
- **Custom shame-keyword config** — out-of-scope for polish; would require config plumbing through CLI/runner.
- **Score-formula auto-tuning** — `N=5` is a reasoned default; tune if React data smoke shows it's off.

## Build sequence (high-level — full plan to follow)

1. **Tier A1** — confidence-multiplier formula + floor-passing leaderboard redefinition (single backend commit; regenerate `fixture-regression.test.ts.snap` in the same commit; fix any cursed-files test fallout).
2. **Tier A2 + A3** — `keywordTiers` and `byMonth` aggregates (data plumbing + tests).
3. **`normalizeReport`** update for backward compat.
4. **Tier B1** — `ShameTrend.tsx` + tests (consumes A3).
5. **Tier B2** — revised `ShameLeaderboard.tsx` (depends on A1; consumes A2 indirectly).
6. **Tier B4** — `HeroCaption` wired into both Shame heroes.
7. **Tier B3** — preset registry / Shell.tsx wiring.
8. **Tier C2** — `shameByDirectory.ts` util + tests.
9. **Tier C1** — `ShameTab` rewrite (`NarrativeKPI` consumer).
10. **Tier D1** — `HeroCaption` on `BlastHistogram`.
11. **Tier D2** — `apps/docs/analyzers/shame.md` page + sidebar entry.
12. **Smoke pass** — React fixture + small-repo (gitrelic itself) + empty-history edge case.
13. **Final test/lint/format/build** — `pnpm test && pnpm lint && pnpm format:check && pnpm build`.

Implementation plan with bite-sized steps, expected commits per item, and verification commands will follow in `docs/superpowers/plans/2026-04-29-shame-polish.md`.
