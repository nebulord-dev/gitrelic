# Rename Tracking Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the GitRelic web dashboard's Rename Tracking analyzer per the approved spec — replace the bottom-panel `SortableTable` with a NarrativeKPI panel, polish the `RenameSankey` hero so its existing-but-undiscoverable click→Inspector affordance becomes obvious (raise the topN cap, beef up selected-state stroke, add a `<HeroCaption>` with click hint), ship the analyzer's docs page at `apps/docs/analyzers/renames.md`, and align the nine cross-link references that currently point at the never-shipped `/analyzers/rename-tracking` slug.

**Architecture:** No backend changes. Frontend-only polish: rewritten `RenamesTab` consuming the existing `report.renameTracking` aggregates (`filesWithRenames`, `chains`, `totalRenames`) into a 3-state informational tier KPI; sankey hero gets uncapped `topN` default + `<HeroCaption>` strip + thicker selected-state stroke; docs page authored under `analyzers/renames.md` with `docsPath: 'analyzers/renames'` set on the preset registry to wire the right-anchored `Docs ↗` tab-bar link.

**Tech Stack:** TypeScript 6, pnpm workspaces + Turbo, Vite + React 19 + Tailwind v4 (web), tsdown (core), Vitest, oxlint + oxfmt. D3-sankey hero. `<NarrativeKPI>` shared component. `<HeroCaption>` shared primitive.

**Spec:** [`docs/superpowers/specs/2026-05-10-rename-tracking-polish-design.md`](../specs/2026-05-10-rename-tracking-polish-design.md)

**Linear:** [RELIC-321](https://linear.app/nebulord/issue/RELIC-321)

**Branch:** `relic-321-rename-tracking-polish`

**Worktree note:** Memory tag `feedback_subagent_cwd_discipline.md` — when executing this plan via `subagent-driven-development`, force every bash command to start with `cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish` or commits drift to main. Memory tag `feedback_worktree_absolute_path_footgun.md` — use absolute paths that include `.worktrees/relic-321-rename-tracking-polish/` and verify with `git status` before committing.

**Top-N discipline:** Memory tag `feedback_topn_under_threshold.md` — for the panel's top-3 most-renamed finding, slice from `report.renameTracking.chains` (the analyzer's existing per-chain output), not from any reconstructed whole-repo set. The analyzer's chain set is already the correct domain; sort `desc by renameCount` and `slice(0, 3)` in the tab.

---

## Task 0: Worktree setup *(already complete)*

The worktree exists from the planning step. Verify before continuing:

- [x] **Step 0.1: Worktree exists**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic
git worktree list
```

Expected: `/Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish` listed on branch `relic-321-rename-tracking-polish`.

- [ ] **Step 0.2: Install dependencies in the worktree**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
pnpm install
```

Expected: lockfile already satisfied; pnpm symlinks `node_modules`. No version drift.

- [ ] **Step 0.3: Verify clean baseline**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
git status
pnpm build
pnpm test
```

Expected: `git status` clean except for the spec/plan docs already on the branch; `pnpm build` and `pnpm test` both green from `main`.

---

## Task 1: Rewrite `RenamesTab` as a NarrativeKPI

**Files:**
- Rewrite: `apps/web/src/components/tabs/RenamesTab.tsx`
- Modify: `apps/web/src/components/layout/BottomPanel.tsx` (line 160) — drop `onSelectFile`, pass `onApplyPreset` instead
- Create: `apps/web/src/components/tabs/RenamesTab.test.tsx`

- [ ] **Step 1.1: Rewrite the tab**

Replace the entire contents of `apps/web/src/components/tabs/RenamesTab.tsx`:

```tsx
import { useMemo } from 'react';

import { NarrativeKPI } from '../shared/NarrativeKPI';
import { fmt } from '../theme';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { FileRenameChain, GitrelicReport } from '@gitrelic/core';

interface RenamesTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

interface TierResult {
  variant: BadgeVariant;
  label: string;
}

function rangeTier(
  filesWithRenames: number,
  longestChain: number,
): TierResult {
  if (filesWithRenames === 0) return { variant: 'stale', label: 'No Renames' };
  if (longestChain >= 2)
    return { variant: 'coupling', label: 'Tracked Chains' };
  return { variant: 'coupling', label: 'Renames Tracked' };
}

function topRenamed(chains: FileRenameChain[], n: number): FileRenameChain[] {
  return [...chains]
    .sort((a, b) => {
      if (b.renameCount !== a.renameCount) return b.renameCount - a.renameCount;
      const aBase = a.currentPath.split('/').pop() ?? a.currentPath;
      const bBase = b.currentPath.split('/').pop() ?? b.currentPath;
      return aBase.localeCompare(bBase);
    })
    .slice(0, n);
}

function TopRenamedList({ rows }: { rows: FileRenameChain[] }) {
  if (rows.length === 0) {
    return (
      <p className="max-w-md text-sm text-text-secondary">
        No renames detected in this analysis window.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
        Most renamed
      </div>
      {rows.map((r) => {
        const basename = r.currentPath.split('/').pop() ?? r.currentPath;
        const dir = r.currentPath.slice(
          0,
          Math.max(0, r.currentPath.length - basename.length - 1),
        );
        return (
          <div key={r.currentPath} className="leading-[1.5]">
            <span className="font-mono text-text-primary">{basename}</span>
            {dir.length > 0 && (
              <span className="font-mono text-text-tertiary text-[10px] ml-1.5">
                {dir}
              </span>
            )}
            <span className="text-text-tertiary ml-2">
              <span className="font-mono text-text-primary">
                {fmt(r.renameCount)}
              </span>{' '}
              rename{r.renameCount === 1 ? '' : 's'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RenamesTab({ report, onApplyPreset }: RenamesTabProps) {
  const rt = report.renameTracking;
  const totalFiles = report.loc.totalFiles;

  const longestChain = useMemo(
    () => rt.chains.reduce((max, c) => Math.max(max, c.renameCount), 0),
    [rt.chains],
  );

  const top = useMemo(() => topRenamed(rt.chains, 3), [rt.chains]);
  const tier = rangeTier(rt.filesWithRenames, longestChain);
  const pct =
    totalFiles > 0 ? Math.round((rt.filesWithRenames / totalFiles) * 100) : 0;

  return (
    <NarrativeKPI
      bigNumber={fmt(rt.filesWithRenames)}
      tier={tier}
      metric="FILES RENAMED"
      finding={<TopRenamedList rows={top} />}
      subline={
        <span>
          <span className="font-mono text-text-primary">
            {fmt(rt.totalRenames)}
          </span>{' '}
          rename{rt.totalRenames === 1 ? '' : 's'} · longest chain:{' '}
          <span className="font-mono">{longestChain}</span> step
          {longestChain === 1 ? '' : 's'} ·{' '}
          <span className="font-mono">{pct}%</span> of tracked files have rename
          history
        </span>
      }
      seeAlso={[
        { label: 'Hotspots', presetId: 'hotspots' },
        { label: 'Churn', presetId: 'churn' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
```

Notes:
- `top-3` slice + sort lives inline (small enough not to warrant `apps/web/src/utils/topRenamed.ts`); promote to a util if a second consumer appears.
- The `dir` rendering preserves directory context lost by the old basename-only pills (per spec issue #2). Trailing-slash trim via `currentPath.length - basename.length - 1`; basename-only paths render with `dir = ''` and the dir span hides.
- `pct` uses `report.loc.totalFiles` as the denominator (not `report.meta.totalFiles` — `loc` is the canonical source for file counts post-LOC analyzer).

- [ ] **Step 1.2: Update `BottomPanel.tsx` wiring**

Open `apps/web/src/components/layout/BottomPanel.tsx`. At line 160:

Was:
```tsx
return <RenamesTab report={report} onSelectFile={onSelectFile} />;
```

Change to:
```tsx
return <RenamesTab report={report} onApplyPreset={onApplyPreset} />;
```

Mirror how `KnowledgeSilosTab` / `BlastRadiusTab` / `GhostFilesTab` are wired in the same file. `onApplyPreset` is already available in the surrounding closure (used by other narrative-KPI tabs).

- [ ] **Step 1.3: Write the tab test**

Create `apps/web/src/components/tabs/RenamesTab.test.tsx`. Mirror `GhostFilesTab.test.tsx` / `CoAuthorsAiAdoptionTab.test.tsx` shape:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RenamesTab } from './RenamesTab';
import type { FileRenameChain, GitrelicReport } from '@gitrelic/core';

function makeReport(overrides: {
  chains?: FileRenameChain[];
  totalRenames?: number;
  totalFiles?: number;
}): GitrelicReport {
  const chains = overrides.chains ?? [];
  return {
    renameTracking: {
      renames: [],
      chains,
      totalRenames:
        overrides.totalRenames ?? chains.reduce((s, c) => s + c.renameCount, 0),
      filesWithRenames: chains.length,
      summary: '',
    },
    loc: {
      totalFiles: overrides.totalFiles ?? 100,
      totalLines: 0,
      files: [],
      languages: [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('RenamesTab', () => {
  it('renders the No Renames tier on an empty repo', () => {
    const onApplyPreset = vi.fn();
    render(
      <RenamesTab
        report={makeReport({ chains: [] })}
        onApplyPreset={onApplyPreset}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number')).toHaveTextContent(
      '0',
    );
    expect(screen.getByText('No Renames')).toBeInTheDocument();
    expect(
      screen.getByText('No renames detected in this analysis window.'),
    ).toBeInTheDocument();
  });

  it('renders the Renames Tracked tier when all chains are length 1', () => {
    const chains: FileRenameChain[] = [
      { currentPath: 'src/a.ts', previousNames: ['old/a.ts'], renameCount: 1 },
      { currentPath: 'src/b.ts', previousNames: ['old/b.ts'], renameCount: 1 },
    ];
    render(
      <RenamesTab
        report={makeReport({ chains, totalFiles: 100 })}
        onApplyPreset={() => {}}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number')).toHaveTextContent(
      '2',
    );
    expect(screen.getByText('Renames Tracked')).toBeInTheDocument();
  });

  it('renders the Tracked Chains tier when any chain is length >= 2', () => {
    const chains: FileRenameChain[] = [
      { currentPath: 'src/a.ts', previousNames: ['old/a.ts'], renameCount: 1 },
      {
        currentPath: 'src/b.ts',
        previousNames: ['old/b.ts', 'mid/b.ts'],
        renameCount: 2,
      },
    ];
    render(
      <RenamesTab
        report={makeReport({ chains, totalFiles: 100 })}
        onApplyPreset={() => {}}
      />,
    );
    expect(screen.getByText('Tracked Chains')).toBeInTheDocument();
  });

  it('lists the top-3 most-renamed chains in the finding', () => {
    const chains: FileRenameChain[] = [
      { currentPath: 'a.ts', previousNames: ['x'], renameCount: 1 },
      { currentPath: 'big.ts', previousNames: ['x', 'y', 'z'], renameCount: 3 },
      { currentPath: 'mid.ts', previousNames: ['x', 'y'], renameCount: 2 },
      { currentPath: 'low.ts', previousNames: ['x'], renameCount: 1 },
    ];
    render(
      <RenamesTab
        report={makeReport({ chains, totalFiles: 100 })}
        onApplyPreset={() => {}}
      />,
    );
    expect(screen.getByText('big.ts')).toBeInTheDocument();
    expect(screen.getByText('mid.ts')).toBeInTheDocument();
    // 4th-ranked falls outside top-3 — `low.ts` is excluded.
    expect(screen.queryByText('low.ts')).not.toBeInTheDocument();
  });

  it('renders the subline with totals + longest chain + tracked-files percent', () => {
    const chains: FileRenameChain[] = [
      { currentPath: 'a.ts', previousNames: ['x'], renameCount: 1 },
      { currentPath: 'b.ts', previousNames: ['y', 'z'], renameCount: 2 },
    ];
    render(
      <RenamesTab
        report={makeReport({ chains, totalFiles: 100 })}
        onApplyPreset={() => {}}
      />,
    );
    expect(screen.getByText(/3 renames/)).toBeInTheDocument();
    expect(screen.getByText(/longest chain:/)).toBeInTheDocument();
    expect(screen.getByText(/2% of tracked files/)).toBeInTheDocument();
  });

  it('fires onApplyPreset when see-also footer links are clicked', () => {
    const onApplyPreset = vi.fn();
    render(
      <RenamesTab
        report={makeReport({ chains: [] })}
        onApplyPreset={onApplyPreset}
      />,
    );
    screen.getByRole('button', { name: 'Hotspots' }).click();
    screen.getByRole('button', { name: 'Churn' }).click();
    expect(onApplyPreset).toHaveBeenCalledWith('hotspots');
    expect(onApplyPreset).toHaveBeenCalledWith('churn');
  });
});
```

Run the test:

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
pnpm --filter @gitrelic/web test -- RenamesTab
```

Expected: 6 cases pass.

---

## Task 2: Polish the `RenameSankey` hero

**Files:**
- Modify: `apps/web/src/components/hero/RenameSankey.tsx`
- Modify: `apps/web/src/components/hero/RenameSankey.test.tsx`

- [ ] **Step 2.1: Raise the topN cap default**

In `apps/web/src/components/hero/RenameSankey.tsx`, change the default from 20 to no-cap. Around line 54:

Was:
```ts
export function prepareSankeyData(
  report: GitrelicReport,
  options: SankeyPrepOptions = {},
): { nodes: RenameSankeyNode[]; links: RenameSankeyLink[] } {
  const topN = options.topN ?? 20;
  const sorted = [...report.renameTracking.chains]
    .sort((a, b) => b.renameCount - a.renameCount)
    .slice(0, topN);
```

Change to:
```ts
export function prepareSankeyData(
  report: GitrelicReport,
  options: SankeyPrepOptions = {},
): { nodes: RenameSankeyNode[]; links: RenameSankeyLink[] } {
  const topN = options.topN ?? Number.POSITIVE_INFINITY;
  const sorted = [...report.renameTracking.chains]
    .sort((a, b) => b.renameCount - a.renameCount)
    .slice(0, topN);
```

`Array.prototype.slice` accepts `Infinity` as a no-op end index, returning the whole array.

- [ ] **Step 2.2: Beef up the selected-state stroke**

Around line 217, change the selected stroke width from 1 to 2.5 and ensure full fillOpacity:

Was:
```tsx
<rect
  x={x0}
  y={y0}
  width={width}
  height={height}
  fill={color}
  fillOpacity={isSelected ? 1 : 0.85}
  stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
  strokeWidth={isSelected ? 1 : 0}
/>
```

Change to:
```tsx
<rect
  x={x0}
  y={y0}
  width={width}
  height={height}
  fill={color}
  fillOpacity={isSelected ? 1 : 0.85}
  stroke={isSelected ? 'var(--accent-primary)' : 'transparent'}
  strokeWidth={isSelected ? 2.5 : 0}
/>
```

- [ ] **Step 2.3: Add a `<HeroCaption>` strip**

Import the shared primitive at the top of the file:

```tsx
import { HeroCaption } from '../shared/HeroCaption';
```

Then wrap the existing `return (...)` body to put the caption beneath the SVG. Was:

```tsx
return (
  <div ref={containerRef} className="relative w-full h-full">
    <svg width={dims.width} height={dims.height}>
      {/* ... */}
    </svg>
    {tooltip && (
      <div className="absolute ...">
        {/* ... */}
      </div>
    )}
  </div>
);
```

Change to:

```tsx
return (
  <div ref={containerRef} className="w-full h-full flex flex-col">
    <div className="relative flex-1">
      <svg width={dims.width} height={dims.height}>
        {/* ... */}
      </svg>
      {tooltip && (
        <div className="absolute ...">
          {/* ... */}
        </div>
      )}
    </div>
    <HeroCaption
      primary="Sankey · old name → current name · width = 1 step · color: terminus = current path"
      subtitle="Click any node to inspect the file in the right-side panel."
    />
  </div>
);
```

The tooltip's `style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}` is computed against the container ref — when wrapping in `flex-col`, the inner `relative flex-1` div now becomes the tooltip's positioning context, but `containerRef` still points at the outer div. Update the `getBoundingClientRect()` call inside `onMouseEnter` to use the inner div's rect instead, OR keep `containerRef` on the outer div and shift the inner div's tooltip absolute-positioning to use it. Simpler: keep `containerRef` on the outer div, place `position: relative` on the inner wrapper as currently, and the existing math stays accurate since the SVG is full-width inside the relative wrapper. **Verify by smoke test** — if the tooltip jumps, switch the ref to the inner div.

The empty-state branch (early return on `!sankeyGraph`) also gets the caption — wrap its existing div in the same `flex-col` shape so the caption renders even when there's no data:

```tsx
if (!sankeyGraph) {
  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
        No rename history detected.
      </div>
      <HeroCaption
        primary="Sankey · old name → current name · width = 1 step · color: terminus = current path"
        subtitle="Click any node to inspect the file in the right-side panel."
      />
    </div>
  );
}
```

- [ ] **Step 2.4: Update the `defaults topN` test**

In `apps/web/src/components/hero/RenameSankey.test.tsx`, around line 114:

Was:
```ts
it('defaults topN to 20 when unspecified', () => {
  const chains = Array.from({ length: 25 }, (_, i) =>
    makeChain(`c${i}`, [`prev${i}`]),
  );
  const { links } = prepareSankeyData(makeReport(chains));
  expect(links).toHaveLength(20);
});
```

Change to:
```ts
it('defaults to all chains when topN unspecified', () => {
  const chains = Array.from({ length: 25 }, (_, i) =>
    makeChain(`c${i}`, [`prev${i}`]),
  );
  const { links } = prepareSankeyData(makeReport(chains));
  expect(links).toHaveLength(25);
});
```

Run the test:

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
pnpm --filter @gitrelic/web test -- RenameSankey
```

Expected: all `prepareSankeyData` + `computeDisplayName` cases pass.

---

## Task 3: Author the docs page

**Files:**
- Create: `apps/docs/analyzers/renames.md`

- [ ] **Step 3.1: Author `apps/docs/analyzers/renames.md`**

Mirror `apps/docs/analyzers/ghost-files.md` and `apps/docs/analyzers/co-authors.md` in structure. Frontmatter + intro + screenshot placeholder + quick read + how-it-works (with mermaid pipeline) + metrics strip table + reading-the-surfaces guide + actions + limitations + related analyzers.

Key copy points (refer back to the spec for full framing):

- **Intro framing:** *"structural-history reconstruction, not a risk metric"* — its job is to attribute pre-rename history correctly so other analyzers' caveats ("renames are not followed") have a place to point.
- **Mermaid pipeline:**
  ```mermaid
  graph LR
    A[git log --diff-filter=R] --> B[parseRenameLog]
    B --> C[reverseMap: newPath -> oldPath]
    C --> D[buildRenameChains]
    D --> E[per-file chain walking backwards]
  ```
- **Metrics-strip 5-slot table:** Files Renamed · Total Renames · Longest Chain · Avg Renames/File · Most Renamed (basename). With formulas.
- **Reading the surfaces:** Metrics strip → Sankey hero (click any node for Inspector) → Narrative-KPI panel → Inspector.
- **Limitations:** `--find-renames` similarity threshold (50%); no follow into pre-rename content history; cycle guard; bot-driven mass-renames inflate counts.
- **Related analyzers:** Hotspots, Churn, Coupling, Cursed Files. **Plus a "this analyzer is what fixes the 'renames are not followed' caveat"** callout linking to the 6+ analyzers that cite it (Churn, Age Map, Bus Factor, Blast Radius, Rewrite Ratio, Parallel Dev, Shame, Co-Authors).

- [ ] **Step 3.2: Add to the VitePress sidebar**

Open `apps/docs/.vitepress/config.ts`. Add an entry between `Parallel Dev` and `Rewrite Ratio` in the Analyzers sidebar (alphabetical):

```ts
{ text: 'Parallel Dev', link: '/analyzers/parallel-dev' },
{ text: 'Renames', link: '/analyzers/renames' },         // NEW
{ text: 'Rewrite Ratio', link: '/analyzers/rewrite-ratio' },
```

- [ ] **Step 3.3: Smoke the docs build locally**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
pnpm docs:build
```

Expected: build succeeds; `/analyzers/renames.html` lands in `apps/docs/.vitepress/dist/`. If `pnpm docs:dev` is preferred, run that instead and click the new sidebar entry.

---

## Task 4: Cross-link sweep

**Files:**
- Modify: 7 analyzer doc pages with 9 references total

- [ ] **Step 4.1: Update 9 cross-links from `/analyzers/rename-tracking` to `/analyzers/renames`**

Each file + line:

| File | Line(s) |
|---|---|
| `apps/docs/analyzers/age-map.md` | 53, 147 |
| `apps/docs/analyzers/blast-radius.md` | 56, 119 |
| `apps/docs/analyzers/bus-factor.md` | 59, 171 |
| `apps/docs/analyzers/churn.md` | 52, 150 |
| `apps/docs/analyzers/co-authors.md` | 213 |
| `apps/docs/analyzers/parallel-dev.md` | 53, 155 |
| `apps/docs/analyzers/rewrite-ratio.md` | 57, 164, 165 |
| `apps/docs/analyzers/shame.md` | 83, 152 |

Each match looks like `(/analyzers/rename-tracking)` — replace the inner URL only, keep the `[Rename Tracking]` link text untouched (the user-visible label). Verify no other matches exist:

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
grep -rn "/analyzers/rename-tracking" apps/docs
```

After the sweep, this should return only the `ignoreDeadLinks` entry in `.vitepress/config.ts` (which Task 5 removes).

---

## Task 5: Registry update + `ignoreDeadLinks` cleanup

**Files:**
- Modify: `apps/web/src/presets/registry.ts` (lines 397–411) — set `docsPath`
- Modify: `apps/docs/.vitepress/config.ts` (line 19) — drop `'/analyzers/rename-tracking'`

> **Gate:** This task **must** come after Task 3 (the docs page must exist on disk first). `apps/web/src/presets/registry.test.ts` enforces that any preset with `docsPath` set has its docs file on disk; setting `docsPath` before authoring breaks CI.

- [ ] **Step 5.1: Set `docsPath` on the `renames` preset**

In `apps/web/src/presets/registry.ts`, in the `renames` entry (around line 397):

Was:
```ts
renames: {
  id: 'renames',
  tier: 'analyzer',
  label: 'Renames',
  group: 'structure',
  hero: {
    defaultViz: 'rename-sankey',
    altTabs: ['rename-sankey'],
  },
  bottomPanel: {
    defaultTab: 'renames',
    altTabs: ['renames'],
  },
  metrics: renamesMetrics,
},
```

Change to:
```ts
renames: {
  id: 'renames',
  tier: 'analyzer',
  label: 'Renames',
  group: 'structure',
  hero: {
    defaultViz: 'rename-sankey',
    altTabs: ['rename-sankey'],
  },
  bottomPanel: {
    defaultTab: 'renames',
    altTabs: ['renames'],
  },
  metrics: renamesMetrics,
  docsPath: 'analyzers/renames',
},
```

- [ ] **Step 5.2: Drop the `ignoreDeadLinks` entry**

In `apps/docs/.vitepress/config.ts`, remove `'/analyzers/rename-tracking',` from the `ignoreDeadLinks` array (line 19).

- [ ] **Step 5.3: Verify `registry.test.ts` is happy**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
pnpm --filter @gitrelic/web test -- registry
```

Expected: pass. `registry.test.ts` checks that every preset with `docsPath: 'X'` has a corresponding file at `apps/docs/X.md`.

---

## Task 6: Smoke + lint + full test pass

**Files:** none (verification only)

- [ ] **Step 6.1: Build and run the CLI against React**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
pnpm build
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

Open the served URL. Click the **Renames** sidebar entry. Verify:

- **Metrics strip** unchanged from baseline (no retune).
- **Sankey hero** renders all 58 chains (was 20). Mouse over a node — tooltip shows. Click a node — selected node has visibly thicker stroke; right-side `Inspector` panel updates with the file's metadata.
- **`<HeroCaption>` strip** renders beneath the sankey: primary describes the chart, subtitle reads `"Click any node to inspect the file in the right-side panel."`
- **NarrativeKPI panel:**
  - Big number = `58` (filesWithRenames for React).
  - Tier badge = `Tracked Chains` (since `settings.json`'s chain has `renameCount=2`).
  - `FILES RENAMED` metric label.
  - Top-3 finding lists `settings.json` first (its 2 renames put it on top), with full path + `2 renames`. Other 2 rows are alphabetical-tiebroken length-1 chains.
  - Subline: `"65 renames · longest chain: 2 steps · 5% of tracked files have rename history"` (or similar).
  - Sticky see-also footer: `Hotspots`, `Churn`. Clicking each switches the active preset.
- **Docs link** in the bottom-panel tab bar: right-anchored `Docs ↗` link visible. Click it — opens `/gitrelic/analyzers/renames` in a new tab. Verify the page renders (sidebar entry present, content rendered).

- [ ] **Step 6.2: Lint + format**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
pnpm lint
pnpm format:check
```

Expected: clean. The pre-commit hook will catch any leftover formatting issues, but running here surfaces them earlier.

- [ ] **Step 6.3: Full test suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
pnpm test
```

Expected: all 231 core + ~30 web tests pass (web count grows by 6 from the new `RenamesTab.test.tsx`).

- [ ] **Step 6.4: Final `pnpm build`**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
pnpm build
```

Expected: build succeeds end-to-end (core, cli, web). The `copy-web-dist.mjs` `onSuccess` step runs and `apps/cli/dist/web/index.html` exists.

---

## Task 7: Commit + open PR

**Files:** none (just git ops)

- [ ] **Step 7.1: Stage + commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
git add \
  apps/web/src/components/tabs/RenamesTab.tsx \
  apps/web/src/components/tabs/RenamesTab.test.tsx \
  apps/web/src/components/hero/RenameSankey.tsx \
  apps/web/src/components/hero/RenameSankey.test.tsx \
  apps/web/src/components/layout/BottomPanel.tsx \
  apps/web/src/presets/registry.ts \
  apps/docs/analyzers/renames.md \
  apps/docs/analyzers/age-map.md \
  apps/docs/analyzers/blast-radius.md \
  apps/docs/analyzers/bus-factor.md \
  apps/docs/analyzers/churn.md \
  apps/docs/analyzers/co-authors.md \
  apps/docs/analyzers/parallel-dev.md \
  apps/docs/analyzers/rewrite-ratio.md \
  apps/docs/analyzers/shame.md \
  apps/docs/.vitepress/config.ts \
  docs/superpowers/specs/2026-05-10-rename-tracking-polish-design.md \
  docs/superpowers/plans/2026-05-10-rename-tracking-polish.md \
  docs/polish-pattern.md

git status   # Verify staged set is exactly what's intended
```

Then commit:

```bash
git commit -m "$(cat <<'EOF'
feat(web): rename-tracking polish (RELIC-321)

Replace the bottom-panel SortableTable with a NarrativeKPI panel headlined
by filesWithRenames, polish the RenameSankey hero so its existing
click→Inspector affordance becomes discoverable (raise topN cap, beef up
selected-state stroke, add HeroCaption with click hint), and ship the
analyzer's docs page at apps/docs/analyzers/renames.md.

Bottom panel: drops ~50 lines of redundant table — Inspector + sankey
already cover per-file detail. Big number = filesWithRenames; informational
3-state tier (No Renames / Renames Tracked / Tracked Chains) since rename
volume is workflow-shape signal, not risk. Top-3 most-renamed list in the
finding; subline carries totals + longest chain + tracked-files percent.

Hero: RenameSankey topN default raised from 20 to no-cap (was silently
stranding 38 of React's 58 chains from the Inspector path); selected-stroke
bumped from 1px to 2.5px; HeroCaption added (regression vs the
Churn/Bus Factor/Rewrite Ratio caption pattern).

Docs: renames.md authored at the analyzers/renames slug (matching the
preset key, per the Co-Authors precedent — co-author.ts → analyzers/co-authors).
Drops the placeholder /analyzers/rename-tracking entry from
ignoreDeadLinks and rewrites 9 cross-link references across 7 analyzer
pages to the new slug.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Then sync the polish-pattern doc — move the rename-tracking row from "Pending" to a shipped entry summarizing the decisions. Optional in this same commit or as a follow-up doc commit:

```bash
# Quick sed swap if the row is straightforward — otherwise hand-edit.
# Add a "Mapped" entry summarizing the decisions, similar to the co-authors
# entry. Then:
git add docs/polish-pattern.md
git commit -m "docs: move rename-tracking entry from Pending to Mapped (RELIC-321)"
```

Or fold polish-pattern.md into the main commit's stage list — recent polish PRs have done it both ways.

- [ ] **Step 7.2: Push + open PR**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-321-rename-tracking-polish
git push -u origin relic-321-rename-tracking-polish

gh pr create --title "feat(web): rename-tracking polish (RELIC-321)" --body "$(cat <<'EOF'
## Summary

- Bottom panel: replaces SortableTable with NarrativeKPI (FILES RENAMED big number + 3-state informational tier + top-3 most-renamed finding + subline + Hotspots/Churn see-also).
- Hero: RenameSankey topN cap raised from 20 to all chains, selected-stroke bumped from 1px to 2.5px, HeroCaption added with click-to-inspect hint.
- Docs: ships apps/docs/analyzers/renames.md, sets docsPath on the renames preset, drops the ignoreDeadLinks placeholder, rewrites 9 cross-links across 7 analyzer pages to the new slug.

Linear: [RELIC-321](https://linear.app/nebulord/issue/RELIC-321)
Spec: docs/superpowers/specs/2026-05-10-rename-tracking-polish-design.md
Plan: docs/superpowers/plans/2026-05-10-rename-tracking-polish.md

## Test plan

- [ ] `pnpm test` passes (231 core + ~30 web)
- [ ] `pnpm build` succeeds end-to-end
- [ ] `pnpm docs:build` succeeds with new sidebar entry
- [ ] Smoke: `gitrelic --path ~/Desktop/react --web` — verify NarrativeKPI big number = 58, tier = Tracked Chains, sankey shows all 58 chains with thick selected-stroke after clicking any node, HeroCaption visible, Docs↗ link resolves to /gitrelic/analyzers/renames

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7.3: Wait for the bot review**

Memory tag `reference_pr_claude_review.md` — expect an automated bot review. Plan headroom for 1–2 follow-up commits if the bot surfaces real issues. Common findings on polish PRs: hardcoded copy strings the spec didn't pin down, missing testid attributes, unused imports left over from rewrites.

---

## Done

When all tasks above check out and the PR merges, the polish-pattern doc gets a final pass to move `rename-tracking` from "Pending (Batches 2–N)" to its own shipped entry summarizing the decisions (per the doc's *"After each batch of polish tickets ships, move analyzers from Pending to a new Mapped section"* directive).
