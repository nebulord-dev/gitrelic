# Tailwind Migration — RELIC-336

> **Scope:** Eliminate `style={{}}` from `apps/web` and adopt Tailwind v4 + `cn()` (clsx + tailwind-merge) as the sole styling system. Add lint enforcement and CLAUDE.md guidance so the regression doesn't recur.

## Why this exists

`apps/web` accumulated **571 `style={{}}` occurrences across 67 files** during the first wave of dashboard development, despite Tailwind v4 already being installed and wired (`@tailwindcss/vite`, `@import 'tailwindcss'` in `index.css`). Only one component (`NarrativeKPI.tsx`) uses Tailwind classes — and even there, only 4 of its ~11 `style={{}}` blocks were replaced. The pattern in CLAUDE.md and the prime skill never reached the styling layer, so every new component defaulted to inline styles.

This spec covers the migration *and* the structural prevention so the next wave of polish work and any future feature work uses Tailwind from the first line.

## Scope and non-goals

### In scope
- Migrate every `style={{}}` block in `apps/web/src/**/*.tsx` to Tailwind classes.
- Introduce `cn()` (clsx + tailwind-merge) as the canonical dynamic-className composer.
- Introduce typed lookup maps for severity / accent / domain colors so dynamic tier-driven styling stays type-safe and grep-able.
- Add a `@theme` block in `index.css` that aliases existing CSS variables to Tailwind tokens (bridge approach — keep CSS vars as the source of truth, light/dark theme switch unchanged).
- Add `react/forbid-dom-props` lint rule scoped to `apps/web/**` to prevent regression.
- Update root `CLAUDE.md` with a "Web Styling" section so the rule is loaded before Claude touches web files.

### Explicitly out of scope
- **Not migrating `index.css`** to Tailwind primitives (`@apply`, `@layer components`, etc.). The CSS variable token system is good as CSS — six semantic layers (surface / border / text / severity / accent / component), light + dark variants, scrollbar styling. Keep it.
- **Not switching to Tailwind's `dark:` variant.** The existing `[data-theme]` attribute switch ships, works, and is theme-agnostic — a future third theme would just add a new `[data-theme='X']` block, no variant renaming. `dark:` would fight that model.
- **Not adding `class-variance-authority` or similar.** `classMaps.ts` covers the ~5 typed enums (severity, accent, domain). cva is over-engineering for this codebase.
- **Not adding visual regression testing infrastructure.** None exists today. Manual screenshot-vs-rendered comparison covers the gap (see QA below).
- **Not migrating `apps/cli`** (Ink terminal UI — irrelevant) or `apps/docs` (VitePress — separate styling system).

## Foundation primitives

Three new files in `apps/web/src/utils/`:

### `cn.ts` — dynamic className composer
```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```
Standard pattern. `clsx` handles conditional composition; `tailwind-merge` resolves conflicts (`'p-2 p-4'` → `'p-4'`).

### `classMaps.ts` — typed tier→class lookups
```ts
import type { BadgeVariant } from '../components/theme';

/** Combined bg + fg classes — replaces today's `badgeStyles` from theme.ts */
export const badgeClasses: Record<BadgeVariant, string> = {
  critical:  'bg-severity-critical-bg text-severity-critical-text',
  warning:   'bg-severity-warning-bg text-severity-warning-text',
  moderate:  'bg-severity-moderate-bg text-severity-moderate-text',
  healthy:   'bg-severity-healthy-bg text-severity-healthy-text',
  ownership: 'bg-accent-ownership-bg text-accent-ownership-text',
  coupling:  'bg-accent-coupling-bg text-accent-coupling-text',
  temporal:  'bg-accent-temporal-bg text-accent-temporal-text',
  shame:     'bg-severity-critical-bg text-severity-critical-text',
  parallel:  'bg-severity-warning-bg text-severity-warning-text',
  stale:     'bg-surface-tertiary text-text-tertiary',
};

/** Foreground-only severity color, for text/icons that need just the bold accent */
export const severityText: Record<BadgeVariant, string> = {
  critical: 'text-severity-critical',
  /* ... */
};
```
Single source of truth for tier→class translation. Replaces today's `color: \`var(--severity-${variant})\`` template-literal pattern, which is grep-hostile and bypasses the type system.

### Consolidation with `apps/web/src/components/theme.ts`
That file already holds the variant taxonomy and tier→CSS-var lookups:
- `BadgeVariant` type — **keep** (canonical type).
- `badgeStyles: Record<BadgeVariant, { bg, fg }>` returning `var(--...)` strings — **delete in PR2** (migrated to `badgeClasses` above; consumers updated when shared/Badge migrates).
- `severityColor()`, `ageColor()`, `clusterVariant()` — variant-mapping helpers (string → BadgeVariant). **Keep** — these don't produce CSS, they classify data into variants. Class lookup happens after.
- `hotspotColor()` — already marked `@deprecated`, returns `var(--severity-*)` strings. Audit consumers in PR3; if used in React `style`, migrate to `severityText` lookup; if used in D3 `.attr('fill', ...)`, leave alone (SVG attributes — Tailwind doesn't apply).
- `fmt()`, `fileName()`, `filePath()` — pure formatting helpers, unrelated. **Keep.**

`classMaps.ts` could live inside `theme.ts` — they're the same concept. Keep them separate because `theme.ts` is data/taxonomy and `classMaps.ts` is presentation; splitting also makes the migration diff cleaner (`theme.ts` shrinks; `classMaps.ts` is net-new).

### `index.css` — `@theme` block (bridge)
Add at the top of `index.css`, immediately after `@import 'tailwindcss';`:
```css
@theme {
  /* Surface */
  --color-surface-primary: var(--surface-primary);
  --color-surface-secondary: var(--surface-secondary);
  /* Border */
  --color-border-primary: var(--border-primary);
  /* Text */
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  /* Severity (paired colors) */
  --color-severity-critical: var(--severity-critical);
  --color-severity-critical-bg: var(--severity-critical-bg);
  --color-severity-critical-text: var(--severity-critical-text);
  /* ...etc — one alias per CSS variable in :root */
}
```
This makes `bg-surface-primary text-text-primary border-border-primary` work as Tailwind utilities. The `[data-theme='light']` switcher continues to flip the underlying CSS variables — Tailwind classes stay the same, only the resolved color changes. Zero behavior change at runtime.

The container query in `index.css` (`@container narrative-kpi`) stays as-is. It's already minimal, named, and battle-tested for `NarrativeKPI`'s responsive layout.

## PR sequence

Four PRs, each independently mergeable. No coexistence rules needed — solo dev, no users, polish initiative resumes after PR4. Total: ~67 files touched.

### PR1 — Foundation + canary
- Install `clsx` and `tailwind-merge` in `apps/web`.
- Create `apps/web/src/utils/cn.ts` and `apps/web/src/utils/classMaps.ts`.
- Add `@theme` block to `apps/web/src/index.css`.
- Migrate `apps/web/src/components/shared/NarrativeKPI.tsx` end-to-end as the canary. It already has 4 className uses (and a container query) — finish the job, prove the pattern.
- Verify NarrativeKPI's container query still scopes correctly to `.narrative-kpi-body` (the responsive ≥880px side-by-side layout from RELIC-334).

**Files touched:** ~7. **Reviewable in a sitting.**

### PR2 — Shared + layout
Migrate every file in `components/shared/` and `components/layout/`:
- `shared/`: `Badge`, `Tooltip`, `HeroCaption`, `ChurnLegend`, `SortableTable`. (NarrativeKPI already done in PR1.)
- `layout/`: `Shell`, `Sidebar`, `TopBar`, `BottomPanel`, `MetricsStrip`, `InspectorPanel`, `LayoutControls`.

These are the most reused — migrating them ripples class semantics into every consumer for free in subsequent PRs.

**Files touched:** ~12.

### PR3 — Inspectors + heroes
- `inspector/`: `FileInspector`, `ContributorsInspector`, `ActivityInspector`, `GuidePanel`.
- `hero/`: all 22 components.

Heroes are mostly thin wrapper divs around D3-rendered SVG. The SVG body is generated by D3 via `.attr()` / `.style()` calls on selections — Tailwind doesn't apply there and the SVG body stays untouched. Only the outer container migrates. Expect ~1–2 className changes per hero file in most cases.

**Files touched:** ~26.

### PR4 — Tabs + enforcement
- All 22 files in `components/tabs/`.
- Add `react/forbid-dom-props` to `oxlint.config.ts`, scoped to `apps/web/**/*.tsx`:
  ```ts
  {
    files: ['apps/web/**/*.tsx'],
    rules: {
      'react/forbid-dom-props': ['error', { forbid: ['style'] }],
    },
  }
  ```
- Update root `CLAUDE.md` with the "Web Styling" section (content below).

Genuine D3-pixel-driven inline styles (where the value depends on runtime data) get a per-line `// oxlint-disable-next-line react/forbid-dom-props` with a short comment justifying the exception. Expect ≤10 such sites total, all in heroes.

**Files touched:** ~22 + 2 config files.

## CLAUDE.md update

New section in root `CLAUDE.md`, placed near the existing `apps/web` package breakdown. Why root and not a per-package `apps/web/CLAUDE.md`: the prime skill loads root CLAUDE.md first, and the failure mode that produced this migration is *Claude not knowing the styling rule before touching a web file*. A per-package CLAUDE.md is loaded later in context — and was missed every session for the past 70+ files.

Also update the existing `apps/web` package section to add a one-line pointer: "Styling: Tailwind v4 only — see Web Styling section below."

### Section content
```markdown
## Web Styling

`apps/web` uses Tailwind v4 for all styling. The `style` prop is forbidden by lint
(`react/forbid-dom-props`) — use Tailwind classes instead.

**Dynamic className composition:** use `cn()` from `apps/web/src/utils/cn.ts`
(clsx + tailwind-merge):
```tsx
import { cn } from '../../utils/cn';

<div className={cn('flex gap-2', isActive && 'border-border-focus')} />
```

**Tier-driven colors** (severity, accent, domain) come from typed lookup maps in
`apps/web/src/utils/classMaps.ts`. Never compose color classes by template-string-
ing tier names — that bypasses the type system and is grep-hostile:
```tsx
// good
<span className={severityText[tier]}>...</span>

// bad
<span className={`text-severity-${tier}`}>...</span>
```

**Theme system:** CSS variables in `apps/web/src/index.css` are the source of truth.
A `@theme` block aliases them to Tailwind tokens (`bg-surface-primary`,
`text-severity-critical`, etc.). Light/dark switches via the `[data-theme]`
attribute on `<html>`. **Don't introduce `dark:` variants** — they fight the
existing system.

**Don't migrate `index.css` to Tailwind primitives** (`@apply`, `@layer components`).
The CSS variable token system, scrollbar styling, and `narrative-kpi` container
query are good as CSS.

**Genuine inline-style escape hatch:** D3-pixel-driven runtime values
(`width: ${barPx}px`) can't be Tailwind classes. Suppress the lint rule per-line
with `// oxlint-disable-next-line react/forbid-dom-props` and a short comment
explaining why the value is runtime-computed.
```

## Visual QA process

No automated visual regression infra exists, and we're not building any. The QA process is:

1. **Baseline screenshots already exist** for every screen in the dashboard (Dan has them locally).
2. After each PR, run `pnpm dev` against the React repo report (`node apps/cli/dist/index.mjs --path ~/path/to/react --web`).
3. Click through every surface touched by the PR; eyeball against the baseline screenshot.
4. Specifically verify: spacing, font weights, color values (especially severity/accent), tier badge appearance, sticky footers, container-query responsive behavior in `NarrativeKPI`, scrollbar styling.

Per-PR scope is small enough that visual diffing is tractable by hand. PR1 is the canary — if `NarrativeKPI` survives the migration pixel-equivalent, the foundation primitives are sound.

## Risks

| Risk | Mitigation |
|---|---|
| Visual regression (no automated check) | Baseline screenshots + per-PR manual diff against React repo (see QA) |
| Container query (`narrative-kpi`) breaks | PR1 canary specifically tests the responsive ≥880px layout |
| Theme bridge edge cases (RGBA composites with alpha) | Tailwind v4 accepts arbitrary color values in `@theme`; verified in PR1 |
| `cn()` import path drift across nested folders | Use a workspace-relative import alias if the relative-import depth gets ugly past `inspector/` and `tabs/` (3-deep) |
| D3-managed inline styles flagged by new lint rule | Per-line `// oxlint-disable-next-line` with justification — not a blanket disable |

## What we're explicitly NOT doing (recap)

Listed earlier under non-goals — re-stated here for the implementation plan author so it's impossible to miss:

- No `index.css` migration to `@apply` / `@layer components`.
- No `dark:` variant adoption.
- No `class-variance-authority` or similar.
- No visual regression testing infrastructure.
- No migration of `apps/cli` or `apps/docs`.
- No coexistence rules with the Polish Initiative — Polish resumes after PR4.

## Definition of done

- All 67 files in `apps/web` use Tailwind classes; `style={{}}` survives only at lint-disabled D3 sites (≤10 total).
- `react/forbid-dom-props` rule lives in `oxlint.config.ts` scoped to `apps/web/**/*.tsx` and `pnpm lint` passes.
- `cn.ts` and `classMaps.ts` exist and are imported throughout `apps/web`.
- `@theme` block in `index.css` aliases all CSS variables to Tailwind tokens.
- Root `CLAUDE.md` has the "Web Styling" section and the `apps/web` pointer.
- Visual diff against baseline screenshots is clean for every changed surface.
- All existing tests pass (no test currently asserts on inline `style` props or rendered classes — confirmed via grep).
