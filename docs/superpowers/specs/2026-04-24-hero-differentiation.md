# Hero Visualization Differentiation

**Date:** 2026-04-24
**Brainstormed:** 2026-04-25
**Status:** Approved — implementation plan to follow
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

### Mismatches addressed by this initiative
| Analyzer | Current hero | Resolution |
|---|---|---|
| Test Coverage | `treemap` (churn-colored) | New token `treemap-test` (binary tested/untested) as primary; new `test-coverage-by-dir` chart as alt |
| Languages | `treemap` (churn-colored) | New bespoke `languages-stacked` (rows = directories, segments = language LOC) as primary; treemap-by-language *not* shipped (color alone doesn't tell the language story) |
| Age Map | `treemap` (churn-colored) | New token `treemap-age` (last-commit-age gradient) as primary |
| Rewrite Ratio | `scatter` (shared with Hotspots) | New `rewrite-diverging-bar` (insertions right of axis, deletions left) |
| Dead Code | `scatter` (shared with Hotspots) | New `staleness-scatter` (X = days since last touch, Y = LOC) |
| Blast Radius | `scatter` (shared with Hotspots) | New `blast-scatter` (X = blast score, Y = co-changed file count) |
| Bus Factor | `risk-heatmap` (shared with Cursed Files) | New `ownership-bar` (rows = critical files, bar = dominant-author share) |
| Knowledge Silos | `ownership-sunburst` (shared family) | New token `ownership-sunburst-silos` reusing `OwnershipSunburst` with `mode="single-author"` |
| Cursed Files | `risk-heatmap` (shared with Hotspots) | Default flips to `treemap` (the new churn-colored version); `risk-heatmap` stays as alt |

### Defensible reuse left alone
- **Tech Debt** + **Complexity Trend** both default to `growth-timeline`. Tech Debt is a dashboard overview where growth is the lead story; Complexity Trend zooms the same data per file. Acceptable.
- **Hotspots** keeps `risk-heatmap` as default — now uniquely, after Cursed Files flips to `treemap`.

## Decisions

### Wiring: distinct `HeroViz` tokens

Each new color mode and bespoke hero gets its own token. The `HeroViz` union grows from 15 → 24 entries. Nine new tokens:

```
treemap-age
treemap-test
rewrite-diverging-bar
staleness-scatter
blast-scatter
ownership-bar
ownership-sunburst-silos
languages-stacked
test-coverage-by-dir
```

Each token gets:
- A `HERO_LABELS` entry (TS `Record<HeroViz, string>` enforces coverage).
- A Shell `selection.activeHeroViz === '...'` branch (~5 lines per).
- A slot in the owning preset's `defaultViz` or `altTabs`.

No new config surface on `PresetDefinition`. The pattern matches the existing `ownership-sunburst-ghosts` precedent: same component, different prop, distinct token.

**Rejected: `colorBy` prop on `PresetDefinition`.** Adding `heroOptions: { treemapColorBy: ... }` to presets would diverge from the established pattern, complicate alt-tab differentiation (e.g., showing both treemap-churn and treemap-age as alt-tabs), and add a config surface for no real benefit.

### Pass 1 — `ChurnTreemap` `colorBy` modes (one PR)

`ChurnTreemap.tsx` gains `colorBy?: 'churn' | 'age' | 'test-proximity'` (default `'churn'`). A `colorByMode` table inside the component maps each mode to a `(file, report) => string` color function plus a legend definition.

| Token | colorBy | Source field | Legend |
|---|---|---|---|
| `treemap` (existing) | `churn` | `hotspots.files[].category` | critical / high / med / low |
| `treemap-age` *(new)* | `age` | `ageMap.files[].lastCommitAge` (days, bucketed) | fresh / recent / aging / stale |
| `treemap-test` *(new)* | `test-proximity` | `testCoverage.files[].hasTestSibling` (binary) | tested / untested |

**Tiny-cell rule:** treemap encoding is color-only. No text labels at small sizes. This rules out three-state encodings that would need text disambiguation (e.g., partial-coverage). Test-coverage encoding stays binary.

**Languages does not get a colorBy mode.** Color alone on a treemap doesn't tell the language story — the relevant question is "what languages live where," and a categorical fill on a churn-shaped treemap doesn't answer it. Languages gets a bespoke hero in Pass 2.

**Wiring deltas in PR 1:**
- Age Map: `defaultViz: 'treemap-age'`, alts `['treemap-age', 'treemap']`.
- Test Coverage: `defaultViz: 'treemap-test'`, alts `['treemap-test']` (the by-dir alt joins in PR 8).
- Cursed Files: `defaultViz: 'treemap'` (was `'risk-heatmap'`), alts `['treemap', 'risk-heatmap', 'scatter']`.

### Pass 2 — bespoke heroes (one PR each)

Each is a new component under `apps/web/src/components/hero/` following the existing `(report, selectedFile, onSelectFile)` props pattern. SVG only, using d3 packages already bundled (`d3-shape`, `d3-scale`, `d3-array`). No new dependencies.

| Token | Component | Owner preset | Notes |
|---|---|---|---|
| `rewrite-diverging-bar` | `RewriteDivergingBar.tsx` | Rewrite Ratio | Files ranked by rewrite ratio; deletions left of zero-axis, insertions right. May need `rewriteRatio.files[].insertions/deletions` exposed in core types if not already. |
| `staleness-scatter` | `StalenessScatter.tsx` | Dead Code | X = days since last touch · Y = LOC · color = age tier. Verify `deadCode.files[].daysSinceLastTouch` exists. |
| `blast-scatter` | `BlastScatter.tsx` | Blast Radius | X = blast score · Y = avg co-changed file count · color = severity. Verify `blastRadius.files[].coChangedCount` exists. |
| `ownership-bar` | `OwnershipBar.tsx` | Bus Factor | One row per critical file; bar = dominant-author share; color = risk tier. Uses existing `busFactors.files[].dominantAuthor`. |
| `ownership-sunburst-silos` | reuse `OwnershipSunburst` w/ extended `mode` | Knowledge Silos | Extend `mode` prop from `'all' \| 'ghost'` to `'all' \| 'ghost' \| 'single-author'`. Filters to files with one dominant author. |
| `languages-stacked` | `LanguagesStackedBar.tsx` | Languages (primary) | Rows = top-level directories; segments = language LOC. Click row → Inspector lists files. Uses `loc.files[].{lines,language}`. |
| `test-coverage-by-dir` | `TestCoverageByDir.tsx` | Test Coverage (alt) | Coverage % per directory, sorted worst-first; row color = coverage tier. Aggregates `testCoverage.files[]` by parent dir. |

**Languages preset rewiring (PR 7):** `defaultViz: 'languages-stacked'`, alts `['languages-stacked', 'treemap']`.
**Test Coverage preset rewiring (PR 8):** `altTabs: ['treemap-test', 'test-coverage-by-dir']`.

### Sequencing — 8 PRs

1. **Pass 1** — `ChurnTreemap` `colorBy` + tokens `treemap-age`, `treemap-test`. Wires Age Map, Test Coverage primary, Cursed Files default flip. **One batch.** Must land first; later PRs may register tokens introduced here in alt-tabs.
2. **Knowledge Silos** — `OwnershipSunburst` `mode='single-author'` extension + `ownership-sunburst-silos` token. Smallest PR; warm-up that validates the per-PR recipe still flows post-presets.
3. **Bus Factor** — `OwnershipBar.tsx`.
4. **Rewrite Ratio** — `RewriteDivergingBar.tsx`.
5. **Dead Code** — `StalenessScatter.tsx`.
6. **Blast Radius** — `BlastScatter.tsx`.
7. **Languages** — `LanguagesStackedBar.tsx`. Promotes to default; treemap drops to alt.
8. **Test Coverage by-dir** — `TestCoverageByDir.tsx`. Joins as alt alongside `treemap-test`.

PRs 2–8 are independent — order can shift if a hero needs more design time.

### Testing

Per CLAUDE.md mandate ("Add tests to all changes that can benefit from tests"):

- **Per hero:** a `<Component>.test.tsx` rendering with a small fixture report, asserting key elements (axis labels, legend, ≥1 data row) and verifying selection callbacks fire on click. Pattern: existing `apps/web/src/components/hero/*.test.tsx` (e.g., `RenameSankey.test.tsx`, `Timeline.test.tsx`).
- **Pass 1 colorBy:** test each color function with edge cases — unknown language, missing age field, file with no test sibling. Co-locate in `ChurnTreemap.test.tsx` or split to `colorByMode.test.ts`.
- **`normalizeReport.ts`:** extend the existing test to cover each new field path the bespoke heroes consume.
- **Snapshot:** `packages/core/src/fixture-regression.test.ts` may need refreshing if a preset's `defaultViz` change leaks into the JSON snapshot — verify in PR 1.

### Guardrails

- **No new dependencies.** SVG + d3 packages already bundled only.
- **Web imports from core stay `import type` only.** New per-file fields, if any, must be added to `packages/core/src/types.ts` and surfaced through analyzer return types — never reached for via runtime imports.
- **Each PR follows the per-PR recipe** in `docs/superpowers/plans/2026-04-22-analyzer-presets.md` §Appendix: widen HeroViz union, add HERO_LABELS entry, build component, wire Shell branch, register in preset altTabs, typecheck + test.
- **Pre-1.0 release rule** still applies — none of these warrant a `feat!:` / breaking commit. Each PR is a `feat(web):` minor bump.

## Out of scope

- Age Map alt viz (e.g., age-distribution histogram). The age-colored treemap is enough.
- Overview alt additions. Already has 7 alt-tabs.
- Tier-1 dashboard mode redesign (Overview / Risk / Tech Debt).
- Tier-3 group-level presets (Code Health / Ownership & Risk / Structure / etc.).
- `HeroViz`-reuse contract test (parked — see below).

## Open questions parked

1. **`HeroViz` → preset reuse contract test** to catch accidental hero reuse by two presets that need separate stories. Defer until at least one accidental reuse happens; cheap to add later.
2. **Renaming `ChurnTreemap`** to something less misleading (`ColorableTreemap`, `Treemap`). Defer to a separate cleanup PR; this initiative stays focused on user-visible output.

## How to pick this up in a future session

1. Prime the codebase (`/prime`).
2. Open this spec.
3. Open the implementation plan (TBD — generated next via `superpowers:writing-plans`).
4. Start with PR 1 (Pass 1).

## Related

- `docs/superpowers/plans/2026-04-22-analyzer-presets.md` — the parent initiative. Appendix §2 explicitly mentions `ChurnTreemap` color-by variants.
- PRs #27 through #38 — the 4 phases of the preset initiative that landed.
