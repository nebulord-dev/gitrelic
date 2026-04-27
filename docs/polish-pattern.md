# Bottom-Panel Pattern (Polish Initiative)

> **Scope:** Internal design doc for the Polish Initiative ([Linear project](https://linear.app/nebulord/project/polish-initiative-8fcf94923771)). Read this before polishing any analyzer's tab.

## Notes for Claude Code

A few things to keep in mind when doing the implementation work this doc describes:

**This doc is the source of truth.** Linear ticket descriptions reference it but are summaries. If a ticket and this doc disagree on a spec detail, the doc wins — and the ticket should be updated to match. If you discover the doc itself is wrong (a spec that doesn't survive contact with the code), fix the doc *first*, then the ticket.

**The Inspector is the per-file detail surface.** Easy to forget when looking at a tab in isolation. The right-side `FileInspector.tsx` already aggregates every analyzer's per-file data on click. When you find yourself thinking "but the user needs to see all the file's metrics" — they already can, on the right. Don't rebuild that in the bottom panel.

**Don't over-engineer the shared component.** `KnowledgeSilosTab.tsx` is ~60 lines. The shared `<NarrativeKPI>` (RELIC-332) should be similarly small — a layout component with a handful of props, not a framework. If the API is growing past the proposed shape in the ticket, push back: you may be solving a problem we don't actually have.

**Tests should match the existing pattern, not invent new ceremony.** Look at neighboring `*.test.ts` and `*.test.tsx` files. Backend additions (`keywordTiers`, `totalInsertions`/`totalDeletions`) get unit tests against the existing test fixtures in `forensics.test.ts` / `rewrite-ratio.test.ts`. The shared `<NarrativeKPI>` component gets a render test covering tier rendering, optional fields, and the `onApplyPreset` callback firing. That's it — don't add visual regression infra unless it already exists.

**Watch the Knowledge Silos visual.** When refactoring `KnowledgeSilosTab.tsx` to consume the shared component (RELIC-332's DoD), the rendered output should be byte-identical to before. Spacing, padding, font weights, severity colors. If something shifts visually, that's a regression — either the shared component is missing a prop or the original tab had inline styles that didn't survive the lift.

**The "see also" footer is sticky for a reason.** The existing one in `ChurnTab.tsx` is buried below a long scrolling table — Dan didn't even know it existed until reviewing the code for this doc. Don't recreate that mistake. Sticky to the bottom of the bottom-panel area, always visible.

**Pre-1.0 versioning rules apply.** Any commit messages with `feat:` get a minor bump, `feat!:` is reclassified to minor (not major) by `.releaserc.json`. See CLAUDE.md "Releases & Versioning" section. Don't let semantic-release jump to 1.0 by accident.

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

Reference implementation: `apps/web/src/components/tabs/KnowledgeSilosTab.tsx` (~60 lines, prop-driven, no SortableTable).

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

The four analyzers in Batch 1 all share the "table is rotated hero" pathology. All four get narrative-KPI bottom panels.

### `churn`

- **Bottom panel:** Narrative-KPI.
- **Big number:** Top file's % of all commits (already in `summary`).
- **Sub-content:** Category-count breakdown (`98 hot · 442 warm · 1,253 cold · 999 frozen` — derived from existing `category` field).
- **Optional secondary visual:** Horizontal stacked bar showing the four category counts as proportions. Cheap, tells the distribution story the hero hides.
- **See also:** Hotspots, Cursed Files.
- **Backend changes:** None.
- **Removes:** ChurnTab's cross-analyzer table-building (loc + bus factor + age map join, ~90 lines). All of it is in the Inspector already.

### `forensics` (Shame tab)

- **Bottom panel:** Narrative-KPI.
- **Big number:** Top file's shame score (out of 100).
- **Sub-content:** Keyword tier breakdown — `442 shameful commits across 1,063 files: X critical (revert/hotfix/oops), Y moderate (hack/workaround), Z mild (fix/bug)`. The tier system is unique to this analyzer; surfacing it is the *interesting* angle.
- **See also:** Cursed Files, Bus Factor.
- **Backend changes:** Add `keywordTiers: { critical: number; moderate: number; mild: number }` aggregate to `ForensicsReport`. ~10 lines in `forensics.ts`.

### `blast-radius`

- **Bottom panel:** Narrative-KPI.
- **Big number:** Count of high-blast files (already computed as `highBlast`, ≥70 threshold).
- **Sub-content:** `summary` string + top file's avg co-change count.
- **Optional secondary visual:** Distribution histogram of blast scores. The hero scatter shows cluster shape; the histogram quantifies it. Skip if budget tight.
- **See also:** Coupling, Hotspots.
- **Backend changes:** None.

### `rewrite-ratio`

- **Bottom panel:** Narrative-KPI.
- **Big number:** Count of high-rewrite files (already computed as `highRewrite`, ≥70 threshold).
- **Sub-content:** Repo-wide insertion/deletion totals — *"This repo has written X lines and deleted Y — net +Z, with N% of files showing balanced rewrite (ratio > 0.5)."* The aggregate angle is unique to this analyzer.
- **See also:** Churn, Hotspots.
- **Backend changes:** Add `totalInsertions: number` and `totalDeletions: number` to `RewriteRatioReport`. Trivially derivable from existing `fileStats` map; ~3 lines.

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
