# Analyzer Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the two-phase dashboard refactor described in `docs/superpowers/specs/2026-04-19-analyzer-presets-design.md`. Phase 1 adds Focus Mode (layout-only state). Phase 2 introduces a registry-driven preset framework, refactors `useSelection` to `activePresetId + overrides`, migrates the existing Overview / Risk / Tech Debt modes into the registry, and adds four Tier 2 presets (Hotspots, Bus Factor, Coupling, Contributors) that prove the pattern end-to-end.

**Architecture:** Both phases live entirely inside `apps/web/`. Phase 1's new state is local to `Shell.tsx` and does not touch `useSelection`. Phase 2 introduces `apps/web/src/presets/` (types, registry, per-preset metric composers) and collapses `useSelection` to three fields: `activePresetId`, `heroOverride`, `bottomTabOverride`. Every sidebar click goes through a single `applyPreset(id)` function that clears overrides atomically. Selection (`selectedFile`, `selectedContributor`) stays orthogonal to mode state and survives preset switches. Stream 3 (the remaining 18 analyzer presets) is tracked in the Appendix as a template for follow-up PRs that can land one-per-PR after Phase 2 merges.

**Tech Stack:** TypeScript 6, React 19, Vitest 4 + @testing-library/react 16, happy-dom, Tailwind 4, D3 (force, hierarchy, scale, shape). oxlint + oxfmt run on staged files via husky + lint-staged. Tests live alongside source (`foo.tsx` + `foo.test.tsx`).

**Spec reference:** `docs/superpowers/specs/2026-04-19-analyzer-presets-design.md`. The Registry Contract and Stream Decomposition sections are load-bearing for this plan.

**Phase independence:** Phase 1 can merge and ship before Phase 2 starts. Phase 2 can merge before Stream 3 begins. Keep the two phases on separate PRs if possible.

**Conventions:**
- Commits: conventional-commits style (`feat(web):`, `refactor(web):`, `chore(web):`). Repo is pre-1.0 and semantic-release reclassifies breaking changes as minor — see root CLAUDE.md.
- Pre-commit hook (husky + lint-staged) runs `oxlint --fix` + `oxfmt` on staged files. Do not skip hooks.
- Before any commit that touches multiple files, run `pnpm --filter @gitrelic/web typecheck` to catch drift.
- Test command for this plan: `pnpm --filter @gitrelic/web exec vitest run <path>` for a specific file, or `pnpm --filter @gitrelic/web test` after Task 0 completes.

---

## Task 0: Add headless test script to `@gitrelic/web`

**Why:** `apps/web/package.json` has no `test` script today. The existing `pnpm test:web` at the root opens Vitest's UI, which is interactive. Every subsequent task runs tests headlessly. Adding `"test": "vitest run"` mirrors the convention in `packages/core/package.json`.

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 0.1: Add the test script**

Edit `apps/web/package.json`. In the `"scripts"` block, add `"test": "vitest run"` between `"preview"` and `"typecheck"`:

```json
"scripts": {
  "build": "vite build",
  "dev": "vite --port 7777",
  "preview": "vite preview",
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "clean": "rm -rf dist"
},
```

- [ ] **Step 0.2: Verify existing tests still pass**

Run: `pnpm --filter @gitrelic/web test`
Expected: PASS — 29 web tests green (counts may drift; the point is no failures).

- [ ] **Step 0.3: Commit**

```bash
git add apps/web/package.json
git commit -m "chore(web): add headless vitest script"
```

---

# Phase 1 — Focus Mode (Stream 1)

Self-contained. No dependency on the preset registry. Can merge before Phase 2 begins.

---

## Task 1.1: Introduce `LayoutMode` enum and local state in `Shell`

**Why:** Focus Mode is view-local layout state, not content state. Per spec Registry Contract ("**No changes to:** `useSelection`..."), the mode lives on `Shell.tsx` as a `useState`.

**Files:**
- Modify: `apps/web/src/components/layout/Shell.tsx`
- Create: `apps/web/src/components/layout/Shell.test.tsx`

- [ ] **Step 1.1.1: Write the failing test for default layout mode**

Create `apps/web/src/components/layout/Shell.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Shell } from './Shell';

import type { GitrelicReport } from '@gitrelic/core';

function makeMinimalReport(): GitrelicReport {
  return {
    meta: { totalAuthors: 0, ageInDays: 0 },
    churn: { files: [], topFiles: [], hotspotCount: 0, summary: '' },
    loc: { totalFiles: 0, totalLines: 0, files: [], languages: [], summary: '' },
    hotspots: { files: [], topHotspots: [], summary: '' },
    cursedFiles: [],
    busFactors: { criticalFiles: [] },
    deadCode: { totalDeadFiles: 0, candidates: [] },
    ghostFiles: { totalGhostFiles: 0 },
    knowledgeConcentration: { concentrationIndex: 0 },
    blastRadius: { files: [] },
    complexityTrend: { growingFiles: [] },
    rewriteRatio: { topRewriters: [] },
    churnVelocity: { acceleratingFiles: [] },
  } as Partial<GitrelicReport> as GitrelicReport;
}

describe('Shell layout mode', () => {
  it('renders sidebar, bottom panel, and inspector by default', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    expect(container.querySelector('nav')).not.toBeNull();
    // Bottom panel has a resize handle div with cursor: row-resize
    expect(container.querySelector('[style*="row-resize"]')).not.toBeNull();
  });
});
```

- [ ] **Step 1.1.2: Verify the test fails**

Run: `pnpm --filter @gitrelic/web exec vitest run src/components/layout/Shell.test.tsx`
Expected: likely PASS actually (default layout already renders all panels). If it passes, that's fine — this test locks in current baseline behavior. If it fails for fixture reasons, extend `makeMinimalReport()` with additional required fields until it passes against current `Shell` code, then proceed.

- [ ] **Step 1.1.3: Add `LayoutMode` state and export**

Edit `apps/web/src/components/layout/Shell.tsx`. At the top of the file, add:

```tsx
import { useEffect, useState } from 'react';
```

(update the existing `useEffect`-only import).

Below the imports, add:

```tsx
export type LayoutMode =
  | 'default'
  | 'focus-canvas'
  | 'fullscreen-hero'
  | 'fullscreen-table'
  | 'canvas-minimal';

interface PanelVisibility {
  sidebar: boolean;
  bottomPanel: boolean;
  inspector: boolean;
  metricsStrip: boolean;
}

function computeVisibility(mode: LayoutMode): PanelVisibility {
  switch (mode) {
    case 'focus-canvas':
      return { sidebar: false, bottomPanel: true, inspector: false, metricsStrip: true };
    case 'fullscreen-hero':
      return { sidebar: false, bottomPanel: false, inspector: false, metricsStrip: false };
    case 'fullscreen-table':
      return { sidebar: false, bottomPanel: true, inspector: false, metricsStrip: false };
    case 'canvas-minimal':
      return { sidebar: false, bottomPanel: false, inspector: false, metricsStrip: true };
    default:
      return { sidebar: true, bottomPanel: true, inspector: true, metricsStrip: true };
  }
}
```

Inside `Shell`, below the existing `const selection = useSelection();`, add:

```tsx
const [layoutMode, setLayoutMode] = useState<LayoutMode>('default');
const visibility = computeVisibility(layoutMode);
```

- [ ] **Step 1.1.4: Verify tests still pass**

Run: `pnpm --filter @gitrelic/web test`
Expected: all pass. No behavior change yet — state is computed but not consumed.

- [ ] **Step 1.1.5: Commit**

```bash
git add apps/web/src/components/layout/Shell.tsx apps/web/src/components/layout/Shell.test.tsx
git commit -m "feat(web): add LayoutMode state scaffolding to Shell"
```

---

## Task 1.2: Wire `PanelVisibility` to the rendered panels

**Why:** The state from Task 1.1 is computed but not consumed. Condition the sidebar / bottom panel / inspector / metrics strip rendering on `visibility`.

**Files:**
- Modify: `apps/web/src/components/layout/Shell.tsx`
- Modify: `apps/web/src/components/layout/Shell.test.tsx`

- [ ] **Step 1.2.1: Write tests for each layout mode**

Append to `Shell.test.tsx`:

```tsx
import { useState } from 'react';

it('hides sidebar, inspector, and metrics in fullscreen-hero mode', () => {
  // This test uses a wrapper that exposes setLayoutMode via a button for simplicity.
  // Alternatively, export a Shell variant that accepts layoutMode as a prop for testability.
  // For now, verify the computeVisibility function directly.
});
```

Actually simpler: export `computeVisibility` from `Shell.tsx` and test it as a pure function. Rewrite the test block:

```tsx
import { computeVisibility } from './Shell';

describe('computeVisibility', () => {
  it('returns all visible for default mode', () => {
    expect(computeVisibility('default')).toEqual({
      sidebar: true,
      bottomPanel: true,
      inspector: true,
      metricsStrip: true,
    });
  });

  it('hides sidebar/inspector in focus-canvas', () => {
    expect(computeVisibility('focus-canvas')).toEqual({
      sidebar: false,
      bottomPanel: true,
      inspector: false,
      metricsStrip: true,
    });
  });

  it('hides everything but hero in fullscreen-hero', () => {
    expect(computeVisibility('fullscreen-hero')).toEqual({
      sidebar: false,
      bottomPanel: false,
      inspector: false,
      metricsStrip: false,
    });
  });

  it('shows only bottom panel in fullscreen-table', () => {
    expect(computeVisibility('fullscreen-table')).toEqual({
      sidebar: false,
      bottomPanel: true,
      inspector: false,
      metricsStrip: false,
    });
  });

  it('shows metrics + hero only in canvas-minimal', () => {
    expect(computeVisibility('canvas-minimal')).toEqual({
      sidebar: false,
      bottomPanel: false,
      inspector: false,
      metricsStrip: true,
    });
  });
});
```

- [ ] **Step 1.2.2: Export `computeVisibility`**

In `Shell.tsx`, change `function computeVisibility` to `export function computeVisibility`.

- [ ] **Step 1.2.3: Verify tests pass**

Run: `pnpm --filter @gitrelic/web exec vitest run src/components/layout/Shell.test.tsx`
Expected: PASS for all `computeVisibility` cases.

- [ ] **Step 1.2.4: Wire visibility into the JSX**

In `Shell.tsx`, wrap each conditional panel:

```tsx
{/* Left sidebar */}
{visibility.sidebar && (
  <Sidebar
    report={report}
    activeItem={selection.activeNavItem}
    dashboardMode={selection.dashboardMode}
    onNavigate={selection.navigateTo}
    onDashboardMode={selection.setDashboardMode}
  />
)}
```

For the metrics strip:

```tsx
{visibility.metricsStrip && (
  <MetricsStrip report={report} dashboardMode={selection.dashboardMode} />
)}
```

For the bottom panel:

```tsx
{visibility.bottomPanel && (
  <BottomPanel
    report={report}
    activeGroup={selection.activeGroup}
    activeTab={selection.activeBottomTab}
    onTabChange={selection.setActiveBottomTab}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
  />
)}
```

For the inspector:

```tsx
{visibility.inspector && (
  <InspectorPanel
    report={report}
    selectedFile={selection.selectedFile}
    selectedContributor={selection.selectedContributor}
    activeTab={selection.activeInspectorTab}
    onTabChange={selection.setActiveInspectorTab}
    onSelectFile={selection.selectFile}
    onSelectContributor={selection.selectContributor}
  />
)}
```

- [ ] **Step 1.2.5: Verify full test suite passes**

Run: `pnpm --filter @gitrelic/web test`
Expected: all PASS (no regressions). Default mode renders everything, exactly as before.

- [ ] **Step 1.2.6: Commit**

```bash
git add apps/web/src/components/layout/Shell.tsx apps/web/src/components/layout/Shell.test.tsx
git commit -m "feat(web): gate panels on LayoutMode visibility"
```

---

## Task 1.3: `LayoutControls` component — top-right panel toggles

**Why:** User-visible control for toggling panels. Lives in the top-right of `TopBar`. Three icon buttons (sidebar / bottom panel / inspector) plus a small layout-mode dropdown.

**Files:**
- Create: `apps/web/src/components/layout/LayoutControls.tsx`
- Modify: `apps/web/src/components/layout/TopBar.tsx`
- Modify: `apps/web/src/components/layout/Shell.tsx` (pass `layoutMode` and `setLayoutMode` to `TopBar`)

- [ ] **Step 1.3.1: Create `LayoutControls.tsx`**

```tsx
import type { LayoutMode } from './Shell';

interface LayoutControlsProps {
  mode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
}

const MODE_LABELS: Record<LayoutMode, string> = {
  default: 'Default',
  'focus-canvas': 'Focus Canvas',
  'fullscreen-hero': 'Fullscreen Hero',
  'fullscreen-table': 'Fullscreen Table',
  'canvas-minimal': 'Canvas Minimal',
};

export function LayoutControls({ mode, onModeChange }: LayoutControlsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        aria-label="Toggle sidebar"
        onClick={() => onModeChange(mode === 'focus-canvas' ? 'default' : 'focus-canvas')}
        style={iconButtonStyle(mode !== 'default' && mode !== 'canvas-minimal')}
      >
        ◧
      </button>
      <button
        aria-label="Toggle bottom panel"
        onClick={() => onModeChange(mode === 'fullscreen-hero' ? 'default' : 'fullscreen-hero')}
        style={iconButtonStyle(mode === 'fullscreen-hero' || mode === 'canvas-minimal')}
      >
        ⬓
      </button>
      <button
        aria-label="Toggle inspector"
        onClick={() => onModeChange(mode === 'default' ? 'focus-canvas' : 'default')}
        style={iconButtonStyle(mode !== 'default')}
      >
        ◨
      </button>
      <select
        aria-label="Layout mode"
        value={mode}
        onChange={(e) => onModeChange(e.target.value as LayoutMode)}
        style={{
          fontSize: 11,
          padding: '2px 6px',
          background: 'var(--surface-tertiary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 4,
        }}
      >
        {(Object.keys(MODE_LABELS) as LayoutMode[]).map((m) => (
          <option key={m} value={m}>
            {MODE_LABELS[m]}
          </option>
        ))}
      </select>
    </div>
  );
}

function iconButtonStyle(active: boolean): React.CSSProperties {
  return {
    padding: '4px 8px',
    fontSize: 14,
    lineHeight: 1,
    border: '1px solid var(--border-primary)',
    borderRadius: 4,
    background: active ? 'var(--surface-elevated)' : 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
  };
}
```

- [ ] **Step 1.3.2: Accept `layoutMode` + `onLayoutModeChange` in `TopBar`**

Read `apps/web/src/components/layout/TopBar.tsx` first. Add props to its interface, slot `<LayoutControls>` into its rightmost position (append next to whatever currently sits at the right). Keep existing controls intact — the `theme toggle` etc. stay.

```tsx
import { LayoutControls } from './LayoutControls';
import type { LayoutMode } from './Shell';

interface TopBarProps {
  report: GitrelicReport;
  layoutMode: LayoutMode;
  onLayoutModeChange: (mode: LayoutMode) => void;
}
```

Render `<LayoutControls mode={layoutMode} onModeChange={onLayoutModeChange} />` within the existing TopBar flex container, rightmost position.

- [ ] **Step 1.3.3: Pass props from `Shell` to `TopBar` and remove stale lint suppression**

In `Shell.tsx`:

```tsx
<TopBar report={report} layoutMode={layoutMode} onLayoutModeChange={setLayoutMode} />
```

**Also delete the stale oxlint suppression.** Task 1.1's lint-hygiene follow-up added `// oxlint-disable-next-line no-unused-vars -- consumed in Task 1.3` directly above the `const [layoutMode, setLayoutMode] = useState<LayoutMode>('default');` line. Both `layoutMode` and `setLayoutMode` are now consumed (in the `<TopBar>` prop above), so the suppression is orphaned. oxlint does NOT error on unused disable directives, so this comment will silently survive into main unless explicitly removed. Delete that single-line comment.

- [ ] **Step 1.3.4: Typecheck**

Run: `pnpm --filter @gitrelic/web typecheck`
Expected: no errors.

- [ ] **Step 1.3.5: Full test suite**

Run: `pnpm --filter @gitrelic/web test`
Expected: PASS.

- [ ] **Step 1.3.6: Commit**

```bash
git add apps/web/src/components/layout/LayoutControls.tsx apps/web/src/components/layout/TopBar.tsx apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): top-bar LayoutControls for focus mode"
```

---

## Task 1.4: Keyboard shortcuts

**Why:** Spec's Focus Mode section specifies `⌘.` (focus canvas), `⌘⇧.` (fullscreen hero), `⌘⇧,` (fullscreen table), `Esc` (return to default).

**Files:**
- Modify: `apps/web/src/components/layout/Shell.tsx`
- Modify: `apps/web/src/components/layout/Shell.test.tsx`

- [ ] **Step 1.4.1: Write the failing test**

Append to `Shell.test.tsx`:

```tsx
import { fireEvent, render } from '@testing-library/react';

describe('Shell keyboard shortcuts', () => {
  it('⌘. enters focus-canvas mode', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    // Sidebar visible initially
    expect(container.querySelector('nav')).not.toBeNull();
    fireEvent.keyDown(window, { key: '.', metaKey: true });
    // Sidebar hidden in focus-canvas
    expect(container.querySelector('nav')).toBeNull();
  });

  it('Esc returns to default mode', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    fireEvent.keyDown(window, { key: '.', metaKey: true });
    expect(container.querySelector('nav')).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('nav')).not.toBeNull();
  });

  it('⌘⇧. enters fullscreen-hero mode', () => {
    const { container } = render(<Shell report={makeMinimalReport()} />);
    fireEvent.keyDown(window, { key: '.', metaKey: true, shiftKey: true });
    // Bottom panel hidden
    expect(container.querySelector('[style*="row-resize"]')).toBeNull();
  });
});
```

- [ ] **Step 1.4.2: Verify the test fails**

Run: `pnpm --filter @gitrelic/web exec vitest run src/components/layout/Shell.test.tsx`
Expected: FAIL for shortcut tests — no handler installed yet.

- [ ] **Step 1.4.3: Install the global keyboard handler**

In `Shell.tsx`, inside the component, after the `useState` for layoutMode:

```tsx
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.metaKey && !e.shiftKey && e.key === '.') {
      e.preventDefault();
      setLayoutMode((m) => (m === 'focus-canvas' ? 'default' : 'focus-canvas'));
      return;
    }
    if (e.metaKey && e.shiftKey && e.key === '.') {
      e.preventDefault();
      setLayoutMode((m) => (m === 'fullscreen-hero' ? 'default' : 'fullscreen-hero'));
      return;
    }
    if (e.metaKey && e.shiftKey && e.key === ',') {
      e.preventDefault();
      setLayoutMode((m) => (m === 'fullscreen-table' ? 'default' : 'fullscreen-table'));
      return;
    }
    if (e.key === 'Escape') {
      setLayoutMode('default');
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

- [ ] **Step 1.4.4: Verify tests pass**

Run: `pnpm --filter @gitrelic/web exec vitest run src/components/layout/Shell.test.tsx`
Expected: PASS for all shortcut cases.

- [ ] **Step 1.4.5: Commit**

```bash
git add apps/web/src/components/layout/Shell.tsx apps/web/src/components/layout/Shell.test.tsx
git commit -m "feat(web): focus-mode keyboard shortcuts"
```

---

## Task 1.5: Phase 1 verification

**Why:** Before starting Phase 2 (or merging Phase 1 alone), verify the dashboard still loads, keyboard shortcuts behave, and nothing's regressed.

**Files:** none

- [ ] **Step 1.5.1: Typecheck, lint, test**

Run in parallel:
```bash
pnpm --filter @gitrelic/web typecheck
pnpm --filter @gitrelic/web test
pnpm lint
```

Expected: all green.

- [ ] **Step 1.5.2: Manual smoke**

```bash
# In one terminal:
pnpm --filter @gitrelic/web dev
```

Navigate to `http://localhost:7777`. Verify:
- Default layout renders all four panels.
- Top-bar dropdown switches between the 5 layout modes.
- `⌘.`, `⌘⇧.`, `⌘⇧,` hit the expected modes; `Esc` returns to default.
- Selection state (clicking a file) survives layout-mode changes.

- [ ] **Step 1.5.3 (optional): Open Phase 1 PR**

If Phase 1 is shipping separately, open a PR named `feat(web): focus mode` containing the commits from Tasks 0–1.5. This is the natural merge point before Phase 2.

---

# Phase 2 — Preset Framework + 4 Analyzers (Stream 2)

Load-bearing refactor. Introduces `apps/web/src/presets/`, rewrites `useSelection`, updates four layout components, migrates the existing Tier 1 modes, adds four Tier 2 presets.

---

## Task 2.1: Create `presets/types.ts` with the registry shape

**Why:** The shared type surface the whole framework consumes. Fixed first so everything downstream types cleanly.

**Files:**
- Create: `apps/web/src/presets/types.ts`

- [ ] **Step 2.1.1: Write the types module**

```typescript
import type { GitrelicReport } from '@gitrelic/core';

export type PresetTier = 'dashboard' | 'analyzer';

export type SidebarGroupLabel =
  | 'overview'
  | 'code-health'
  | 'ownership-risk'
  | 'team-activity'
  | 'structure';

export type HeroViz =
  | 'treemap'
  | 'ownership'
  | 'coupling'
  | 'commit-graph'
  | 'scatter'
  | 'timeline'
  | 'swimlanes'
  | 'risk-heatmap'
  | 'ownership-sunburst'
  | 'growth-timeline'
  | 'debt-scatter';

export type BottomTab =
  | 'hotspots'
  | 'cursed-files'
  | 'bus-factor'
  | 'coupling'
  | 'contributors'
  | 'parallel-dev'
  | 'shame'
  | 'age-map'
  | 'dead-code'
  | 'complexity-trend'
  | 'rewrite-ratio'
  | 'churn-velocity'
  | 'blast-radius'
  | 'ghost-files'
  | 'knowledge-silos'
  | 'co-authors'
  | 'commit-timing'
  | 'languages'
  | 'test-coverage'
  | 'renames'
  | 'risk-register'
  | 'debt-inventory';

export interface Metric {
  label: string;
  value: string;
  color: string;
}

export type DashboardPresetId = 'overview' | 'risk' | 'tech-debt';

export type AnalyzerPresetId =
  | 'hotspots'
  | 'bus-factor'
  | 'coupling'
  | 'contributors';
// NOTE: Stream 3 will extend AnalyzerPresetId with the remaining 18 presets.

export type PresetId = DashboardPresetId | AnalyzerPresetId;

export interface PresetDefinition {
  id: PresetId;
  tier: PresetTier;
  label: string;
  group: SidebarGroupLabel;
  hero: {
    defaultViz: HeroViz;
    altTabs: HeroViz[];
  };
  bottomPanel: {
    defaultTab: BottomTab;
    altTabs: BottomTab[];
  };
  metrics: (report: GitrelicReport) => Metric[];
}
```

**Type strategy decision** (called out in spec Registry Contract): `PresetId` is a hand-maintained string-literal union. This keeps the `PRESETS` record's value-type elaboration clean and supports type-narrowing at call sites. Adding a preset requires two edits (one in this file, one in `registry.ts`); a registry-contract test (Task 2.3) catches any drift.

- [ ] **Step 2.1.2: Typecheck**

Run: `pnpm --filter @gitrelic/web typecheck`
Expected: no errors (file is standalone, no consumers yet).

- [ ] **Step 2.1.3: Commit**

```bash
git add apps/web/src/presets/types.ts
git commit -m "feat(web): add preset registry types"
```

---

## Task 2.2: Lift metric-composition functions out of `MetricsStrip` into `presets/metrics/`

**Why:** Pure refactor. `MetricsStrip` currently defines `getOverviewMetrics`, `getRiskMetrics`, `getTechDebtMetrics`. Moving them to per-preset modules prepares for the registry and keeps `MetricsStrip` focused on rendering.

**Files:**
- Create: `apps/web/src/presets/metrics/overview.ts`
- Create: `apps/web/src/presets/metrics/risk.ts`
- Create: `apps/web/src/presets/metrics/tech-debt.ts`
- Modify: `apps/web/src/components/layout/MetricsStrip.tsx`

- [ ] **Step 2.2.1: Create `presets/metrics/overview.ts`**

Copy the body of `getOverviewMetrics` from `MetricsStrip.tsx` into this file. Export as default-named `overviewMetrics`:

```typescript
import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function overviewMetrics(report: GitrelicReport): Metric[] {
  const criticalCount = report.hotspots.topHotspots.filter(
    (h) => h.category === 'critical',
  ).length;

  return [
    {
      label: 'Cursed Files',
      value: String(report.cursedFiles.length),
      color:
        report.cursedFiles.length > 0
          ? 'var(--severity-critical)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Hotspots',
      value: String(criticalCount),
      color:
        criticalCount > 3
          ? 'var(--severity-critical)'
          : criticalCount > 0
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'Bus Factor Risks',
      value: String(report.busFactors.criticalFiles.length),
      color:
        report.busFactors.criticalFiles.length > 0
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Contributors',
      value: String(report.meta.totalAuthors),
      color: 'var(--accent-primary)',
    },
    {
      label: 'Repo Age',
      value: `${(report.meta.ageInDays / 365).toFixed(1)}y`,
      color: 'var(--text-primary)',
    },
    {
      label: 'Lines of Code',
      value: fmt(report.loc.totalLines),
      color: 'var(--text-primary)',
    },
  ];
}
```

- [ ] **Step 2.2.2: Create `presets/metrics/risk.ts`**

Same approach for `getRiskMetrics`:

```typescript
import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function riskMetrics(report: GitrelicReport): Metric[] {
  const criticalBusFactor = report.busFactors.criticalFiles.length;
  const ghostFiles = report.ghostFiles.totalGhostFiles;
  const concentrationIndex = Math.round(report.knowledgeConcentration.concentrationIndex);
  const highBlastRadius = report.blastRadius.files.filter((f) => f.blastScore > 70).length;

  const locMap = new Map<string, number>();
  for (const entry of report.loc.files) {
    locMap.set(entry.file, entry.lines);
  }
  const atRiskLoc = report.busFactors.criticalFiles.reduce(
    (sum, f) => sum + (locMap.get(f.file) ?? 0),
    0,
  );

  return [
    {
      label: 'Critical Bus Factor',
      value: String(criticalBusFactor),
      color: criticalBusFactor > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Ghost Files',
      value: String(ghostFiles),
      color: ghostFiles > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Knowledge Concentration',
      value: `${concentrationIndex}%`,
      color: concentrationIndex > 60 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'High Blast Radius',
      value: String(highBlastRadius),
      color: highBlastRadius > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'At-Risk LOC',
      value: fmt(atRiskLoc),
      color: atRiskLoc > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
  ];
}
```

- [ ] **Step 2.2.3: Create `presets/metrics/tech-debt.ts`**

```typescript
import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function techDebtMetrics(report: GitrelicReport): Metric[] {
  const deadFiles = report.deadCode.totalDeadFiles;
  const growingFiles = report.complexityTrend.growingFiles.length;
  const highRewrite = report.rewriteRatio.topRewriters.length;
  const acceleratingChurn = report.churnVelocity.acceleratingFiles.length;

  const locMap = new Map<string, number>();
  for (const entry of report.loc.files) {
    locMap.set(entry.file, entry.lines);
  }

  const debtFileSet = new Set<string>();
  for (const f of report.deadCode.candidates) {
    debtFileSet.add(f.file);
  }
  for (const f of report.rewriteRatio.topRewriters) {
    debtFileSet.add(f.file);
  }
  const debtLoc = Array.from(debtFileSet).reduce(
    (sum, file) => sum + (locMap.get(file) ?? 0),
    0,
  );

  return [
    {
      label: 'Dead Files',
      value: String(deadFiles),
      color: deadFiles > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Growing Files',
      value: String(growingFiles),
      color: growingFiles > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'High Rewrite',
      value: String(highRewrite),
      color: highRewrite > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Accelerating Churn',
      value: String(acceleratingChurn),
      color: acceleratingChurn > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Debt LOC',
      value: fmt(debtLoc),
      color: debtLoc > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
  ];
}
```

- [ ] **Step 2.2.4: Remove the functions from `MetricsStrip.tsx` (interim shape)**

This leaves `MetricsStrip` in a deliberately transitional state: it still takes `dashboardMode` as a prop and dispatches internally. Task 2.8 removes the dispatcher entirely and changes the prop shape to `metrics: Metric[]`. Between Task 2.2 and Task 2.8, the code compiles and tests pass — the old API is still used by Shell.

Delete `getOverviewMetrics`, `getRiskMetrics`, `getTechDebtMetrics`, and the `getMetrics` dispatcher from `MetricsStrip.tsx`. Also delete its `Metric` interface — will now import from `presets/types.ts`. Leave the render-only code intact (we'll change its prop shape in Task 2.8).

```tsx
// apps/web/src/components/layout/MetricsStrip.tsx
import { fmt } from '../theme';
import { overviewMetrics } from '../../presets/metrics/overview';
import { riskMetrics } from '../../presets/metrics/risk';
import { techDebtMetrics } from '../../presets/metrics/tech-debt';

import type { DashboardMode } from '../../hooks/useSelection';
import type { Metric } from '../../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

interface MetricsStripProps {
  report: GitrelicReport;
  dashboardMode: DashboardMode;
}

function getMetrics(report: GitrelicReport, mode: DashboardMode): Metric[] {
  switch (mode) {
    case 'risk':
      return riskMetrics(report);
    case 'tech-debt':
      return techDebtMetrics(report);
    default:
      return overviewMetrics(report);
  }
}

export function MetricsStrip({ report, dashboardMode }: MetricsStripProps) {
  const metrics = getMetrics(report, dashboardMode);
  // ...keep existing render block unchanged...
}
```

The `fmt` import line may now be unused; if so, delete it. The rendering block (mapping `metrics` → cells) stays exactly as-is.

- [ ] **Step 2.2.5: Typecheck + tests**

Run:
```bash
pnpm --filter @gitrelic/web typecheck
pnpm --filter @gitrelic/web test
```

Expected: all pass. This is a pure refactor — no behavior change.

- [ ] **Step 2.2.6: Commit**

```bash
git add apps/web/src/presets/metrics apps/web/src/components/layout/MetricsStrip.tsx
git commit -m "refactor(web): lift metric composition into presets/metrics"
```

---

## Task 2.3: Create `presets/registry.ts` with Tier 1 entries

**Why:** Introduce the `PRESETS` record. Populate with the three existing Dashboard modes migrated to the new shape. No Tier 2 yet.

**Files:**
- Create: `apps/web/src/presets/registry.ts`

- [ ] **Step 2.3.1: Write the registry**

```typescript
import { overviewMetrics } from './metrics/overview';
import { riskMetrics } from './metrics/risk';
import { techDebtMetrics } from './metrics/tech-debt';

import type { PresetDefinition, PresetId } from './types';

export const PRESETS: Record<PresetId, PresetDefinition> = {
  overview: {
    id: 'overview',
    tier: 'dashboard',
    label: 'Overview',
    group: 'overview',
    hero: {
      defaultViz: 'treemap',
      altTabs: [
        'treemap',
        'ownership',
        'coupling',
        'commit-graph',
        'scatter',
        'timeline',
        'swimlanes',
      ],
    },
    bottomPanel: {
      defaultTab: 'hotspots',
      altTabs: ['hotspots', 'cursed-files', 'bus-factor', 'churn-velocity', 'ghost-files'],
    },
    metrics: overviewMetrics,
  },
  risk: {
    id: 'risk',
    tier: 'dashboard',
    label: 'Risk',
    group: 'overview',
    hero: {
      defaultViz: 'risk-heatmap',
      altTabs: ['risk-heatmap', 'ownership-sunburst'],
    },
    bottomPanel: {
      defaultTab: 'risk-register',
      altTabs: ['risk-register', 'bus-factor', 'ghost-files', 'knowledge-silos'],
    },
    metrics: riskMetrics,
  },
  'tech-debt': {
    id: 'tech-debt',
    tier: 'dashboard',
    label: 'Tech Debt',
    group: 'overview',
    hero: {
      defaultViz: 'growth-timeline',
      altTabs: ['growth-timeline', 'debt-scatter'],
    },
    bottomPanel: {
      defaultTab: 'debt-inventory',
      altTabs: ['debt-inventory', 'dead-code', 'complexity-trend', 'rewrite-ratio', 'churn-velocity'],
    },
    metrics: techDebtMetrics,
  },
  // Tier 2 entries (Tasks 2.11 – 2.14) go below this line.
  hotspots: undefined as unknown as PresetDefinition,
  'bus-factor': undefined as unknown as PresetDefinition,
  coupling: undefined as unknown as PresetDefinition,
  contributors: undefined as unknown as PresetDefinition,
};
```

**Note on the `undefined as unknown as PresetDefinition` placeholders:** these keep the `Record<PresetId, ...>` shape complete while deferring the Tier 2 definitions to Tasks 2.11–2.14. The registry contract test (Task 2.4) will skip Tier 2 until those tasks land, OR be written in a way that filters them out. Alternative: narrow `PresetId` in `types.ts` to only Tier 1 now, widen it per task. We take the placeholder approach to keep `types.ts` stable.

- [ ] **Step 2.3.2: Typecheck**

Run: `pnpm --filter @gitrelic/web typecheck`
Expected: no errors.

- [ ] **Step 2.3.3: Commit**

```bash
git add apps/web/src/presets/registry.ts
git commit -m "feat(web): registry with Tier 1 preset entries"
```

---

## Task 2.4: Registry contract tests

**Why:** Locks the invariants: for every defined preset, `defaultViz ∈ altTabs`, `defaultTab ∈ altTabs`, `metrics(report)` returns 1–5 entries.

**Files:**
- Create: `apps/web/src/presets/registry.test.ts`

- [ ] **Step 2.4.1: Write the tests**

```typescript
import { describe, expect, it } from 'vitest';

import { PRESETS } from './registry';
import type { GitrelicReport } from '@gitrelic/core';
import type { PresetDefinition, PresetId } from './types';

// Minimal report fixture for metrics() invocation. Expand as new metric functions need it.
function makeReport(): GitrelicReport {
  return {
    meta: { totalAuthors: 5, ageInDays: 365 },
    churn: { files: [], topFiles: [], hotspotCount: 0, summary: '' },
    loc: { totalFiles: 10, totalLines: 1000, files: [], languages: [], summary: '' },
    hotspots: { files: [], topHotspots: [], summary: '' },
    cursedFiles: [],
    busFactors: { criticalFiles: [] },
    deadCode: { totalDeadFiles: 0, candidates: [] },
    ghostFiles: { totalGhostFiles: 0 },
    knowledgeConcentration: { concentrationIndex: 0 },
    blastRadius: { files: [] },
    complexityTrend: { growingFiles: [] },
    rewriteRatio: { topRewriters: [] },
    churnVelocity: { acceleratingFiles: [] },
  } as Partial<GitrelicReport> as GitrelicReport;
}

const DEFINED_PRESETS = (Object.entries(PRESETS) as [PresetId, PresetDefinition | undefined][])
  .filter(([, def]) => def !== undefined)
  .map(([id, def]) => ({ id, def: def as PresetDefinition }));

describe('PRESETS registry contract', () => {
  it.each(DEFINED_PRESETS)('$id: defaultViz is included in hero.altTabs', ({ def }) => {
    expect(def.hero.altTabs).toContain(def.hero.defaultViz);
  });

  it.each(DEFINED_PRESETS)('$id: defaultTab is included in bottomPanel.altTabs', ({ def }) => {
    expect(def.bottomPanel.altTabs).toContain(def.bottomPanel.defaultTab);
  });

  it.each(DEFINED_PRESETS)('$id: metrics returns 1 to 5 entries', ({ def }) => {
    const result = def.metrics(makeReport());
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it.each(DEFINED_PRESETS)('$id: id field matches the registry key', ({ id, def }) => {
    expect(def.id).toBe(id);
  });

  it('includes all three Tier 1 presets', () => {
    const tier1Ids = DEFINED_PRESETS.filter(({ def }) => def.tier === 'dashboard').map(
      ({ id }) => id,
    );
    expect(tier1Ids).toEqual(expect.arrayContaining(['overview', 'risk', 'tech-debt']));
  });
});
```

- [ ] **Step 2.4.2: Run the tests**

Run: `pnpm --filter @gitrelic/web exec vitest run src/presets/registry.test.ts`
Expected: PASS. (`overviewMetrics` returns 6 entries today — see note below.)

- [ ] **Step 2.4.3: Fix the overview metrics length (spec says 1–5)**

The current `overviewMetrics` returns six cells (Cursed Files / Hotspots / Bus Factor Risks / Contributors / Repo Age / Lines of Code). Spec Resolved Decisions pins metric strip at **1–5 cells**. Drop the least-useful entry. Recommendation: drop **"Lines of Code"** — it's already visible in the TopBar footer area and is repo-wide context, not an overview signal.

Edit `apps/web/src/presets/metrics/overview.ts`: delete the final `{ label: 'Lines of Code', ... }` entry.

- [ ] **Step 2.4.4: Re-run the tests**

Run: `pnpm --filter @gitrelic/web exec vitest run src/presets/registry.test.ts`
Expected: PASS.

- [ ] **Step 2.4.5: Commit**

```bash
git add apps/web/src/presets/registry.test.ts apps/web/src/presets/metrics/overview.ts
git commit -m "feat(web): registry contract tests + trim overview metrics to 5"
```

---

## Task 2.5: Refactor `useSelection` — write new tests first

**Why:** The hook refactor is the load-bearing change. Writing the new behavior as tests before touching the implementation forces the contract clarity promised in the spec.

**Files:**
- Modify: `apps/web/src/hooks/useSelection.test.ts`

- [ ] **Step 2.5.1: Rewrite the test file to describe the new shape**

Replace the contents of `apps/web/src/hooks/useSelection.test.ts` with:

```typescript
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSelection } from './useSelection';

describe('useSelection (preset-driven)', () => {
  describe('initial state', () => {
    it('starts on the overview preset with no selection and no overrides', () => {
      const { result } = renderHook(() => useSelection());
      expect(result.current.activePresetId).toBe('overview');
      expect(result.current.heroOverride).toBeNull();
      expect(result.current.bottomTabOverride).toBeNull();
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.selectedContributor).toBeNull();
    });

    it('derives activeHeroViz from the overview preset default', () => {
      const { result } = renderHook(() => useSelection());
      expect(result.current.activeHeroViz).toBe('treemap');
      expect(result.current.activeBottomTab).toBe('hotspots');
    });
  });

  describe('applyPreset', () => {
    it('switches the active preset id', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.applyPreset('risk'));
      expect(result.current.activePresetId).toBe('risk');
    });

    it('changes derived hero and bottom tab to the new preset defaults', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.applyPreset('risk'));
      expect(result.current.activeHeroViz).toBe('risk-heatmap');
      expect(result.current.activeBottomTab).toBe('risk-register');
    });

    it('clears hero and bottom tab overrides', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.setHeroOverride('ownership'));
      act(() => result.current.setBottomTabOverride('shame'));
      expect(result.current.heroOverride).toBe('ownership');
      expect(result.current.bottomTabOverride).toBe('shame');
      act(() => result.current.applyPreset('tech-debt'));
      expect(result.current.heroOverride).toBeNull();
      expect(result.current.bottomTabOverride).toBeNull();
    });

    it('preserves selectedFile across preset changes', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectFile('src/runner.ts'));
      act(() => result.current.applyPreset('risk'));
      expect(result.current.selectedFile).toBe('src/runner.ts');
    });

    it('preserves selectedContributor across preset changes', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectContributor('dan@example.com'));
      act(() => result.current.applyPreset('tech-debt'));
      expect(result.current.selectedContributor).toBe('dan@example.com');
    });
  });

  describe('overrides', () => {
    it('setHeroOverride changes derived activeHeroViz', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.setHeroOverride('coupling'));
      expect(result.current.activeHeroViz).toBe('coupling');
    });

    it('setBottomTabOverride changes derived activeBottomTab', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.setBottomTabOverride('shame'));
      expect(result.current.activeBottomTab).toBe('shame');
    });
  });

  describe('selection', () => {
    it('selectFile clears contributor and sets inspector tab to file', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectContributor('x@y.com'));
      act(() => result.current.selectFile('src/x.ts'));
      expect(result.current.selectedContributor).toBeNull();
      expect(result.current.activeInspectorTab).toBe('file');
    });

    it('selectContributor clears file and sets inspector tab to contributors', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectFile('src/x.ts'));
      act(() => result.current.selectContributor('x@y.com'));
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.activeInspectorTab).toBe('contributors');
    });

    it('clearSelection wipes both', () => {
      const { result } = renderHook(() => useSelection());
      act(() => result.current.selectFile('src/x.ts'));
      act(() => result.current.clearSelection());
      expect(result.current.selectedFile).toBeNull();
      expect(result.current.selectedContributor).toBeNull();
    });
  });
});
```

- [ ] **Step 2.5.2: Verify the tests fail**

Run: `pnpm --filter @gitrelic/web exec vitest run src/hooks/useSelection.test.ts`
Expected: FAIL on every test — old `useSelection` has different field names (`navigateTo`, `dashboardMode`, etc.).

---

## Task 2.6: Refactor `useSelection` — implement the new hook

**Files:**
- Modify: `apps/web/src/hooks/useSelection.ts`

- [ ] **Step 2.6.1: Replace the hook's implementation**

Replace the entire contents of `apps/web/src/hooks/useSelection.ts` with:

```typescript
import { useCallback, useState } from 'react';

import { PRESETS } from '../presets/registry';

import type { BottomTab, HeroViz, Metric, PresetId } from '../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

export type InspectorTab = 'file' | 'contributors' | 'activity';

export interface SelectionState {
  // Preset state
  activePresetId: PresetId;
  heroOverride: HeroViz | null;
  bottomTabOverride: BottomTab | null;

  // Derived
  activeHeroViz: HeroViz;
  activeBottomTab: BottomTab;
  heroAltTabs: HeroViz[];
  bottomAltTabs: BottomTab[];
  metrics: (report: GitrelicReport) => Metric[];

  // Selection
  selectedFile: string | null;
  selectedContributor: string | null;
  activeInspectorTab: InspectorTab;

  // Actions
  applyPreset: (id: PresetId) => void;
  setHeroOverride: (viz: HeroViz) => void;
  setBottomTabOverride: (tab: BottomTab) => void;
  selectFile: (file: string) => void;
  selectContributor: (email: string) => void;
  clearSelection: () => void;
  setActiveInspectorTab: (tab: InspectorTab) => void;
}

export function useSelection(): SelectionState {
  const [activePresetId, setActivePresetId] = useState<PresetId>('overview');
  const [heroOverride, setHeroOverrideState] = useState<HeroViz | null>(null);
  const [bottomTabOverride, setBottomTabOverrideState] = useState<BottomTab | null>(null);

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedContributor, setSelectedContributor] = useState<string | null>(null);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>('file');

  const preset = PRESETS[activePresetId];

  const applyPreset = useCallback((id: PresetId) => {
    setActivePresetId(id);
    setHeroOverrideState(null);
    setBottomTabOverrideState(null);
  }, []);

  const setHeroOverride = useCallback((viz: HeroViz) => {
    setHeroOverrideState(viz);
  }, []);

  const setBottomTabOverride = useCallback((tab: BottomTab) => {
    setBottomTabOverrideState(tab);
  }, []);

  const selectFile = useCallback((file: string) => {
    setSelectedFile(file);
    setSelectedContributor(null);
    setActiveInspectorTab('file');
  }, []);

  const selectContributor = useCallback((email: string) => {
    setSelectedContributor(email);
    setSelectedFile(null);
    setActiveInspectorTab('contributors');
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setSelectedContributor(null);
  }, []);

  return {
    activePresetId,
    heroOverride,
    bottomTabOverride,
    activeHeroViz: heroOverride ?? preset.hero.defaultViz,
    activeBottomTab: bottomTabOverride ?? preset.bottomPanel.defaultTab,
    heroAltTabs: preset.hero.altTabs,
    bottomAltTabs: preset.bottomPanel.altTabs,
    metrics: preset.metrics,
    selectedFile,
    selectedContributor,
    activeInspectorTab,
    applyPreset,
    setHeroOverride,
    setBottomTabOverride,
    selectFile,
    selectContributor,
    clearSelection,
    setActiveInspectorTab,
  };
}
```

**Deleted symbols** (from the previous implementation):
- `NavItem`, `BottomTab`, `SidebarGroup`, `DashboardMode`, `HeroViz` type unions (moved to `presets/types.ts`)
- `GROUP_TABS`, `navToGroupTab` constants
- `handleSetDashboardMode`, `navigateTo`, `setActiveBottomTab`, `setActiveHeroViz`, `setDashboardMode` methods

Callers of `BottomTab` / `HeroViz` from this file must switch their imports to `../presets/types`. Tasks 2.7–2.10 handle each caller.

- [ ] **Step 2.6.2: Verify hook tests pass**

Run: `pnpm --filter @gitrelic/web exec vitest run src/hooks/useSelection.test.ts`
Expected: PASS for all tests written in Task 2.5.

- [ ] **Step 2.6.3: Typecheck**

Run: `pnpm --filter @gitrelic/web typecheck`
Expected: **FAIL** — consumers (`Shell`, `Sidebar`, `MetricsStrip`, `BottomPanel`) still reference the old API. This is expected; Tasks 2.7–2.10 fix each.

**Do not commit yet.** The next four tasks are part of the same atomic refactor. Commit after Task 2.10 passes the full test suite.

---

## Task 2.7: Update `Shell.tsx` to consume derived values

**Files:**
- Modify: `apps/web/src/components/layout/Shell.tsx`

- [ ] **Step 2.7.1: Rewrite hero imports and dispatch**

Replace the current `getHeroVizzes` helper and `<HeroViz>` imports with direct use of `selection.heroAltTabs`. The existing 11-case hero switch stays — only the ordering source changes. Edit:

```tsx
// Remove:
function getHeroVizzes(mode: DashboardMode): { id: HeroViz; label: string }[] { ... }

// Add at top (or move existing block):
const HERO_LABELS: Record<HeroViz, string> = {
  treemap: 'Treemap',
  ownership: 'Ownership',
  coupling: 'Coupling',
  'commit-graph': 'Graph',
  scatter: 'Scatter',
  timeline: 'Timeline',
  swimlanes: 'Swimlanes',
  'risk-heatmap': 'Heatmap',
  'ownership-sunburst': 'Sunburst',
  'growth-timeline': 'Timeline',
  'debt-scatter': 'Scatter',
};
```

Inside `Shell`:

```tsx
const heroVizzes = selection.heroAltTabs.map((id) => ({ id, label: HERO_LABELS[id] }));
```

- [ ] **Step 2.7.2: Replace Sidebar props**

```tsx
{visibility.sidebar && (
  <Sidebar
    report={report}
    activePresetId={selection.activePresetId}
    onApplyPreset={selection.applyPreset}
  />
)}
```

- [ ] **Step 2.7.3: Replace MetricsStrip props**

```tsx
{visibility.metricsStrip && (
  <MetricsStrip metrics={selection.metrics(report)} />
)}
```

- [ ] **Step 2.7.4: Replace BottomPanel props**

```tsx
{visibility.bottomPanel && (
  <BottomPanel
    report={report}
    activeTab={selection.activeBottomTab}
    altTabs={selection.bottomAltTabs}
    onTabChange={selection.setBottomTabOverride}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
  />
)}
```

- [ ] **Step 2.7.5: Replace hero alt-tab click handler**

Existing code calls `selection.setActiveHeroViz(viz.id)`. Change to `selection.setHeroOverride(viz.id)`.

- [ ] **Step 2.7.6: Update type imports**

Replace `import type { DashboardMode, HeroViz } from '../../hooks/useSelection';` with:

```tsx
import type { HeroViz } from '../../presets/types';
```

(The `DashboardMode` type is deleted.)

- [ ] **Step 2.7.7: Typecheck**

Run: `pnpm --filter @gitrelic/web typecheck`
Expected: errors in Sidebar / MetricsStrip / BottomPanel (they still have old prop shapes). Shell itself should typecheck.

---

## Task 2.8: Update `MetricsStrip.tsx` to accept `metrics: Metric[]`

**Files:**
- Modify: `apps/web/src/components/layout/MetricsStrip.tsx`

- [ ] **Step 2.8.1: Simplify MetricsStrip**

Replace the entire file with:

```tsx
import type { Metric } from '../../presets/types';

interface MetricsStripProps {
  metrics: Metric[];
}

export function MetricsStrip({ metrics }: MetricsStripProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 1,
        background: 'var(--border-primary)',
        borderBottom: '1px solid var(--border-primary)',
        flexShrink: 0,
      }}
    >
      {metrics.map((m) => (
        <div
          key={m.label}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'var(--surface-primary)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>{m.value}</div>
          <div
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--text-tertiary)',
              marginTop: 2,
            }}
          >
            {m.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2.8.2: Typecheck**

Run: `pnpm --filter @gitrelic/web typecheck`
Expected: fewer errors — MetricsStrip is clean, remaining errors in Sidebar / BottomPanel.

---

## Task 2.9: Update `BottomPanel.tsx` to accept `altTabs: BottomTab[]`

**Files:**
- Modify: `apps/web/src/components/layout/BottomPanel.tsx`

- [ ] **Step 2.9.1: Rewrite the props and replace `GROUP_TABS` lookup**

Edit the top of the file:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';

// ...existing tab component imports unchanged...

import type { BottomTab } from '../../presets/types';
import type { GitrelicReport } from '@gitrelic/core';
```

Remove `import { GROUP_TABS } from '../../hooks/useSelection';` and `import type { SidebarGroup } from '../../hooks/useSelection';`.

Replace the props interface:

```tsx
interface BottomPanelProps {
  report: GitrelicReport;
  activeTab: BottomTab;
  altTabs: BottomTab[];
  onTabChange: (tab: BottomTab) => void;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}
```

Replace the body:

```tsx
export function BottomPanel({
  report,
  activeTab,
  altTabs,
  onTabChange,
  selectedFile,
  onSelectFile,
}: BottomPanelProps) {
  // ...existing resize logic unchanged (handleMouseDown, useRef, height state)...

  const visibleTabs = altTabs;

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      onTabChange(visibleTabs[0]);
    }
  }, [activeTab, onTabChange, visibleTabs]);

  // ...existing render block unchanged (tab bar maps over visibleTabs, TabContent unchanged)...
}
```

The `TAB_LABELS` record, `TabContent` switch, and the resize machinery stay exactly as-is.

- [ ] **Step 2.9.2: Typecheck**

Run: `pnpm --filter @gitrelic/web typecheck`
Expected: errors remaining only in `Sidebar.tsx`.

---

## Task 2.10: Rewrite `Sidebar.tsx` to emit `applyPreset` for every item

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 2.10.1: Rewrite the sidebar**

Replace the entire file:

```tsx
import { PRESETS } from '../../presets/registry';

import type { PresetDefinition, PresetId, SidebarGroupLabel } from '../../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

interface SidebarProps {
  report: GitrelicReport;
  activePresetId: PresetId;
  onApplyPreset: (id: PresetId) => void;
}

interface NavEntry {
  id: PresetId;
  label: string;
  badge?: number;
}

interface NavGroup {
  label: string;
  groupId: SidebarGroupLabel | 'dashboard-group';
  items: NavEntry[];
}

function getNavGroups(report: GitrelicReport): NavGroup[] {
  const dashboardPresets = (['overview', 'risk', 'tech-debt'] as const).map((id) => ({
    id,
    label: PRESETS[id].label,
  })) satisfies NavEntry[];

  return [
    {
      label: 'Overview',
      groupId: 'dashboard-group',
      items: dashboardPresets,
    },
    {
      label: 'Code Health',
      groupId: 'code-health',
      items: [
        {
          id: 'hotspots',
          label: 'Hotspots',
          badge: report.hotspots.topHotspots.filter((h) => h.category === 'critical').length,
        },
        // NOTE: Stream 3 will add the other Code Health presets here.
      ],
    },
    {
      label: 'Ownership & Risk',
      groupId: 'ownership-risk',
      items: [
        {
          id: 'bus-factor',
          label: 'Bus Factor',
          badge: report.busFactors.criticalFiles.length,
        },
        {
          id: 'coupling',
          label: 'Coupling',
        },
      ],
    },
    {
      label: 'Team & Activity',
      groupId: 'team-activity',
      items: [
        { id: 'contributors', label: 'Contributors' },
      ],
    },
  ];
}

export function Sidebar({ report, activePresetId, onApplyPreset }: SidebarProps) {
  const groups = getNavGroups(report);

  return (
    <nav
      style={{
        width: 200,
        minWidth: 200,
        background: 'var(--surface-primary)',
        borderRight: '1px solid var(--border-primary)',
        padding: '12px 0',
        overflowY: 'auto',
        flexShrink: 0,
      }}
    >
      {groups.map((group) => (
        <div key={group.label} style={{ marginBottom: 16, padding: '0 12px' }}>
          <div
            style={{
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              color: 'var(--text-tertiary)',
              marginBottom: 8,
              padding: '0 8px',
            }}
          >
            {group.label}
          </div>
          {group.items.map((item) => {
            const isActive = activePresetId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onApplyPreset(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  textAlign: 'left',
                  background: isActive ? 'var(--nav-item-active-bg)' : 'transparent',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  marginBottom: 2,
                }}
              >
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge != null && item.badge > 0 && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: '1px 5px',
                      borderRadius: 8,
                      fontWeight: 600,
                      background: 'var(--nav-badge-critical)',
                      color: '#fff',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
```

**What's gone:** the Dashboard dropdown/accordion behavior. Overview / Risk / Tech Debt are now flat entries under an "Overview" section header. The spec's Open Design Question #1 ("Dashboard dropdown vs flat") is explicitly deferred — the flat treatment is the simpler default; revisit after Phase 2 ships.

**What's here:** the four Tier 2 presets (Hotspots, Bus Factor, Coupling, Contributors) from Tasks 2.11–2.14. Other analyzer entries go in during Stream 3.

- [ ] **Step 2.10.2: Typecheck**

Run: `pnpm --filter @gitrelic/web typecheck`
Expected: PASS everywhere.

- [ ] **Step 2.10.3: Full test suite**

Run: `pnpm --filter @gitrelic/web test`
Expected: Shell tests still pass. Hook tests pass. Registry contract tests pass (Tier 2 placeholders are filtered out). Previously-passing tests still pass.

**Transient-state warning:** Between this commit and Task 2.14, the four Tier 2 buttons (Hotspots / Bus Factor / Coupling / Contributors) are rendered in the Sidebar but their `PRESETS[id]` values are `undefined` placeholders. A click on any of them triggers `applyPreset('hotspots')` → `PRESETS['hotspots'].hero.defaultViz` → crash. This is expected and short-lived — Tasks 2.11–2.14 are fast. **Do not merge to main between Task 2.10 and Task 2.14.**

If any automated test fails here, it's because something exercises a Tier 2 click. The Shell integration test in Task 2.15 does exactly this; it's defined later intentionally. If you've already authored Task 2.15's tests at this point, mark them `it.skip` temporarily and remove the skip after Task 2.14.

- [ ] **Step 2.10.4: Commit the refactor**

This single commit contains Tasks 2.5–2.10: the hook rewrite plus every consumer update.

```bash
git add apps/web/src/hooks/useSelection.ts apps/web/src/hooks/useSelection.test.ts \
        apps/web/src/components/layout/Shell.tsx \
        apps/web/src/components/layout/MetricsStrip.tsx \
        apps/web/src/components/layout/BottomPanel.tsx \
        apps/web/src/components/layout/Sidebar.tsx
git commit -m "refactor(web): collapse useSelection to preset model"
```

---

## Task 2.11: Add `hotspots` Tier 2 preset

**Why:** First Tier 2 preset. Proves the pattern for an existing hero (HotspotScatter).

**Files:**
- Create: `apps/web/src/presets/metrics/hotspots.ts`
- Modify: `apps/web/src/presets/registry.ts`

- [ ] **Step 2.11.1: Write the metrics function**

```typescript
// apps/web/src/presets/metrics/hotspots.ts
import { fmt } from '../../components/theme';

import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function hotspotsMetrics(report: GitrelicReport): Metric[] {
  const topHotspot = report.hotspots.topHotspots[0];
  const criticalCount = report.hotspots.topHotspots.filter(
    (h) => h.category === 'critical',
  ).length;
  const totalChurn = report.churn.files.reduce((sum, f) => sum + f.commitCount, 0);
  const avgLoc =
    report.loc.files.length > 0
      ? Math.round(report.loc.totalLines / report.loc.files.length)
      : 0;

  return [
    {
      label: 'Top Score',
      value: topHotspot ? String(Math.round(topHotspot.hotspotScore)) : '—',
      color: topHotspot && topHotspot.hotspotScore > 70
        ? 'var(--severity-critical)'
        : 'var(--severity-healthy)',
    },
    {
      label: 'Critical Hotspots',
      value: String(criticalCount),
      color: criticalCount > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Avg LOC',
      value: fmt(avgLoc),
      color: 'var(--text-primary)',
    },
    {
      label: 'Total Churn',
      value: fmt(totalChurn),
      color: 'var(--accent-primary)',
    },
  ];
}
```

- [ ] **Step 2.11.2: Replace the placeholder in `registry.ts`**

Edit `apps/web/src/presets/registry.ts`. Change `hotspots: undefined as unknown as PresetDefinition,` to:

```typescript
import { hotspotsMetrics } from './metrics/hotspots';
// ...
hotspots: {
  id: 'hotspots',
  tier: 'analyzer',
  label: 'Hotspots',
  group: 'code-health',
  hero: {
    defaultViz: 'scatter',
    altTabs: ['scatter', 'treemap', 'risk-heatmap'],
  },
  bottomPanel: {
    defaultTab: 'hotspots',
    altTabs: ['hotspots'],
  },
  metrics: hotspotsMetrics,
},
```

- [ ] **Step 2.11.3: Run tests**

Run: `pnpm --filter @gitrelic/web test`
Expected: registry contract tests now include `hotspots` and pass. Manual smoke: `pnpm --filter @gitrelic/web dev`; click Hotspots in the sidebar, verify the hero switches to the scatter plot, the bottom panel stays on hotspots, and the metric strip shows 4 Hotspots-specific cells.

- [ ] **Step 2.11.4: Commit**

```bash
git add apps/web/src/presets/metrics/hotspots.ts apps/web/src/presets/registry.ts
git commit -m "feat(web): add Hotspots Tier 2 preset"
```

---

## Task 2.12: Add `bus-factor` Tier 2 preset

**Files:**
- Create: `apps/web/src/presets/metrics/bus-factor.ts`
- Modify: `apps/web/src/presets/registry.ts`

- [ ] **Step 2.12.1: Write the metrics function**

Core types reference (verified): `FileBusFactor` has `file`, `uniqueAuthors`, `authors: string[]`, `dominantAuthor`, `dominantAuthorPercent`, `risk: 'critical' | 'high' | 'medium' | 'low'`. `report.busFactors.criticalFiles` is already filtered to single-dominant-owner files.

```typescript
// apps/web/src/presets/metrics/bus-factor.ts
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function busFactorMetrics(report: GitrelicReport): Metric[] {
  const criticalCount = report.busFactors.criticalFiles.length;
  const soloOwnedCount = report.busFactors.criticalFiles.filter(
    (f) => f.uniqueAuthors === 1,
  ).length;
  const soloOwnedPct =
    report.loc.totalFiles > 0
      ? Math.round((soloOwnedCount / report.loc.totalFiles) * 100)
      : 0;
  const dominantOwners = new Set(
    report.busFactors.criticalFiles.map((f) => f.dominantAuthor),
  ).size;

  return [
    {
      label: 'Critical Files',
      value: String(criticalCount),
      color: criticalCount > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Solo-Owned',
      value: String(soloOwnedCount),
      color: soloOwnedCount > 0 ? 'var(--severity-critical)' : 'var(--severity-healthy)',
    },
    {
      label: 'Solo-Owned %',
      value: `${soloOwnedPct}%`,
      color: soloOwnedPct > 20 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Dominant Owners',
      value: String(dominantOwners),
      color: 'var(--accent-primary)',
    },
  ];
}
```

- [ ] **Step 2.12.2: Replace the placeholder in `registry.ts`**

```typescript
import { busFactorMetrics } from './metrics/bus-factor';
// ...
'bus-factor': {
  id: 'bus-factor',
  tier: 'analyzer',
  label: 'Bus Factor',
  group: 'ownership-risk',
  hero: {
    defaultViz: 'risk-heatmap',
    altTabs: ['risk-heatmap', 'ownership'],
  },
  bottomPanel: {
    defaultTab: 'bus-factor',
    altTabs: ['bus-factor', 'knowledge-silos'],
  },
  metrics: busFactorMetrics,
},
```

- [ ] **Step 2.12.3: Test + commit**

```bash
pnpm --filter @gitrelic/web test
git add apps/web/src/presets/metrics/bus-factor.ts apps/web/src/presets/registry.ts
git commit -m "feat(web): add Bus Factor Tier 2 preset"
```

---

## Task 2.13: Add `coupling` Tier 2 preset

**Why:** Exercises non-file-shaped metrics (pair counts, pair strengths). Validates that the metric strip's 1–5 length flexibility actually works in the registry.

**Files:**
- Create: `apps/web/src/presets/metrics/coupling.ts`
- Modify: `apps/web/src/presets/registry.ts`

Core types reference (verified): `CoupledPair` has `fileA`, `fileB`, `coCommits`, `totalCommitsA`, `totalCommitsB`, `couplingStrength`. `CouplingReport.pairs: CoupledPair[]` and `topPairs: CoupledPair[]` (already sorted).

- [ ] **Step 2.13.1: Write the metrics function**

```typescript
// apps/web/src/presets/metrics/coupling.ts
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function couplingMetrics(report: GitrelicReport): Metric[] {
  const pairs = report.coupling.pairs;
  const pairCount = pairs.length;
  const topPair = report.coupling.topPairs[0];
  const hubCounts = pairs.reduce(
    (hubs, p) => {
      hubs.set(p.fileA, (hubs.get(p.fileA) ?? 0) + 1);
      hubs.set(p.fileB, (hubs.get(p.fileB) ?? 0) + 1);
      return hubs;
    },
    new Map<string, number>(),
  );
  const topHub = [...hubCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  // Three metrics here; deliberately not padded. Exercises the 1-5 metric-strip flexibility.
  return [
    {
      label: 'Coupled Pairs',
      value: String(pairCount),
      color: pairCount > 0 ? 'var(--accent-primary)' : 'var(--severity-healthy)',
    },
    {
      label: 'Top Coupling',
      value: topPair ? `${Math.round(topPair.couplingStrength * 100)}%` : '—',
      color:
        topPair && topPair.couplingStrength > 0.7
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'Hub File',
      value: topHub ? `${topHub[0].split('/').pop()} (${topHub[1]})` : '—',
      color: 'var(--text-primary)',
    },
  ];
}
```

- [ ] **Step 2.13.2: Replace the placeholder in `registry.ts`**

```typescript
import { couplingMetrics } from './metrics/coupling';
// ...
coupling: {
  id: 'coupling',
  tier: 'analyzer',
  label: 'Coupling',
  group: 'ownership-risk',
  hero: {
    defaultViz: 'coupling',
    altTabs: ['coupling'],
  },
  bottomPanel: {
    defaultTab: 'coupling',
    altTabs: ['coupling'],
  },
  metrics: couplingMetrics,
},
```

- [ ] **Step 2.13.3: Test + commit**

```bash
pnpm --filter @gitrelic/web test
git add apps/web/src/presets/metrics/coupling.ts apps/web/src/presets/registry.ts
git commit -m "feat(web): add Coupling Tier 2 preset"
```

---

## Task 2.14: Add `contributors` Tier 2 preset

**Why:** Contributor-keyed selection instead of file-keyed. Validates selection survives preset change even when the selection type mismatches the new preset's primary axis.

**Files:**
- Create: `apps/web/src/presets/metrics/contributors.ts`
- Modify: `apps/web/src/presets/registry.ts`

- [ ] **Step 2.14.1: Write the metrics function**

```typescript
// apps/web/src/presets/metrics/contributors.ts
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function contributorsMetrics(report: GitrelicReport): Metric[] {
  const totalAuthors = report.meta.totalAuthors;
  const ghostCount = report.ghostFiles?.totalGhostFiles ?? 0;
  // Total commits across the repo as a rough activity indicator:
  const totalCommits = report.churn.files.reduce((sum, f) => sum + f.commitCount, 0);

  return [
    {
      label: 'Active Contributors',
      value: String(totalAuthors),
      color: 'var(--accent-primary)',
    },
    {
      label: 'Ghost Authors',
      value: String(ghostCount),
      color: ghostCount > 0 ? 'var(--severity-warning)' : 'var(--severity-healthy)',
    },
    {
      label: 'Total Commits',
      value: String(totalCommits),
      color: 'var(--text-primary)',
    },
  ];
}
```

- [ ] **Step 2.14.2: Replace the placeholder in `registry.ts`**

```typescript
import { contributorsMetrics } from './metrics/contributors';
// ...
contributors: {
  id: 'contributors',
  tier: 'analyzer',
  label: 'Contributors',
  group: 'team-activity',
  hero: {
    defaultViz: 'ownership',
    altTabs: ['ownership', 'swimlanes', 'ownership-sunburst'],
  },
  bottomPanel: {
    defaultTab: 'contributors',
    altTabs: ['contributors'],
  },
  metrics: contributorsMetrics,
},
```

- [ ] **Step 2.14.3: Test + commit**

```bash
pnpm --filter @gitrelic/web test
git add apps/web/src/presets/metrics/contributors.ts apps/web/src/presets/registry.ts
git commit -m "feat(web): add Contributors Tier 2 preset"
```

---

## Task 2.15: Shell component test — sidebar click wires `applyPreset` end-to-end

**Why:** Integration test that catches the kind of wiring bug a registry contract test can't see: "did clicking Hotspots actually change the dashboard shape?"

**Files:**
- Modify: `apps/web/src/components/layout/Shell.test.tsx`

- [ ] **Step 2.15.1: Append the integration test**

```tsx
import { fireEvent } from '@testing-library/react';

describe('Shell sidebar → preset wiring', () => {
  it('clicking Hotspots reshapes the hero to scatter', () => {
    const { container, getByText } = render(<Shell report={makeMinimalReport()} />);
    // Default hero label is "Treemap"
    expect(getByText('Treemap')).toBeDefined();
    fireEvent.click(getByText('Hotspots'));
    // After applyPreset('hotspots'), the hero alt-tabs become scatter/treemap/risk-heatmap.
    // The active tab should now be "Scatter".
    expect(getByText('Scatter')).toBeDefined();
  });

  it('overrides clear when another preset is clicked', () => {
    const { getByText } = render(<Shell report={makeMinimalReport()} />);
    fireEvent.click(getByText('Hotspots'));
    // Default hero for hotspots is Scatter. Override to Treemap.
    fireEvent.click(getByText('Treemap'));
    fireEvent.click(getByText('Contributors'));
    // Contributors preset default is Ownership. Treemap override should be gone.
    expect(getByText('Ownership')).toBeDefined();
  });
});
```

- [ ] **Step 2.15.2: Run the test**

Run: `pnpm --filter @gitrelic/web exec vitest run src/components/layout/Shell.test.tsx`
Expected: PASS.

- [ ] **Step 2.15.3: Commit**

```bash
git add apps/web/src/components/layout/Shell.test.tsx
git commit -m "test(web): Shell sidebar-to-preset integration test"
```

---

## Task 2.16: Phase 2 verification

- [ ] **Step 2.16.1: Full checks**

Run:
```bash
pnpm --filter @gitrelic/web typecheck
pnpm --filter @gitrelic/web test
pnpm lint
pnpm format:check
```

Expected: all green.

- [ ] **Step 2.16.2: Manual smoke against a real report**

```bash
# Build the CLI + web first:
pnpm build
# Run against any git repo:
node apps/cli/dist/index.mjs --path ~/path/to/any-git-repo --web
```

Open the served URL. Verify:
- Overview / Risk / Tech Debt presets still work (Tier 1 migration correct).
- All four Tier 2 presets (Hotspots, Bus Factor, Coupling, Contributors) reshape all four panels.
- Selecting a file, then switching presets, preserves the selected file.
- Hero alt-tab override works and resets when another sidebar item is clicked.
- Focus Mode shortcuts (⌘., ⌘⇧., ⌘⇧,, Esc) still work under the new Shell.

- [ ] **Step 2.16.3: Run package-scoped audits**

Per spec Next Steps, audit before merging Phase 2:

```bash
# Invoke via Skill tool in Claude Code:
#   Skill: audit-web
#   Skill: audit-architecture
```

Fix any issues the audits raise before opening the PR.

- [ ] **Step 2.16.4 (optional): Open Phase 2 PR**

PR title: `feat(web): analyzer preset framework + 4 Tier 2 presets`. Include a CHANGELOG-style summary of commits in the body.

---

# Appendix — Stream 3 Pattern (for follow-up PRs)

Stream 3 is **not part of this plan**. It's 18 follow-up PRs, each adding one Tier 2 preset to the registry. Use this template per PR.

## Per-PR template

### 1. Widen the `AnalyzerPresetId` union

Edit `apps/web/src/presets/types.ts`, append the new id (e.g. `'cursed-files'`) to the `AnalyzerPresetId` union. This single edit is the schema change.

### 2. Build any required new component

- **Data-only presets (existing hero + existing tab):** skip this step. Age Map, Languages, Test Coverage, Cursed Files, Stale Files, Complexity, Rewrites, Knowledge Silos, Parallel Dev, Commit Timing, Blast Radius — all use existing heroes from the `HeroViz` union.
- **New-hero presets:** create the component under `apps/web/src/components/hero/` (e.g. `AuthorForceGraph.tsx`, `ShameLeaderboard.tsx`, `RenameSankey.tsx`). Wire it into Shell's hero switch. Write a unit test for its data-preparation helper (follow the `prepareScatterData` pattern in `HotspotScatter.test.tsx`).
- **`ChurnTreemap` color-by variants** (age, language, shame, test-proximity): add a `colorBy` prop to `ChurnTreemap`. Prefer prop over new component.

**d3-sankey dependency** (Renames PR only): `pnpm --filter @gitrelic/web add d3-sankey @types/d3-sankey`. Commit the `package.json` + `pnpm-lock.yaml` change as part of the Renames PR. Remember to check the bundle-size impact.

### 3. Add the metrics module

Create `apps/web/src/presets/metrics/<id>.ts` following the pattern in `hotspots.ts` / `bus-factor.ts`. Keep length 1–5.

### 4. Register the preset

Edit `apps/web/src/presets/registry.ts`, add the entry (tier `'analyzer'`, correct `group`, hero and bottomPanel shapes).

### 5. Add the sidebar entry

Edit `apps/web/src/components/layout/Sidebar.tsx` — add the `NavEntry` to the correct group.

### 6. Run contract tests + manual smoke

```bash
pnpm --filter @gitrelic/web test
pnpm --filter @gitrelic/web exec vitest run src/presets/registry.test.ts
```

### 7. Commit

```bash
git commit -m "feat(web): add <preset-name> Tier 2 preset"
```

One PR per preset (or small batches of 3–4 related ones). Stream 3 has no single "done" criterion — it's a rolling set of small PRs until all 22 analyzers are registered.

## Stream 3 target list (18 remaining presets)

**Data-only (no new components):** Age Map, Languages, Test Coverage, Cursed Files, Stale Files, Complexity, Rewrites, Knowledge Silos, Parallel Dev, Commit Timing, Blast Radius.

**New hero per PR:** Ghost Files (`OwnershipSunburst` filter prop), Co-Authors (`AuthorForceGraph`), Shame (`ShameLeaderboard`), Renames (`RenameSankey` + `d3-sankey` dependency).

**`ChurnTreemap` color-by variants** (implementation-choice note on Age Map / Languages / Test Coverage / Shame — not extra presets): add `colorBy` prop when the corresponding preset PR lands.

---

# Deferrals (out of scope for this plan)

Per spec Open Design Questions (rewritten):

- Tier 3 group presets (Code Health / Ownership & Risk / ... as clickable presets)
- Deep links / URL state (`?preset=<id>&file=<path>`)
- Inspector auto-select on preset change
- localStorage preset overrides (per-preset memory)
- Metric strip typographic redesign
- Inspector accordion sections
- Bottom panel master-detail (KAN-160 / KAN-74 file drill-down)
- Dashboard dropdown vs flat-item redesign (Phase 2 chose flat as the simpler default; revisit if user testing complains)

Each of these is its own ticket / plan. None block Phase 1, Phase 2, or Stream 3.
