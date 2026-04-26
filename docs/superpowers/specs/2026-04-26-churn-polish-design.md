# Churn Polish

**Date:** 2026-04-26
**Brainstormed:** 2026-04-26
**Status:** Approved — implementation plan to follow
**Linear:** [RELIC-303 Polish: churn](https://linear.app/nebulord/issue/RELIC-303/polish-churn)

## Problem

The Churn surface shipped via PR #49 (build/churn-surface) gives the analyzer its first first-class home — sidebar entry, ranked-bar hero, treemap alt-tab, four-tile metrics strip, six-column table. It's wired correctly, tests pass, and it works on the React fixture. **But forensic time on the actual surface revealed it's not yet pulling its weight.**

Six concrete gaps:

1. **The treemap alt-tab is redundant** with Overview's treemap — same component, same defaults (size = LOC, color = hotspot category proxy). Toggling "Top Churn ↔ Treemap" gives the user the same visual story they already saw on Overview, with the file-frequency dimension hidden under LOC sizing. The structural lens is supposed to answer "where does churn concentrate?" but as-rendered it answers "where do big files live?"
2. **No category legend** anywhere. The hero caption claims "color = churn category" but the four colors (hot/warm/cold/frozen) are never visually defined. New users have to guess — or worse, infer wrong.
3. **Long basenames truncate from the LEFT**, leaving fragments like `ureFlags.test-renderer.native-fb.js` visible. The recognizable prefix is the part that should survive.
4. **`Authors` column lacks a tooltip** showing actual author names — Bus Factor's analogous column already does this. Inconsistent surface.
5. **Hero subheading reads "Repository Map"** — a generic carry-over from Overview that doesn't belong on a Churn-specific view.
6. **No cross-links to related analyzers**. Hotspots = churn × LOC, ChurnVelocity = churn over time, CursedFiles bundles churn signal — all natural next clicks. The build-phase spec deferred this, and the polish ticket explicitly asks for it.

Plus four refinement items (severity-tinted trailing label, tooltip explanation of category bands, missing ChurnTab tests, undocumented `MIN_RIGHT_PAD` constant) and a one-line copy review on the metric tiles.

## Scope

**In scope (11 items, three tiers):**

- **Tier A (5)** — high-leverage UX gaps: legend, basename truncation, authors tooltip, cross-link footer, hero subheading polish.
- **Tier D (1)** — differentiation: re-tune the treemap alt-tab so it actually tells a churn-specific structural story.
- **Tier B (5)** — refinement: tile copy review, severity-tinted trailing label, tooltip detail, ChurnTab tests, code comment.

**Out of scope:**

- New analyzers, new analyzer columns in the report.
- Changes to other presets (Overview, Hotspots, Cursed Files) that consume the same `ChurnTreemap` component — back-compat preserved via default props.
- Continuous-gradient bars (Tier C1 in brainstorm) — bigger redesign, deferred.
- "Show more" affordance for >100 hero bars (Tier C2) — bigger lift, deferred.
- Smarter "Last Touched" bucketing (Tier C3) — visible on quiet repos but low-impact on the active fixtures, deferred.
- Inspector panel content changes — out of scope for this ticket.

## Decisions

### Tier A items

#### A1 — Churn-category legend

New shared component `apps/web/src/components/shared/ChurnLegend.tsx` rendering a one-line swatch row:

```
● hot (≥75) · ● warm (40–75) · ● cold (10–40) · ● frozen (≤10)
```

Each swatch fills via the existing `categoryColor` palette through the `severityForChurn` mapping in `apps/web/src/utils/churn.ts`. Component is presentational, takes no props, exports a single named function. Has a small dedicated test verifying the four labels and their thresholds.

Mount points:

- **`ChurnBar.tsx`** — render directly above `<HeroCaption>` in both populated and empty branches (so the legend persists even when no data).
- **`ChurnTreemap.tsx`** — accept a new `legend?: 'churn'` prop (default off — preserves Overview / Hotspots / Cursed Files / Age Map / Test Coverage usages). When set, render `<ChurnLegend>` at the bottom of the rendered SVG container.

#### A2 — Right-side ellipsis on row labels

`ChurnBar`'s row labels use the SVG `<text textAnchor="end">` pattern, which truncates on the LEFT when content overflows. Switch to programmatic right-side truncation using the existing `truncateToFit` helper, anchored against `LABEL_WIDTH`. Picks up the existing `CHAR_PX` constant for character-width estimation.

A new tiny helper `truncateLabelToFit(label, maxChars)` (or reuse of `truncateToFit`) is fine — but the truncation must happen in JS before the `<text>` is emitted, not via CSS, because SVG text doesn't support ellipsis natively.

After the change, `ReactFeatureFlags.test-renderer.native-fb.js` should render as `ReactFeatureFlags.test-rend…` (visible recognizable prefix) instead of `ureFlags.test-renderer.native-fb.js`.

#### A3 — Authors tooltip in ChurnTab

Currently:

```tsx
{
  key: 'authors',
  render: (r) => <span>{r.uniqueAuthors != null ? r.uniqueAuthors : '—'}</span>,
}
```

Bring to parity with `BusFactorTab.tsx` (which renders the author list inline inside `<Tooltip content={...}>` as a flex column of `<span>` elements — see `BusFactorTab.tsx` lines 67–71 for the exact pattern):

```tsx
{
  key: 'authors',
  render: (r) => (
    <Tooltip
      content={
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {(r.authors ?? []).map((a) => (
            <span key={a}>{a}</span>
          ))}
        </div>
      }
    >
      <span>{r.uniqueAuthors ?? '—'}</span>
    </Tooltip>
  ),
}
```

Source the author list by extending `buildRows` in `ChurnTab.tsx` to also lookup `report.busFactors.files[].authors` (an array of email strings already on `FileBusFactor`). Add `authors: string[] | null` to the `ChurnRow` shape. The Tooltip component already exists at `apps/web/src/components/shared/Tooltip.tsx` and is the same one Bus Factor uses.

#### A4 — "See also" footer

Below the SortableTable in `ChurnTab.tsx`, add a short footer row linking to three related presets:

```
See also: Hotspots · Churn Velocity · Cursed Files
```

Each link is a button that calls `selection.applyPreset(id)`. Pass `applyPreset` down as a prop or use the `useSelection` hook directly — pick whichever stays cleaner. Style follows the BottomPanel tab bar typography (10px, dim, hover-underline).

#### A5 — Hero subheading + empty-state subtitle

Two pieces:

- **Hero subheading.** `Shell.tsx` currently renders `<span>Repository Map</span>` as the static hero title above the alt-tabs. Replace with a per-preset string. Add `heroLabel?: string` to `PresetDefinition`, default to "Repository Map" so all other presets stay unchanged. Set `heroLabel: 'Churn — file commit frequency'` (or final wording) on the `churn` preset.
- **Empty-state subtitle.** Today reads `Churn = how many commits each file appears in.` — both build reviewers flagged this as hand-wavy. Replace with something action-oriented: `No file churn detected. Try a longer commit history or a different branch.` (final wording in plan).

### Tier D — differentiation

#### D1 — `sizeBy` prop on ChurnTreemap, new viz token

Today `ChurnTreemap` builds tiles using:

```ts
fileSet.set(f.file, {
  loc: f.lines,
  // …
});
// …
value: Math.max(data.loc, 1),
```

That `value` field drives the d3-treemap layout (tile area). To re-target by commit count:

1. Add a `sizeBy?: 'loc' | 'commits'` prop to `ChurnTreemap`, defaulting to `'loc'` (preserves every existing call).
2. Inside `buildTree`, look up commit count via `report.churn.files` keyed by file path. Set `value` to `loc` or `commitCount` based on the prop.
3. Files missing from `report.churn.files` (no commits in window) collapse to `value=1` (the same minimum already used for files missing from LOC).

New `HeroViz` token `treemap-bycommits` (matches the existing `treemap-age` / `treemap-test` precedent — different prop combination, distinct token). `Shell.tsx` dispatches:

```tsx
{selection.activeHeroViz === 'treemap-bycommits' && (
  <ChurnTreemap
    report={report}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
    colorBy="churn"
    sizeBy="commits"
    legend="churn"
  />
)}
```

`HERO_LABELS['treemap-bycommits'] = 'Treemap'` (same display label — the preset's alt-tab list disambiguates context).

In `registry.ts`, swap the Churn preset's `altTabs: ['churn-bar', 'treemap']` to `['churn-bar', 'treemap-bycommits']`. The Overview preset (which lists `'treemap'` in its alt-tabs) is untouched.

### Tier B items

#### B1 — Metric tile copy review

Final tile labels in `apps/web/src/presets/metrics/churn.ts`:

| Current | Decision | Rationale |
|---|---|---|
| `Hot Files` | Keep | Already clear. |
| `Top Churn` | Rename → `Top File Commits` | "Top Churn" reads as count-of-something-called-churn-at-the-top. The value is *the highest commit count any single file has*. Be explicit. |
| `Top File %` | Rename → `Top File Share` | "%" already in the value; "Share" is more idiomatic for "this file's portion of total commits". |
| `Tracked Files` | Keep | Clear enough; matches the column the value comes from. |

Update the existing `churn.test.ts` assertions to match new labels.

#### B2 — Severity-tint trailing label

In `ChurnBar.tsx`, the trailing `{n} commits` `<text>` element currently uses `fill="var(--text-secondary)"`. Change to `fill={fillFor(row.category, 1)}` — same call already used to color the bar itself. This makes hot files visually pop in the leaderboard scan.

Verify contrast on the dark theme is still readable; if the at-opacity-1 fill is too saturated against the surface, fall back to opacity 0.85.

#### B3 — Tooltip describes the band

Today's tooltip ends with the capitalized category name on its own line. Extend with a band-explanation line:

```
hot
top tier — 76+ churn score
```

(or final wording). Source the explanation from a small helper in `apps/web/src/utils/churn.ts`:

```ts
export function churnCategoryDescription(category: ChurnCategory): string {
  switch (category) {
    case 'hot': return 'top tier — 76+ churn score';
    case 'warm': return 'mid-high tier — 41–75 churn score';
    case 'cold': return 'low tier — 11–40 churn score';
    case 'frozen': return 'rarely touched — ≤10 churn score';
  }
}
```

Render in `ChurnBar`'s tooltip as a sub-line under the category label.

#### B4 — ChurnTab tests

New `apps/web/src/components/tabs/ChurnTab.test.tsx`:

- **`formatRelative` unit tests** — the helper is currently private to the file. Either extract it to a shared util (e.g., `apps/web/src/utils/relativeTime.ts`) and test there, or export it from `ChurnTab.tsx` for direct testing. Spec recommendation: extract — the formatter has no tab-specific logic and could be reused.
- **Render smoke test** — render `<ChurnTab>` against a representative fixture, assert: column headers present, row count matches `report.churn.files`, default sort is commits desc (first row = highest commitCount).

Test count: ~5 (4 `formatRelative` cases + 1 render).

#### B5 — `MIN_RIGHT_PAD` comment

One-line comment in `ChurnBar.tsx`:

```ts
// Tighter than OwnershipBar's 120 because "1,234 commits" is shorter than
// "{author-email} {percent}%" — leaves more room for the bar lane on narrow widths.
const MIN_RIGHT_PAD = 90;
```

## Non-decisions / acknowledged risks

- **A4 cross-link discoverability.** Link wording ("See also") is conventional but slightly invisible — if usability testing reveals users miss it, follow-up could promote it visually (badge, callout). Out of scope.
- **D1 token sprawl.** `HeroViz` will reach 25 entries. Each is fine on its own; we'd revisit only if the dispatch in `Shell.tsx` becomes unreadable. Currently still a flat conditional chain, no refactor needed.
- **B2 contrast.** Severity colors at full opacity may exceed WCAG contrast ratios on some background tones. The fill helper already supports per-call opacity; clamp if needed during implementation.
- **B3 wording.** "Top tier — 76+ churn score" exposes the internal scoring. If the user wants to keep that abstraction private, swap to descriptive ("seen in nearly every release", etc.). Pin in plan.
- **B4 extraction.** Extracting `formatRelative` to a shared util adds a new file. If the team prefers in-place testing, mark the helper exported and test it through `ChurnTab.test.tsx` — same coverage, slightly less reusable.

## File plan

### New files

| Path | Responsibility |
|---|---|
| `apps/web/src/components/shared/ChurnLegend.tsx` | Single-purpose presentational component: 4-swatch legend strip. |
| `apps/web/src/components/shared/ChurnLegend.test.tsx` | Verifies all four labels + threshold strings render. |
| `apps/web/src/components/tabs/ChurnTab.test.tsx` | Render smoke test for ChurnTab. |
| `apps/web/src/utils/relativeTime.ts` *(if extracting)* | `formatRelative(days)` + unit tests. |
| `apps/web/src/utils/relativeTime.test.ts` *(if extracting)* | Tests the formatter's branches. |

### Modified files

| Path | Changes (item refs) |
|---|---|
| `apps/web/src/components/hero/ChurnBar.tsx` | A1 mount legend · A2 right-ellipsis label · A5 empty-state subtitle · B2 trailing fill · B3 tooltip line · B5 comment |
| `apps/web/src/components/hero/ChurnTreemap.tsx` | A1 optional legend prop · D1 sizeBy prop |
| `apps/web/src/components/layout/Shell.tsx` | A5 per-preset hero label · D1 dispatch new viz token |
| `apps/web/src/components/tabs/ChurnTab.tsx` | A3 Authors tooltip · A4 See-also footer · (B4 may export `formatRelative` if not extracting) |
| `apps/web/src/presets/registry.ts` | A5 `heroLabel` on Churn preset · D1 swap alt-tab |
| `apps/web/src/presets/types.ts` | A5 add `heroLabel?` to `PresetDefinition` · D1 add `'treemap-bycommits'` to `HeroViz` |
| `apps/web/src/presets/metrics/churn.ts` | B1 label changes |
| `apps/web/src/presets/metrics/churn.test.ts` | B1 update label assertions |
| `apps/web/src/utils/churn.ts` | B3 add `churnCategoryDescription` |
| `apps/web/src/utils/churn.test.ts` | B3 cover the new helper |

## Tests

Per CLAUDE.md ("Add tests to all changes that can benefit from tests") and the build-phase memory note ("every new metrics composer needs a test"):

- `ChurnLegend.test.tsx` — labels + thresholds present.
- `ChurnTab.test.tsx` — render smoke + default sort assertion.
- `relativeTime.test.ts` (if extracting) — boundary cases for each branch (`days < 1`, `< 30`, `< 365`, `>= 365` × `< 10` and `>= 10`).
- `churn.test.ts` (utils) — new `churnCategoryDescription` cases.
- `churn.test.ts` (metrics) — updated label assertions for B1.
- `Shell.test.tsx` — extend if necessary to cover the new `treemap-bycommits` dispatch and the per-preset `heroLabel` path.

## Out of scope, but staged

- **Inspector panel content** — currently shows hotspot-style fields. Could be tuned for Churn context (highlight commit-cadence, recent activity), but that's its own ticket.
- **Continuous gradient bars** (brainstorm Tier C1) — defer to RELIC-3xx.
- **"Show more" affordance** for >100 hero rows (brainstorm Tier C2) — defer.
- **Last-Touched bucket polish** (brainstorm Tier C3) — defer.

## Build sequence (high-level — full plan to follow)

1. Tier B5 (comment) and B1 (label rename) — trivial isolated changes.
2. Tier A1 (`ChurnLegend`) + tests — foundation for D1's optional-legend prop.
3. Tier A2 (right-ellipsis truncation) — local to ChurnBar.
4. Tier B2 (trailing severity fill) — one-line in ChurnBar.
5. Tier A5 (hero subheading + empty subtitle) — `PresetDefinition` widening + Shell dispatch + Churn preset entry.
6. Tier D1 (`sizeBy` + `treemap-bycommits` token) — biggest change; lands after A1 so legend wires in.
7. Tier B3 (tooltip describes band) + utils helper.
8. Tier A3 (Authors tooltip) + `buildRows` extension.
9. Tier A4 ("See also" footer).
10. Tier B4 (ChurnTab tests; extract `formatRelative` if pursuing).
11. Smoke test (React fixture + gitrelic edge state).
12. Final test/lint/format/build pass.

Implementation plan with bite-sized steps, expected commits per item, and verification commands will follow in `docs/superpowers/plans/2026-04-26-churn-polish.md`.
