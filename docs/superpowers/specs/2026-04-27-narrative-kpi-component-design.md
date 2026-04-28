# Shared `<NarrativeKPI>` Component

**Date:** 2026-04-27
**Brainstormed:** 2026-04-27
**Status:** Approved — implementation plan to follow
**Linear:** [RELIC-332 Lift narrative-KPI layout from KnowledgeSilosTab into shared `<NarrativeKPI>` component](https://linear.app/nebulord/issue/RELIC-332)
**Related doc:** [`docs/polish-pattern.md`](../../polish-pattern.md)

## Problem

The Polish Initiative has decided that four Batch 1 analyzers — Churn, Forensics (Shame), Blast Radius, Rewrite Ratio — should replace their generic `[hero] + [SortableTable]` bottom panels with a *narrative-KPI* layout: a severity-colored big number on the left, a one-sentence finding on the right, and a sticky "See also" footer. The reference implementation already exists, hand-rolled inline in `apps/web/src/components/tabs/KnowledgeSilosTab.tsx`.

Without a shared component, each Batch 1 polish ticket would re-implement the same layout — visual drift, copy-paste maintenance, and per-tab interpretation of the spec anatomy. The four blocked polish tickets ([RELIC-303](https://linear.app/nebulord/issue/RELIC-303), [RELIC-308](https://linear.app/nebulord/issue/RELIC-308), [RELIC-314](https://linear.app/nebulord/issue/RELIC-314), [RELIC-315](https://linear.app/nebulord/issue/RELIC-315)) all wait on this lift.

A secondary problem: the polish doc's footer rule ("every bottom panel gets a sticky 'See also'") is not yet honored anywhere, including the reference Knowledge Silos tab. The doc describes the rule but the surface predates it. Lifting the layout is the natural moment to enforce it.

## Scope

**In scope:**

- New shared component `apps/web/src/components/shared/NarrativeKPI.tsx` with the API documented under [Decisions](#decisions).
- Refactor `apps/web/src/components/tabs/KnowledgeSilosTab.tsx` to consume the shared component. Net code reduction expected; KPI tile rendering must remain visually byte-identical.
- Add a "See also" footer to Knowledge Silos for the first time. Choices: **Bus Factor** + **Ghost Files** (ownership-concentration neighborhood).
- Wire `onApplyPreset` from `BottomPanel.tsx` to `KnowledgeSilosTab`. One-line change at `BottomPanel.tsx:122-123`.
- Tighten `BottomPanelProps.onApplyPreset` (and the local `TabContent` helper's matching prop) from optional to required. `Shell.tsx:459` (the `<BottomPanel>` callsite) passes it unconditionally, so this just makes the contract honest and lets `KnowledgeSilosTab` require it without a non-null assertion. Only existing consumer is `ChurnTab` (which receives it as optional today; a required source still satisfies an optional sink, so `ChurnTab.tsx` is untouched).
- Component test `NarrativeKPI.test.tsx` covering tier rendering, optional fields, and `onApplyPreset` callback firing.
- Smoke test `KnowledgeSilosTab.test.tsx` covering rendering with a fixture report and footer-click invoking `onApplyPreset`.

**Out of scope:**

- Refactoring any of the four Batch 1 tabs (Churn / Shame / Blast Radius / Rewrite Ratio) to consume `<NarrativeKPI>` — those are tracked in their own tickets and depend on this one merging.
- Backend changes (`keywordTiers` for Forensics, `totalInsertions`/`totalDeletions` for Rewrite Ratio) — Batch 1 ticket scope.
- An `extras` / `children` slot for analyzer-specific secondary visuals (Churn's category stacked bar, Blast Radius's distribution histogram). Both are listed as optional / "skip if budget tight" in `polish-pattern.md`. Defer until a Batch 1 ticket actually wants one — adding the slot is a one-prop, one-`<div>` change at that point.
- A separate `<SeeAlsoFooter>` component for table-style bottom panels (e.g., a future Cursed Files refit). Today only narrative-KPI surfaces need the sticky footer; extract later if a table tab adopts it.
- Visual regression / Storybook infrastructure — neither exists in `apps/web` today; matching neighboring `*.test.tsx` patterns is sufficient.
- Making `ChurnTab.tsx`'s existing (non-sticky) "See also" footer sticky. The polish doc's footer rule applies to every bottom panel, but ChurnTab's footer fix belongs to its Batch 1 ticket ([RELIC-303](https://linear.app/nebulord/issue/RELIC-303)) — that ticket already plans the wider Churn polish, including a likely full migration to `<NarrativeKPI>`. Touching ChurnTab here would either pre-empt RELIC-303 or leave a half-fixed surface.

## Decisions

### Component API

```tsx
// apps/web/src/components/shared/NarrativeKPI.tsx

import type { BadgeVariant } from '../theme';
import type { PresetId } from '../../presets/types';
import type { ReactNode } from 'react';

interface SeeAlsoLink {
  label: string;       // e.g. 'Hotspots'
  presetId: PresetId;  // e.g. 'hotspots'
}

interface NarrativeKPIProps {
  // Left tile
  bigNumber: string;            // '67%', '73', '12' — caller formats
  tier: { variant: BadgeVariant; label: string };
  metric: string;               // 'Concentration Index' (rendered uppercase, tracked)

  // Right narrative
  finding: ReactNode;           // primary line; caller emits <strong> for the bolded number
  subline?: ReactNode;          // optional secondary line

  // Sticky footer (always rendered)
  seeAlso: [SeeAlsoLink, SeeAlsoLink];
  onApplyPreset: (id: PresetId) => void;
}
```

Naming notes:

- The Linear ticket proposed `label` for the metric label. Renamed to `metric` here to avoid collision with `tier.label` (which is the badge text, e.g., "Moderate Risk"). Two distinct concepts deserve distinct names.
- `seeAlso` is typed as a 2-tuple `[SeeAlsoLink, SeeAlsoLink]` — not `SeeAlsoLink[]`. The polish doc rule is "two related-analyzer links per footer," and the tuple makes that a compile-time contract, forcing each tab author to make an editorial choice rather than punt with one or three. Loosening to an array later is a one-character change.
- `BadgeVariant` is the existing union exported from `apps/web/src/components/theme.ts`. Reusing it keeps severity colors consistent with every other badge in the dashboard. The polish doc's canonical tier triad (Healthy / Moderate / Critical) maps directly to three of its members — Knowledge Silos uses `healthy` / `warning` / `critical`, but Batch 1 tabs may pick `moderate` for the middle band where the threshold story is closer to neutral than to "warning".
- `subline` is `ReactNode` to allow either a plain string or richer content (e.g., a category breakdown like `98 hot · 442 warm · 1,253 cold`). Knowledge Silos uses a plain string.
- `bigNumber` is `string`, not `number` — the caller formats (`.toFixed(0) + '%'`, `String(highBlast)`, etc.). Keeps formatting close to the source data and avoids prescribing percentage / count / score variations in the component.

### Layout

The component renders a vertical flex container that fills its parent (`minHeight: 100%`). Two regions:

1. **Top region** — horizontal flex with the KPI tile on the left and the narrative on the right. Reproduces `KnowledgeSilosTab.tsx` lines 21–66 exactly: 36px mono-font number colored via `var(--severity-${variant})`, `marginTop: 4` to the badge, `marginTop: 6` plus `letterSpacing: 1` and `fontSize: 9` uppercase metric label. Right side: 11px primary `finding`, 10px tertiary `subline` capped at `maxWidth: 400`.
2. **Footer region** — sticky to the bottom of the scroll container, containing the two see-also links and an interleaving `·` separator.

### Sticky footer implementation

`position: sticky; bottom: 0` on the footer element, with `background: var(--surface-primary)` so scrolling content underneath doesn't bleed through. A thin `borderTop: 1px solid var(--border-primary)` separates it from the narrative above.

This works because `BottomPanel.tsx`'s tab content area (`flex: 1, overflow: 'auto', padding: '8px 16px'`) is the scroll container, and `position: sticky` resolves against the nearest scrollable ancestor. For narrative-KPI specifically the content is short and won't scroll, so "sticky" reads as "pinned to the bottom" — but the same component drops into the same scroll context other tabs use, so the behavior generalizes when Batch 1 tabs adopt it.

The footer renders the two links as `<button>`s styled to match the existing `linkStyle` pattern in `ChurnTab.tsx` (transparent background, `color: var(--accent-primary)`, underlined, `fontSize: 10`). Click invokes `onApplyPreset(seeAlso[i].presetId)`.

### Outer wrapper change

The current `KnowledgeSilosTab.tsx` outer wrapper is `<div style={{ padding: '12px 0' }}>` with no height claim. The new `<NarrativeKPI>` outer wrapper is a flex column with `minHeight: '100%'` so the sticky footer has something to pin against. **The KPI tile + narrative subtree renders byte-identically; the outer container does change.** Acceptable because:

- The tile is the regulated visual per the Linear DoD.
- The taller container only matters when the tab content is shorter than the panel — in which case the footer pins to the bottom (intentional, per the polish doc's footer rule).
- When content is taller than the panel, the panel's existing `overflow: auto` already controlled scroll behavior; that path is unchanged.

### Knowledge Silos refactor

`KnowledgeSilosTab.tsx` becomes:

```tsx
import { NarrativeKPI } from '../shared/NarrativeKPI';
import type { GitrelicReport } from '@gitrelic/core';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';

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
          <strong>{kc.singleAuthorFiles}</strong> of {kc.totalFiles} files have a single dominant author (80%+ commits)
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

The `riskLevel` helper stays in `KnowledgeSilosTab.tsx` because the 40 / 70 thresholds are concentration-index-specific. Each Batch 1 tab will own its own threshold helper following this pattern.

`onApplyPreset` is **required** on the tab's props (no `?`). `BottomPanel.tsx` always has the prop in scope, so requiring it makes the contract honest and prevents a tab from silently rendering footer-less.

### `BottomPanel.tsx` wiring

One-line change at `BottomPanel.tsx:122-123`:

```tsx
case 'knowledge-silos':
  return <KnowledgeSilosTab report={report} onApplyPreset={onApplyPreset} />;
```

`onApplyPreset` is already destructured into the `TabContent` helper component in this file, so no other plumbing needed.

### "Behavior unchanged" interpretation

The Linear ticket's DoD says "no regressions on Knowledge Silos visual / screenshot." This spec interprets that as **the KPI tile + narrative region must render byte-identically** — same fontSize, fontFamily, color, spacing, badge variant, label letter-spacing.

Adding a footer is **not a regression** — the polish doc explicitly mandates one on every bottom panel, and the existing Knowledge Silos predates that rule. Gaining the footer is a documented improvement, not a behavior change in the regulated sense.

## Tests

### `NarrativeKPI.test.tsx` — five focused cases

1. **Smoke** — renders the big number, tier badge, and metric label with given props.
2. **Severity color** — for `tier.variant: 'warning'`, asserts the inline `color: var(--severity-warning)` style on the big number element.
3. **Optional `subline`** — render without `subline`, assert no element with the subline's text content; render with one, assert it appears.
4. **`finding` accepts ReactNode** — pass `<><strong>1,870</strong> of 2,792 files</>`, assert the `<strong>` renders inside the finding.
5. **Footer click invokes `onApplyPreset`** — render with a mock callback, click each see-also button, assert the callback received `seeAlso[0].presetId` then `seeAlso[1].presetId`.

### `KnowledgeSilosTab.test.tsx` — one smoke case

Render with a minimal `GitrelicReport` fixture (concentration index in the warning band) plus a mock `onApplyPreset`. Assertions:

- The big number renders the expected percentage.
- The "Moderate Risk" badge is present.
- Both see-also buttons ("Bus Factor", "Ghost Files") are present.
- Clicking the first fires `onApplyPreset('bus-factor')`.

This is the regression guard for "Knowledge Silos visual unchanged."

### Test infra

Both test files use `@testing-library/react` + `vitest`. The most direct precedent is `apps/web/src/components/tabs/ChurnTab.test.tsx` (same scrolling-tab + `onApplyPreset` shape); `Shell.test.tsx` and `SortableTable.test.tsx` are secondary references for shared-component test patterns. No new infrastructure.

## Definition of done

- [ ] `apps/web/src/components/shared/NarrativeKPI.tsx` exists with the API above.
- [ ] Sticky "See also" footer renders correctly in the `BottomPanel` scroll context.
- [ ] `KnowledgeSilosTab.tsx` consumes `<NarrativeKPI>`; net code reduction; KPI tile subtree renders byte-identically to `main` (outer wrapper change documented in [Outer wrapper change](#outer-wrapper-change)).
- [ ] `BottomPanelProps.onApplyPreset` and the local `TabContent` helper's `onApplyPreset` are tightened from optional to required; `BottomPanel.tsx` passes `onApplyPreset` into `KnowledgeSilosTab`.
- [ ] `NarrativeKPI.test.tsx` covers the five cases above; `KnowledgeSilosTab.test.tsx` covers the smoke case.
- [ ] `docs/polish-pattern.md`'s reference-implementation pointer (line ~51) is updated from `apps/web/src/components/tabs/KnowledgeSilosTab.tsx` to `apps/web/src/components/shared/NarrativeKPI.tsx`. Per the polish doc's own rule (line 9), doc updates land *first* / in the same commit as the code, not after.
- [ ] `pnpm test` and `pnpm lint` pass at repo root.
- [ ] Manual smoke on the React fixture (`node apps/cli/dist/index.mjs --path ~/Desktop/react --web`) shows the Knowledge Silos tab rendering its KPI tile + narrative + new footer with both see-also links functional.

## Risks & mitigations

- **Visual drift from the lift.** The KPI tile + narrative styling lives inline in the current `KnowledgeSilosTab.tsx`; reproducing it in a shared component risks subtle diffs (margin, fontSize, color tokens). *Mitigation:* copy the JSX subtree wholesale, then refactor only the prop interface around it. Keep the inline `style={...}` blocks identical until the smoke test passes; only after that consider any consolidation.
- **`position: sticky` not engaging.** Sticky requires a scrollable ancestor with finite height. `BottomPanel`'s tab area satisfies this, but if a future layout change makes the panel `overflow: visible` the footer would silently un-stick. *Mitigation:* the smoke test on the live React fixture catches this for the Knowledge Silos surface; Batch 1 tabs will hit the same scroll container so we'll catch it again there.
- **2-tuple too rigid.** If during a Batch 1 polish a tab genuinely needs three see-also links, we'd loosen to `SeeAlsoLink[]`. *Mitigation:* trivial refactor — change the type, no callsite changes needed. Document this as the escape hatch in the component file's doc comment.
