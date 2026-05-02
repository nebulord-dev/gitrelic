# Tailwind Migration — PR3b (Simple Heroes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate 16 of the 28 hero components in `apps/web/src/components/hero/` (the simpler patterns — histograms, scatters, commit charts, heatmaps, timelines, sankey) plus delete the dead `hotspotColor()` function from `theme.ts`. The remaining 12 heroes (bars, trends, trees, force graphs, ContributorSwimlanes) ship in PR3c.

**Why split into PR3b + PR3c:** The original spec scoped 22 heroes; recounting found 28 (some analyzers have multiple hero variants — `bus-factor` has Histogram + OwnershipBar, `churn` has Bar + Treemap, etc.). 28 files × 5-22 React styles per file is too much for one PR. Splitting at the "simple wrappers" vs "complex viz" boundary keeps each PR reviewable in one sitting.

**Architecture:** Apply the foundation primitives (`cn`, `classMaps`, `@theme` bridge) to 16 hero components. Heroes are React shells around D3-generated SVG content — D3 sets `.attr()` and `.style()` on SVG selections, which Tailwind doesn't apply to. The React `style={{}}` count is for wrapper divs, tooltips (often dynamic-positioning carve-outs), legends, and empty states. **The SVG body stays untouched** — only the surrounding React JSX migrates.

**Tech Stack:** Tailwind v4 with `@theme` bridge, `cn()` (clsx + tailwind-merge), vitest 4 + happy-dom, React 19. Foundation primitives in place from PR1/PR2/PR3a.

**Spec:** `docs/superpowers/specs/2026-04-30-tailwind-migration-design.md`
**PR2 plan (cookbook):** `docs/superpowers/plans/2026-05-01-tailwind-migration-pr2-shared-layout.md`

---

## File Map

### Modified (16 hero files)

**Task 1 — Histograms (4 files):**
- `apps/web/src/components/hero/BlastHistogram.tsx` (335 lines, 9 styles)
- `apps/web/src/components/hero/BusFactorHistogram.tsx` (346 lines, 9 styles)
- `apps/web/src/components/hero/RewriteHistogram.tsx` (335 lines, 9 styles)
- `apps/web/src/components/hero/ChurnTreemap.tsx` (227 lines, 4 styles)

**Task 2 — Simple wrappers (6 files):**
- `apps/web/src/components/hero/HotspotScatter.tsx` (209 lines, 5 styles)
- `apps/web/src/components/hero/DebtScatter.tsx` (294 lines, 5 styles)
- `apps/web/src/components/hero/StalenessScatter.tsx` (270 lines, 7 styles)
- `apps/web/src/components/hero/CommitGraph.tsx` (112 lines, 7 styles)
- `apps/web/src/components/hero/CommitDAG.tsx` (147 lines, 5 styles)
- `apps/web/src/components/hero/TestCoverageByDir.tsx` (199 lines, 8 styles)

**Task 3 — Medium wrappers (6 files):**
- `apps/web/src/components/hero/CommitHeatmap.tsx` (170 lines, 8 styles)
- `apps/web/src/components/hero/CommitBranches.tsx` (175 lines, 11 styles)
- `apps/web/src/components/hero/Timeline.tsx` (302 lines, 7 styles)
- `apps/web/src/components/hero/GrowthTimeline.tsx` (315 lines, 7 styles)
- `apps/web/src/components/hero/CouplingHeatmap.tsx` (259 lines, 7 styles)
- `apps/web/src/components/hero/RenameSankey.tsx` (257 lines, 8 styles)

### Modified (1 supporting file)
- `apps/web/src/components/theme.ts` — **delete** the `hotspotColor()` function (lines 57-64 plus the JSDoc deprecation comment). Verified 0 consumers via `grep -rn "hotspotColor" apps/web/src/`.

### Untouched in PR3b
- 12 hero files (PR3c — see below).
- All inspector files (already migrated in PR3a).
- All tab files (PR4).
- `oxlint.config.ts`, `index.css`, root `CLAUDE.md` — final polish in PR4.

### Deferred to PR3c (12 files)
- Bars: ChurnBar, OwnershipBar, RewriteDivergingBar, ShameLeaderboard, LanguagesStackedBar (5 files, ~58 styles)
- Trends/Trees: ShameTrend, OwnershipSunburst, RiskHeatmap (3 files, ~34 styles)
- Force graphs + Bubble: AuthorForceGraph, CouplingForceGraph, OwnershipBubble (3 files, 33 styles + 9 pre-existing `no-explicit-any` warnings to fix)
- ContributorSwimlanes (1 file, 22 styles, the heaviest single hero)

---

## Hero-Specific Patterns

Heroes have unique shapes the cookbook doesn't fully cover. Document up-front so all 3 task implementers handle consistently:

### 1. D3 mount container

Most heroes wrap their D3 SVG canvas with a `<div ref={containerRef}>`. The container's React `style={{}}` typically contains:
- `width: '100%', height: '100%'` → `w-full h-full`
- `position: 'relative'` → `relative` (so absolutely-positioned tooltip overlays anchor here)
- `overflow: 'hidden'` → `overflow-hidden` (clip SVG that overflows during animation)

D3 reads `containerRef.current.getBoundingClientRect()` to size the SVG canvas — class vs inline doesn't affect this. Migration is safe.

### 2. Tooltip overlays — the dynamic-positioning carve-out pattern

Heroes commonly render a tooltip overlay positioned via React state (`tooltipState: { x, y, content } | null`):
```tsx
{tooltip && (
  <div style={{
    position: 'absolute',
    left: tooltip.x,
    top: tooltip.y,
    transform: 'translate(-50%, -100%)',
    background: 'var(--tooltip-bg)',
    /* ... etc */
  }}>
    {tooltip.content}
  </div>
)}
```

Same shape as Tooltip.tsx's dynamic positioning carve-out (PR2). Apply the same split:
- Static parts (`background`, `color`, `padding`, `border-radius`, etc.) → `className="absolute bg-tooltip-bg text-tooltip-text px-2 py-1 rounded text-[10px] whitespace-nowrap pointer-events-none z-[100] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"` (mirror Tooltip's spec).
- Dynamic positioning → `style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}` (carve-out, runtime coords).

**Each hero with a tooltip adds 1 carve-out** (the dynamic-positioning style). PR2-PR3a total is 7; PR3b expected to add roughly 5-10 (one per hero with a tooltip — varies, not every hero has one).

### 3. Empty states

Heroes show a "No data" message when the report's data array is empty. Common pattern:
```tsx
<div style={{
  padding: 32, color: 'var(--text-tertiary)', textAlign: 'center', fontSize: 12,
}}>
  No data
</div>
```

→ `className="p-8 text-text-tertiary text-center text-xs"`. Static, no `cn()` needed.

### 4. Legend rows (inline within hero, not the shared ChurnLegend)

Some heroes render their own legend strip. Pattern:
```tsx
<div style={{ display: 'flex', gap: 12, fontSize: 9, /* ... */ }}>
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span style={{ width: 8, height: 8, background: '...', borderRadius: 2 }} />
    Label
  </span>
</div>
```

The swatch background is often data-driven (severity tier or category) — same pattern as ChurnLegend's swatch carve-out. Migrate static parts to className; keep `style={{ background: dynamicColor }}` as a carve-out.

### 5. SVG body — DON'T migrate

Heroes generate SVG via D3 like:
```ts
svg.selectAll('rect').data(items).join('rect')
  .attr('x', d => xScale(d.bin))
  .attr('width', barWidth)
  .style('fill', d => severityColorFor(d));
```

This is **D3 setting attributes/styles on SVG nodes**. Tailwind utilities don't apply to SVG attributes. **Don't try to migrate the D3-generated SVG.** Only the React JSX wrapper migrates.

### 6. Severity color in SVG fills

Heroes use functions like `categoryColor()`, `severityForChurn()`, `severityColor()` to compute SVG `.style('fill', ...)` colors. These are runtime values that flow into D3 — leave them alone. They're not React `style={{}}` and don't trigger the `react/forbid-dom-props` lint rule (which targets only the React `style` prop).

### 7. The `hotspotColor` deletion (in Task 1)

`apps/web/src/components/theme.ts` exports a deprecated `hotspotColor(category)` function (lines 57-64). `grep -rn "hotspotColor" apps/web/src/` confirms **0 live consumers**. The function returns `var(--severity-*)` strings, not Tailwind classes. Delete it. If the grep finds a consumer that wasn't there at planning time (someone added one between branches), STOP and report — the consumer needs migration first.

---

## Pattern reminders (compiled across PR1-PR3a reviews)

- `cn()` only for runtime conditionals or spread-merges.
- Use ternary form when both branches set distinct values; base-class + conditional override when the false state inherits naturally.
- Module-level for 4+ uses; inline for one-offs.
- Off-scale arbitrary syntax. **Check the scale first**: `0.5` (2px), `1.5` (6px), `2.5` (10px), `3.5` (14px) ARE on the scale.
- `font-medium` (500) vs `font-semibold` (600) — distinct, don't conflate.
- `break-all` for paths/emails (no spaces).
- Standard 4px scale: 0/0.5/1/1.5/2/2.5/3/3.5/4/5/6/8/10/12 maps to 0/2/4/6/8/10/12/14/16/20/24/32/40/48 px.
- Bare-number React inline-style values are px (`letterSpacing: 1` → `tracking-[1px]`).
- Don't import React just for type namespace.
- Don't translate dead code unless context suggests deferred work.
- Use `hover:` variant for hover states (no `cn()` needed for hover unless the class is dynamic).
- `gap-px` works for 1px separator-style gaps.
- The `text-accent-*` Tailwind tokens (added in PR1's @theme bridge) work for all 3 accent domains (ownership, coupling, temporal) plus `text-accent-primary`. No carve-out needed for accent colors.
- D3 `.attr('fill', ...)` and `.style('fill', ...)` calls in SVG generation are NOT React style props. Don't migrate.

---

## Task 1: hotspotColor cleanup + 4 histograms

**Goal:** Delete the dead `hotspotColor()` function from `theme.ts`. Migrate the 4 histogram heroes (Blast, BusFactor, Rewrite, ChurnTreemap). 5 commits total.

**Files:**
- Modify: `apps/web/src/components/theme.ts` (delete `hotspotColor()` lines 57-64 + JSDoc deprecation comment)
- Modify: `apps/web/src/components/hero/BlastHistogram.tsx`
- Modify: `apps/web/src/components/hero/BusFactorHistogram.tsx`
- Modify: `apps/web/src/components/hero/RewriteHistogram.tsx`
- Modify: `apps/web/src/components/hero/ChurnTreemap.tsx`

### Step 1: Delete `hotspotColor()` from `theme.ts`

Verify zero consumers first:
```bash
grep -rn "hotspotColor" apps/web/src/
```
Expected: only `apps/web/src/components/theme.ts:57` matches (the definition). If anything else does, STOP and report.

Then delete the function (and its `@deprecated` JSDoc comment immediately above it). Do NOT delete `severityColor()`, `ageColor()`, `clusterVariant()`, `fmt()`, `fileName()`, or `filePath()` — those stay.

Verify file shrinks by ~10 lines, all other exports preserved:
```bash
grep -E "^export" apps/web/src/components/theme.ts
```

Run lint + tests:
```bash
pnpm lint apps/web/src/components/theme.ts
pnpm --filter @gitrelic/web test
```

Commit:
```bash
git add apps/web/src/components/theme.ts
git commit -m "refactor(web): delete unused hotspotColor() helper from theme.ts (RELIC-336)"
```

### Step 2-5: Migrate each histogram (one commit per file)

For each of BlastHistogram, BusFactorHistogram, RewriteHistogram, ChurnTreemap:

1. Read the file end-to-end. Identify the React `style={{}}` blocks (4-9 per file). Note which are static, which are dynamic (tooltip positioning, swatch backgrounds), which use `cn()` candidates (state-driven highlights).

2. Translate following the cookbook + the hero-specific patterns above:
   - Container div → static `className`.
   - Tooltip overlay → split static `className` + dynamic positioning `style={{}}` carve-out.
   - Empty state → static `className`.
   - Legend → static `className` + per-swatch `style={{ background }}` carve-out if data-driven.
   - SVG body — DON'T migrate.

3. Run hero-specific tests if they exist (most histograms have `*.test.tsx`):
   ```bash
   pnpm --filter @gitrelic/web test BlastHistogram.test.tsx
   ```
   (Replace name per file.)

4. Self-review:
   ```bash
   grep -n "style=" apps/web/src/components/hero/BlastHistogram.tsx
   ```
   Expected: 0 matches OR documented carve-outs only (with justification — likely 0-2 per hero).

5. Commit:
   ```bash
   git add apps/web/src/components/hero/BlastHistogram.tsx
   git commit -m "refactor(web): migrate BlastHistogram to Tailwind (RELIC-336)"
   ```
   (Replace component name per file.)

After all 4 histograms migrated, run full suite:
```bash
pnpm --filter @gitrelic/web test
pnpm lint
```
Expected: 551/551 pass; 9 warnings unchanged (the pre-existing `no-explicit-any` ones are in CouplingForceGraph/AuthorForceGraph/OwnershipBubble — all PR3c scope).

---

## Task 2: 6 simple heroes (5-8 styles each)

**Goal:** Migrate 6 heroes with the simplest patterns (mostly scatters and commit charts).

**Files:**
- `apps/web/src/components/hero/HotspotScatter.tsx` (5 styles)
- `apps/web/src/components/hero/DebtScatter.tsx` (5 styles)
- `apps/web/src/components/hero/StalenessScatter.tsx` (7 styles)
- `apps/web/src/components/hero/CommitGraph.tsx` (7 styles)
- `apps/web/src/components/hero/CommitDAG.tsx` (5 styles)
- `apps/web/src/components/hero/TestCoverageByDir.tsx` (8 styles)

For each: read → translate → test (if test file exists) → commit. Pattern:

```bash
# Per file:
pnpm --filter @gitrelic/web test <FileName>.test.tsx  # if exists
git add apps/web/src/components/hero/<FileName>.tsx
git commit -m "refactor(web): migrate <FileName> to Tailwind (RELIC-336)"
```

After all 6: run full suite + lint.

Document any new carve-outs in your report (each hero with a tooltip → 1 dynamic-positioning carve-out).

---

## Task 3: 6 medium heroes (7-11 styles each)

**Goal:** Migrate 6 heroes with slightly more complex JSX (heatmaps, timelines, sankey, branches).

**Files:**
- `apps/web/src/components/hero/CommitHeatmap.tsx` (8 styles)
- `apps/web/src/components/hero/CommitBranches.tsx` (11 styles)
- `apps/web/src/components/hero/Timeline.tsx` (7 styles)
- `apps/web/src/components/hero/GrowthTimeline.tsx` (7 styles)
- `apps/web/src/components/hero/CouplingHeatmap.tsx` (7 styles)
- `apps/web/src/components/hero/RenameSankey.tsx` (8 styles)

Same per-file pattern as Task 2. After all 6: run full suite + lint.

---

## Final verification (after Task 3)

Run from repo root:
```bash
pnpm test
pnpm lint
pnpm format:check
pnpm build
```

Expected:
- All tests pass (812/812 — heroes have test files; behavior should be unchanged).
- 0 lint errors. Warnings = 9 (only the pre-existing `no-explicit-any` in 3 D3 hero files, all PR3c scope).
- Format check clean.
- Build succeeds.

Carve-out audit:
```bash
grep -rn "style={{" apps/web/src/components/hero/
```
Expected: each migrated hero (16 of them) has 0 OR a small number of carve-outs (mostly tooltip dynamic positioning, occasional data-driven swatch backgrounds). Total PR3b carve-out additions: estimated 5-10 (one per hero with a runtime-positioned tooltip).

Then run the dashboard for visual QA:
```bash
pnpm build
node apps/cli/dist/index.mjs --path ~/path/to/some-repo --web
```

Click through every tab that uses a migrated hero:
- Blast Radius, Bus Factor, Rewrite Ratio, Churn (treemap variant) — Task 1's histograms
- Hotspots, Debt (Cursed Files), Stale (Age Map), Commit Graph, Commit DAG (Coupling?), Test Coverage — Task 2
- Commit Timing (heatmap), Commit Branches (?), Timeline (Activity?), Growth Timeline (Complexity Trend), Coupling, Renames — Task 3

Verify in both themes (DevTools `document.documentElement.dataset.theme = 'light'`).

Specifically verify per hero:
- D3 SVG renders correctly (the chart itself — bars, scatter dots, sankey ribbons, etc.).
- Tooltip overlay appears on hover at the right position.
- Empty state shows "No data" centered when applicable.
- Wrapper div sizes correctly (full width/height of its container).

---

## Self-Review (plan author)

**Spec coverage:**
- ✅ 16 of 28 heroes (Tasks 1-3 above).
- ✅ `hotspotColor()` deletion (Task 1 step 1).
- ⚠️ NOT in this plan: 12 heroes (PR3c — bars, trends, trees, force graphs, ContributorSwimlanes), tab files (PR4), lint rule + CLAUDE.md (PR4).
- ⚠️ NOT addressed: the 9 pre-existing `no-explicit-any` warnings in CouplingForceGraph/AuthorForceGraph/OwnershipBubble — those land in PR3c when those files migrate.

**New patterns documented:** D3 mount container shape, tooltip overlay carve-out, empty state shape, inline legend with data-driven swatch, SVG body don't-migrate rule, severity color in SVG fills don't-migrate rule, `hotspotColor` deletion. All in the "Hero-Specific Patterns" section.

**Placeholder scan:** None. Tasks reference the cookbook + per-file class translations follow the established pattern. Implementer reads each source to translate.

**Type consistency:** `cn` import path consistent (`'../../utils/cn'` from `hero/`). All new tokens in className strings are bridged in `@theme` (verified for PR1/PR2/PR3a — no new tokens needed for PR3b).

**Carve-out anticipation:** ~5-10 new carve-outs (tooltip dynamic positioning, data-driven swatch backgrounds). Cumulative total after PR3b: 12-17. Each carve-out should be a runtime value that can't be a static Tailwind class.

---

## What's next

PR3c — 12 remaining heroes (bars, trends, trees, force graphs, ContributorSwimlanes). The 9 pre-existing `no-explicit-any` warnings in 3 D3 force-graph files get fixed in the same PR (when those files migrate, the typing fix is in scope per the PR1 reviewer's note).

PR4 — 22 tab components, `react/forbid-dom-props` lint rule, per-line disable comments on the cumulative carve-outs (likely 12-17 total by PR3c end), root `CLAUDE.md` "Web Styling" section.
