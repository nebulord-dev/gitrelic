# Tailwind Migration — PR1 (Foundation + Canary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the Tailwind v4 + `cn()` foundation in `apps/web` and migrate `NarrativeKPI.tsx` end-to-end as the canary that proves the pattern.

**Architecture:** Add `clsx` + `tailwind-merge` to `apps/web`, create a `cn()` composer and a typed `classMaps.ts` for tier→class lookups, bridge existing `:root` CSS variables to Tailwind tokens via an `@theme` block in `index.css`. Migrate `NarrativeKPI` (already partially uses Tailwind via `narrative-kpi-*` layout classes) so its `style={{}}` blocks become Tailwind utilities while the `[data-theme]` runtime switch and the `narrative-kpi` container query continue to work unchanged.

**Tech Stack:** Tailwind v4 (already installed via `@tailwindcss/vite`), `clsx` ^2, `tailwind-merge` ^2, vitest 4 + happy-dom, React 19.

**Spec:** `docs/superpowers/specs/2026-04-30-tailwind-migration-design.md`

---

## File Map

### New files
- `apps/web/src/utils/cn.ts` — `cn(...inputs)` composer wrapping `clsx` + `tailwind-merge`.
- `apps/web/src/utils/cn.test.ts` — unit tests for `cn()`.
- `apps/web/src/utils/classMaps.ts` — typed lookup maps from `BadgeVariant` → Tailwind class strings (`badgeClasses`, `severityText`).
- `apps/web/src/utils/classMaps.test.ts` — unit tests covering all variants in both maps.

### Modified files
- `apps/web/package.json` — add `clsx` and `tailwind-merge` to `dependencies`.
- `apps/web/src/index.css` — add `@theme` block aliasing CSS variables to Tailwind tokens (after the `@import 'tailwindcss';` line, before the existing `:root` block).
- `apps/web/src/components/shared/NarrativeKPI.tsx` — replace every `style={{}}` and the `linkStyle: CSSProperties` constant with Tailwind classes via `cn()` + `classMaps.ts` lookups.
- `apps/web/src/components/shared/NarrativeKPI.test.tsx` — update the severity-color assertion (line 34) to check className instead of style attribute.

### Untouched in PR1
- `apps/web/src/components/theme.ts` — `badgeStyles` stays for now (consumed by `Badge.tsx`, which migrates in PR2).
- All hero/tab/inspector/layout components — migrated in PR2/3/4.

---

## Task 1: Install clsx + tailwind-merge

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install both deps**

Run from repo root:
```bash
pnpm --filter @gitrelic/web add clsx tailwind-merge
```

Expected: `apps/web/package.json` `dependencies` block now contains `"clsx": "^2.x.x"` and `"tailwind-merge": "^2.x.x"`. Lockfile updates.

- [ ] **Step 2: Verify install resolved**

```bash
pnpm --filter @gitrelic/web list clsx tailwind-merge
```

Expected: both listed with concrete versions, no warnings.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add clsx and tailwind-merge for cn() pattern (RELIC-336)"
```

---

## Task 2: Create cn() composer (TDD)

**Files:**
- Create: `apps/web/src/utils/cn.test.ts`
- Create: `apps/web/src/utils/cn.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/src/utils/cn.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { cn } from './cn';

describe('cn', () => {
  it('joins string args', () => {
    expect(cn('flex', 'gap-2')).toBe('flex gap-2');
  });

  it('handles conditional values via clsx semantics', () => {
    expect(cn('flex', false && 'hidden', 'gap-2')).toBe('flex gap-2');
    expect(cn('flex', true && 'gap-2')).toBe('flex gap-2');
    expect(cn('flex', null, undefined, 'gap-2')).toBe('flex gap-2');
  });

  it('resolves Tailwind conflicts via tailwind-merge', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', 'text-lg')).toBe('text-lg');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('accepts arrays and objects (clsx semantics)', () => {
    expect(cn(['flex', 'gap-2'])).toBe('flex gap-2');
    expect(cn({ flex: true, hidden: false })).toBe('flex');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @gitrelic/web test cn.test.ts
```

Expected: FAIL — `Cannot find module './cn'`.

- [ ] **Step 3: Write the implementation**

`apps/web/src/utils/cn.ts`:

```ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @gitrelic/web test cn.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/cn.ts apps/web/src/utils/cn.test.ts
git commit -m "feat(web): add cn() composer with clsx + tailwind-merge (RELIC-336)"
```

---

## Task 3: Create classMaps.ts (TDD)

**Files:**
- Create: `apps/web/src/utils/classMaps.test.ts`
- Create: `apps/web/src/utils/classMaps.ts`

**Why this file is small but worth the test:** the maps are typed as `Record<BadgeVariant, string>`, so TypeScript guarantees full coverage at compile time. The test exists to catch *content* drift — a refactor renaming `bg-severity-critical-bg` to a wrong utility wouldn't fail the type check but would fail rendering. One snapshot-style test is enough.

- [ ] **Step 1: Write the failing test**

`apps/web/src/utils/classMaps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { badgeClasses, severityText } from './classMaps';

describe('badgeClasses', () => {
  it('covers every BadgeVariant with bg + text classes', () => {
    expect(badgeClasses).toEqual({
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
    });
  });
});

describe('severityText', () => {
  it('covers every BadgeVariant with a foreground severity class', () => {
    expect(severityText).toEqual({
      critical:  'text-severity-critical',
      warning:   'text-severity-warning',
      moderate:  'text-severity-moderate',
      healthy:   'text-severity-healthy',
      ownership: 'text-accent-ownership',
      coupling:  'text-accent-coupling',
      temporal:  'text-accent-temporal',
      shame:     'text-severity-critical',
      parallel:  'text-severity-warning',
      stale:     'text-text-tertiary',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm --filter @gitrelic/web test classMaps.test.ts
```

Expected: FAIL — `Cannot find module './classMaps'`.

- [ ] **Step 3: Write the implementation**

`apps/web/src/utils/classMaps.ts`:

```ts
import type { BadgeVariant } from '../components/theme';

/**
 * Combined background + foreground classes per variant.
 * Replaces the legacy `badgeStyles` lookup in `components/theme.ts`,
 * which returns CSS-var strings for inline-style consumption.
 * Migrate consumers from `badgeStyles[v]` (used in `style={{}}`)
 * to `badgeClasses[v]` (used in `className`) as part of the Tailwind
 * migration (RELIC-336).
 */
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

/**
 * Foreground-only severity color per variant — for big numbers, icons,
 * or text accents that need just the bold severity color (no background).
 */
export const severityText: Record<BadgeVariant, string> = {
  critical:  'text-severity-critical',
  warning:   'text-severity-warning',
  moderate:  'text-severity-moderate',
  healthy:   'text-severity-healthy',
  ownership: 'text-accent-ownership',
  coupling:  'text-accent-coupling',
  temporal:  'text-accent-temporal',
  shame:     'text-severity-critical',
  parallel:  'text-severity-warning',
  stale:     'text-text-tertiary',
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter @gitrelic/web test classMaps.test.ts
```

Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/classMaps.ts apps/web/src/utils/classMaps.test.ts
git commit -m "feat(web): add typed tier->Tailwind class maps (RELIC-336)"
```

---

## Task 4: Add @theme bridge to index.css

**Files:**
- Modify: `apps/web/src/index.css` (insert `@theme` block between line 1 `@import 'tailwindcss';` and line 7 `:root {`)

**Why no test:** Tailwind's `@theme` directive runs at CSS-build time. The bridge is verified by Task 5's NarrativeKPI render — if `bg-surface-primary` and `text-severity-critical` resolve to the right colors visually, the bridge works. Container query and theme-switcher behavior are also covered by NarrativeKPI's existing tests + manual QA.

- [ ] **Step 1: Insert the @theme block**

In `apps/web/src/index.css`, between line 1 (`@import 'tailwindcss';`) and the existing `:root` block (currently starting line 7), insert:

```css

/* ═══════════════════════════════════════════════════
   Tailwind v4 Token Bridge (RELIC-336)
   Aliases the semantic CSS variables defined in :root below to
   Tailwind tokens, so utilities like `bg-surface-primary` and
   `text-severity-critical` resolve through the same variables
   that the [data-theme='light'] switch already toggles. Theme
   switching keeps working unchanged — only the Tailwind utility
   class is the new surface.
   ═══════════════════════════════════════════════════ */

@theme {
  /* Surface */
  --color-surface-primary: var(--surface-primary);
  --color-surface-secondary: var(--surface-secondary);
  --color-surface-tertiary: var(--surface-tertiary);
  --color-surface-elevated: var(--surface-elevated);

  /* Borders */
  --color-border-primary: var(--border-primary);
  --color-border-secondary: var(--border-secondary);
  --color-border-focus: var(--border-focus);

  /* Text */
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-text-inverse: var(--text-inverse);

  /* Severity */
  --color-severity-critical: var(--severity-critical);
  --color-severity-critical-bg: var(--severity-critical-bg);
  --color-severity-critical-text: var(--severity-critical-text);
  --color-severity-warning: var(--severity-warning);
  --color-severity-warning-bg: var(--severity-warning-bg);
  --color-severity-warning-text: var(--severity-warning-text);
  --color-severity-moderate: var(--severity-moderate);
  --color-severity-moderate-bg: var(--severity-moderate-bg);
  --color-severity-moderate-text: var(--severity-moderate-text);
  --color-severity-healthy: var(--severity-healthy);
  --color-severity-healthy-bg: var(--severity-healthy-bg);
  --color-severity-healthy-text: var(--severity-healthy-text);

  /* Accent / Domain */
  --color-accent-ownership: var(--accent-ownership);
  --color-accent-ownership-bg: var(--accent-ownership-bg);
  --color-accent-ownership-text: var(--accent-ownership-text);
  --color-accent-coupling: var(--accent-coupling);
  --color-accent-coupling-bg: var(--accent-coupling-bg);
  --color-accent-coupling-text: var(--accent-coupling-text);
  --color-accent-temporal: var(--accent-temporal);
  --color-accent-temporal-bg: var(--accent-temporal-bg);
  --color-accent-temporal-text: var(--accent-temporal-text);
  --color-accent-primary: var(--accent-primary);

  /* Component */
  --color-panel-resize-handle: var(--panel-resize-handle);
  --color-panel-resize-handle-hover: var(--panel-resize-handle-hover);
  --color-nav-item-active-bg: var(--nav-item-active-bg);
  --color-nav-badge-critical: var(--nav-badge-critical);
  --color-nav-badge-warning: var(--nav-badge-warning);
  --color-tooltip-bg: var(--tooltip-bg);
  --color-tooltip-text: var(--tooltip-text);

  /* Fonts — duplicated from :root so Tailwind's font-* utilities
     pick up the project's stack. Keeping :root values too so any
     direct var(--font-*) consumer in CSS keeps working unchanged. */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
}

```

The existing `:root`, `[data-theme='light']`, base, scrollbar, utility, and `narrative-kpi-*` blocks below stay completely unchanged.

- [ ] **Step 2: Verify dev server runs and dashboard loads with no theming change**

In one terminal:
```bash
pnpm --filter @gitrelic/web build
```
Expected: build succeeds, no Tailwind / Vite errors.

In another terminal (assumes you have a generated report from a real repo locally — e.g., the React repo):
```bash
node apps/cli/dist/index.mjs --path ~/path/to/react --web
```
Expected: dashboard loads at the printed port. Click through 2–3 tabs (e.g., Bus Factor, Knowledge Silos, Churn). Visual must be **byte-identical** to before — no color shifts, no font shifts, no spacing shifts. The bridge alone shouldn't render any new utility yet — this is the "did I break the theme?" check.

If anything looks different, the bridge has an issue (most likely a typo in a CSS var name). Diff against `:root` to verify every `--color-*` alias points to a CSS variable that actually exists in `:root`.

- [ ] **Step 3: Verify the [data-theme='light'] switch still flips**

In the dev server's browser DevTools, toggle the theme:
```js
document.documentElement.dataset.theme = 'light';
// then back:
document.documentElement.dataset.theme = '';
```
Expected: theme flips between dark and light cleanly (same behavior as before the @theme block).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/index.css
git commit -m "feat(web): bridge CSS variables to Tailwind tokens via @theme (RELIC-336)"
```

---

## Task 5: Migrate NarrativeKPI.tsx (canary)

**Files:**
- Modify: `apps/web/src/components/shared/NarrativeKPI.tsx`
- Modify: `apps/web/src/components/shared/NarrativeKPI.test.tsx`

**Translation reference** (every existing `style={{}}` block and its Tailwind equivalent):

| Original | Tailwind |
|---|---|
| `display: flex, flexDirection: column, minHeight: '100%'` | `flex flex-col min-h-full` |
| `flex: 1, padding: '12px 0'` | `flex-1 py-3` |
| `display: flex, gap: 24, alignItems: flex-start` | `flex gap-6 items-start` |
| `textAlign: center, minWidth: 120` | `text-center min-w-[120px]` |
| `fontSize: 36, fontWeight: 700, fontFamily: var(--font-mono), color: var(--severity-X), lineHeight: 1` | `cn('text-[36px] font-bold font-mono leading-none', severityText[tier.variant])` |
| `marginTop: 4` | `mt-1` |
| `fontSize: 9, color: var(--text-tertiary), marginTop: 6, textTransform: uppercase, letterSpacing: 1` | `text-[9px] text-text-tertiary mt-1.5 uppercase tracking-[1px]` |
| `display: flex, flexDirection: column, gap: 8, fontSize: 11` | `flex flex-col gap-2 text-[11px]` |
| `color: var(--text-secondary)` | `text-text-secondary` |
| `color: var(--text-tertiary), fontSize: 10, maxWidth: 400` | `text-text-tertiary text-[10px] max-w-[400px]` |
| Sticky footer: `position: sticky, bottom: 0, marginTop: auto, background: var(--surface-primary), borderTop: 1px solid var(--border-primary), padding: 6px 4px, fontSize: 10, color: var(--text-tertiary), display: flex, gap: 8, alignItems: center` | `sticky bottom-0 mt-auto bg-surface-primary border-t border-border-primary px-1 py-1.5 text-[10px] text-text-tertiary flex gap-2 items-center` |
| `linkStyle` constant (background: none, border: none, color: var(--accent-primary), fontSize: 10, cursor: pointer, padding: 0, textDecoration: underline) | constant: `const linkClass = 'bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline';` |

**Why arbitrary values for some sizes:** the existing component uses several non-standard pixel values (`fontSize: 9`, `fontSize: 10`, `fontSize: 11`, `fontSize: 36`, `letterSpacing: 1`, `padding: 6px 4px`) that don't map cleanly to Tailwind's scale. Using `text-[10px]` etc. preserves byte-identical sizing. Standard utilities (`gap-6` for 24px, `mt-1.5` for 6px) work because they happen to be on Tailwind's 4px scale.

**Why keep the `narrative-kpi-*` classNames:** the container query in `index.css` targets these selectors. Removing them breaks the responsive ≥880px layout. They stay; Tailwind utilities are added alongside them via `cn()`.

- [ ] **Step 1: Update the existing test that asserts on style attribute**

In `apps/web/src/components/shared/NarrativeKPI.test.tsx`, replace the body of the test on lines 29–35 (`'applies severity color from tier.variant to the big number'`) with:

```tsx
  it('applies severity color from tier.variant to the big number', () => {
    render(<NarrativeKPI {...baseProps} onApplyPreset={vi.fn()} />);
    const big = screen.getByText('67%');
    // Tailwind class is the contract now; happy-dom won't compute the
    // resolved color, but the className is enough to verify wiring.
    expect(big.className).toContain('text-severity-warning');
  });
```

- [ ] **Step 2: Run the test to confirm it fails (red)**

```bash
pnpm --filter @gitrelic/web test NarrativeKPI.test.tsx
```

Expected: the updated assertion FAILS (current implementation still uses inline style, big.className doesn't contain `text-severity-warning`). Other tests still pass.

- [ ] **Step 3: Replace NarrativeKPI.tsx with the migrated implementation**

Full file contents for `apps/web/src/components/shared/NarrativeKPI.tsx`:

```tsx
import type { ReactNode } from 'react';

import Badge from './Badge';

import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import { cn } from '../../utils/cn';
import { severityText } from '../../utils/classMaps';

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
  /**
   * Optional content rendered alongside the KPI / finding / subline row and
   * above the sticky see-also footer. On wide containers (≥880px) the extras
   * sit side-by-side with the KPI row; on narrow containers they stack
   * beneath. Use for analyzer-specific drill-downs (directory rollups,
   * secondary callouts) that don't fit the constrained subline area. Leave
   * undefined for the canonical sparse layout.
   */
  extras?: ReactNode;
  seeAlso: [SeeAlsoLink, SeeAlsoLink];
  onApplyPreset: (id: PresetId) => void;
}

const linkClass =
  'bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline';

export function NarrativeKPI({
  bigNumber,
  tier,
  metric,
  finding,
  subline,
  extras,
  seeAlso,
  onApplyPreset,
}: NarrativeKPIProps) {
  return (
    <div className="flex flex-col min-h-full">
      <div className="narrative-kpi-body flex-1 py-3">
        <div className="narrative-kpi-stack">
          <div className="narrative-kpi-row flex gap-6 items-start">
            <div className="text-center min-w-[120px]">
              <div
                data-testid="narrative-kpi-big-number"
                className={cn(
                  'text-[36px] font-bold font-mono leading-none',
                  severityText[tier.variant],
                )}
              >
                {bigNumber}
              </div>
              <div className="mt-1">
                <Badge variant={tier.variant}>{tier.label}</Badge>
              </div>
              <div className="text-[9px] text-text-tertiary mt-1.5 uppercase tracking-[1px]">
                {metric}
              </div>
            </div>
            <div className="flex flex-col gap-2 text-[11px]">
              <div className="text-text-secondary">{finding}</div>
              {subline != null && (
                <div className="text-text-tertiary text-[10px] max-w-[400px]">{subline}</div>
              )}
            </div>
          </div>
          {extras != null && <div className="narrative-kpi-extras">{extras}</div>}
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto bg-surface-primary border-t border-border-primary px-1 py-1.5 text-[10px] text-text-tertiary flex gap-2 items-center">
        See also:{' '}
        <button onClick={() => onApplyPreset(seeAlso[0].presetId)} className={linkClass}>
          {seeAlso[0].label}
        </button>
        ·
        <button onClick={() => onApplyPreset(seeAlso[1].presetId)} className={linkClass}>
          {seeAlso[1].label}
        </button>
      </div>
    </div>
  );
}
```

Key changes vs. original:
- Removed `import type { CSSProperties }` and the `linkStyle: CSSProperties` constant.
- Added `import { cn } from '../../utils/cn'` and `import { severityText } from '../../utils/classMaps'`.
- Replaced every `style={{}}` block with the equivalent `className` (see translation table above).
- Kept the four `narrative-kpi-*` classNames that the container query in `index.css` targets.
- Big-number color is now `severityText[tier.variant]` (typed lookup) instead of `\`var(--severity-${tier.variant})\`` (template literal).

- [ ] **Step 4: Run all NarrativeKPI tests**

```bash
pnpm --filter @gitrelic/web test NarrativeKPI.test.tsx
```

Expected: all 8 tests PASS (the updated severity-color assertion is now satisfied, and the other tests — basic render, subline conditional, ReactNode finding, click handlers, container/stack/extras class wiring — keep working because the `narrative-kpi-*` classes are preserved and behavior is unchanged).

- [ ] **Step 5: Run the full web test suite**

```bash
pnpm --filter @gitrelic/web test
```

Expected: all 29 tests PASS. No consumer of `NarrativeKPI` should break — the component's prop shape is unchanged.

- [ ] **Step 6: Run lint and format**

```bash
pnpm lint
pnpm format:check
```

Expected: both clean. If `format:check` complains, run `pnpm format` and commit the fix.

- [ ] **Step 7: Visual QA against rendered dashboard**

Build the CLI bundle (so it serves the freshly-built `apps/web/dist`):
```bash
pnpm build
```

Then run the dashboard against a real repo:
```bash
node apps/cli/dist/index.mjs --path ~/path/to/react --web
```

In the browser, navigate through every tab that consumes `NarrativeKPI`:
- Bus Factor (tab) — narrative-KPI panel at the bottom
- Knowledge Silos (tab) — original NarrativeKPI consumer
- Blast Radius (tab) — uses `extras` slot
- Rewrite Ratio (tab) — uses `extras` slot
- Shame (tab) — uses `extras` slot

For each, compare against your baseline screenshot. Verify:
- Big number color matches the tier (red for critical, amber for warning, blue for moderate, green for healthy).
- Big number font is the project's mono stack (SF Mono / Cascadia Code), not Tailwind's default monospace.
- Tier badge appears unchanged (Badge.tsx is not yet migrated — should still look identical).
- Metric label is uppercase, 9px, tertiary text color, with letter-spacing.
- Finding text and subline colors match (secondary and tertiary respectively).
- Sticky "See also" footer pins to the bottom of the panel, has a top border, and the link buttons are accent-primary blue with underline.
- **Container query test:** resize the browser. The `.narrative-kpi-stack` should remain column-direction at narrow widths and flip to row-direction at ≥880px (KPI row + extras side-by-side on tabs that use extras). On panels without extras (Knowledge Silos), there's no visible flip — the stack is single-child either way.

Then toggle dark/light theme via DevTools (`document.documentElement.dataset.theme = 'light'`) and re-eyeball the same surfaces — colors should flip correctly because the `[data-theme]` switcher still drives the underlying CSS variables that the @theme bridge aliases.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/shared/NarrativeKPI.tsx apps/web/src/components/shared/NarrativeKPI.test.tsx
git commit -m "refactor(web): migrate NarrativeKPI to Tailwind via cn() (RELIC-336)

Canary migration for the Tailwind v4 adoption. Replaces every
style={{}} block with Tailwind utilities; severity color now flows
through the typed severityText lookup map instead of a template-
string CSS variable. The four narrative-kpi-* classNames stay because
the responsive container query in index.css targets them by selector."
```

---

## Self-Review

After writing this plan, I checked it against the spec:

**Spec coverage:**
- ✅ `cn.ts` — Task 2.
- ✅ `classMaps.ts` (with `badgeClasses` + `severityText`) — Task 3.
- ✅ `@theme` block in `index.css` — Task 4.
- ✅ NarrativeKPI canary migration — Task 5.
- ✅ Container query preserved — Task 5 step 3 (kept narrative-kpi-* classnames) and step 7 (manual QA).
- ✅ `[data-theme]` runtime switch preserved — Task 4 step 3 + Task 5 step 7.
- ✅ Tests passing throughout — Task 5 step 5.
- ✅ Visual QA against baseline screenshots — Task 5 step 7.
- ⚠️ NOT in this plan: `react/forbid-dom-props` lint rule, root CLAUDE.md update, `theme.ts` consolidation (deletion of `badgeStyles`). Those land in PR4 and PR2 respectively per the spec — correctly out of scope for PR1.

**Placeholder scan:** None — every code block is complete, every command is exact, expected outputs are stated.

**Type consistency:** `cn` signature, `BadgeVariant` import path (`'../components/theme'`), `severityText` and `badgeClasses` shapes, `linkClass` usage all consistent across tasks.

---

## What's next after this PR merges

PR2 picks up shared + layout components (Badge, Tooltip, HeroCaption, ChurnLegend, SortableTable, Shell, Sidebar, TopBar, BottomPanel, MetricsStrip, InspectorPanel, LayoutControls). Badge migrating in PR2 is what triggers the deletion of `badgeStyles` from `theme.ts`. A separate plan document will be written when PR1 lands — using the same template but consuming the foundation primitives this PR establishes.
