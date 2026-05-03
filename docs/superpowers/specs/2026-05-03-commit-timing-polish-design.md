# Commit Timing Polish — Design

> **Linear ticket:** [RELIC-323](https://linear.app/nebulord/issue/RELIC-323)
> **Polish Initiative pattern doc:** [`docs/polish-pattern.md`](../../polish-pattern.md)
> **Status:** Approved 2026-05-03. Implementation plan to follow via `superpowers:writing-plans`.

## Context

The Commit Timing analyzer measures *when* commits land. Two stress signals drive its score:

- **Late-night** — commits between 11pm and 4am local time
- **Weekend** — commits on Saturday or Sunday

Per-file `stressScore = round(lateNightPercent × 0.6 + weekendPercent × 0.4)`, capped at 100. The analyzer currently exposes `repoLateNightPercent`, `repoWeekendPercent`, per-file timing profiles, and a `summary` string — and nothing else. The dashboard tab consumes shared firehose heroes (`Timeline`, `Swimlanes`) plus a generic `SortableTable` of per-file rows.

A forensic pass against the React repo (1,137 commits, 86 authors, top-stress = 40) revealed the following pathologies.

### Hero pathologies

The page currently ships **two shared firehose heroes**:

1. **`Timeline` (default)** — stacked-area-by-author commit volume per month. Beautiful chart, but it encodes **author identity over time**, not hour-of-day or day-of-week — which are the only two dimensions Commit Timing actually measures. A peak on this chart says "October was busy"; it cannot say "October was *stressed*."

2. **`Swimlanes` (alt)** — per-author active/inactive bars across months. Same root problem: a Contributors-style visualization rehomed here for lack of a domain-specific alternative. Visually impressive but answers a Contributors question, not a Commit Timing question.

Both are still alive in the `Overview` and `Contributors` presets and stay there — they're great heroes for the right question. They're stripped from this preset.

### Bottom panel pathology

`CommitTimingTab.tsx` ships a `SortableTable` of per-file rows (File · Late Night % · Weekend % · Peak Time · Stress). Pure rotated-hero pathology in the polish-pattern.md sense, with two extra concerns:

- **The Inspector already covers per-file detail** on row click (per-file `stressScore`, peak hour, late-night and weekend percentages all aggregate there).
- **The analyzer is fundamentally about people, not files.** Files don't choose to commit at 3am — humans do. Bus Factor (RELIC-304) hit this exact realization and pivoted its finding from per-file to per-author with significant payoff. Commit Timing has the same shape and benefits from the same pivot.

### Strip pathology

The current `commitTimingMetrics` preset has four slots:

1. `Late Night %` (4% on React, repo-aggregate)
2. `Weekend %` (7%)
3. `Stress Files` — count where `stressScore > 50` (0 on React)
4. `Top Stress` — top file's `stressScore` (40 on React, mostly opaque without knowing the formula)

Slot 3's `>50` threshold doesn't match the proposed panel's `≥70` tier. Slot 4 is per-file and visually opaque; on a healthy repo it's a number with no severity context.

## Goals

1. **Strip both firehose heroes.** Replace with a `CommitPunchCard` (default) and a `StressTrend` (alt) — both analyzer-specific, both differentiated.
2. **Replace the bottom-panel SortableTable** with a `<NarrativeKPI>` whose finding pivots to **top-3 stressed contributors** (Bus Factor people-pivot pattern).
3. **Retune the metrics strip** to align slot 3 with the panel's `≥70` threshold and replace slot 4 with an author-axis metric that mirrors the panel's pivot.
4. **Add an `apps/docs/analyzers/commit-timing.md` page** per the analyzer-polish-session pattern.

## Out of scope

- No score formula changes — current `stressScore = round(lateNightPercent × 0.6 + weekendPercent × 0.4)` is appropriately weighted; existing `< 3` per-file commit floor already filters noise.
- No changes to `Timeline` / `Swimlanes` components — they stay alive in `Overview` / `Contributors` presets, just unwired from this one. Memory note `project_timeline_hero_rehoming.md` carries forward to Contributors polish for the Timeline.
- No changes to the per-file `FileTimingProfile` shape (unused fields like `dayCount[7]` stay internal).
- The shared `<NarrativeKPI>` component shape stays as-is — no new props.
- Inspector surfaces are unchanged.

## Heroes

### Default — `CommitPunchCard` (NEW)

Visual design — 7×24 grid, rows = days (Mon–Sun), cols = hours (0–23). Each cell rendered as a square (or rounded rect), filled by **log-scaled** color ramp keyed to repo-wide commit count for that (day, hour) bucket. The log scale matches GitHub's punch-card precedent and surfaces rare-but-meaningful off-hours signal that a linear scale would wash out next to a busy weekday-afternoon peak.

**Stress-zone shading.** Subtle background tint behind:
- Weekend rows (Sat, Sun) — `var(--severity-warning)` at low opacity
- Late-night cols (23, 0, 1, 2, 3, 4) — same tint

The intersection (weekend ∩ late-night cells) gets the tint twice, naturally darker — visually identifies the "worst" quadrant without breaking the unified single-ramp color encoding inside cells.

**Axes & labels.** Day labels on the left (`Mon`, `Tue`, …), hour labels on the bottom (`12am`, `3am`, `6am`, …, every 3 hours to keep the strip readable). Optional small total-commits-per-row indicator on the right edge if it fits without crowding.

**Hover.** Tooltip on cell: `Tue 2pm · 47 commits (3% of total)`. Tooltip uses the established `<Tooltip>` primitive with `bg-tooltip-bg text-tooltip-text` tokens.

**Click.** No-op (cells aren't files). Do not invent drill-down behavior — out of scope.

**Empty state.** "No commits in the analyzed window." Matches the empty-state copy style of `BlastHistogram` / `AgeHistogram`.

**Hero caption.** Reuses shared `<HeroCaption>`:

> *When this team works.* Cells are commit counts (log-scaled). Shaded rows mark weekends; shaded columns mark late-night hours.

**Component file.** `apps/web/src/components/hero/CommitPunchCard.tsx` + co-located `.test.tsx`.

### Alt — `StressTrend` (NEW)

Visual design — stacked bar by ISO calendar month, **3 disjoint layers** per bar:

1. **`weekendLateNight`** — both criteria (worst). `var(--severity-critical)`.
2. **`singleCriterion`** — exactly one of late-night OR weekend, but not both. `var(--severity-warning)`.
3. **`healthy`** — neither criterion. `var(--surface-tertiary)` or equivalent neutral.

Bars sum cleanly to total commits in that month. Disjoint partition is the most honest of the three explored options (overlapping double-counts; 2-layer hides the worst-vs-mild distinction). Mirrors `ShameTrend`'s 3-tier severity-stack precedent (RELIC-308).

**Axes.** X = month (chronological forward). Y = total commits. Tick density adjusts to repo length.

**Hover.** Tooltip per bar: `Mar 26 · 87 commits — 4 weekend-late-night · 12 single-criterion · 71 healthy`.

**Click.** No-op. Out of scope to wire month-click filtering.

**Empty state.** "No commits in the analyzed window."

**Hero caption.** Reuses shared `<HeroCaption>`:

> *Is off-hours pressure trending?* Bars layered by stress severity per month — red is the worst (weekend + late-night), orange is one criterion, neutral is healthy hours.

**Component file.** `apps/web/src/components/hero/StressTrend.tsx` + co-located `.test.tsx`.

### Removed from this preset

- `timeline` (still wired in `overview` / `contributors`)
- `swimlanes` (still wired in `overview` / `contributors`)

## Bottom panel — `<NarrativeKPI>`

| Slot | Content |
|---|---|
| **Big number** | `report.commitTiming.highStress` — count of files with `stressScore ≥ 70` |
| **Tier badge** | `0 = Healthy` · `1–4 = Moderate` · `5+ = High Stress` (mirrors parallel-dev's `MODERATE_THRESHOLD = 5` tier band) |
| **Metric label** | `FILES ≥70 STRESS` |
| **Finding** | Top-3 **stressed contributors** (people-pivot, Bus Factor pattern). Each row: `<full git author name [+ disambiguator]> · Late: N% · Weekend: K% · M commits`. Sourced from new `authorStress` aggregate, sorted desc by per-author `stressScore`, with `MIN_AUTHOR_COMMITS = 5` floor. |
| **Subline** | `<X>% late-night · <Y>% weekend across <N> commits` — repo aggregate. Lifts the existing `summary` text into the structured layout. |
| **Extras** | "Where they live" — top-5 directory rollup of high-stress files. Aggregator at `apps/web/src/utils/commitTimingByDirectory.ts`. Hidden when empty. |
| **See also** | `Shame` · `Hotspots`. Sticky footer. |

### Why people-pivot, not file-pivot

Commit Timing is fundamentally about human behavior. On the React repo at the spec'd `≥70` threshold, the file-pivot finding would be empty (top-stress is 40); the panel hollows out. The author-pivot finding always has signal — author stress percentages exist on every repo with commits.

This also adds the *management-visibility angle* (per `project_management_team_visibility_angle.md`) — "is anyone grinding?" is the headline question a manager opens this tab to ask, and right now no surface answers it.

The Inspector still surfaces per-file timing detail on row click (or via punch-card cell hover later) — per-file isn't lost, just moved out of the headline.

### Author display name handling

Authors are rendered by **full git author name** (`%an`), not first-name-only — first-name-only is too ambiguous in active OSS repos (React has both `Sebastian Markbåge` and `Sebastian "Sebbie" Silbermann`).

**Collision rule.** If two distinct authors (different lowercased emails) share an identical full-name string, append the email's local-part as a disambiguator: `Alex Lee (alex)` / `Alex Lee (alee)`. The disambiguation pass runs once after aggregation; common case stays clean.

This rule applies portfolio-wide per `feedback_author_display_names.md` and is a small follow-up candidate for Bus Factor's existing top-3 dominant-owners surface.

### Empty-state behavior

When `highStress === 0`:
- Big number renders as `0` with `Healthy` tier badge — this *is* the signal on a healthy repo
- Finding still shows top-3 stressed contributors (always populated when commits exist + ≥5-commit floor met)
- Subline still shows repo-aggregate facts
- Extras (directory rollup) is hidden if empty

The panel never hollows because the finding always carries.

## Backend changes

### `CommitTimingReport` additions (`packages/core/src/types.ts`)

```ts
export interface AuthorStressProfile {
  email: string;            // stable id, lowercased
  name: string;             // display, full git author name (with collision suffix if needed)
  totalCommits: number;
  lateNightCommits: number;
  weekendCommits: number;
  lateNightPercent: number; // 0–100, rounded
  weekendPercent: number;   // 0–100, rounded
  stressScore: number;      // round(lateNightPercent × 0.6 + weekendPercent × 0.4), 0–100
}

export interface CommitTimingMonthlyBucket {
  month: string;            // ISO YYYY-MM
  weekendLateNight: number; // commits matching BOTH criteria
  singleCriterion: number;  // commits matching exactly one criterion (XOR)
  healthy: number;          // commits matching neither
  total: number;            // weekendLateNight + singleCriterion + healthy
}

export interface CommitTimingTierMix {
  low: number;              // stressScore 0–24
  medium: number;           // 25–49
  high: number;             // 50–74
  critical: number;         // 75+
}

export interface CommitTimingReport {
  files: FileTimingProfile[];
  stressFiles: FileTimingProfile[];
  repoLateNightPercent: number;
  repoWeekendPercent: number;
  summary: string;
  // NEW
  repoHourDayMatrix: number[][];     // 7 rows × 24 cols, [dayOfWeek][hour]; Sun=0
  highStress: number;                // count of files with stressScore ≥ 70
  tierMix: CommitTimingTierMix;      // file-score band counts
  byMonth: CommitTimingMonthlyBucket[];  // disjoint, sorted ascending by month
  authorStress: AuthorStressProfile[];   // sorted desc by stressScore, post-floor and post-disambiguation
}
```

### Analyzer logic changes (`packages/core/src/analyzers/commit-timing.ts`)

- One additional repo-wide accumulator: `repoHourDayMatrix: number[][]` (7×24, zero-initialized). Populate with `repoHourDayMatrix[day][hour]++` per commit, alongside the existing `repoLateNight` / `repoWeekend` counters.
- Track per-author accumulators in the same loop: `Map<emailLower, { name, totalCommits, lateNightCommits, weekendCommits }>`. Email is the stable id (lowercased); name is the most recently-seen `%an` value for that email — last write wins is fine since names are usually stable per email.
- Track per-month buckets in the same loop: `Map<isoMonth, { weekendLateNight, singleCriterion, healthy }>`. Compute disjoint bucket from `(late, wknd)` predicates: both → `weekendLateNight`; exactly one → `singleCriterion`; neither → `healthy`.
- After the main loop:
  - Compute `tierMix` by bucketing `files[].stressScore` into 0–24 / 25–49 / 50–74 / 75+
  - Compute `highStress = files.filter(f => f.stressScore >= 70).length`
  - Compute `authorStress[]`: derive percentages, compute per-author `stressScore` with the same formula as per-file, filter `totalCommits >= MIN_AUTHOR_COMMITS (5)`, sort desc by `stressScore` then alphabetical by name
  - Run name-collision disambiguation: group by `name`, if any group has >1 distinct emails, append `(local-part)` to each member's name
  - Sort `byMonth` ascending by `month` ISO string

### `MIN_AUTHOR_COMMITS = 5`

Module constant in `commit-timing.ts`. Mirrors the per-file `< 3` floor's intent — exclude noise. Five chosen because per-author commit counts skew higher than per-file, and a one-off 3am hotfix from a passer-by shouldn't top a stress leaderboard. Co-located with the per-file floor for discoverability.

### No score-formula changes

Per-file `stressScore` formula and the `< 3` per-file commit floor stay as-is. Per-author uses the same formula for consistency.

### Snapshot regeneration

`packages/core/src/__snapshots__/fixture-regression.test.ts.snap` regenerates with the new fields. Existing test fixture is small enough that the diff is reviewable.

## Metrics strip retune (`apps/web/src/presets/metrics/commit-timing.ts`)

| Slot | Before | After |
|---|---|---|
| 1 | `Late Night %` (repo-wide) | unchanged |
| 2 | `Weekend %` (repo-wide) | unchanged |
| 3 | `Stress Files` — count `stressScore > 50` — severity 0 / >0 / ≥5 | **`High Stress`** — `report.commitTiming.highStress` (count `≥70`) — severity `0 = healthy` / `1–4 = warning` / `5+ = critical` |
| 4 | `Top Stress` — top file's `stressScore` | **`Stressed Authors`** — count of `authorStress` entries with `stressScore ≥ 50` (already filtered to `totalCommits ≥ 5` upstream). Severity `0 = healthy` / `1–2 = warning` / `3+ = critical` |

Slot 4 reuses the same `authorStress` array the panel finding consumes — no extra backend pass. Threshold of `≥50` (not 70) is intentional: per-author stress is harder to push to ≥70 than per-file (people commit across many contexts), so 50 is the more meaningful warning band at the strip.

## Tests

### Core (`packages/core/src/analyzers/commit-timing.test.ts` extended)

New assertions atop the existing test suite:

- `repoHourDayMatrix` is 7×24 with non-negative integer counts; sum equals `commits.length`
- Timezone offset in commit date string is respected — a commit at `2026-03-15T03:00:00+05:30` lands in the author's local hour, not UTC
- `byMonth` layers are disjoint and sum to month total; months sorted ascending; ISO month format
- `authorStress` aggregates per-author correctly across multi-author commits' authoring shape
- `MIN_AUTHOR_COMMITS = 5` floor excludes sub-floor authors
- Per-author `stressScore` matches the per-file formula
- Sort order is desc by `stressScore`, alphabetical-by-name tiebreaker
- Name-collision disambiguation appends `(local-part)` only when two distinct emails share an identical full-name string
- `highStress` matches `files.filter(f => f.stressScore >= 70).length`
- `tierMix` band counts match expected bucketing
- Empty-repo edge case: all aggregates zero / empty / `[]`

### Web

**`CommitPunchCard.test.tsx`** (NEW)
- Renders 7×24 grid (168 cells)
- Log color scale: cell with count 100 isn't ~10× the brightness of count 10 (verifies log not linear)
- Stress-zone shading present on weekend rows + late-night cols
- Tooltip content on hover: includes day, hour, count, %
- Empty-state copy when matrix is all-zero

**`StressTrend.test.tsx`** (NEW)
- Renders one bar per month
- 3 disjoint layers per bar in correct color tokens
- Layers sum to bar total
- Tooltip per bar shows all three tier counts
- Empty-state copy when `byMonth` is `[]`

**`CommitTimingTab.test.tsx`** (NEW; replaces nothing — there is no existing tab test)
- Renders `<NarrativeKPI>` with `getByTestId('narrative-kpi-big-number')` matching `report.commitTiming.highStress`
- Tier badge label matches threshold band
- Top-3 author rows render with full names, `Late: N% · Weekend: K% · M commits` format
- Disambiguator suffix appears in finding when test fixture has a name collision
- Empty-state: when `highStress === 0`, finding still renders top-3 contributors; extras hidden when directory rollup is empty
- See-also footer wires `onApplyPreset` callback for `shame` and `hotspots`

**Aggregator tests:**
- `apps/web/src/utils/topStressedAuthors.test.ts` (NEW) — slice-from-filtered behavior, name-collision handling
- `apps/web/src/utils/commitTimingByDirectory.test.ts` (NEW) — top-5 directory rollup of `highStress` files, mirrors existing `parallelDevByDirectory.test.ts`

### Snapshot

`fixture-regression.test.ts.snap` regenerates. Inspect the diff in PR review for unexpected churn.

## Docs

New page `apps/docs/analyzers/commit-timing.md` (analyzer-polish-session pattern, per `project_analyzer_polish_session_pattern.md`). Mirrors structure of `apps/docs/analyzers/parallel-dev.md`:

1. **What it measures** — late-night + weekend signal, score formula
2. **How to read the PunchCard** — log color, stress zones, what it answers
3. **How to read StressTrend** — disjoint layers, tier severity, what it answers
4. **The KPI panel** — high-stress threshold, top-3 contributors, directory rollup
5. **See also** — Shame, Hotspots

Add to `apps/docs/.vitepress/config.ts` sidebar under Analyzers.

Per `polish-tasks.md` and the analyzer-polish-session pattern, the docs page ships **in the same PR** as the polish work.

## Removes

- `CommitTimingTab.tsx` per-file `SortableTable` (~85 lines)
- The `timeline` / `swimlanes` hero entries from `commit-timing` preset's hero list (component files stay, used by other presets)
- Old metrics-strip slot 3/4 logic in `commit-timing.ts` preset (replaced inline)

## Implementation order

1. **Core analyzer** — extend `commit-timing.ts` with the five new aggregates; update `types.ts`; extend `commit-timing.test.ts`
2. **Snapshot regen** — accept `fixture-regression.test.ts.snap` diff
3. **Web aggregators** — `topStressedAuthors.ts` + test; `commitTimingByDirectory.ts` + test
4. **Heroes** — `CommitPunchCard.tsx` + test; `StressTrend.tsx` + test
5. **Tab rewrite** — `CommitTimingTab.tsx` → `<NarrativeKPI>` consumer + test
6. **Strip retune** — `presets/metrics/commit-timing.ts` slot 3/4 changes
7. **Hero registry** — wire new heroes; strip `timeline`/`swimlanes` from this preset
8. **Docs** — `apps/docs/analyzers/commit-timing.md` + sidebar config update
9. **Pattern doc update** — move `commit-timing` from "spec — RELIC-323" to shipped status in `polish-pattern.md`; capture any deltas (heroes ended at 2 not 3; finding pivoted to authors not files; metrics slot 4 became `Stressed Authors` not `High Stress`)

## Pre-1.0 versioning

Ships as `feat:` (minor bump). No breaking change to the public CLI surface. The `CommitTimingReport` shape is additive — new optional fields on the report. Sidebar deep-links that pinned the old `timeline` default for the `commit-timing` preset will silently fall through to the new `punch-card` default. Acceptable per pre-1.0 norms.
