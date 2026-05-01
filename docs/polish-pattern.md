# Bottom-Panel Pattern (Polish Initiative)

> **Scope:** Internal design doc for the Polish Initiative ([Linear project](https://linear.app/nebulord/project/polish-initiative-8fcf94923771)). Read this before polishing any analyzer's tab.

## How to read this doc

**This is a high-level overview, not a binding spec.** Each polish session opens the analyzer in the rendered dashboard against real data (typically the React repo), audits *every* surface — hero(es), metrics strip, big number, narrative-KPI, scoring formula, Inspector overlap, bottom panel, extras slot — and proposes whatever changes make it a *great* analyzer. That can include ignoring or contradicting the per-analyzer recommendation below.

A few sessions have already proven this:

- **Churn (RELIC-303)** flipped from narrative-KPI to a directory-rollup table after we saw the metrics strip already showed the narrative-KPI numbers.
- **Blast Radius (RELIC-315)** collapsed three heroes into one histogram, added an `extras` slot to `NarrativeKPI` (reversing RELIC-332's "no extras" decision), and rewrote its sub-content based on what fit visually.
- **Shame** revealed that the per-file score formula itself produces top-of-leaderboard noise on real data, expanding scope from "replace the bottom table" to "rethink the hero, the formula, and the KPI."

**The mapping below is a starting heuristic.** When you discover the right design is different, build the right design — and update this doc *first*, then the ticket.

## Notes for Claude Code

A few things to keep in mind when doing the implementation work this doc describes:

**This doc is the source of truth.** Linear ticket descriptions reference it but are summaries. If a ticket and this doc disagree on a spec detail, the doc wins — and the ticket should be updated to match. If you discover the doc itself is wrong (a spec that doesn't survive contact with the code), fix the doc *first*, then the ticket.

**The Inspector is the per-file detail surface.** Easy to forget when looking at a tab in isolation. The right-side `FileInspector.tsx` already aggregates every analyzer's per-file data on click. When you find yourself thinking "but the user needs to see all the file's metrics" — they already can, on the right. Don't rebuild that in the bottom panel.

**Don't over-engineer the shared component.** `KnowledgeSilosTab.tsx` is ~60 lines. The shared `<NarrativeKPI>` (RELIC-332) should be similarly small — a layout component with a handful of props, not a framework. If the API is growing past the proposed shape in the ticket, push back: you may be solving a problem we don't actually have.

**Tests should match the existing pattern, not invent new ceremony.** Look at neighboring `*.test.ts` and `*.test.tsx` files. Backend additions (`keywordTiers`, `totalInsertions`/`totalDeletions`) get unit tests against the existing test fixtures in `forensics.test.ts` / `rewrite-ratio.test.ts`. The shared `<NarrativeKPI>` component gets a render test covering tier rendering, optional fields, and the `onApplyPreset` callback firing. That's it — don't add visual regression infra unless it already exists.

**Watch the Knowledge Silos visual.** When refactoring `KnowledgeSilosTab.tsx` to consume the shared component (RELIC-332's DoD), the rendered output should be byte-identical to before. Spacing, padding, font weights, severity colors. If something shifts visually, that's a regression — either the shared component is missing a prop or the original tab had inline styles that didn't survive the lift.

**The "see also" footer is sticky for a reason.** The existing one in `ChurnTab.tsx` is buried below a long scrolling table — Dan didn't even know it existed until reviewing the code for this doc. Don't recreate that mistake. Sticky to the bottom of the bottom-panel area, always visible.

**Pre-1.0 versioning rules apply.** Any commit messages with `feat:` get a minor bump, `feat!:` is reclassified to minor (not major) by `.releaserc.json`. See CLAUDE.md "Releases & Versioning" section. Don't let semantic-release jump to 1.0 by accident.

NOTE FROM DAN: I added a `polish-tasks.md` to `/docs` to go over the things that extend the Linear stories.  Please review it.

## Why this doc exists

The dashboard ships a single template across all 22 analyzers: `[hero viz on top] + [SortableTable below]`. After polishing Bus Factor and Churn it became clear the table is often nearly redundant with the hero — same columns, same rows, just rotated. This doc maps each analyzer to a deliberate bottom-panel form so polish tickets execute it instead of re-litigating it.

The parent ticket is [RELIC-331](https://linear.app/nebulord/issue/RELIC-331).

## The Inspector already exists

Critical context that informs everything below: `apps/web/src/components/inspector/FileInspector.tsx` already aggregates every analyzer's per-file data into a single right-side panel that opens when a row is clicked. That means **per-file detail is already covered**. When a bottom-panel table just rotates the hero's data, it's not adding a third dimension — it's a worse version of what the Inspector already does on click.

This shifts the bottom-panel question from *"how do we show file detail?"* to *"what story is missing from the hero?"*

## Bottom-panel forms

| Form | Right when... |
|---|---|
| **Narrative-KPI** | The aggregate story matters more than the row-by-row. Big number + tier badge + one-sentence finding. Pattern lives in `KnowledgeSilosTab.tsx`. |
| **Table (SortableTable)** | The bottom is a *different unit of analysis* from the hero (e.g., per-language table under a per-directory hero) OR the columns carry explanatory chips the hero can't (e.g., Cursed Files' REASONS). |
| **Distribution histogram** | Hero is top-N and the long tail matters. |
| **Time-series** | Aggregate metric over months tells the story. |
| **Smaller multiples** | Per-file rhythm pattern is the point. |
| **Comparison view** | Comparing 2–3 files across metrics is the point. |
| **Companion analyzer** | A neighborhood from a related view earns its space. |

Default to **narrative-KPI** when in doubt. The hero shows the ranked list; the Inspector shows per-file detail; narrative-KPI shows the *aggregate truth* — which is the one slot the other two surfaces don't fill.

## The narrative-KPI pattern

Reference implementation: `apps/web/src/components/shared/NarrativeKPI.tsx` (the shared layout). Reference consumer: `apps/web/src/components/tabs/KnowledgeSilosTab.tsx`.

Anatomy:

1. **Big number (left)** — severity-colored, mono font, one decisive metric. Examples: top file's % share, count of high-tier files, concentration index.
2. **Tier badge** — under the number. Healthy / Moderate / Critical (or analyzer-specific labels). Threshold-driven.
3. **Small uppercase label** — under the badge. Names what the number means.
4. **Right side: one-sentence finding** — leads with a bolded number that supports the headline KPI. Comes from the analyzer's existing `summary` field where possible.
5. **Sub-line** — analyzer's secondary `summary` text or a derived breakdown (tier counts, etc.).
6. **Sticky "See also" footer** — links to 2 related analyzers via `onApplyPreset(...)`. Sticky to the bottom of the bottom-panel area, not buried below a scrolling list. (See "Footer pattern" below.)

A shared `<NarrativeKPI>` component should be lifted from `KnowledgeSilosTab.tsx` into `apps/web/src/components/shared/`. Filed as [RELIC-332](https://linear.app/nebulord/issue/RELIC-332) — blocks all four Batch 1 polish tickets.

## Footer pattern (sticky "See also")

Discovered while reviewing `ChurnTab.tsx`: the existing "See also" link footer is buried at the bottom of a long scrolling table — easy to miss entirely. **Make it sticky to the bottom of the panel** so it's discoverable without scrolling. Applies to every bottom panel (narrative-KPI or otherwise).

Two related-analyzer links per footer. Per-analyzer choices are listed in the mapping below.

## Existing data, currently unused

Every analyzer's report already produces:
- A `summary` string (e.g., Churn's `"renderer.js has been modified in 8% of all commits"`)
- Aggregate counts (`hotspotCount`, `highBlast`, `highRewrite`, etc.)
- Tier/category enums with explicit thresholds

**The frontend doesn't use any of this.** Adopting narrative-KPI surfaces it for free.

## Mapped so far (Batch 1)

The four analyzers in Batch 1 all share the "table is rotated hero" pathology. Three of them (`forensics`, `blast-radius`, `rewrite-ratio`) get narrative-KPI bottom panels. **`churn`** moved to a directory roll-up table after evaluating against the rendered Churn page — its candidate narrative-KPI numbers (`Top File Commits`, `Top File Share`) are already shown in the metrics strip, leaving the directory lens as the only churn-specific story the screen doesn't already tell.

> **Hero scope creep is OK when warranted.** Originally Batch 1 was scoped strictly to bottom-panel work. `blast-radius` widened it: a forensic look at the three hero views found that two were redundant with other analyzers (Scatter ↔ Hotspots, Coupling ↔ Coupling) and the third had a structural diagonal artifact. Replacing all three with a single distribution histogram fell out naturally from the narrative-KPI work. Future polish tickets should ask the same value question per `polish-tasks.md` — *"is each hero pulling its weight?"* — before defaulting to the doc's bottom-panel-only scope.

### `churn` *(shipped — RELIC-303)*

- **Bottom panel:** Table (directory roll-up), **split into two BottomTabs** sharing one component (`Churn` / `Test Files`). Different unit of analysis from the per-file hero — answers "where in the codebase does churn live?" — and isolates source-vs-test churn so neither story drowns out the other.
- **Columns:** Directory · Commits · Share (% of all repo commits) · Files · Top file.
- **Aggregation:** Group by each file's immediate parent directory; sort by total commit count desc; show top ~10. Same util feeds both tabs with a path-classifier pre-filter.
- **Test classification:** `apps/web/src/utils/isTestPath.ts` — segments `__tests__/`, `__snapshots__/`, `__fixtures__/`, `tests/`, `cypress/`; basename patterns `.test.`, `.spec.`. Conservative; designed to be liftable to core later as a repo-level `testPaths` config that other analyzers (test-coverage, age-map, complexity-trend, blast-radius) can share.
- **Why not narrative-KPI:** the metrics strip already shows `Top File Commits` and `Top File Share` — a narrative-KPI would be a third copy of the same number. Inspector already shows per-file detail (LOC, authors, age, category). The per-directory lens is the only one missing from the screen.
- **Why split tabs not filter:** test-heavy repos (React's `__tests__/fixtures/compiler` at 24% / 984 files) drown out the source story when conflated. Splitting preserves both signals without forcing a global filter decision.
- **See also:** Hotspots, Cursed Files. Sticky to the bottom of the panel.
- **Backend changes:** None — derived from `report.churn.files[]` in the frontend.
- **Removes:** ChurnTab's per-file SortableTable + cross-analyzer join (loc + bus factor + age map, ~90 lines). All redundant with the Inspector.

### `forensics` (Shame tab) *(shipped — RELIC-308)*

- **Bottom panel:** Narrative-KPI.
- **Big number:** Files with `shameScore ≥ 70` (post-formula-fix). Tier badge thresholds **0 = Healthy · 1–9 = Moderate · 10+ = High Shame** — mirrors blast-radius's absolute-count thresholding so the headline is comparable across analyzers.
- **Sub-content:** `N` shame commits — **X** critical (revert/hotfix/oops) · **Y** moderate (hack/workaround) · **Z** mild (fix/bug). The tier weighting is unique to this analyzer; the subline carries it. Sub-line beneath: total file count after the min-commit-confidence floor.
- **Extras (`NarrativeKPI.extras` slot):** "Where they live" — top-5 directory rollup of the high-shame (`≥70`) files (same shape as blast-radius). Each row: parent directory · proportional bar · file count · share %. New aggregator at `apps/web/src/utils/shameByDirectory.ts`.
- **Hero:** **Two tabs** sharing one component — `Trend` (default) + `Leaderboard` (alt). Forensic look at the existing leaderboard against React data revealed every entry tied at score 100, because the score formula `(rawShamePoints / totalCommits) × 100` sets a single-commit YAML with one "fix" keyword to 100. Polish therefore expanded scope to include a formula fix and an alternative hero.
  - **Trend (default):** stacked-bar by month, three layers per bar (critical · moderate · mild commit counts), tier-colored. Answers the temporal question — *is shame trending up, and is the severity mix shifting toward worse tiers?* — that nothing else on the screen surfaces.
  - **Leaderboard (alt):** revised version of the existing horizontal bar leaderboard, filtered to files passing the confidence floor, with bar color encoding the file's dominant keyword tier (red/orange/yellow). Answers *which files actually carry sustained shame?*
- **Hero captions:** wired into both Shame heroes via the existing shared `<HeroCaption>` (already used by `ChurnBar` / `OwnershipBar`). Backport: same caption strip is **also added to `BlastHistogram`** in this PR — it shipped without one in RELIC-315 and the missing caption is a regression against the Churn/Bus Factor pattern.
- **See also:** Cursed Files, Bus Factor. Sticky to the bottom of the panel.
- **Backend changes:**
  - Add `keywordTiers: { critical: number; moderate: number; mild: number }` aggregate to `ForensicsReport` (commit-level counts).
  - Add `byMonth: Array<{ month: string; critical: number; moderate: number; mild: number }>` aggregate to `ForensicsReport` for the Trend hero.
  - **Score formula fix:** confidence multiplier — `shameScore = round(rawScore × min(1, totalCommits / 5))`. Sub-floor files get scaled down proportionally (1-commit YAML drops from 100 to 20) instead of zeroed out. Cursed-files' existing 75/50/25 thresholds keep meaning the same thing.
- **Downstream effects:** `fixture-regression.test.ts.snap` regenerates (~10 score updates); `cursed-files.test.ts` may need expectation tweaks if any test fixture has <5 commits.
- **Removes:** ShameTab's per-file SortableTable (~95 lines). Inspector + leaderboard-hero already cover per-file detail.

### `blast-radius` *(shipped — RELIC-315)*

- **Bottom panel:** Narrative-KPI.
- **Big number:** Count of files with `blastScore` ≥ 70. The analyzer computes this inline in its `summary` string (`packages/core/src/analyzers/blast-radius.ts`) but doesn't expose it on `BlastRadiusReport`; the tab filters `report.blastRadius.files` itself. One-liner, no backend change needed.
- **Tier thresholds:** 0 = Low Risk, 1–9 = Moderate Risk, 10+ = High Risk. Absolute count (not proportional) — architectural load-bearers are uncommon in any repo size, so absolute thresholds are easier to reason about.
- **Sub-content:** Top **three** blast files (file basename + avg / peak) as the finding; **tier mix** breakdown (low/medium/high/critical counts) as the subline. The original spec called for "summary string + top file's avg co-change count," but a forensic look at the rendered panel showed (a) the analyzer's summary just rephrased the big number and (b) the panel had real estate to surface more files than the headline. Top-3 + tier mix density-up the panel without overstepping the Inspector's per-file detail surface.
- **Extras (`NarrativeKPI.extras` slot):** "Where they live" — top-5 directory rollup of the high-blast (`≥70`) files. Each row: immediate parent directory · proportional bar · count · share % of all high-blast files. Aggregator at `apps/web/src/utils/blastByDirectory.ts`. Answers the "if I want to reduce blast radius, where do I look?" question that the histogram (distribution shape), top-3 (per-file worst), and Inspector (per-file detail) can't.
- **NarrativeKPI shared component change:** Added an optional `extras?: ReactNode` slot, rendered full-width between the kpi-row and the sticky see-also footer. Reverses the original RELIC-332 "no extras slot" decision after seeing the rendered panel — a forensic look against React data showed substantial vertical empty space below the KPI/finding/subline row, and the directory rollup couldn't fit in `subline`'s 400px constrained width. Other Batch 1 analyzers (forensics, rewrite-ratio) may opt in similarly when they have analyzer-specific drill-downs that don't fit the constrained subline; canonical sparse layout (Knowledge Silos) leaves it `undefined` and renders identically to before.
- **Hero:** Collapsed from three views (Blast scatter / Scatter / Coupling) down to a **single distribution histogram** of blast scores, 10 bins of width 10, colored by tier of bucket midpoint, with the ≥70 zone shaded and labeled. The original Blast scatter had a structural diagonal (`blastScore = avg / maxAvg × 100` — x and y axes were the same number rescaled); the alt-tab Scatter duplicated Hotspots' churn × LOC; the alt-tab Coupling duplicated the Coupling analyzer's hero. Histogram answers the only question those three didn't: *what's the distribution shape of blast risk in this repo?*
- **See also:** Coupling, Hotspots.
- **Backend changes:** None.

### `rewrite-ratio` *(shipped — RELIC-314)*

- **Bottom panel:** Narrative-KPI.
- **Big number:** `report.rewriteRatio.highRewrite` — count of files with `rewriteScore ≥ 70` after the formula fix (see below). Now exposed on the report; previously computed inline in the summary string only.
- **Tier thresholds:** 0 = Healthy · 1–4 = Moderate · 5+ = High Rewrite. Tighter than Blast (1–9 / 10+) because rewrite-heavy files are usually fewer per repo.
- **Sub-content:** Top **three** high-rewrite files (basename + `+ins / −del`) as the finding, sliced from the threshold-filtered subset (per RELIC-315 lesson). Subline: repo balance — *"+X / −Y · net +Z · N% of files balanced (ratio > 0.5)"* — the aggregate growth-vs-rewrite angle unique to this analyzer.
- **Extras (`NarrativeKPI.extras` slot):** "Where they live" — top-5 directory rollup of the high-rewrite files. Aggregator at `apps/web/src/utils/rewriteByDirectory.ts`. Same shape as Blast Radius and Shame — three Batch 1 panels now share one layout.
- **Hero:** Two views — `Rewrites` (default `RewriteDivergingBar`, top-30 by score) + `Distribution` (new `RewriteHistogram`, mirrors `BlastHistogram` 1:1 with 10 bins, ≥70 zone shaded). Dropped the previous `Scatter` alt-tab (was wired to `HotspotScatter` — a pure dup of the Hotspots default hero) and `Debt` alt-tab (was wired to `DebtScatter` — owned by the Tech Debt curated dashboard, not rewrite-ratio's territory). Same "two redundant alts" pathology blast-radius had.
- **HeroCaption backport:** added to `RewriteDivergingBar` (was missing — backport-style fix paralleling the BlastHistogram caption added during RELIC-308).
- **See also:** Churn, Hotspots.
- **Backend changes:**
  - **Score formula fix:** confidence multiplier — `rewriteScore = round(rawScore × min(1, min(ins, del) / 30))`. The smaller side of the diff IS the rewrite signal, so it's the analyzer-specific confidence basis. `+1/-1` files no longer tie with `+116/-116` at 100. Mirrors Shame's `min(1, totalCommits / 5)` precedent. Snapshot regenerates (`fixture-regression.test.ts.snap`); cursed-files unaffected (it doesn't consume `rewriteScore`).
  - **Three new aggregates** on `RewriteRatioReport`: `totalInsertions`, `totalDeletions` (repo-wide), and `highRewrite` (count of files ≥70).
- **Metrics-strip slot 2 fix:** replaced misleading `High Rewriters` (which used `topRewriters.length`, capped at 10) with `Files ≥70` (sourced from the new `highRewrite` aggregate). Severity bands match the panel's tier badge (0 / 1–4 / 5+).
- **Scope expansion:** Like blast-radius, the polish ticket exceeded its original bottom-panel-only spec — a forensic look at the rendered Rewrite Ratio tab against React data revealed every top-30 score tied at 100 (formula bug) and two of three alt-tabs duplicating other analyzers' heroes (hero audit). Same "*hero scope creep is OK when warranted*" precedent.
- **Removes:** `RewriteRatioTab`'s per-file `SortableTable` (~107 lines). Inspector + diverging-bar already cover per-file detail.

## Pending (Batches 2–N)

Not yet decided. Will be filled in as each batch is worked through. Listed here so the doc is honest about what's done vs. open.

| Analyzer | Batch | Notes from initial screenshot review |
|---|---|---|
| `bus-factor` | TBD | Bus Bar view falls in same "rotated hero" bucket as Batch 1 — likely also narrative-KPI. RELIC-304 was prematurely marked Done; pulled back to Todo. |
| `parallel-dev` | 2 | Shares both views (Swimlanes + Timeline) with `commit-timing`. Merge-or-keep-separate decision tracked in [RELIC-333](https://linear.app/nebulord/issue/RELIC-333) — resolve before this analyzer's polish ticket. |
| `commit-timing` | 2 | See above — [RELIC-333](https://linear.app/nebulord/issue/RELIC-333) blocks. |
| `co-author` | 2 | Empty on react repo; needs empty-state pass. |
| `knowledge-concentration` (Knowledge Silos) | — | Already shipped. Reference implementation. |
| `ghost-files` | 3 | Same sunburst as Knowledge Silos. Likely narrative-KPI. |
| `contributors` | 3 | Sunburst is one of three views. Bottom table earns space (per-contributor vs hero per-directory). |
| `cursed-files` | TBD | Bottom table earns space (REASONS chips). Probably keeps current form. |
| `age-map` | TBD | Treemap hero. Generic table — likely narrative-KPI. |
| `test-coverage` | TBD | Treemap. Bottom table earns space (different unit). |
| `loc` (Languages) | TBD | Stacked bars. Bottom table earns space (per-language vs per-directory). |
| `hotspot` | TBD | Strong scatter hero, signals chips earn table's space. Probably keeps. |
| `coupling` | TBD | Matrix heatmap. Bottom shows same-dir pairs vs hero's cross-dir — earns space. |
| `churn-velocity` | TBD | Not screenshotted yet. |
| `dead-code` | TBD | Not screenshotted yet (Stale Files in screenshots may be related). |
| `hotspot-clustering` | TBD | Not screenshotted yet. |
| `complexity-trend` | TBD | Multi-line time series. Bottom table earns space (precise growth numbers). |
| `rename-tracking` (Renames) | TBD | Sankey hero; bottom table redundant. Likely narrative-KPI. |

## What this changes for polish tickets

Each Batch 1 polish ticket gets a sharper definition-of-done than the original generic checklist:

- Hero graph(s) — verify metric/granularity/legend
- Bottom panel — replace SortableTable with narrative-KPI per spec above
- Sticky "See also" footer with the two analyzers listed above
- Backend additions where noted
- Empty / small-repo / huge-repo states
- Copy pass

**Batch 1 tickets depend on [RELIC-332](https://linear.app/nebulord/issue/RELIC-332) (shared `<NarrativeKPI>` component) being completed first.**

## When to update this doc

- After each batch of polish tickets ships, move analyzers from "Pending" to a new "Mapped" section.
- If a polish ticket discovers the spec is wrong, update the doc *first*, then the ticket.
- New patterns (a sixth bottom-panel form, a different footer style, etc.) get added to the forms table.
