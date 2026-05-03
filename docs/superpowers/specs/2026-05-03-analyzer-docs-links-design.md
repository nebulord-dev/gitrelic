# Analyzer Docs Links — Design

> **Linear ticket:** TBD (file as part of the chore PR)
> **Polish Initiative pattern doc:** [`docs/polish-pattern.md`](../../polish-pattern.md)
> **Status:** Draft 2026-05-03. Implementation plan to follow via `superpowers:writing-plans`.

## Context

The Polish Initiative ships an `apps/docs/analyzers/<slug>.md` page with each polished analyzer. As of 2026-05-03 seven analyzers have docs pages — `age-map`, `blast-radius`, `bus-factor`, `churn`, `parallel-dev`, `rewrite-ratio`, `shame` — and Commit Timing (RELIC-323) is in PR review and will land an eighth.

The dashboard does not link to any of these pages. A user staring at the Bus Factor panel who wants to know "how is `overallBusFactor` calculated?" or "what does the High Risk tier mean?" has to discover the docs site externally. The polish-pattern doc captures placement decisions for hero, KPI, see-also, and tier thresholds — but has no story for how a user gets from the analyzer they're reading to the docs page that explains it.

The intent is **reference-on-demand**: surface a link that's hard to miss while reading the panel, anchored on the analyzer's identity, conditional on the docs page existing so unpolished analyzers stay link-free until they're polished.

## Goals

1. **Add an opt-in `docsPath?: string` field to `PresetDefinition`.** Setting it on a preset is the single switch that wires the in-app docs link.
2. **Render a `Docs ↗` affordance in the bottom-panel tab bar** when the active preset has `docsPath` set. Right-anchored, doesn't compete with the tab buttons or chart chrome.
3. **Backfill the eight polished analyzers** (the seven shipped + Commit Timing once RELIC-323 merges) with their `docsPath` values.
4. **Update `docs/polish-pattern.md`** so every future polish session adds the docs page *and* sets `docsPath` on its preset as part of the same DoD.

## Out of scope

- **No docs-page authoring** — all eight pages already exist (or will exist when 323 merges).
- **No new docs site nav.** The VitePress sidebar (`apps/docs/.vitepress/config.ts`) already lists each analyzer page.
- **No retroactive ticket churn.** Already-shipped polish tickets stay closed; this spec lives under a single new chore ticket.
- **No links from heroes or hero captions.** Placement is the panel header (tab bar) only — the analyzer name is the canonical anchor for the docs page, and a single source-of-truth location prevents drift across multi-hero analyzers.
- **No info icon or tooltip** — plain `Docs ↗` text link. Affordance is text + arrow, no extra ceremony.
- **No dashboard-tier docs links** (Overview, Risk, Tech Debt presets). Dashboard tiers compose multiple analyzers; their docs story is separate.

## Approach

### Field shape

Extend `PresetDefinition` in `apps/web/src/presets/types.ts`:

```ts
export interface PresetDefinition {
  id: PresetId;
  tier: PresetTier;
  label: string;
  group: SidebarGroupLabel;
  heroLabel?: string;
  hero: { defaultViz: HeroViz; altTabs: HeroViz[] };
  bottomPanel: { defaultTab: BottomTab; altTabs: BottomTab[] };
  metrics: (report: GitrelicReport) => Metric[];
  docsPath?: string; // e.g. 'analyzers/churn'. When set, BottomPanel renders a Docs link.
}
```

Path convention: **slug only**, no leading slash, no base, no extension. Path-style (`'analyzers/churn'`) rather than slug-style (`'churn'`) so the field is self-descriptive at the call site and cheap to extend if a future polish session adds a non-`/analyzers/` doc target. Resolution rule: the URL is built as `${DOCS_BASE_URL}/${docsPath}` where `DOCS_BASE_URL = 'https://nebulord-dev.github.io/gitrelic'` (matches `apps/docs/.vitepress/config.ts` `base: '/gitrelic/'` deployed under the repo's GitHub Pages host).

`DOCS_BASE_URL` lives as a module-level `const` at the top of `BottomPanel.tsx`. Not configurable; the docs deployment URL is stable.

### Rendering placement

The bottom-panel tab bar (`apps/web/src/components/layout/BottomPanel.tsx`, lines 218–233) currently renders `altTabs` left-to-right. Add a right-side affordance using flex justification:

```tsx
<div className="flex items-center justify-between border-b border-border-primary px-4 shrink-0">
  <div className="flex">
    {altTabs.map(...)}
  </div>
  {docsPath && (
    <a
      href={`${DOCS_BASE_URL}/${docsPath}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] text-text-tertiary hover:text-text-primary px-3.5 py-2"
    >
      Docs ↗
    </a>
  )}
</div>
```

Visual notes:

- **Type size matches tab buttons** (`text-[10px]`) — sits on the same baseline.
- **Tertiary text color** at rest, **primary on hover** — quiet by default, responsive to intent.
- **`target="_blank"` + `rel="noopener noreferrer"`** — docs site is a separate deploy; opening in-place would lose the user's dashboard state. `noopener noreferrer` is the standard hardening for cross-origin `_blank` links.
- **Arrow glyph (`↗`)** matches the established external-link convention in the docs site's own nav.
- **No icon library required** — plain unicode arrow keeps the change scope-tight.

### Plumbing

`docsPath` is per-preset, available in `apps/web/src/presets/registry.ts` via `PRESETS[selection.activePresetId]`. `Shell.tsx` already reads from this map at line 222 for `heroLabel`. Add `docsPath` to the `<BottomPanel>` prop spread at line 437:

```tsx
<BottomPanel
  report={report}
  activeTab={selection.activeBottomTab}
  altTabs={selection.bottomAltTabs}
  docsPath={PRESETS[selection.activePresetId].docsPath}
  ...
/>
```

`BottomPanelProps` adds `docsPath?: string`. No other consumer changes.

### Dashboard-tier presets

`overview`, `risk`, and `tech-debt` are dashboard-tier presets (`PresetTier === 'dashboard'`) that compose metrics from multiple analyzers. They do **not** receive `docsPath` — the field stays `undefined` on their definitions and the link does not render. This is the intended behavior: the docs link is an analyzer-scoped affordance, and dashboard tiers don't have a 1:1 docs page.

### Backfill list

The chore PR sets `docsPath` on these eight analyzer presets:

| Preset ID         | `docsPath`               |
|---                |---                       |
| `age-map`         | `analyzers/age-map`      |
| `blast-radius`    | `analyzers/blast-radius` |
| `bus-factor`      | `analyzers/bus-factor`   |
| `churn`           | `analyzers/churn`        |
| `commit-timing`   | `analyzers/commit-timing`|
| `parallel-dev`    | `analyzers/parallel-dev` |
| `rewrite-ratio`   | `analyzers/rewrite-ratio`|
| `shame`           | `analyzers/shame`        |

`commit-timing` is included contingent on RELIC-323 having merged before this chore PR opens. If 323 is still in review, the chore PR drops `commit-timing` from the list and 323's PR adds it as a one-line addition (single conflict avoided).

### `polish-pattern.md` updates

Three small changes to the existing doc:

1. **New subsection** after "Footer pattern (sticky 'See also')" — heading **"Docs link"**. Defines: placement (panel tab bar, right-anchored), affordance (`Docs ↗` text link), conditional on `docsPath` set on the preset, URL convention (`analyzers/<slug>`).

2. **DoD checklist additions** in "What this changes for polish tickets" (lines 240–247). Add two bullets:
   - Docs page at `apps/docs/analyzers/<slug>.md`
   - `docsPath` set on the analyzer's preset in `apps/web/src/presets/registry.ts`

3. **Cross-reference** in the narrative-KPI anatomy list (lines 67–75) — one-line pointer to the new "Docs link" subsection so readers find both the in-panel chrome decisions in the same place.

## Components

### Files modified

- `apps/web/src/presets/types.ts` — add optional `docsPath?: string` to `PresetDefinition`.
- `apps/web/src/presets/registry.ts` — set `docsPath` on the eight analyzer presets.
- `apps/web/src/components/layout/BottomPanel.tsx` — add `DOCS_BASE_URL` const, accept `docsPath` prop, render right-anchored link in tab bar with conditional render.
- `apps/web/src/components/layout/Shell.tsx` — pass `docsPath={PRESETS[selection.activePresetId].docsPath}` to `<BottomPanel>`.
- `docs/polish-pattern.md` — three additions described above.

### Files created

None.

### Files removed

None.

## Testing

The change is a small bit of conditional rendering with no data transformation. Test surface:

1. **`apps/web/src/components/layout/Shell.test.tsx`** — extend (or add if missing) a case that renders Shell with an analyzer preset that has `docsPath` set and asserts a `<a href>` element with `Docs ↗` text exists in the bottom panel; and a case with a dashboard preset (no `docsPath`) that asserts no docs link renders.

2. **`apps/web/src/presets/registry.test.ts`** — extend to verify the eight backfilled presets have `docsPath` set and that all `docsPath` values follow the `analyzers/<slug>` convention.

3. **No new hero/tab tests required** — none of those surfaces change.

4. **No analyzer/core tests required** — backend unchanged.

## Error handling and edge cases

- **404 on the docs site.** If a preset's `docsPath` value is wrong (typo, dropped page), the user gets a 404 on the VitePress site. The dashboard does not pre-validate URLs — it would require runtime fetches against the deployment, which adds latency for marginal benefit. Mitigation: registry test asserts all `docsPath` values resolve to a real `apps/docs/analyzers/<slug>.md` file at build time. Concretely: for each preset where `docsPath` is set, verify `apps/docs/analyzers/<slug>.md` exists on disk via `fs.existsSync` (Vitest already runs in Node, can hit the filesystem directly).

- **Dashboard-tier presets.** `overview`, `risk`, and `tech-debt` presets do not set `docsPath` — link does not render. Covered by the registry test (verifies `tier === 'dashboard'` presets have `docsPath === undefined`).

- **Local dev.** The link points at the deployed docs site, not the local `pnpm docs:dev` server. Acceptable: `pnpm docs:dev` is a separate workflow used by docs authors, not dashboard users. A user clicking the link from a locally-run dashboard gets the public deployed page — same as clicking any external link.

- **Future docs site URL changes.** `DOCS_BASE_URL` is a single constant in `BottomPanel.tsx`. If the docs deployment moves, one edit. Not worth abstracting into config.

## Risks and mitigations

- **`registry.ts` test relying on filesystem access.** Vitest runs Node, has `fs` access — same pattern other registry tests use to read fixture files. No risk.

- **PR ordering vs RELIC-323.** Spec assumes RELIC-323 merges first. If 323 is still in review when the chore PR opens, drop `commit-timing` from the backfill list; 323 author adds it as a one-line preset addition before merge. Conflict avoided.

- **Docs-site base URL drift.** Hardcoding `'https://nebulord-dev.github.io/gitrelic'` couples the dashboard build to the public deployment. Mitigation: single constant location, explicit comment in `BottomPanel.tsx`, registry test to verify `docsPath` references resolve. Acceptable risk — the docs deployment URL is stable per `apps/docs/.vitepress/config.ts`.

## Decisions / rationale

- **Why a `docsPath` field on the preset, not a convention-based slug lookup.** Convention-based ("if `apps/docs/analyzers/${preset.id}.md` exists, render the link") would couple browser code to filesystem state and require either a fetch + 404-dance or a build-time manifest. Explicit opt-in via a typed field is cleaner: visible in the registry, type-safe, no runtime fetch, trivial to grep.

- **Why path-style (`analyzers/churn`) not slug-style (`churn`).** Path-style is self-descriptive at the call site and lets a future polish session point at non-`/analyzers/` docs (e.g., a guide page) without a schema change. Slug-style would require either a second field or a string-prefix branching rule — both worse than just storing the path segment.

- **Why panel tab bar, not hero header or hero caption.** Discussed in the brainstorming session: the tab bar is the analyzer's identity row, the docs page covers the whole analyzer (hero + KPI + formula), and a single source-of-truth location avoids duplication across multi-hero analyzers (Punch Card / Trend toggle, etc.). Hero caption is chart-scoped; hero header competes with chart chrome.

- **Why a chore PR rather than per-analyzer backfill PRs.** Eight presets, eight one-line additions. A single PR keeps the diff reviewable, scaffolds the field + component change once, and ships the entire backfill atomically. Per-analyzer backfill PRs would be eight near-empty PRs for the same outcome.

- **Why no info icon.** A `Docs ↗` text link is grep-friendly, accessible to screen readers without aria-label ceremony, and consistent with the docs site's own external-link conventions. An icon-only affordance would require alt text or a tooltip and add a dependency surface (icon import) for no readability win.

## Open questions

None at draft time. Spec ready for review.
