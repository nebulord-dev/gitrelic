# Hero Visualization Differentiation

**Date:** 2026-04-24
**Status:** Deferred backlog item — open after the preset initiative settles
**Tracked in git as of 2026-04-24** (PR #39 un-ignored `docs/` alongside adding this file).

## Problem

The analyzer-presets initiative (PRs #27–#38) gave every analyzer a sidebar entry and a metric strip. But many analyzers point at heroes that don't tell the analyzer's specific story. The user called this out while running GitRelic on Sickbay:

> Several of the analyzers show the same chart/graph. The Test Coverage analyzer just shows the main treemap, so I'm thinking that's the fallback graph, whereas Rewrite Ratio shows the same chart as Hotspots.

The plan document (`docs/superpowers/plans/2026-04-22-analyzer-presets.md` §Appendix) anticipated this and proposed adding a `colorBy` prop to `ChurnTreemap` for treemap-based presets. That polish was deferred and never shipped.

## Current state

### Real reuse with unique stories (fine as-is)
| Analyzer | Hero | Story told |
|---|---|---|
| Coupling | `coupling` heatmap | Pair-matrix, unique |
| Commit Timing | `timeline` | Late-night/weekend bands |
| Parallel Dev | `swimlanes` | Weekly multi-author overlap |
| Contributors | `ownership` bubble | Per-author file counts |
| Ghost Files | `ownership-sunburst-ghosts` | Author ring + filtered files (mode prop) |
| Co-Authors | `author-force-graph` | Collaboration network |
| Shame | `shame-leaderboard` | File shame scores |
| Renames | `rename-sankey` | Historical rename chains |

### Genuine mismatches (hero doesn't show the analyzer's data)

| Analyzer | Current hero | Problem | Proposed |
|---|---|---|---|
| **Test Coverage** | `treemap` (churn) | Shows churn, not coverage | Treemap colored by per-directory test-file ratio (red = uncovered) |
| **Languages** | `treemap` (churn) | Shows churn, not language mix | Treemap colored by language, sized by LOC |
| **Age Map** | `treemap` (churn) | Shows churn, not age | Treemap colored by last-commit-age gradient |
| **Rewrite Ratio** | `scatter` (churn × LOC) | Hotspot axes, not rewrite axes | Diverging bar chart: insertions right / deletions left per file |
| **Dead Code** | `scatter` (churn × LOC) | Hotspot axes, not stillness | Scatter of churn × days-since-last-touch, or a time-bucketed bar |
| **Blast Radius** | `scatter` (churn × LOC) | Hotspot axes, not cascade | Scatter of blast-score × co-changed-file-count |
| **Bus Factor** | `risk-heatmap` | Shared with Cursed Files | Dominant-author horizontal bar of critical files |
| **Knowledge Silos** | `ownership-sunburst` | Shared with Ghost Files base | Sunburst filtered to single-author files (same `mode` pattern) |

### Somewhat-okay reuse (defensible, minor polish desirable)
- **Cursed Files** and **Hotspots** both default to `risk-heatmap`. Defensible since cursed = hotspot + ownership + age. Cursed Files could default to `treemap` (alt `risk-heatmap`) to separate visually.
- **Tech Debt** and **Complexity Trend** both default to `growth-timeline`. Tech Debt is a dashboard overview so showing growth is fine; Complexity Trend could zoom in on "accelerating" files specifically.

## Proposed approach

### Pass 1 — `ChurnTreemap` `colorBy` prop (the deferred appendix item)

**Scope:** one PR.

Add a `colorBy?: 'churn' | 'age' | 'language' | 'test-proximity' | 'shame'` prop to `ChurnTreemap`. Default stays `churn`. Each mode maps a different per-file attribute from the report onto the cell fill color.

**Fixes:** Test Coverage, Languages, Age Map. Also gives Shame a secondary alt-viz for free.

**Wiring:** each affected preset's `hero.defaultViz` stays `'treemap'` but the preset gains a `heroOptions?: { treemapColorBy: ... }` field. The Shell hero switch passes the option through. Alternatively, introduce distinct HeroViz tokens (`treemap-age`, `treemap-language`, `treemap-test`) and route each in Shell — same pattern we used for `ownership-sunburst-ghosts`. The token approach matches how heroes are switched today; prefer it over new preset-level config surface.

**Effort:** 4–6 hours. Needs a `colorBy` palette per mode, a unit test per transform, and four preset registry tweaks.

### Pass 2 — Targeted charts for the remaining gaps

**Scope:** one PR per preset. Each introduces a new `HeroViz` token and a new hero component.

Priority order (by impact on data fidelity):

1. **Rewrite Ratio** — `rewrite-diverging-bar`. Files ranked by rewrite ratio, horizontal bars with deletions left of zero-axis and insertions right. Very different visual story from a scatter.
2. **Dead Code** — `staleness-scatter`. X = days since last touch, Y = LOC. Files in the upper-right are ancient but large (real dead-code candidates).
3. **Blast Radius** — `blast-scatter`. X = blast score, Y = commit co-change count. Replaces the generic churn×LOC scatter.
4. **Bus Factor** — `ownership-bar`. Horizontal bars per critical file showing dominant-author percentage, colored by risk tier.
5. **Knowledge Silos** — `ownership-sunburst` with a `mode="single-author"` filter, matching Ghost Files' pattern. No new component.

**Effort:** 1–2 hours per preset for items 1–4 (straightforward SVG or d3-shape primitives, no new deps). Item 5 is ~30 minutes since it reuses `OwnershipSunburst`.

Each PR follows the appendix per-PR recipe (widen HeroViz union, build hero, wire Shell, update HERO_LABELS, typecheck + test).

### Out of scope for this initiative

- Redesigning the three Tier-1 dashboard modes (Overview / Risk / Tech Debt)
- Adding Tier-3 group-level presets (Code Health / Ownership & Risk / ...)
- Bundle-size-sensitive new deps — prefer SVG + existing d3 packages

## Open questions

1. Single PR per hero vs batch PRs? Batching Pass 1 makes sense (one `colorBy` prop, many consumers). For Pass 2, each hero is independent so separate PRs are fine.
2. Should `ChurnTreemap` be renamed given it's no longer just-churn? Low priority; can rename later or leave.
3. Is there value in a `HeroViz` → default preset mapping as a contract test, to catch accidental reuse of a hero by two presets that need separate stories? Probably yes, but scope-creep for this initiative.

## How to pick this up in a future session

1. Prime the codebase (`/prime`).
2. Open this spec.
3. Choose Pass 1 or Pass 2; if Pass 1, start by reading `apps/web/src/components/hero/ChurnTreemap.tsx` and the test-coverage preset wiring.
4. Use the per-PR recipe in `docs/superpowers/plans/2026-04-22-analyzer-presets.md` §Appendix.

## Related

- `docs/superpowers/plans/2026-04-22-analyzer-presets.md` — the parent initiative. Appendix §2 explicitly mentions `ChurnTreemap` color-by variants.
- PRs #27 through #38 — the 4 phases of the preset initiative that landed.
