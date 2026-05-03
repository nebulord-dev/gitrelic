# Contributors Polish — Design

> **Linear:** [RELIC-306](https://linear.app/nebulord/issue/RELIC-306)
> **Pattern doc:** [`docs/polish-pattern.md`](../../polish-pattern.md) — Contributors entry under "Pending (Batches 2–N)" gets updated when this ships.
> **Status:** Approved by Trace, ready for implementation plan.

## Summary

Polish the Contributors analyzer in the GitRelic web view. Promote `ContributorSwimlanes` to the default hero, drop `OwnershipSunburst` from the preset (redundant with Knowledge Silos / Ghost Files), keep `OwnershipBubble` as the single alt, retune the metrics strip with two new team-health aggregates (`Top-3 Share`, `Newcomers (90d)`), polish the bottom-panel `SortableTable` with display-name presentation and two new columns (`Lines`, `Last Active`), and ship the analyzer's docs page.

The bottom-panel form stays a table — Contributors is a roster/leaderboard analyzer at heart, and the team-health KPIs that would justify a narrative-KPI live more naturally in the always-visible metrics strip than in the collapsible bottom panel.

## Why this scope

The current Contributors view ships:

- **Default hero:** `OwnershipBubble` (per-directory bubble pack colored by dominant author)
- **Alt heroes:** `ContributorSwimlanes`, `OwnershipSunburst`
- **Metrics strip:** Active Contributors, Ghost Authors, Total Commits
- **Bottom panel:** `SortableTable` of all contributors

Three problems surfaced from the screenshot review against the React repo:

1. **Sunburst is redundant here.** It's the *lead* hero in Knowledge Silos and Ghost Files. On Contributors it answers "who concentrates where, with risk overlay" — a worse Bus Factor / Knowledge Silos. Same "redundant alts" pathology that Bus Factor and Rewrite Ratio fixed.
2. **Bubble's question ("who works on what directory") is good, but it's not the analyzer's lead question.** The lead question for Contributors is "who is on the team and how active are they" — Swimlanes answers that visually with per-author rows + intensity + ghost coloring.
3. **Metrics strip carries raw counts, no team-health insight.** "Active Contributors" is a number with no severity signal; "Total Commits" is a meta-stat. There's no surface for *velocity concentration* (top-3 share) or *team renewal* (newcomers).

The polish-pattern doc's original Batch-3 entry for Contributors said "Bottom table earns space (per-contributor vs hero per-directory)" — based on the bubble being default. With Swimlanes as default, that justification weakens (both surfaces are now per-author), but the table still earns space because it's a *different density* (full sortable list of 86 vs. ~10 visible rows in Swimlanes). The pattern doc gets updated post-ship.

## Out of scope

- **Inspector display-name migration.** Memory tagged display-names as a follow-up for Bus Factor too — applying the rule to `FileInspector` / `ContributorsInspector` is its own ticket.
- **Bubble redesign.** The bubble's question is right (per the user's framing). Polish is label cleanup + display names + caption strip — *not* a new visualization.
- **Timeline rehoming.** Considered as a third hero alt and rejected: Timeline still lives in the Overview preset (RELIC-323 only stripped it from commit-timing), and adding it to Contributors would partially overlap Swimlanes. Two-tab pattern is cleaner.
- **Score formula changes.** Contributors has no per-file score formula — concentration risk lives in the metrics strip (`top3CommitShare`), not on individual rows.

## Architecture

### Hero scope

| Slot | After | Before |
|---|---|---|
| Default | `swimlanes` | `ownership` |
| Alt | `ownership` | `swimlanes`, `ownership-sunburst` |
| Removed | — | `ownership-sunburst` |

`OwnershipSunburst` the component stays — Knowledge Silos and Ghost Files still consume it.

### Bubble polish (cleanup, not redesign)

- Author labels render the **display name** (`Sebastian Markbåge`), not the email-prefix (`sebastian@calyptus.eu`). Falls back to email only when name is empty.
- Bubbles below a size threshold (≈22px radius) drop their text labels entirely instead of showing truncated junk like `packages/r…`.
- Tooltip carries the full directory path, dominant author display name, and author share %.
- Migrate the existing footer caption line to the shared `<HeroCaption>` component (parity with Swimlanes / Churn / Rewrite Ratio).

### Swimlanes polish

- Author labels render the display name (same rule).
- Add the shared `<HeroCaption>` strip with copy along the lines of "x = time · row = author · color intensity = commits per week".
- No structural changes — the visualization works as-is per the screenshot review.

### Metrics strip retune

| Slot | Label | Value | Severity bands | Source |
|---|---|---|---|---|
| 1 | **Active Contributors** | count | `1` critical · `2–5` warning · `6+` healthy | existing `activeContributors.length` |
| 2 | **Top-3 Share** | `%` (rounded) | `<40%` healthy · `40–69%` warning · `70%+` critical | NEW aggregate `top3CommitShare` |
| 3 | **Ghost Authors** | count | `0` healthy · `1+ but <30% ghost ratio` warning · `≥30% ghost ratio` critical | existing `ghostContributors.length`; ratio = `ghostContributors.length / contributors.length` |
| 4 | **Newcomers (90d)** | count | `0` neutral · `1+` healthy (no warning band — newcomers are positive) | NEW aggregate `newcomers90d` |

**Dropped from the strip:** `Total Commits` (meta-stat without team-health signal — replaced by the more meaningful slots above).

The retune mirrors the precedent set by Rewrite Ratio (`Files ≥70`), Parallel Dev (`High Parallel`), and Commit Timing (`High Stress` / `Stressed Authors`) — replace shape-of-data counts with health-tiered counts.

### Bottom panel — polished `SortableTable`

Six columns, default sort by commits desc:

| # | Column | Source | Notes |
|---|---|---|---|
| 1 | **Contributor** | `name` + `email` + `isActive` | Display name primary; email lighter/smaller below; status dot + `ghost` badge inline |
| 2 | **Commits** | `commitCount` | Default sort, desc; bold mono |
| 3 | **Files** | `filesOwned` | Breadth — how many files this contributor owns (filled by runner from bus factor) |
| 4 | **Lines** | `linesChanged` | Depth — total ins+del. New column; data already exists on `Contributor` |
| 5 | **Last Active** | `lastCommit` | Relative time ("3 weeks ago") via existing `utils/relativeTime.ts` |
| 6 | **Focus Areas** | `focusAreas` | Top **3** (was top 2), comma-separated, truncated |

**Removed:** standalone right-aligned `Status` column (consolidated into the Contributor cell next to the name).

**Sticky see-also footer:** Inline JSX matching `ChurnTab`'s pattern (don't lift to a shared component yet — single other consumer, YAGNI):

- **Bus Factor** — the per-file ownership-concentration sibling to top-3 share (per-team velocity concentration)
- **Ghost Files** — dormant ownership, the file-side pair to the contributors-side ghost count

This pair completes the ownership-risk triangle from the contributor vertex.

### Backend additions — `packages/core`

**`types.ts` — `ContributorReport`:**

```ts
export interface ContributorReport {
  contributors: Contributor[];
  activeContributors: Contributor[];
  ghostContributors: Contributor[];
  topContributor: Contributor;
  summary: string;
  top3CommitShare: number;   // NEW — % (0-100), team velocity concentration
  newcomers90d: number;      // NEW — count of authors with firstCommit ≤ 90d ago
}
```

**`analyzers/contributors.ts`:**

```ts
const totalCommits = contributors.reduce((sum, c) => sum + c.commitCount, 0);
const top3Sum = contributors
  .slice(0, 3)
  .reduce((sum, c) => sum + c.commitCount, 0);
const top3CommitShare = totalCommits === 0 ? 0 : (top3Sum / totalCommits) * 100;

const newcomerCutoff = now - 90 * 86_400_000;
const newcomers90d = contributors.filter(
  (c) => new Date(c.firstCommit).getTime() >= newcomerCutoff,
).length;
```

Empty-repo guard: `totalCommits === 0` → `top3CommitShare = 0`. Mirrors the existing empty-repo guard for `topContributor`.

**No score-formula changes.** No effects on cursed-files or other downstream analyzers.

### Web wiring

**`apps/web/src/presets/registry.ts` — `contributors` entry:**

```ts
contributors: {
  id: 'contributors',
  tier: 'analyzer',
  label: 'Contributors',
  group: 'team-activity',
  hero: {
    defaultViz: 'swimlanes',              // was 'ownership'
    altTabs: ['swimlanes', 'ownership'],  // was ['ownership', 'swimlanes', 'ownership-sunburst']
  },
  bottomPanel: {
    defaultTab: 'contributors',
    altTabs: ['contributors'],
  },
  metrics: contributorsMetrics,
  docsPath: 'analyzers/contributors',     // NEW
},
```

**`apps/web/src/presets/metrics/contributors.ts`:** rewrite the composer to produce the 4 slots above. Severity-band logic mirrors `commit-timing.ts` / `parallel-dev.ts` precedent.

**`apps/web/src/components/tabs/ContributorsTab.tsx`:** full rewrite mirroring `ChurnTab.tsx`'s shape — `flex flex-col min-h-full` outer, table or empty-state in `flex-1`, sticky see-also footer at the bottom. Add `onApplyPreset` to props.

**`apps/web/src/components/layout/BottomPanel.tsx`:** wire `onApplyPreset` through to `ContributorsTab` (mirror how `ChurnTab` / `ShameTab` / etc. receive it).

**`apps/web/src/components/hero/ContributorSwimlanes.tsx` and `OwnershipBubble.tsx`:** wire `<HeroCaption>` and replace email-prefix labeling with `c.name ?? c.email`.

### Docs page — `apps/docs/analyzers/contributors.md` (NEW)

Follows the structure used by `parallel-dev.md` / `commit-timing.md` / `shame.md`:

1. **Frontmatter** — `title: Contributors`, description.
2. **Intro paragraph** — what Contributors measures, what questions it answers, social vs. structural framing.
3. **Quick read** — 10-second tour of metrics strip / Swimlanes hero / Bubble alt / table / Inspector.
4. **How contributors are measured** — mermaid pipeline diagram, the active/ghost cutoff math (`MIN_ACTIVE_DAYS = 90`, `MIN_GHOST_DAYS = 180`, scaled by `repoAgeDays`), focus-area derivation (top-3 dirs at depth 2).
5. **The metrics strip** — formulas + tier thresholds for the 4 slots (with worked examples).
6. **Reading the surfaces** — Swimlanes (default) → Bubble (alt) → table → Inspector.
7. **What action it suggests** — top-3 share + 0 newcomers = stagnant concentration; high ghost ratio = team turnover; focus-area collisions = coordination opportunities.
8. **Limitations** — email-keyed identity (no name dedup at this layer), 2-deep focus areas, heuristic active/ghost cutoffs, renames not followed, `--since` window sensitivity.
9. **Related analyzers** — Bus Factor, Knowledge Silos, Ghost Files, Co-Authors.

`::: tip Screenshot` callout left as a TODO placeholder per the existing pattern.

**`apps/docs/.vitepress/config.ts`:**

- Add `{ text: 'Contributors', link: '/analyzers/contributors' }` to the Analyzers sidebar, alphabetical between Commit Timing and Parallel Dev.
- Remove `/analyzers/contributors` from `ignoreDeadLinks`.

## Tests

| File | What it covers |
|---|---|
| `packages/core/src/analyzers/contributors.test.ts` | New aggregates: `top3CommitShare` (empty repo / single contributor / ≥3 contributors); `newcomers90d` boundary cases (89 / 90 / 91 days from `now`) |
| `apps/web/src/presets/metrics/contributors.test.ts` (NEW) | 4-slot composer: tier bands for slot 1 (1 / 2–5 / 6+), slot 2 (<40 / 40–69 / 70+), slot 3 (0 / <30% / ≥30%), slot 4 (always healthy or neutral) |
| `apps/web/src/components/tabs/ContributorsTab.test.tsx` (NEW) | Renders 6 columns; sort-by-commits desc default; ghost badge inline in Contributor cell; sticky footer fires `onApplyPreset` with `bus-factor` / `ghost-files`; empty-state copy when contributor list is empty |
| `apps/web/src/presets/registry.test.ts` | Existing DoD assertion auto-fails if `docsPath` is set on the preset but the docs file is missing — no new test needed, just satisfies the existing one |
| `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` | Regenerates with pure additions (`top3CommitShare`, `newcomers90d`) on the contributors slice |

Per the polish-pattern doc's note: tests should match existing patterns. `contributors.test.ts` already has fixture-based scaffolding; add cases against the same fixtures. Don't add visual regression infra unless it already exists (it doesn't here).

## Removes

- `'ownership-sunburst'` from contributors preset `altTabs` (component itself stays — used by Knowledge Silos / Ghost Files).
- Standalone `Status` column in `ContributorsTab` (consolidated into the Contributor cell).
- `Total Commits` slot from the metrics strip (replaced by the new health-signal slots).

## Versioning

Ships as `feat:` (minor bump per `.releaserc.json` pre-1.0 rule). `OwnershipSunburst` deep-links pinned to the contributors preset would silently fall through to the new Swimlanes default — no breaking change to the public CLI surface, no `feat!:` trigger.

## Implementation order

1. **Backend** — types + analyzer aggregates + core test (smallest, no UI dependencies).
2. **Metrics composer** — `presets/metrics/contributors.ts` rewrite + composer test.
3. **Hero polish** — `ContributorSwimlanes` + `OwnershipBubble` (display names + HeroCaption); registry default flip.
4. **Tab rewrite** — `ContributorsTab.tsx` (columns + see-also footer); BottomPanel wiring; tab test.
5. **Docs page** — `apps/docs/analyzers/contributors.md` + sidebar entry + `ignoreDeadLinks` cleanup; `docsPath` set on preset (this satisfies the registry-test DoD assertion).
6. **Snapshot regeneration** — `pnpm test:core` once the analyzer changes land; commit the snapshot diff.

Each step is independently testable. Step 5 is the gate — don't set `docsPath` until the docs page exists, or `registry.test.ts` will fail.
