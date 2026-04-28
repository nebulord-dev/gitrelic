# Shared `<NarrativeKPI>` Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift the inline narrative-KPI layout from `KnowledgeSilosTab.tsx` into a shared `<NarrativeKPI>` component (with a sticky "See also" footer), refactor Knowledge Silos to consume it, and unblock four Batch 1 polish tickets.

**Architecture:** A small presentational React component in `apps/web/src/components/shared/` that takes a structured KPI tile (big number + tier badge + uppercase metric label), a free-form `finding` ReactNode, an optional `subline`, and a strict 2-tuple of see-also links. Renders a vertical flex column with `position: sticky; bottom: 0` on the footer; sticky resolution uses `BottomPanel.tsx`'s existing scroll container. No backend changes.

**Tech Stack:** React 19, TypeScript, vitest + @testing-library/react. Existing `BadgeVariant` from `theme.ts` and `PresetId` from `presets/types.ts`. No new dependencies.

**Spec:** [`docs/superpowers/specs/2026-04-27-narrative-kpi-component-design.md`](../specs/2026-04-27-narrative-kpi-component-design.md)

**Linear:** [RELIC-332](https://linear.app/nebulord/issue/RELIC-332)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/web/src/components/shared/NarrativeKPI.tsx` | Create | Presentational shared component (KPI tile + narrative + sticky footer) |
| `apps/web/src/components/shared/NarrativeKPI.test.tsx` | Create | 5 unit tests for the component contract |
| `apps/web/src/components/tabs/KnowledgeSilosTab.tsx` | Modify | Replace inline JSX with `<NarrativeKPI>` consumer; require `onApplyPreset` |
| `apps/web/src/components/tabs/KnowledgeSilosTab.test.tsx` | Create | One smoke test (regression guard for byte-identical KPI tile) |
| `apps/web/src/components/layout/BottomPanel.tsx` | Modify | Tighten `onApplyPreset` to required (props + `TabContent` helper); pass it to `KnowledgeSilosTab` |
| `docs/polish-pattern.md` | Modify | Update reference-implementation pointer (line ~51) |

---

## Task 1: Build `<NarrativeKPI>` shared component (TDD)

**Files:**
- Create: `apps/web/src/components/shared/NarrativeKPI.tsx`
- Create: `apps/web/src/components/shared/NarrativeKPI.test.tsx`

- [ ] **Step 1: Write the failing tests**

> Note: the spec lists "five focused cases." The plan implements case 3 ("`subline` is optional") as a single `it` block with two assertions (rerender pattern), keeping the file at 5 `it` blocks total — one per spec case.

Create `apps/web/src/components/shared/NarrativeKPI.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NarrativeKPI, type SeeAlsoLink } from './NarrativeKPI';

const seeAlso: [SeeAlsoLink, SeeAlsoLink] = [
  { label: 'Bus Factor', presetId: 'bus-factor' },
  { label: 'Ghost Files', presetId: 'ghost-files' },
];

const baseProps = {
  bigNumber: '67%',
  tier: { variant: 'warning' as const, label: 'Moderate Risk' },
  metric: 'Concentration Index',
  finding: <>1,870 of 2,792 files have a single dominant author</>,
  seeAlso,
};

describe('NarrativeKPI', () => {
  afterEach(() => cleanup());

  it('renders big number, tier badge, and metric label', () => {
    render(<NarrativeKPI {...baseProps} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.getByText('Moderate Risk')).toBeTruthy();
    expect(screen.getByText('Concentration Index')).toBeTruthy();
  });

  it('applies severity color from tier.variant to the big number', () => {
    render(<NarrativeKPI {...baseProps} onApplyPreset={vi.fn()} />);
    const big = screen.getByText('67%');
    // happy-dom can normalize CSS values; assert against the raw style attribute
    // to ensure we round-trip the var() reference faithfully.
    expect(big.getAttribute('style')).toContain('color: var(--severity-warning)');
  });

  it('renders subline when provided and omits it when absent', () => {
    const { rerender } = render(
      <NarrativeKPI
        {...baseProps}
        subline="67% of files are single-author dominant (1870/2792)"
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/single-author dominant/)).toBeTruthy();
    rerender(<NarrativeKPI {...baseProps} onApplyPreset={vi.fn()} />);
    expect(screen.queryByText(/single-author dominant/)).toBeNull();
  });

  it('renders ReactNode finding (e.g. with <strong>)', () => {
    render(
      <NarrativeKPI
        {...baseProps}
        finding={
          <>
            <strong>1,870</strong> of 2,792 files
          </>
        }
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('1,870').tagName).toBe('STRONG');
  });

  it('invokes onApplyPreset with the correct presetId on each footer click', () => {
    const onApplyPreset = vi.fn();
    render(<NarrativeKPI {...baseProps} onApplyPreset={onApplyPreset} />);
    screen.getByText('Bus Factor').click();
    expect(onApplyPreset).toHaveBeenLastCalledWith('bus-factor');
    screen.getByText('Ghost Files').click();
    expect(onApplyPreset).toHaveBeenLastCalledWith('ghost-files');
    expect(onApplyPreset).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @gitrelic/web test --run NarrativeKPI`

Expected: All 5 tests fail with "Cannot find module './NarrativeKPI'" (or similar import error).

- [ ] **Step 3: Implement `NarrativeKPI.tsx`**

Create `apps/web/src/components/shared/NarrativeKPI.tsx`:

```tsx
import type { CSSProperties, ReactNode } from 'react';

import type { PresetId } from '../../presets/types';
import Badge from './Badge';
import type { BadgeVariant } from '../theme';

export interface SeeAlsoLink {
  label: string;
  presetId: PresetId;
}

interface NarrativeKPIProps {
  bigNumber: string;
  tier: { variant: BadgeVariant; label: string };
  metric: string;
  finding: ReactNode;
  subline?: ReactNode;
  seeAlso: [SeeAlsoLink, SeeAlsoLink];
  onApplyPreset: (id: PresetId) => void;
}

const linkStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent-primary)',
  fontSize: 10,
  cursor: 'pointer',
  padding: 0,
  textDecoration: 'underline',
};

export function NarrativeKPI({
  bigNumber,
  tier,
  metric,
  finding,
  subline,
  seeAlso,
  onApplyPreset,
}: NarrativeKPIProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div
        style={{
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
          padding: '12px 0',
          flex: 1,
        }}
      >
        <div style={{ textAlign: 'center', minWidth: 120 }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: `var(--severity-${tier.variant})`,
              lineHeight: 1,
            }}
          >
            {bigNumber}
          </div>
          <div style={{ marginTop: 4 }}>
            <Badge variant={tier.variant}>{tier.label}</Badge>
          </div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--text-tertiary)',
              marginTop: 6,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {metric}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11 }}>
          <div style={{ color: 'var(--text-secondary)' }}>{finding}</div>
          {subline != null && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 10, maxWidth: 400 }}>
              {subline}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 'auto',
          background: 'var(--surface-primary)',
          borderTop: '1px solid var(--border-primary)',
          padding: '6px 4px',
          fontSize: 10,
          color: 'var(--text-tertiary)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        See also:{' '}
        <button onClick={() => onApplyPreset(seeAlso[0].presetId)} style={linkStyle}>
          {seeAlso[0].label}
        </button>
        ·
        <button onClick={() => onApplyPreset(seeAlso[1].presetId)} style={linkStyle}>
          {seeAlso[1].label}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @gitrelic/web test --run NarrativeKPI`

Expected: All 5 tests pass.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/shared/NarrativeKPI.tsx apps/web/src/components/shared/NarrativeKPI.test.tsx
git commit -m "feat(web): add shared <NarrativeKPI> layout component"
```

---

## Task 2: Tighten `BottomPanel`'s `onApplyPreset` prop chain to required

**Files:**
- Modify: `apps/web/src/components/layout/BottomPanel.tsx` (lines 30-41 and 75-81)

This is a pre-step for Task 3 — tightening the prop type before `KnowledgeSilosTab` requires it avoids a transient TS error window.

- [ ] **Step 1: Verify `Shell.tsx`'s `<BottomPanel>` callsite passes `onApplyPreset`**

Run: `grep -n 'BottomPanel' apps/web/src/components/layout/Shell.tsx`

Find the `<BottomPanel ...>` JSX block. Confirm it includes `onApplyPreset={selection.applyPreset}` (currently around line 459). If the BottomPanel callsite does NOT pass `onApplyPreset`, STOP and escalate — tightening the prop would be a breaking change. (Note: `grep -n 'onApplyPreset' Shell.tsx` would also match the unrelated Sidebar callsite around line 185 — ignore that hit; it's a different component's prop.)

- [ ] **Step 2: Edit `BottomPanelProps`**

In `apps/web/src/components/layout/BottomPanel.tsx`, change line 37 from:

```ts
  onApplyPreset?: (id: PresetId) => void;
```

to:

```ts
  onApplyPreset: (id: PresetId) => void;
```

- [ ] **Step 3: Edit `TabContent` helper's prop type**

In the same file, around line 80, change:

```ts
  onApplyPreset?: (id: PresetId) => void;
```

to:

```ts
  onApplyPreset: (id: PresetId) => void;
```

- [ ] **Step 4: Run typecheck via test runner**

Run: `pnpm --filter @gitrelic/web test --run`

Expected: All existing web tests still pass. (`ChurnTab` consumes `onApplyPreset?` optionally; a required source still satisfies an optional sink, so no callsite breaks.)

- [ ] **Step 5: Run lint**

Run: `pnpm lint`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/layout/BottomPanel.tsx
git commit -m "refactor(web): require onApplyPreset on BottomPanel props"
```

---

## Task 3: Refactor `KnowledgeSilosTab.tsx` to consume `<NarrativeKPI>`

**Files:**
- Modify: `apps/web/src/components/tabs/KnowledgeSilosTab.tsx`
- Modify: `apps/web/src/components/layout/BottomPanel.tsx` (line 122-123)

- [ ] **Step 1: Rewrite `KnowledgeSilosTab.tsx`**

Replace the entire contents of `apps/web/src/components/tabs/KnowledgeSilosTab.tsx` with:

```tsx
import { NarrativeKPI } from '../shared/NarrativeKPI';
import type { BadgeVariant } from '../theme';

import type { PresetId } from '../../presets/types';
import type { GitrelicReport } from '@gitrelic/core';

interface KnowledgeSilosTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

function riskLevel(index: number): { variant: BadgeVariant; label: string } {
  if (index < 40) return { variant: 'healthy', label: 'Low Risk' };
  if (index < 70) return { variant: 'warning', label: 'Moderate Risk' };
  return { variant: 'critical', label: 'High Risk' };
}

export function KnowledgeSilosTab({ report, onApplyPreset }: KnowledgeSilosTabProps) {
  const kc = report.knowledgeConcentration;
  const risk = riskLevel(kc.concentrationIndex);

  return (
    <NarrativeKPI
      bigNumber={`${kc.concentrationIndex.toFixed(0)}%`}
      tier={risk}
      metric="Concentration Index"
      finding={
        <>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            {kc.singleAuthorFiles}
          </span>{' '}
          of {kc.totalFiles} files have a single dominant author (80%+ commits)
        </>
      }
      subline={kc.summary}
      seeAlso={[
        { label: 'Bus Factor', presetId: 'bus-factor' },
        { label: 'Ghost Files', presetId: 'ghost-files' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
```

- [ ] **Step 2: Update the `BottomPanel` callsite**

In `apps/web/src/components/layout/BottomPanel.tsx` at lines 122-123, change:

```tsx
    case 'knowledge-silos':
      return <KnowledgeSilosTab report={report} />;
```

to:

```tsx
    case 'knowledge-silos':
      return <KnowledgeSilosTab report={report} onApplyPreset={onApplyPreset} />;
```

- [ ] **Step 3: Run web tests**

Run: `pnpm --filter @gitrelic/web test --run`

Expected: All existing tests still pass. No `KnowledgeSilosTab` test exists yet (added in Task 4).

- [ ] **Step 4: Manual visual check**

**Precondition:** if `apps/cli/dist/index.mjs` does not yet exist (fresh worktree), run `pnpm build` first. This produces both the CLI bundle and the bundled web dashboard via `copy-web-dist.mjs`.

Then start the smoke target: `node apps/cli/dist/index.mjs --path ~/Desktop/react --web`. Open the URL printed to stdout (typically `http://localhost:7777`) in a browser and click into the Knowledge Silos tab. Verify:

- The big percentage, badge, and uppercase "Concentration Index" label render at the same size, color, and spacing as `main`.
- The bolded number in the finding line (e.g. **1,870**) renders in **mono font** with `--text-primary` color and `font-weight: 600` — same treatment as the original.
- A new sticky "See also: Bus Factor · Ghost Files" footer is visible at the bottom of the panel.
- Clicking each link switches to the corresponding analyzer surface.

Stop here and abort the task if visual drift is detected — re-check that the inline `style={...}` blocks in `NarrativeKPI.tsx` match the original `KnowledgeSilosTab.tsx` lines 21-66 exactly, and that the `<span>` wrapping the bolded number in `KnowledgeSilosTab.tsx`'s `finding` prop preserves the `font-mono` / `text-primary` / `font-weight: 600` styling.

**Fallback** if the CLI bundle isn't building: run `pnpm --filter @gitrelic/web dev` standalone and load the dashboard with whichever fixture report is already in `apps/web/public/`. Visual checks above still apply — this just skips the CLI server path.

- [ ] **Step 5: Run lint**

Run: `pnpm lint`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/tabs/KnowledgeSilosTab.tsx apps/web/src/components/layout/BottomPanel.tsx
git commit -m "refactor(web): consume <NarrativeKPI> in KnowledgeSilosTab"
```

---

## Task 4: Add `KnowledgeSilosTab` smoke test

**Files:**
- Create: `apps/web/src/components/tabs/KnowledgeSilosTab.test.tsx`

- [ ] **Step 1: Write the test**

Create `apps/web/src/components/tabs/KnowledgeSilosTab.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeSilosTab } from './KnowledgeSilosTab';

import type { GitrelicReport } from '@gitrelic/core';

function makeReport(): GitrelicReport {
  return {
    knowledgeConcentration: {
      concentrationIndex: 67,
      singleAuthorFiles: 1870,
      totalFiles: 2792,
      summary: '67% of files are single-author dominant (1870/2792)',
    },
  } as unknown as GitrelicReport;
}

describe('KnowledgeSilosTab', () => {
  afterEach(() => cleanup());

  it('renders the big percentage, Moderate Risk badge, and both see-also links', () => {
    render(<KnowledgeSilosTab report={makeReport()} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.getByText('Moderate Risk')).toBeTruthy();
    expect(screen.getByText('Concentration Index')).toBeTruthy();
    expect(screen.getByText('Bus Factor')).toBeTruthy();
    expect(screen.getByText('Ghost Files')).toBeTruthy();
  });

  it('routes Bus Factor click to onApplyPreset("bus-factor")', () => {
    const onApplyPreset = vi.fn();
    render(<KnowledgeSilosTab report={makeReport()} onApplyPreset={onApplyPreset} />);
    screen.getByText('Bus Factor').click();
    expect(onApplyPreset).toHaveBeenCalledWith('bus-factor');
  });

  it('routes Ghost Files click to onApplyPreset("ghost-files")', () => {
    const onApplyPreset = vi.fn();
    render(<KnowledgeSilosTab report={makeReport()} onApplyPreset={onApplyPreset} />);
    screen.getByText('Ghost Files').click();
    expect(onApplyPreset).toHaveBeenCalledWith('ghost-files');
  });
});
```

- [ ] **Step 2: Run the new test**

Run: `pnpm --filter @gitrelic/web test --run KnowledgeSilosTab`

Expected: All 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/tabs/KnowledgeSilosTab.test.tsx
git commit -m "test(web): smoke test KnowledgeSilosTab rendering and footer routing"
```

---

## Task 5: Update `polish-pattern.md` reference-implementation pointer

**Files:**
- Modify: `docs/polish-pattern.md` (line ~51)

The doc currently says (line 51):

> Reference implementation: `apps/web/src/components/tabs/KnowledgeSilosTab.tsx` (~60 lines, prop-driven, no SortableTable).

After this PR, the canonical reference is the shared component itself. KS becomes a *consumer*, not the implementation.

- [ ] **Step 1: Edit the pointer**

In `docs/polish-pattern.md`, find the line under "## The narrative-KPI pattern" that reads:

```markdown
Reference implementation: `apps/web/src/components/tabs/KnowledgeSilosTab.tsx` (~60 lines, prop-driven, no SortableTable).
```

Replace with:

```markdown
Reference implementation: `apps/web/src/components/shared/NarrativeKPI.tsx` (the shared layout). Reference consumer: `apps/web/src/components/tabs/KnowledgeSilosTab.tsx`.
```

- [ ] **Step 2: Verify the doc still reads cleanly**

Skim the surrounding paragraph (the "## The narrative-KPI pattern" section). The next sentence after the pointer should still flow.

- [ ] **Step 3: Commit**

```bash
git add docs/polish-pattern.md
git commit -m "docs: point polish-pattern reference at shared <NarrativeKPI>"
```

---

## Task 6: Final verification

- [ ] **Step 1: Full test suite**

Run from repo root: `pnpm test`

Expected: All tests pass (231 core + 29 web baseline + 9 new from this PR = 269 total, give or take if other tests have shifted on `main`).

- [ ] **Step 2: Lint**

Run: `pnpm lint`

Expected: Clean.

- [ ] **Step 3: Format check**

Run: `pnpm format:check`

Expected: Clean. (Pre-commit `oxfmt` should have already kept files in shape; this is a belt-and-suspenders.)

- [ ] **Step 4: Build**

Run: `pnpm build`

Expected: Success. Confirms tsdown / Vite still produce the expected outputs and no value-import-from-`@gitrelic/core` regression slipped in.

- [ ] **Step 5: Manual smoke on the React fixture**

Run: `node apps/cli/dist/index.mjs --path ~/Desktop/react --web`

Open the dashboard in a browser (URL printed to stdout, typically `http://localhost:7777`). Click into **Knowledge Silos** tab. Verify all DoD items from the spec:

- [ ] Big percentage renders with the same fontSize/fontFamily/color as `main`.
- [ ] "Moderate Risk" / "Low Risk" / "High Risk" badge present and severity-colored.
- [ ] "Concentration Index" uppercase label visible.
- [ ] Finding line shows the bolded number in mono / `text-primary` / `font-weight: 600` followed by `of M files have a single dominant author (80%+ commits)`.
- [ ] Subline shows the analyzer's `summary` text.
- [ ] **Sticky "See also" footer visible at the bottom of the panel** (resize the panel via the drag handle to confirm it stays pinned when content scrolls).
- [ ] Clicking **Bus Factor** switches to the Bus Factor preset.
- [ ] Clicking **Ghost Files** switches to the Ghost Files preset.

- [ ] **Step 6: Open the PR**

If working on a feature branch:

```bash
git push -u origin <branch>
gh pr create --title "feat(web): lift narrative-KPI layout into shared component (RELIC-332)" --body "..."
```

PR body should reference the spec, the Linear ticket, and note the four blocked Batch 1 tickets that this unblocks.

---

## Out of scope reminder

- Refactoring Churn / Shame / Blast Radius / Rewrite Ratio tabs to consume `<NarrativeKPI>` — those are Batch 1 tickets (RELIC-303, RELIC-308, RELIC-315, RELIC-314).
- Making `ChurnTab.tsx`'s existing non-sticky footer sticky — deferred to RELIC-303.
- Backend changes (`keywordTiers`, `totalInsertions`/`totalDeletions`) — Batch 1 ticket scope.
- An `extras` / `children` slot on `<NarrativeKPI>` for analyzer-specific secondary visuals — defer until a Batch 1 ticket actually wants one.
