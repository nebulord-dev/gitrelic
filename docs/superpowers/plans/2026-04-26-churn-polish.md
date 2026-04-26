# Churn Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the freshly shipped Churn surface (RELIC-303) — fix the redundant treemap, add a category legend, fix label truncation, surface authors and cross-links, and tighten copy.

**Architecture:** All changes live inside `apps/web`. No core or CLI work. Roughly: extend the existing `ChurnTreemap` with a `sizeBy` prop and a new viz token to differentiate the alt-tab; add a small shared `ChurnLegend` component to be mounted by both the bar hero and the treemap; widen `PresetDefinition` with an optional `heroLabel`; sprinkle in tooltip and copy refinements; add the missing `ChurnTab` test.

**Tech Stack:** React 19 · TypeScript 6 · Vitest · D3-hierarchy (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-26-churn-polish-design.md`

---

## File Structure

### New files
| Path | Responsibility |
|---|---|
| `apps/web/src/components/shared/ChurnLegend.tsx` | A 4-swatch legend strip explaining hot/warm/cold/frozen thresholds. Presentational, no props. |
| `apps/web/src/components/shared/ChurnLegend.test.tsx` | Verifies all four labels + threshold strings render. |
| `apps/web/src/utils/relativeTime.ts` | Pure `formatRelative(days)` formatter — extracted from `ChurnTab` for testability. |
| `apps/web/src/utils/relativeTime.test.ts` | Boundary tests for each branch (`today`, `Xd ago`, `Xmo ago`, `Xy ago`). |
| `apps/web/src/components/tabs/ChurnTab.test.tsx` | Render smoke test confirming columns + default sort. |

### Modified files
| Path | Items |
|---|---|
| `apps/web/src/components/hero/ChurnBar.tsx` | A1 mount legend · A2 right-ellipsis label · A5 empty-state subtitle · B2 trailing fill · B3 tooltip detail · B5 comment |
| `apps/web/src/components/hero/ChurnTreemap.tsx` | A1 optional `legend` prop · D1 `sizeBy` prop |
| `apps/web/src/components/layout/Shell.tsx` | A5 per-preset hero label · D1 dispatch new `treemap-bycommits` token |
| `apps/web/src/components/tabs/ChurnTab.tsx` | A3 Authors tooltip · A4 See-also footer · B4 use extracted formatRelative |
| `apps/web/src/presets/registry.ts` | A5 `heroLabel` on Churn preset · D1 swap alt-tab |
| `apps/web/src/presets/types.ts` | A5 add `heroLabel?` to `PresetDefinition` · D1 add `'treemap-bycommits'` to `HeroViz` |
| `apps/web/src/presets/metrics/churn.ts` | B1 label changes |
| `apps/web/src/presets/metrics/churn.test.ts` | B1 update label assertions |
| `apps/web/src/utils/churn.ts` | B3 add `churnCategoryDescription` |
| `apps/web/src/utils/churn.test.ts` | B3 cover the new helper |

### Reference patterns (read before starting)
- `apps/web/src/components/hero/OwnershipBar.tsx` — bar-hero structure, the `truncateToFit` helper pattern.
- `apps/web/src/components/tabs/BusFactorTab.tsx:67–71` — exact author-tooltip render pattern (inline `<div>` with `<span>` per email inside `<Tooltip content={...}>`).
- `apps/web/src/components/shared/Tooltip.tsx` — the reusable Tooltip primitive.
- `apps/web/src/hooks/useSelection.ts` — `applyPreset(id: PresetId)` is what the See-also links should call.

---

## Task 1: B5 — Document `MIN_RIGHT_PAD` constant

**Files:** Modify `apps/web/src/components/hero/ChurnBar.tsx:24`

- [ ] **Step 1: Add explanatory comment**

Replace the line `const MIN_RIGHT_PAD = 90;` (currently preceded only by an unrelated comment about `CHAR_PX`) with:

```ts
// Tighter than OwnershipBar's 120 because "1,234 commits" is shorter than
// OwnershipBar's "{author-email} {percent}%" — leaves more room for the bar
// lane on narrow widths.
const MIN_RIGHT_PAD = 90;
```

- [ ] **Step 2: Verify**

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/hero/ChurnBar.tsx
git commit -m "docs(web): explain MIN_RIGHT_PAD divergence in ChurnBar"
```

---

## Task 2: B1 — Metric tile copy review

**Files:**
- Modify: `apps/web/src/presets/metrics/churn.ts`
- Modify: `apps/web/src/presets/metrics/churn.test.ts`

Spec calls for:
- `Top Churn` → `Top File Commits`
- `Top File %` → `Top File Share`
- `Hot Files`, `Tracked Files` unchanged.

- [ ] **Step 1: Update test fixtures (TDD: tests fail first)**

In `apps/web/src/presets/metrics/churn.test.ts`, update every `label:` assertion that mentions `'Top Churn'` to `'Top File Commits'`, and every `'Top File %'` to `'Top File Share'`. Search-replace by exact strings.

- [ ] **Step 2: Run tests; expect failures**

```bash
pnpm --filter @gitrelic/web exec vitest run src/presets/metrics/churn.test.ts
```

Expected: failures on the renamed labels (the implementation still emits the old names).

- [ ] **Step 3: Update the composer**

In `apps/web/src/presets/metrics/churn.ts`, change:
- `label: 'Top Churn'` → `label: 'Top File Commits'`
- `label: 'Top File %'` → `label: 'Top File Share'`

- [ ] **Step 4: Run tests; expect green**

```bash
pnpm --filter @gitrelic/web exec vitest run src/presets/metrics/churn.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/presets/metrics/churn.ts apps/web/src/presets/metrics/churn.test.ts
git commit -m "feat(web): clarify churn metric tile copy

Top Churn → Top File Commits (the value is the highest commit count
any single file has, not 'churn at the top'). Top File % → Top File
Share (Share is the more idiomatic phrasing; '%' already lives in
the value)."
```

---

## Task 3: B3 — Add `churnCategoryDescription` helper

**Files:**
- Modify: `apps/web/src/utils/churn.ts`
- Modify: `apps/web/src/utils/churn.test.ts`

Pure addition. Follows the existing `severityForChurn` pattern in the same file.

- [ ] **Step 1: Write failing tests**

Append to `apps/web/src/utils/churn.test.ts` (inside a new `describe`):

```ts
import { churnCategoryDescription } from './churn';

describe('churnCategoryDescription', () => {
  it('describes hot as the top tier', () => {
    expect(churnCategoryDescription('hot')).toBe('top tier — 76+ churn score');
  });

  it('describes warm as the mid-high tier', () => {
    expect(churnCategoryDescription('warm')).toBe('mid-high tier — 41–75 churn score');
  });

  it('describes cold as the low tier', () => {
    expect(churnCategoryDescription('cold')).toBe('low tier — 11–40 churn score');
  });

  it('describes frozen as rarely touched', () => {
    expect(churnCategoryDescription('frozen')).toBe('rarely touched — ≤10 churn score');
  });
});
```

- [ ] **Step 2: Run tests; expect failure**

```bash
pnpm --filter @gitrelic/web exec vitest run src/utils/churn.test.ts
```

Expected: import fails — `churnCategoryDescription` does not exist.

- [ ] **Step 3: Implement**

Append to `apps/web/src/utils/churn.ts`:

```ts
// Short human-readable description of each churn band, suitable for tooltips
// and explanations. Lines up with the thresholds shown in ChurnLegend.
export function churnCategoryDescription(category: ChurnCategory): string {
  switch (category) {
    case 'hot':
      return 'top tier — 76+ churn score';
    case 'warm':
      return 'mid-high tier — 41–75 churn score';
    case 'cold':
      return 'low tier — 11–40 churn score';
    case 'frozen':
      return 'rarely touched — ≤10 churn score';
  }
}
```

- [ ] **Step 4: Run tests; expect green**

```bash
pnpm --filter @gitrelic/web exec vitest run src/utils/churn.test.ts
```

Expected: 8 tests pass (4 existing `severityForChurn` + 4 new).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/churn.ts apps/web/src/utils/churn.test.ts
git commit -m "feat(web): add churnCategoryDescription helper

Maps ChurnCategory → short human-readable band description, used by
the ChurnBar tooltip to explain what 'hot/warm/cold/frozen' actually
means without making the user infer thresholds."
```

---

## Task 4: A1 — Build `ChurnLegend` shared component

**Files:**
- Create: `apps/web/src/components/shared/ChurnLegend.tsx`
- Create: `apps/web/src/components/shared/ChurnLegend.test.tsx`

A 4-swatch row. Presentational, no props. Each swatch fills via `categoryColor(severityForChurn(category), 0.85)`.

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/components/shared/ChurnLegend.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { ChurnLegend } from './ChurnLegend';

describe('ChurnLegend', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all four churn category labels', () => {
    render(<ChurnLegend />);
    expect(screen.getByText(/hot/)).toBeTruthy();
    expect(screen.getByText(/warm/)).toBeTruthy();
    expect(screen.getByText(/cold/)).toBeTruthy();
    expect(screen.getByText(/frozen/)).toBeTruthy();
  });

  it('renders threshold strings next to labels', () => {
    render(<ChurnLegend />);
    expect(screen.getByText(/≥75/)).toBeTruthy();
    expect(screen.getByText(/40–75/)).toBeTruthy();
    expect(screen.getByText(/10–40/)).toBeTruthy();
    expect(screen.getByText(/≤10/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests; expect failure**

```bash
pnpm --filter @gitrelic/web exec vitest run src/components/shared/ChurnLegend.test.tsx
```

Expected: import fails — component does not exist.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/shared/ChurnLegend.tsx`:

```tsx
import { severityForChurn } from '../../utils/churn';
import { categoryColor } from '../../utils/colors';

import type { ChurnCategory } from '@gitrelic/core';

interface SwatchProps {
  category: ChurnCategory;
  label: string;
  range: string;
}

function Swatch({ category, label, range }: SwatchProps) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 1,
          background: categoryColor(severityForChurn(category), 0.85),
          display: 'inline-block',
        }}
      />
      <span>
        {label} <span style={{ color: 'var(--text-tertiary)' }}>({range})</span>
      </span>
    </span>
  );
}

export function ChurnLegend() {
  return (
    <div
      role="group"
      aria-label="Churn category legend"
      style={{
        display: 'flex',
        gap: 14,
        fontSize: 9,
        color: 'var(--text-secondary)',
        padding: '4px 16px',
      }}
    >
      <Swatch category="hot" label="hot" range="≥75" />
      <Swatch category="warm" label="warm" range="40–75" />
      <Swatch category="cold" label="cold" range="10–40" />
      <Swatch category="frozen" label="frozen" range="≤10" />
    </div>
  );
}
```

- [ ] **Step 4: Run tests; expect green**

```bash
pnpm --filter @gitrelic/web exec vitest run src/components/shared/ChurnLegend.test.tsx
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shared/ChurnLegend.tsx apps/web/src/components/shared/ChurnLegend.test.tsx
git commit -m "feat(web): add ChurnLegend shared component

Four-swatch strip explaining the hot/warm/cold/frozen thresholds.
Presentational, no props. Mounted by ChurnBar (next task) and the
re-tuned ChurnTreemap alt-tab (D1)."
```

---

## Task 5: A1 + B3 in ChurnBar — Mount legend, extend tooltip

**Files:** Modify `apps/web/src/components/hero/ChurnBar.tsx`

Two changes: render `<ChurnLegend>` above the `<HeroCaption>` (in both populated and empty branches), and add the band-description line to the tooltip using `churnCategoryDescription`.

- [ ] **Step 1: Add imports**

Add at the top of `ChurnBar.tsx`:

```ts
import { churnCategoryDescription, severityForChurn } from '../../utils/churn';
import { ChurnLegend } from '../shared/ChurnLegend';
```

(`severityForChurn` is already imported; just keep the existing import.)

- [ ] **Step 2: Mount `<ChurnLegend>` in the empty branch**

Inside the `if (rows.length === 0)` block, insert `<ChurnLegend />` between the centered "No file churn detected." block and the `<HeroCaption>`. Keeps the legend visible even when there's no data to color.

- [ ] **Step 3: Mount `<ChurnLegend>` in the populated branch**

In the main return, insert `<ChurnLegend />` between the closing `</div>` of the scroll container and the `<HeroCaption>`. Use `flexShrink: 0` styling parity with HeroCaption so it doesn't compress on narrow viewports.

- [ ] **Step 4: Extend the tooltip with the band description**

In the tooltip JSX (the `<div>` around line 250), under the existing capitalized `{tooltip.row.category}` line, add a new line:

```tsx
<div style={{ color: 'var(--text-tertiary)', fontSize: 9, marginTop: 1 }}>
  {churnCategoryDescription(tooltip.row.category)}
</div>
```

- [ ] **Step 5: Run the existing ChurnBar tests; expect green**

```bash
pnpm --filter @gitrelic/web exec vitest run src/components/hero/ChurnBar.test.tsx
```

Expected: 8 tests still pass (the existing render + data-prep tests don't assert on the legend or tooltip detail).

- [ ] **Step 6: Run type-checker**

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/hero/ChurnBar.tsx
git commit -m "feat(web): mount ChurnLegend + describe categories in tooltip

A1 (legend): the bar hero now renders ChurnLegend above the caption
in both populated and empty branches — users no longer have to guess
what hot/warm/cold/frozen mean.

B3 (tooltip): each tooltip's category line gets a sub-line explaining
the band ('hot — top tier, 76+ score'). Sourced from the new
churnCategoryDescription helper."
```

---

## Task 6: A2 + B2 in ChurnBar — Right-ellipsis label, severity-tint trailing label

**Files:** Modify `apps/web/src/components/hero/ChurnBar.tsx`

Two micro-changes affecting bar rendering.

- [ ] **Step 1: Truncate basenames from the right**

In the inner `rows.map` (around the `<text>` element rendering `row.name`), replace:

```tsx
<text … >{row.name}</text>
```

with:

```tsx
<text … >{truncateToFit(row.name, labelMaxChars)}</text>
```

Wait — `labelMaxChars` is currently sized for the trailing label, NOT the leading basename. It will compute too small a budget. Compute a separate budget for the basename based on `LABEL_WIDTH`:

```tsx
const basenameMaxChars = Math.max(8, Math.floor((LABEL_WIDTH - 8) / CHAR_PX));
// … in the row map:
<text … >{truncateToFit(row.name, basenameMaxChars)}</text>
```

Place the `basenameMaxChars` calc next to the existing `labelMaxChars` calc (around line 125).

- [ ] **Step 2: Severity-tint the trailing commit-count label**

Replace `fill="var(--text-secondary)"` on the trailing `<text>` element (around line 213) with:

```tsx
fill={fillFor(row.category, isSelected ? 1 : 0.85)}
```

(The `fillFor` helper is already in scope and returns the category-coded `categoryColor`.)

- [ ] **Step 3: Visually verify (manual; later in smoke test)**

Tests don't catch SVG fill changes — covered by smoke test in Task 12. For now, type-check:

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Run existing tests; expect green**

```bash
pnpm --filter @gitrelic/web exec vitest run src/components/hero/ChurnBar.test.tsx
```

Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/hero/ChurnBar.tsx
git commit -m "fix(web): right-ellipsis basenames + severity-tint trailing label

A2: the leading basename label currently relies on SVG textAnchor='end'
which truncates from the LEFT — leaving fragments like
'ureFlags.test-renderer.native-fb.js' visible. Switched to JS
truncateToFit + LABEL_WIDTH budget so the recognizable prefix stays
visible.

B2: the trailing '{n} commits' label was muted-secondary regardless of
category. Now category-tinted via fillFor() — hot files visually pop
in the ranked leaderboard."
```

---

## Task 7: A5 — Per-preset hero label + empty-state subtitle

**Files:**
- Modify: `apps/web/src/presets/types.ts`
- Modify: `apps/web/src/presets/registry.ts`
- Modify: `apps/web/src/components/layout/Shell.tsx`
- Modify: `apps/web/src/components/hero/ChurnBar.tsx`

The hero header at `Shell.tsx:218-220` is a hardcoded "Repository Map". Widen `PresetDefinition` with an optional `heroLabel`, default to "Repository Map" in the Shell render, set Churn preset's heroLabel to a Churn-specific phrase. Also tighten the empty-state subtitle in ChurnBar.

- [ ] **Step 1: Widen `PresetDefinition`**

In `apps/web/src/presets/types.ts`, add an optional field:

```ts
export interface PresetDefinition {
  id: PresetId;
  tier: PresetTier;
  label: string;
  group: SidebarGroupLabel;
  heroLabel?: string;          // ← new (optional, for per-preset hero header override)
  hero: { /* … */ };
  bottomPanel: { /* … */ };
  metrics: (report: GitrelicReport) => Metric[];
}
```

- [ ] **Step 2: Set the Churn preset's heroLabel**

In `apps/web/src/presets/registry.ts`, on the `churn` preset entry:

```ts
churn: {
  id: 'churn',
  tier: 'analyzer',
  label: 'Churn',
  group: 'code-health',
  heroLabel: 'Churn — file commit frequency',   // ← new
  hero: { /* … */ },
  // …
},
```

- [ ] **Step 3: Render the per-preset label in Shell**

In `apps/web/src/components/layout/Shell.tsx`, replace line 218-220:

```tsx
<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
  Repository Map
</span>
```

with:

```tsx
<span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
  {PRESETS[selection.activePresetId].heroLabel ?? 'Repository Map'}
</span>
```

Add an import at the top of the file: `import { PRESETS } from '../../presets/registry';` (verified: NOT currently imported in `Shell.tsx`; you must add it).

- [ ] **Step 4: Tighten the empty-state subtitle in ChurnBar**

In `ChurnBar.tsx`, the empty-branch `<HeroCaption>` currently has:

```tsx
subtitle="Churn = how many commits each file appears in."
```

Replace with:

```tsx
subtitle="No commits touched any file in the analysis window. Try a longer history or a different branch."
```

- [ ] **Step 5: Type-check**

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Run web tests**

```bash
pnpm --filter @gitrelic/web test
```

Expected: all tests pass. (`Shell.test.tsx` may need a small adjustment if it currently asserts on the literal "Repository Map" string — check and update only if necessary.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/presets/types.ts apps/web/src/presets/registry.ts apps/web/src/components/layout/Shell.tsx apps/web/src/components/hero/ChurnBar.tsx
git commit -m "feat(web): per-preset hero label + Churn empty-state copy

A5: replaces the hardcoded 'Repository Map' header on the hero pane
with an optional heroLabel on PresetDefinition. Churn preset overrides
to 'Churn — file commit frequency'; all other presets keep the legacy
default.

Tightens ChurnBar's empty-state subtitle from the hand-wavy
'Churn = how many commits each file appears in' to actionable copy
that points the user at a longer history or different branch."
```

---

## Task 8: D1 — Differentiated Churn treemap (`sizeBy='commits'`)

**Files:**
- Modify: `apps/web/src/presets/types.ts`
- Modify: `apps/web/src/presets/registry.ts`
- Modify: `apps/web/src/components/hero/ChurnTreemap.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx`

This is the most substantive task — adds a new viz token that re-targets `ChurnTreemap` so tile size = commit count (rather than LOC). Existing `treemap` token behavior unchanged for back-compat.

- [ ] **Step 1: Add `'treemap-bycommits'` to the `HeroViz` union**

In `apps/web/src/presets/types.ts`, append `| 'treemap-bycommits'` to `HeroViz`. Insert after `'treemap-test'`:

```ts
export type HeroViz =
  | 'treemap'
  | 'treemap-age'
  | 'treemap-test'
  | 'treemap-bycommits'        // ← new
  | // … rest unchanged
```

- [ ] **Step 2: Type-check; confirm expected breakage**

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
```

Expected: error in `Shell.tsx` — `HERO_LABELS` is missing `'treemap-bycommits'`. That's the wiring checklist for the next steps.

- [ ] **Step 3: Add HERO_LABELS entry + dispatch branch in Shell**

In `apps/web/src/components/layout/Shell.tsx`:

a) Add to `HERO_LABELS` (after `'treemap-test': 'Coverage'` to keep grouping clean):

```ts
'treemap-bycommits': 'Treemap',   // ← new (display label same as 'treemap'; preset altTabs disambiguate)
```

b) Add a dispatch branch (after the existing `treemap-test` branch):

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

- [ ] **Step 4: Add `sizeBy` and `legend` props to `ChurnTreemap`**

In `apps/web/src/components/hero/ChurnTreemap.tsx`:

a) Extend the props interface (around line 63):

```tsx
interface ChurnTreemapProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  colorBy?: TreemapColorBy;
  sizeBy?: 'loc' | 'commits';      // ← new (default 'loc' preserves existing behavior)
  legend?: 'churn';                // ← new (when set, renders ChurnLegend below the SVG)
}
```

b) Update the component signature (around line 123):

```tsx
export function ChurnTreemap({
  report,
  selectedFile,
  onSelectFile,
  colorBy = 'churn',
  sizeBy = 'loc',           // ← new
  legend,                    // ← new
}: ChurnTreemapProps) {
```

c) Update `buildTree` to honor `sizeBy`. Replace the `fileSet` build loop and the `value` assignment. Around line 84–117:

```tsx
function buildTree(report: GitrelicReport, sizeBy: 'loc' | 'commits'): TreeNode {
  const root: TreeNode = { name: 'root', children: [] };
  const dirMap = new Map<string, TreeNode>();

  // Index churn data for commit-count sizing.
  const churnByFile = new Map(report.churn.files.map((f) => [f.file, f.commitCount]));

  // Only include files that appear in LOC data (the structural canon).
  const fileSet = new Map<string, { value: number; score: number; category: string }>();
  for (const f of report.loc.files) {
    const hotspot = report.hotspots.files.find((h) => h.file === f.file);
    const sizeValue =
      sizeBy === 'commits' ? (churnByFile.get(f.file) ?? 0) : f.lines;
    fileSet.set(f.file, {
      value: Math.max(sizeValue, 1),
      score: hotspot?.hotspotScore ?? 0,
      category: hotspot?.category ?? 'low',
    });
  }

  for (const [filePath, data] of fileSet) {
    const parts = filePath.split('/');
    const fName = parts.pop()!;
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const key = parts.slice(0, i + 1).join('/');
      if (!dirMap.has(key)) {
        const node: TreeNode = { name: part, children: [] };
        dirMap.set(key, node);
        current.children!.push(node);
      }
      current = dirMap.get(key)!;
    }
    current.children!.push({
      name: fName,
      fullPath: filePath,
      value: data.value,
      hotspotScore: data.score,
      category: data.category,
    });
  }

  return root;
}
```

d) Update the call site in the component body to pass `sizeBy`:

```tsx
const leaves = useMemo(() => {
  const tree = buildTree(report, sizeBy);    // ← pass sizeBy
  // … rest unchanged
}, [report, dims.width, dims.height, sizeBy]);   // ← add sizeBy to deps
```

e) Mount `<ChurnLegend>` below the SVG when `legend === 'churn'`. Inside the JSX, after the `</svg>` and inside the wrapping `<div ref={containerRef}>`, conditionally render:

```tsx
{legend === 'churn' && <ChurnLegend />}
```

Add the import at the top: `import { ChurnLegend } from '../shared/ChurnLegend';`

- [ ] **Step 5: Swap the Churn preset's alt-tab in registry**

In `apps/web/src/presets/registry.ts`, on the `churn` preset:

```ts
hero: {
  defaultViz: 'churn-bar',
  altTabs: ['churn-bar', 'treemap-bycommits'],   // ← was ['churn-bar', 'treemap']
},
```

- [ ] **Step 6: Type-check**

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7: Run existing tests**

```bash
pnpm --filter @gitrelic/web test
```

Expected: all tests pass. `ChurnTreemap` test (if any) shouldn't break since `sizeBy` defaults to `'loc'` for back-compat. If existing snapshot tests assert on `value` derivation, update to reflect the new field name (`value` field replaces the old `loc` field on the inner map but the surface shape is unchanged for callers).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/presets/types.ts apps/web/src/presets/registry.ts apps/web/src/components/hero/ChurnTreemap.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): differentiated Churn treemap (sizeBy=commits)

The Churn alt-tab treemap was rendering the same view as Overview's
treemap (size=LOC, color=hotspot category) — toggling 'Top Churn ↔
Treemap' showed the user the same image they already saw. Adds a
sizeBy: 'loc' | 'commits' prop to ChurnTreemap (default 'loc' for
back-compat with Overview/Cursed Files/Age Map/Test Coverage).

New HeroViz token 'treemap-bycommits' dispatches ChurnTreemap with
sizeBy='commits' and legend='churn'. Churn preset's altTabs now
swap 'treemap' → 'treemap-bycommits'. Tiles size by commit count,
giving a structural lens that's actually about churn ('where do
commits cluster?')."
```

---

## Task 9: A3 — Authors tooltip in ChurnTab

**Files:** Modify `apps/web/src/components/tabs/ChurnTab.tsx`

Bring Authors column to parity with `BusFactorTab`'s. Reference: `apps/web/src/components/tabs/BusFactorTab.tsx:67–71`.

- [ ] **Step 1: Extend `ChurnRow` and `buildRows` with author emails**

In `ChurnTab.tsx`:

a) Add `authors: string[] | null` to the `ChurnRow` interface:

```ts
interface ChurnRow {
  file: string;
  commitCount: number;
  category: ChurnCategory;
  loc: number | null;
  uniqueAuthors: number | null;
  authors: string[] | null;   // ← new
  ageDays: number | null;
}
```

b) Extend `buildRows` to lookup the author array (already on `FileBusFactor`):

```ts
function buildRows(report: GitrelicReport): ChurnRow[] {
  const locByFile = new Map(report.loc.files.map((f) => [f.file, f.lines]));
  const bfByFile = new Map(
    report.busFactors.files.map((f) => [f.file, { uniqueAuthors: f.uniqueAuthors, authors: f.authors }]),
  );
  const ageByFile = new Map(report.ageMap.files.map((f) => [f.file, f.ageInDays]));

  return (report.churn?.files ?? []).map((f: FileChurn) => {
    const bf = bfByFile.get(f.file);
    return {
      file: f.file,
      commitCount: f.commitCount,
      category: f.category,
      loc: locByFile.get(f.file) ?? null,
      uniqueAuthors: bf?.uniqueAuthors ?? null,
      authors: bf?.authors ?? null,
      ageDays: ageByFile.get(f.file) ?? null,
    };
  });
}
```

- [ ] **Step 2: Wire Tooltip in the Authors column**

Add the Tooltip import (alongside the existing imports):

```ts
import { Tooltip } from '../shared/Tooltip';
```

Replace the existing Authors column render with the BusFactor pattern (mirror `BusFactorTab.tsx:67–71`):

```tsx
{
  key: 'authors',
  label: 'Authors',
  width: '70px',
  align: 'right',
  sortValue: (r) => r.uniqueAuthors ?? -1,
  render: (r) => {
    const authors = r.authors ?? [];
    return authors.length > 0 ? (
      <Tooltip
        content={
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {authors.map((a) => (
              <span key={a}>{a}</span>
            ))}
          </div>
        }
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
          {r.uniqueAuthors ?? '—'}
        </span>
      </Tooltip>
    ) : (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
        —
      </span>
    );
  },
},
```

- [ ] **Step 3: Type-check + tests**

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
pnpm --filter @gitrelic/web test
```

Expected: zero errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/tabs/ChurnTab.tsx
git commit -m "feat(web): authors tooltip in ChurnTab

Bus Factor's Authors column shows the integer plus a hover-tooltip
listing actual author emails. ChurnTab now matches — the bare
integer is preserved, the tooltip pulls f.authors from the bus-factor
data for the same file."
```

---

## Task 10: A4 — "See also" footer in ChurnTab

**Files:** Modify `apps/web/src/components/tabs/ChurnTab.tsx`

Footer below the SortableTable linking to Hotspots, Churn Velocity, Cursed Files. Click → applies that preset.

- [ ] **Step 1: Pass `applyPreset` down**

`ChurnTab` doesn't currently take a callback for switching presets. Two clean options: (a) pass `applyPreset` as a prop from `BottomPanel`, or (b) accept a generic `onApplyPreset?: (id: PresetId) => void` prop. Use (b) for tight scope.

Update the `ChurnTabProps` interface in `ChurnTab.tsx`:

```ts
import type { PresetId } from '../../presets/types';

interface ChurnTabProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  onApplyPreset?: (id: PresetId) => void;     // ← new
}
```

Update the component signature to accept it.

- [ ] **Step 2: Render the footer**

After the `<SortableTable …/>` element, wrap both in a fragment:

```tsx
return (
  <>
    <SortableTable
      data={sorted}
      columns={columns}
      rowKey={(r) => r.file}
      selectedKey={selectedFile}
      onRowClick={(r) => onSelectFile(r.file)}
    />
    {onApplyPreset && (
      <div
        style={{
          padding: '8px 4px 4px',
          fontSize: 10,
          color: 'var(--text-tertiary)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        See also:{' '}
        <button
          onClick={() => onApplyPreset('hotspots')}
          style={linkStyle}
        >
          Hotspots
        </button>
        ·
        <button
          onClick={() => onApplyPreset('complexity-trend')}
          style={linkStyle}
          title="Coming soon"
          disabled
        >
          Churn Velocity
        </button>
        ·
        <button
          onClick={() => onApplyPreset('cursed-files')}
          style={linkStyle}
        >
          Cursed Files
        </button>
      </div>
    )}
  </>
);
```

Wait — `'churn-velocity'` is NOT a registered preset (only the analyzer exists; there's no `churn-velocity` preset in the registry — `'churn-velocity'` is a `BottomTab` value used by Tech Debt). Drop the Churn Velocity link or substitute. Simpler: link only Hotspots and Cursed Files (both are real presets). Update accordingly:

```tsx
{onApplyPreset && (
  <div
    style={{
      padding: '8px 4px 4px',
      fontSize: 10,
      color: 'var(--text-tertiary)',
      display: 'flex',
      gap: 8,
      alignItems: 'center',
    }}
  >
    See also:{' '}
    <button onClick={() => onApplyPreset('hotspots')} style={linkStyle}>
      Hotspots
    </button>
    ·
    <button onClick={() => onApplyPreset('cursed-files')} style={linkStyle}>
      Cursed Files
    </button>
  </div>
)}
```

Define `linkStyle` near the top of the file:

```ts
const linkStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent-primary)',
  fontSize: 10,
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
};
```

- [ ] **Step 3: Wire `applyPreset` from BottomPanel**

In `apps/web/src/components/layout/BottomPanel.tsx`:

a) Add `onApplyPreset` to `BottomPanelProps`:

```ts
interface BottomPanelProps {
  report: GitrelicReport;
  activeTab: BottomTab;
  altTabs: BottomTab[];
  onTabChange: (tab: BottomTab) => void;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  onApplyPreset?: (id: PresetId) => void;        // ← new
  fillAvailable?: boolean;
}
```

b) Thread it through `TabContent`'s switch case for `'churn'`:

```tsx
case 'churn':
  return (
    <ChurnTab
      report={report}
      selectedFile={selectedFile}
      onSelectFile={onSelectFile}
      onApplyPreset={onApplyPreset}     // ← new
    />
  );
```

(Other tab cases left unchanged.)

c) In `apps/web/src/components/layout/Shell.tsx`, the BottomPanel render needs to pass `onApplyPreset={selection.applyPreset}`. Find the existing `<BottomPanel … />` render and add the prop.

- [ ] **Step 4: Type-check + tests**

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
pnpm --filter @gitrelic/web test
```

Expected: zero errors, all tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/tabs/ChurnTab.tsx apps/web/src/components/layout/BottomPanel.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): see-also footer on ChurnTab

Adds a small footer below the table linking to Hotspots and Cursed
Files — both genuinely related to churn (Hotspots = churn × LOC,
Cursed Files bundles churn signal with ownership and age). Click
applies the preset via useSelection.applyPreset, the same hook the
sidebar uses.

Threads onApplyPreset through BottomPanel as an optional prop —
other tabs are unaffected (the prop is only consumed by ChurnTab)."
```

---

## Task 11: B4 — Extract `formatRelative`, add ChurnTab tests

**Files:**
- Create: `apps/web/src/utils/relativeTime.ts`
- Create: `apps/web/src/utils/relativeTime.test.ts`
- Create: `apps/web/src/components/tabs/ChurnTab.test.tsx`
- Modify: `apps/web/src/components/tabs/ChurnTab.tsx`

Two-step extraction: pull `formatRelative` to a shared util with its own tests, then add a ChurnTab render smoke test that verifies columns + default sort.

- [ ] **Step 1: Write `relativeTime.test.ts` first (TDD)**

Create `apps/web/src/utils/relativeTime.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { formatRelative } from './relativeTime';

describe('formatRelative', () => {
  it('returns em-dash when days is null', () => {
    expect(formatRelative(null)).toBe('—');
  });

  it('returns "today" for sub-day ages', () => {
    expect(formatRelative(0)).toBe('today');
    expect(formatRelative(0.5)).toBe('today');
  });

  it('returns "Xd ago" for ages under 30 days, rounded', () => {
    expect(formatRelative(1)).toBe('1d ago');
    expect(formatRelative(7.4)).toBe('7d ago');
    expect(formatRelative(29)).toBe('29d ago');
  });

  it('returns "Xmo ago" for ages between 30 and 365 days, rounded', () => {
    expect(formatRelative(30)).toBe('1mo ago');
    expect(formatRelative(60)).toBe('2mo ago');
    expect(formatRelative(364)).toBe('12mo ago');
  });

  it('returns "X.Xy ago" for ages 1 to 9 years, one decimal', () => {
    expect(formatRelative(365)).toBe('1.0y ago');
    expect(formatRelative(548)).toBe('1.5y ago');
    expect(formatRelative(3285)).toBe('9.0y ago');
  });

  it('returns "Xy ago" for ages 10+ years, no decimals', () => {
    expect(formatRelative(3650)).toBe('10y ago');
    expect(formatRelative(7305)).toBe('20y ago');
  });
});
```

- [ ] **Step 2: Run tests; expect failure**

```bash
pnpm --filter @gitrelic/web exec vitest run src/utils/relativeTime.test.ts
```

Expected: import fails — module does not exist.

- [ ] **Step 3: Create `relativeTime.ts`**

Create `apps/web/src/utils/relativeTime.ts`:

```ts
// Human-readable age formatter used in tables ("Last Touched" column).
// Buckets: null → '—', <1d → 'today', <30d → 'Xd ago',
//          <365d → 'Xmo ago', 1–10y → 'X.Xy ago', 10+y → 'Xy ago'.
export function formatRelative(days: number | null): string {
  if (days == null) return '—';
  if (days < 1) return 'today';
  if (days < 30) return `${Math.round(days)}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  const years = days / 365;
  return `${years.toFixed(years >= 10 ? 0 : 1)}y ago`;
}
```

- [ ] **Step 4: Run tests; expect green**

```bash
pnpm --filter @gitrelic/web exec vitest run src/utils/relativeTime.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Replace `formatRelative` in ChurnTab**

In `apps/web/src/components/tabs/ChurnTab.tsx`:

a) Remove the local `formatRelative` function definition (around lines 25–32 — the function is unique in the file, so search finds it).

b) Add the import: `import { formatRelative } from '../../utils/relativeTime';`

- [ ] **Step 6: Verify ChurnTab still works**

```bash
pnpm --filter @gitrelic/web exec tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7: Commit the extraction**

```bash
git add apps/web/src/utils/relativeTime.ts apps/web/src/utils/relativeTime.test.ts apps/web/src/components/tabs/ChurnTab.tsx
git commit -m "refactor(web): extract formatRelative to shared util

Pulls formatRelative out of ChurnTab into apps/web/src/utils/relativeTime.ts
with its own unit tests covering each branch (today / Xd / Xmo / Xy).
Sets up future tabs that need the same formatter to share it instead
of redefining."
```

- [ ] **Step 8: Add ChurnTab render smoke test**

Create `apps/web/src/components/tabs/ChurnTab.test.tsx`:

```tsx
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { ChurnTab } from './ChurnTab';

import type { GitrelicReport } from '@gitrelic/core';

function makeReport(): GitrelicReport {
  return {
    churn: {
      files: [
        { file: 'src/big.ts', commitCount: 50, churnScore: 90, category: 'hot' },
        { file: 'src/small.ts', commitCount: 5, churnScore: 20, category: 'cold' },
      ],
      topFiles: [],
      hotspotCount: 0,
      summary: '',
    },
    loc: { files: [{ file: 'src/big.ts', lines: 500 }, { file: 'src/small.ts', lines: 50 }] },
    busFactors: { files: [{ file: 'src/big.ts', uniqueAuthors: 3, authors: ['a@x', 'b@x', 'c@x'] }] },
    ageMap: { files: [{ file: 'src/big.ts', ageInDays: 5 }] },
  } as unknown as GitrelicReport;
}

describe('ChurnTab', () => {
  afterEach(() => cleanup());

  it('renders all six column headers', () => {
    render(
      <ChurnTab report={makeReport()} selectedFile={null} onSelectFile={vi.fn()} />,
    );
    expect(screen.getByText('File')).toBeTruthy();
    expect(screen.getByText('Commits')).toBeTruthy();
    expect(screen.getByText('LOC')).toBeTruthy();
    expect(screen.getByText('Authors')).toBeTruthy();
    expect(screen.getByText('Last Touched')).toBeTruthy();
    expect(screen.getByText('Category')).toBeTruthy();
  });

  it('pre-sorts rows by commits desc', () => {
    const { container } = render(
      <ChurnTab report={makeReport()} selectedFile={null} onSelectFile={vi.fn()} />,
    );
    // First data row should be 'big.ts' (50 commits) before 'small.ts' (5 commits).
    const text = container.textContent ?? '';
    expect(text.indexOf('big.ts')).toBeLessThan(text.indexOf('small.ts'));
  });

  it('invokes onSelectFile when a row is clicked', () => {
    const onSelectFile = vi.fn();
    render(<ChurnTab report={makeReport()} selectedFile={null} onSelectFile={onSelectFile} />);
    const row = screen.getByText('big.ts').closest('div')?.parentElement;
    row?.click();
    expect(onSelectFile).toHaveBeenCalledWith('src/big.ts');
  });
});
```

- [ ] **Step 9: Run the new test**

```bash
pnpm --filter @gitrelic/web exec vitest run src/components/tabs/ChurnTab.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 10: Commit the test**

```bash
git add apps/web/src/components/tabs/ChurnTab.test.tsx
git commit -m "test(web): smoke test ChurnTab rendering

Covers the column shape, the pre-sort by commits desc, and the row
click handler. Build code reviewer flagged the absence; this fills
the gap. Doesn't try to be exhaustive — buildRows logic is exercised
through the render and the cross-analyzer columns surface in the row
text."
```

---

## Task 12: Smoke test — React fixture + edge state

**Files:** none modified. Verification only.

- [ ] **Step 1: Build**

```bash
pnpm build
```

Expected: clean. `apps/cli/dist/web/index.html` present.

- [ ] **Step 2: Smoke against the React fixture**

```bash
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

Open the printed URL.

- [ ] **Step 3: Visual checks on the Churn preset**

Click "Churn" in the sidebar. Confirm:

- **Hero header**: reads "Churn — file commit frequency" (A5).
- **Bar hero**:
  - Long basenames truncate from the RIGHT now ("ReactFeatureFlags.test-rend…", not "ureFlags.test-renderer.native-fb.js") (A2).
  - Trailing `{n} commits` labels are tinted by category — hot files have red trailing labels, frozen have green/healthy (B2).
  - Tooltip on hover shows: full path · "X commits" · category · band description ("hot — top tier, 76+ score") (B3).
  - **Legend** strip visible above the caption: 4 swatches with thresholds (A1).
- **Metrics tiles**: read "Hot Files / Top File Commits / Top File Share / Tracked Files" (B1).
- **Treemap alt-tab**: click "Treemap" alt-tab. Confirm:
  - Tile sizes now scale by **commit count**, not LOC (D1) — the React fixture's most-churned files (e.g., `renderer.js`, `ReactFlightServer.js`) should be the biggest tiles regardless of their LOC. Compare side-by-side with the Overview's treemap to confirm the visual differs.
  - **Legend** present below the treemap (A1 mounted via `legend='churn'` prop).
- **Bottom-panel table**: click a row. Confirm:
  - Authors column hover shows author emails (A3).
  - "See also: Hotspots · Cursed Files" footer below the table (A4). Click each → preset switches.

- [ ] **Step 4: Edge-state spot-check on gitrelic itself**

```bash
node apps/cli/dist/index.mjs --path . --web
```

Verify:
- Sidebar still shows Churn entry.
- Bar hero renders normally.
- "Last Touched" formats use "today / Xd ago" buckets.

- [ ] **Step 5: Stop both servers** with Ctrl-C.

---

## Task 13: Final verification

**Files:** none modified.

- [ ] **Step 1: Run full test suite**

```bash
pnpm test
```

Expected: 240 core + 382+ web tests pass (the +18 from build phase plus ~12 new from this polish phase = ~394 web). All green.

- [ ] **Step 2: Lint and format**

```bash
pnpm lint
pnpm format:check
```

Expected: zero new errors. Pre-existing lint warnings (in unrelated files) are acceptable.

- [ ] **Step 3: Verify build outputs**

```bash
pnpm build
ls apps/cli/dist/web/
```

Expected: `index.html` and `assets/` present.

- [ ] **Step 4: Diff sanity-check**

```bash
git log --oneline main..HEAD
git diff main..HEAD --stat
```

Expected: 11–13 commits, ~10 files modified, ~5 new files.

---

## Risks & rollback

- **`ChurnTreemap` `sizeBy` regression**: the prop default is `'loc'`, so all existing call sites (Overview / Hotspots / Cursed Files / Age Map / Test Coverage) keep their current behavior. Verified: no existing test touches `buildTree` or asserts on the internal map fields (only `colorByMode` is exercised), so the internal rename has zero test exposure.
- **`Tooltip` import in ChurnTab**: `Tooltip` is already imported at runtime via `BusFactorTab`; the new import in ChurnTab is just a second consumer. No bundling concern.
- **`heroLabel` widening**: `PresetDefinition`'s new optional field doesn't affect any other consumer. Default to `'Repository Map'` preserves Shell behavior on every preset that doesn't set it.
- **A4 Churn Velocity link**: the brainstorm proposed three See-also links, but `'churn-velocity'` isn't a registered preset (only a tab inside Tech Debt). Plan ships only Hotspots + Cursed Files. If a Churn Velocity preset lands later, add it as a follow-up.
- **Rollback path**: revert tasks in reverse order — each task commit is independent, so a single `git revert <sha>` restores the prior state without affecting later tasks. Most disruptive single revert is Task 8 (D1) since it touches four files.

---

## After this plan ships

- Mark RELIC-303 as Done in Linear.
- Consider Tier C items (continuous gradient bars, "show more" affordance, smarter Last-Touched bucketing) — defer to a new ticket if user feedback suggests value.
