# Tailwind Migration — PR2 (Shared + Layout) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every `style={{}}` block in `apps/web/src/components/shared/` (5 files: Badge, Tooltip, HeroCaption, ChurnLegend, SortableTable — NarrativeKPI already done in PR1) and `apps/web/src/components/layout/` (7 files: Shell, Sidebar, TopBar, BottomPanel, MetricsStrip, InspectorPanel, LayoutControls) to Tailwind classes via `cn()` and `classMaps.ts`. Delete the legacy `badgeStyles` lookup from `theme.ts` once Badge migrates. Clean up the two `no-constant-binary-expression` lint warnings in `cn.test.ts` so the warning baseline stays at zero-from-this-PR for the rest of the migration.

**Architecture:** Apply the foundation primitives shipped in PR1 (`cn()`, `classMaps.ts` with `badgeClasses`/`severityText`, `@theme` bridge) to 12 component files plus one theme.ts deletion. Each component file's `style={{}}` blocks become Tailwind classes; classNames that index.css targets by selector (none in PR2 scope, but verify for each file) and prop interfaces stay intact. Two documented carve-outs survive the migration as `style` blocks (Tooltip's caller-supplied `wrapperStyle` prop, MetricsStrip's data-driven `m.color`).

**Tech Stack:** Tailwind v4 with `@theme` bridge, `cn()` (clsx + tailwind-merge), vitest 4 + happy-dom, React 19. All foundation primitives live at `apps/web/src/utils/cn.ts` and `apps/web/src/utils/classMaps.ts`.

**Spec:** `docs/superpowers/specs/2026-04-30-tailwind-migration-design.md`
**PR1 plan (canonical translation reference):** `docs/superpowers/plans/2026-04-30-tailwind-migration-pr1-foundation.md`

---

## File Map

### Modified (12 component files)
- `apps/web/src/components/shared/Badge.tsx` (49 lines, 2 styles, **deletes `badgeStyles` consumption** — switches to `badgeClasses` from `classMaps.ts`)
- `apps/web/src/components/shared/Tooltip.tsx` (57 lines, 1 style block + carve-out for `wrapperStyle` prop forwarding + dynamic positioning style)
- `apps/web/src/components/shared/HeroCaption.tsx` (30 lines, 3 styles)
- `apps/web/src/components/shared/ChurnLegend.tsx` (50 lines, 4 styles — one swatch has data-driven `background` via `categoryColor()` — keep that as inline style)
- `apps/web/src/components/shared/SortableTable.tsx` (175 lines, 6 styles)
- `apps/web/src/components/layout/LayoutControls.tsx` (80 lines, 2 styles + dynamic `iconButtonStyle(active)` function — convert to `cn()`-based className)
- `apps/web/src/components/layout/MetricsStrip.tsx` (44 lines, 4 styles + 1 data-driven `m.color` carve-out)
- `apps/web/src/components/layout/TopBar.tsx` (77 lines, 9 styles)
- `apps/web/src/components/layout/Sidebar.tsx` (229 lines, 6 styles)
- `apps/web/src/components/layout/BottomPanel.tsx` (258 lines, 5 styles)
- `apps/web/src/components/layout/InspectorPanel.tsx` (182 lines, 9 styles)
- `apps/web/src/components/layout/Shell.tsx` (478 lines, 9 styles — composes everything; theme switching, resizable panels, keyboard shortcuts)

### Modified (1 supporting file)
- `apps/web/src/components/theme.ts` — **delete** the `badgeStyles` constant (lines 13–24). Keep `BadgeVariant` type, `severityColor()`, `ageColor()`, `clusterVariant()`, `hotspotColor()` (deprecated, audited in PR3), `fmt()`, `fileName()`, `filePath()`. Result: file shrinks from 94 lines to ~80.

### Modified (1 test cleanup)
- `apps/web/src/utils/cn.test.ts` — extract literal `false`/`true` to named variables to eliminate `no-constant-binary-expression` warnings without losing test intent.

### Untouched in PR2
- All hero components (PR3).
- All inspector components (PR3).
- All tab components (PR4).
- `oxlint.config.ts` — `react/forbid-dom-props` rule lands in PR4 (would fire on every unmigrated file in PR2/PR3 otherwise).
- `index.css`, root `CLAUDE.md` — final polish in PR4.

---

## Translation Cookbook

PR1's canonical translation table (in PR1's plan) covers the foundational mappings. PR2 adds these new patterns observed across the 12 files:

### Layout primitives
| Inline | Tailwind |
|---|---|
| `position: 'absolute'` | `absolute` |
| `position: 'relative'` | `relative` |
| `position: 'fixed'` | `fixed` |
| `position: 'sticky'` | `sticky` |
| `top: 0`, `left: 0`, `right: 0`, `bottom: 0` | `top-0`, `left-0`, `right-0`, `bottom-0` |
| `inset: 0` | `inset-0` |
| `width: '100%'` | `w-full` |
| `height: '100%'` | `h-full` |
| `width: '100vw'` / `height: '100vh'` | `w-screen` / `h-screen` |
| `display: 'block'` | `block` |
| `display: 'inline-block'` | `inline-block` |
| `display: 'inline-flex'` | `inline-flex` |
| `display: 'grid'` | `grid` |
| `display: 'none'` | `hidden` |
| `flexShrink: 0` | `shrink-0` |
| `flexGrow: 1` | `grow` |
| `overflow: 'hidden'` | `overflow-hidden` |
| `overflow: 'auto'` | `overflow-auto` |
| `overflow: 'scroll'` | `overflow-scroll` |
| `overflowY: 'auto'` | `overflow-y-auto` |
| `overflowX: 'auto'` | `overflow-x-auto` |
| `whiteSpace: 'nowrap'` | `whitespace-nowrap` |
| `whiteSpace: 'normal'` | `whitespace-normal` |
| `wordBreak: 'break-word'` | `break-words` |
| `pointerEvents: 'none'` | `pointer-events-none` |
| `pointerEvents: 'auto'` | `pointer-events-auto` |
| `cursor: 'pointer'` | `cursor-pointer` |
| `cursor: 'help'` | `cursor-help` |
| `cursor: 'default'` | `cursor-default` |
| `cursor: 'col-resize'` | `cursor-col-resize` |
| `cursor: 'row-resize'` | `cursor-row-resize` |
| `userSelect: 'none'` | `select-none` |

### Borders
| Inline | Tailwind |
|---|---|
| `border: '1px solid var(--border-primary)'` | `border border-border-primary` |
| `border: 'none'` | `border-none` (or `border-0` — both render the same) |
| `borderTop: '1px solid var(--border-primary)'` | `border-t border-border-primary` |
| `borderBottom: '1px solid var(--border-primary)'` | `border-b border-border-primary` |
| `borderLeft: '1px solid var(--border-primary)'` | `border-l border-border-primary` |
| `borderRight: '1px solid var(--border-primary)'` | `border-r border-border-primary` |
| `borderRadius: 4` | `rounded` |
| `borderRadius: 3` | `rounded-[3px]` |
| `borderRadius: 1` | `rounded-[1px]` |
| `borderRadius: '50%'` | `rounded-full` |
| `borderRadius: 8` | `rounded-lg` |
| `borderRadius: 6` | `rounded-md` |

### Spacing (4px-scale shortcuts; non-scale values use arbitrary syntax)
| Inline (px) | Tailwind |
|---|---|
| 0 | `0` |
| 1 | `0.25` |
| 2 | `0.5` |
| 4 | `1` |
| 6 | `1.5` |
| 8 | `2` |
| 10 | `2.5` |
| 12 | `3` |
| 14 | `3.5` |
| 16 | `4` |
| 20 | `5` |
| 24 | `6` |
| 32 | `8` |
| 40 | `10` |
| 48 | `12` |

So `padding: '4px 8px'` → `px-2 py-1`, `padding: '12px 16px'` → `px-4 py-3`, `gap: 14` → `gap-3.5`, etc. Non-scale values (e.g., `gap: 14` happens to be `gap-3.5` because 3.5 × 4 = 14, but `gap: 7` would be `gap-[7px]`).

### Typography
| Inline | Tailwind |
|---|---|
| `fontSize: 9` / `10` / `11` | `text-[9px]` / `text-[10px]` / `text-[11px]` (off-scale) |
| `fontSize: 12` / `14` / `16` / `18` / `20` | `text-xs` / `text-sm` / `text-base` / `text-lg` / `text-xl` |
| `fontSize: 24` / `30` / `36` | `text-2xl` / `text-3xl` / `text-4xl` (or arbitrary if pixel-exact matters) |
| `fontWeight: 400` / `500` / `600` / `700` | `font-normal` / `font-medium` / `font-semibold` / `font-bold` |
| `fontFamily: 'var(--font-mono)'` | `font-mono` |
| `fontFamily: 'var(--font-sans)'` | `font-sans` |
| `lineHeight: 1` | `leading-none` |
| `lineHeight: 1.4` | `leading-snug` (close — use `leading-[1.4]` for exact) |
| `letterSpacing: 1` | `tracking-[1px]` (note: React converts unitless `1` to `1px`) |
| `letterSpacing: '0.02em'` | `tracking-[0.02em]` |
| `textTransform: 'uppercase'` | `uppercase` |
| `textTransform: 'lowercase'` | `lowercase` |
| `textAlign: 'center'` | `text-center` |
| `textAlign: 'left'` | `text-left` |
| `textAlign: 'right'` | `text-right` |
| `textDecoration: 'underline'` | `underline` |
| `textDecoration: 'none'` | `no-underline` |

### Z-index
| Inline | Tailwind |
|---|---|
| `zIndex: 0` | `z-0` |
| `zIndex: 10` | `z-10` |
| `zIndex: 1000` | `z-[1000]` |

### Shadows
| Inline | Tailwind |
|---|---|
| `boxShadow: '0 2px 8px rgba(0,0,0,0.3)'` | `shadow-[0_2px_8px_rgba(0,0,0,0.3)]` (arbitrary — exact pixel values matter) |

### Colors (via @theme bridge)
| Inline | Tailwind |
|---|---|
| `background: 'var(--surface-primary)'` | `bg-surface-primary` |
| `background: 'var(--surface-secondary)'` | `bg-surface-secondary` |
| `background: 'var(--surface-tertiary)'` | `bg-surface-tertiary` |
| `background: 'var(--surface-elevated)'` | `bg-surface-elevated` |
| `background: 'var(--tooltip-bg)'` | `bg-tooltip-bg` |
| `background: 'transparent'` or `'none'` | `bg-transparent` |
| `color: 'var(--text-primary)'` | `text-text-primary` |
| `color: 'var(--text-secondary)'` | `text-text-secondary` |
| `color: 'var(--text-tertiary)'` | `text-text-tertiary` |
| `color: 'var(--tooltip-text)'` | `text-tooltip-text` |
| Severity-tier colors via lookup | use `severityText[variant]` from `classMaps.ts` |
| Tier badge bg+fg combo | use `badgeClasses[variant]` from `classMaps.ts` |

### Conditional / dynamic classes via `cn()`
Whenever a style block depends on a runtime boolean, prop, or state, use `cn()`:
```tsx
import { cn } from '../../utils/cn';

className={cn(
  'px-2 py-1 border border-border-primary rounded text-text-secondary cursor-pointer',
  active ? 'bg-surface-elevated' : 'bg-transparent'
)}
```

If a component currently exports a `getXxxStyle(active: boolean)` function, refactor to a `getXxxClass(active: boolean)` function returning a `cn()` result.

### Documented carve-outs (style survives)

These are the **only** sites in PR2 where `style={{}}` is allowed to remain. Each gets a `// oxlint-disable-next-line react/forbid-dom-props` comment in PR4 with a one-line justification. For PR2, just leave them as-is — no disable comment yet (the rule isn't enabled).

1. **`Tooltip.tsx`** — caller-supplied `wrapperStyle` prop:
   ```tsx
   <div ref={wrapRef} ... className="inline-block cursor-help" style={wrapperStyle}>
   ```
   Why: 5 tab files (BusFactor/BlastRadius/RewriteRatio/CursedFiles/Shame) pass `wrapperStyle` for table-cell ellipsis layouts. Migrating the prop API to `wrapperClassName` is out of PR2 scope (would touch tabs).

2. **`Tooltip.tsx`** — dynamic positioning (left/top/transform driven by `coords`):
   ```tsx
   <div className="fixed bg-tooltip-bg text-tooltip-text px-2 py-1 rounded text-[10px] whitespace-nowrap pointer-events-none z-[1000] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
        style={{ left: coords.x, top: position === 'top' ? coords.y - 8 : coords.y + 8, transform: position === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)' }}>
   ```
   Why: `coords` is set from `getBoundingClientRect()` at runtime — pixel-exact positioning can't be a Tailwind class.

3. **`ChurnLegend.tsx`** — data-driven swatch background:
   ```tsx
   <span className="w-2 h-2 rounded-[1px] inline-block" style={{ background: categoryColor(severityForChurn(category), 0.85) }} />
   ```
   Why: `categoryColor()` returns a runtime-computed RGBA string with a per-category alpha value — not a fixed Tailwind class.

4. **`MetricsStrip.tsx`** — data-driven big-number color:
   ```tsx
   <div className="text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
   ```
   Why: `m.color` comes from `Metric.color: string` in the preset data layer (`apps/web/src/presets/`). Migrating `Metric.color` to a Tailwind className requires touching every preset file — out of PR2 scope (separate cleanup).

That's 4 documented `style={{}}` survivors across all of PR2. Every other style block migrates to Tailwind.

---

## Pattern reminders (from PR1 review)

1. **Use `cn()` only when there is a dynamic/runtime class.** Static-only class lists are plain string `className="..."`. Wrapping a static list in `cn()` is overhead and misleads readers into hunting for the dynamic part.
2. **Preserve any className that `index.css` targets by name.** PR2's 12 files don't have such selectors, but always grep `apps/web/src/index.css` before deleting any className from a component you're migrating. (PR2 verification: no `narrative-kpi-*` style selectors apply to PR2 files.)
3. **Non-4px pixel values use arbitrary syntax** — `text-[9px]`, `text-[10px]`, `min-w-[120px]`, `tracking-[1px]`, `rounded-[3px]`, etc. Do not round to the nearest scale step.
4. **`background: 'none'` and `bg-transparent`** are equivalent for the buttons in PR2 (both produce `background-color: transparent` at runtime — `none` is shorthand that resets `background-color` to its initial value, which is `transparent`). Use `bg-transparent` consistently.
5. **`severityText` and `badgeClasses` are typed `Record<BadgeVariant, string>`** — direct lookup, no template strings, no fallbacks. The TypeScript exhaustiveness check guarantees every variant is covered.
6. **Run tests if a `*.test.tsx` exists for the file.** Files with tests in PR2 scope: `Tooltip.test.tsx`, `HeroCaption.test.tsx`, `ChurnLegend.test.tsx`, `SortableTable.test.tsx`, `Shell.test.tsx`. Visual / class-presence assertions may need updating; behavior assertions should keep passing untouched. Files without tests: Badge, Sidebar, TopBar, BottomPanel, MetricsStrip, InspectorPanel, LayoutControls — PR2 does NOT add new tests (out of scope; tests come with new behavior).
7. **Never silently delete a prop from an exported component.** Tooltip's `wrapperStyle` survives because 5 tab files consume it. Same caution for any other public API.

---

## Task 1: Cleanup + 5 simple shared/layout files

**Goal:** Eliminate the 2 pre-existing lint warnings in `cn.test.ts`, then migrate the 5 smallest files (Tooltip, HeroCaption, ChurnLegend, LayoutControls, MetricsStrip). One commit per file (6 commits total). All translations follow the cookbook above.

**Files:**
- Modify: `apps/web/src/utils/cn.test.ts`
- Modify: `apps/web/src/components/shared/Tooltip.tsx`
- Modify: `apps/web/src/components/shared/HeroCaption.tsx`
- Modify: `apps/web/src/components/shared/ChurnLegend.tsx`
- Modify: `apps/web/src/components/layout/LayoutControls.tsx`
- Modify: `apps/web/src/components/layout/MetricsStrip.tsx`

- [ ] **Step 1: Fix `cn.test.ts` lint warnings**

In `apps/web/src/utils/cn.test.ts`, the `'handles conditional values via clsx semantics'` test currently has:
```ts
expect(cn('flex', false && 'hidden', 'gap-2')).toBe('flex gap-2');
expect(cn('flex', true && 'gap-2')).toBe('flex gap-2');
```

The literal `false &&` and `true &&` trigger `no-constant-binary-expression`. Refactor to use named variables (which mirror real-world clsx usage anyway):
```ts
const showHidden = false;
const showGap = true;
expect(cn('flex', showHidden && 'hidden', 'gap-2')).toBe('flex gap-2');
expect(cn('flex', showGap && 'gap-2')).toBe('flex gap-2');
expect(cn('flex', null, undefined, 'gap-2')).toBe('flex gap-2');
```

Run `pnpm --filter @gitrelic/web test cn.test.ts` — expected: 4/4 pass. Then `pnpm lint apps/web/src/utils/cn.test.ts` — expected: 0 warnings.

Commit:
```bash
git add apps/web/src/utils/cn.test.ts
git commit -m "test(web): extract conditional values to named vars in cn.test.ts (RELIC-336)"
```

- [ ] **Step 2: Migrate `Tooltip.tsx`**

Read `apps/web/src/components/shared/Tooltip.tsx`. Then translate:

The wrapper div currently has `style={{ display: 'inline-block', cursor: 'help', ...wrapperStyle }}`. Split into className for the static parts and `style={wrapperStyle}` for the prop forwarding (carve-out #1):
```tsx
<div ref={wrapRef} onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)} className="inline-block cursor-help" style={wrapperStyle}>
```

The tooltip popup div (`tooltipStyle: CSSProperties`) — split static-vs-dynamic. Static parts go to className, dynamic positioning stays in `style` (carve-out #2):
```tsx
{visible && (
  <div
    className="fixed bg-tooltip-bg text-tooltip-text px-2 py-1 rounded text-[10px] whitespace-nowrap pointer-events-none z-[1000] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
    style={{
      left: coords.x,
      top: position === 'top' ? coords.y - 8 : coords.y + 8,
      transform: position === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
    }}
  >
    {content}
  </div>
)}
```

Remove `import type { CSSProperties }` from the React imports? **No — keep it.** The `wrapperStyle?: CSSProperties` prop type still uses `CSSProperties`. Verify the import is still needed.

Delete the `tooltipStyle: CSSProperties` constant (its content is now inline at the JSX site).

Run `pnpm --filter @gitrelic/web test Tooltip.test.tsx` — expected: all tests pass (Tooltip's tests verify behavior — show/hide on hover, content rendering, wrapperStyle merge behavior. The wrapperStyle test should still pass because `style={wrapperStyle}` forwarding is preserved).

Run `pnpm lint apps/web/src/components/shared/Tooltip.tsx` — expected: 0 errors, 0 warnings.

Commit:
```bash
git add apps/web/src/components/shared/Tooltip.tsx
git commit -m "refactor(web): migrate Tooltip to Tailwind (RELIC-336)"
```

- [ ] **Step 3: Migrate `HeroCaption.tsx`**

Read `apps/web/src/components/shared/HeroCaption.tsx` (3 style blocks, all static).

Outer wrapper:
```tsx
<div className="shrink-0 px-4 py-2.5 border-t border-border-primary bg-surface-primary">
```
(Note: `padding: '10px 16px'` → `px-4 py-2.5`. `10px` is `2.5` on the 4px scale.)

Primary line: `className="text-xs text-text-secondary"` (`fontSize: 12` → `text-xs`).

Subtitle: `className="text-[11px] text-text-tertiary mt-[3px]"` (off-scale font and margin).

Run `pnpm --filter @gitrelic/web test HeroCaption.test.tsx` — expected: pass.

Commit:
```bash
git add apps/web/src/components/shared/HeroCaption.tsx
git commit -m "refactor(web): migrate HeroCaption to Tailwind (RELIC-336)"
```

- [ ] **Step 4: Migrate `ChurnLegend.tsx`**

Read `apps/web/src/components/shared/ChurnLegend.tsx` (4 style blocks; 1 carve-out for swatch `background`).

Swatch outer span: `className="inline-flex items-center gap-1"` (`gap: 4` → `gap-1`).

Swatch color block — keep `style={{ background: categoryColor(...) }}` (carve-out #3) but migrate the rest to className:
```tsx
<span
  className="w-2 h-2 rounded-[1px] inline-block"
  style={{ background: categoryColor(severityForChurn(category), 0.85) }}
/>
```

Range label: `className="text-text-tertiary"`.

Outer legend container:
```tsx
<div role="group" aria-label="Churn category legend" className="flex gap-3.5 text-[9px] text-text-secondary px-4 py-1">
```
(`gap: 14` → `gap-3.5`, `padding: '4px 16px'` → `px-4 py-1`.)

Run `pnpm --filter @gitrelic/web test ChurnLegend.test.tsx` — expected: pass.

Commit:
```bash
git add apps/web/src/components/shared/ChurnLegend.tsx
git commit -m "refactor(web): migrate ChurnLegend to Tailwind (RELIC-336)"
```

- [ ] **Step 5: Migrate `LayoutControls.tsx`**

Read `apps/web/src/components/layout/LayoutControls.tsx` (2 inline + 1 dynamic function).

Outer container: `className="flex items-center gap-2"` (`gap: 8` → `gap-2`).

The `iconButtonStyle(active: boolean)` function — refactor to `iconButtonClass(active: boolean): string`:
```tsx
function iconButtonClass(active: boolean): string {
  return cn(
    'px-2 py-1 text-sm leading-none border border-border-primary rounded text-text-secondary cursor-pointer',
    active ? 'bg-surface-elevated' : 'bg-transparent',
  );
}
```
Then update each button: `style={iconButtonStyle(...)}` → `className={iconButtonClass(...)}`. (`padding: '4px 8px'` → `px-2 py-1`. `fontSize: 14` → `text-sm`. `lineHeight: 1` → `leading-none`. `borderRadius: 4` → `rounded`.)

Add import: `import { cn } from '../../utils/cn';`.

The `<select>` element's style block:
```tsx
<select
  aria-label="Layout mode"
  value={mode}
  onChange={(e) => onModeChange(e.target.value as LayoutMode)}
  className="text-[11px] px-1.5 py-0.5 bg-surface-tertiary text-text-primary border border-border-primary rounded"
>
```
(`fontSize: 11` off-scale, `padding: '2px 6px'` → `px-1.5 py-0.5`, `borderRadius: 4` → `rounded`.)

Remove the unused `React.CSSProperties` reference (the `iconButtonStyle` function was the only consumer).

No tests to run for LayoutControls (no test file). Run lint instead: `pnpm lint apps/web/src/components/layout/LayoutControls.tsx`.

Commit:
```bash
git add apps/web/src/components/layout/LayoutControls.tsx
git commit -m "refactor(web): migrate LayoutControls to Tailwind via cn() (RELIC-336)"
```

- [ ] **Step 6: Migrate `MetricsStrip.tsx`**

Read `apps/web/src/components/layout/MetricsStrip.tsx` (4 inline + 1 data-driven `m.color` carve-out).

Outer container:
```tsx
<div className="flex gap-px bg-border-primary border-b border-border-primary shrink-0">
```
(`gap: 1` → `gap-px` — Tailwind v4 supports `gap-px` for 1px gap.)

Each metric cell: `className="flex-1 px-4 py-3 bg-surface-primary text-center"` (`padding: '12px 16px'` → `px-4 py-3`).

Big number — carve-out #4 (data-driven color):
```tsx
<div className="text-xl font-bold" style={{ color: m.color }}>{m.value}</div>
```
(`fontSize: 20` → `text-xl`, `fontWeight: 700` → `font-bold`. `color: m.color` survives.)

Label:
```tsx
<div className="text-[9px] uppercase tracking-[1px] text-text-tertiary mt-0.5">{m.label}</div>
```
(`marginTop: 2` → `mt-0.5`.)

No tests to run for MetricsStrip. Lint check.

Commit:
```bash
git add apps/web/src/components/layout/MetricsStrip.tsx
git commit -m "refactor(web): migrate MetricsStrip to Tailwind (RELIC-336)"
```

- [ ] **Step 7: Run the full test suite + lint**

```bash
pnpm --filter @gitrelic/web test
pnpm lint
```
Expected: all tests pass (no behavior changed). Lint should show 0 new warnings (the cn.test.ts cleanup removed 2 pre-existing warnings; PR2 should not introduce any).

- [ ] **Step 8: Self-review**

For each migrated file, grep `style={{` to verify only the documented carve-outs remain:
```bash
grep -n "style={{" apps/web/src/components/shared/Tooltip.tsx apps/web/src/components/shared/HeroCaption.tsx apps/web/src/components/shared/ChurnLegend.tsx apps/web/src/components/layout/LayoutControls.tsx apps/web/src/components/layout/MetricsStrip.tsx
```
Expected output:
- `Tooltip.tsx`: 1 line — the dynamic positioning `style={{ left: coords.x, top: ..., transform: ... }}`. (The `style={wrapperStyle}` line is `style={...}` not `style={{...}}` — won't match this grep.)
- `HeroCaption.tsx`: 0 lines.
- `ChurnLegend.tsx`: 1 line — the swatch `style={{ background: categoryColor(...) }}`.
- `LayoutControls.tsx`: 0 lines.
- `MetricsStrip.tsx`: 1 line — the big-number `style={{ color: m.color }}`.

Total: 3 carve-outs across these 5 files. Plus the `style={wrapperStyle}` in Tooltip — confirm via separate grep `grep "style=" apps/web/src/components/shared/Tooltip.tsx`.

---

## Task 2: Migrate Badge.tsx + delete badgeStyles

**Goal:** Migrate `Badge.tsx` to consume `badgeClasses` from `classMaps.ts` instead of `badgeStyles` from `theme.ts`. Then delete `badgeStyles` (and its commented imports if any) from `theme.ts`.

**Files:**
- Modify: `apps/web/src/components/shared/Badge.tsx`
- Modify: `apps/web/src/components/theme.ts` (delete lines 13–24, the `badgeStyles` constant)

- [ ] **Step 1: Verify nothing else imports `badgeStyles`**

```bash
grep -rn "badgeStyles" apps/web/src/
```
Expected: only `Badge.tsx` (consumer) and `theme.ts` (definition) match. If anything else does, **STOP and report** — that consumer needs migration first.

- [ ] **Step 2: Migrate `Badge.tsx`**

Current implementation (49 lines): two style blocks. The badge `<span>` uses `badgeStyles[variant]` for `background`/`color` and inline values for the rest. The Tooltip content `<div>` for the multi-name case has a flex layout style.

Translate badge `<span>`:
```tsx
import type { ReactNode } from 'react';

import { type BadgeVariant } from '../theme';
import { Tooltip } from './Tooltip';

import { cn } from '../../utils/cn';
import { badgeClasses } from '../../utils/classMaps';

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  title?: string;
}

export default function Badge({ variant, children, title }: BadgeProps) {
  const classes = badgeClasses[variant] ?? badgeClasses.stale;
  const badge = (
    <span
      className={cn(
        'inline-block text-[10px] px-[7px] py-[2px] rounded-[3px] font-medium tracking-[0.02em] whitespace-normal break-words',
        classes,
      )}
    >
      {children}
    </span>
  );

  if (!title) return badge;

  const names = title.split(', ');
  return (
    <Tooltip
      content={
        <div className="flex flex-col gap-0.5">
          {names.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      }
    >
      {badge}
    </Tooltip>
  );
}
```

Notes:
- `padding: '2px 7px'` is mixed-scale (2 is `0.5`, but 7 is off-scale). Use arbitrary `px-[7px] py-[2px]` for pixel-exact.
- `borderRadius: 3` → `rounded-[3px]`.
- `fontWeight: 500` → `font-medium`.
- `letterSpacing: '0.02em'` → `tracking-[0.02em]`.
- Tooltip content `gap: 2` → `gap-0.5`.
- The fallback `?? badgeClasses.stale` mirrors the original `?? badgeStyles.stale` defensive default.

- [ ] **Step 3: Delete `badgeStyles` from `theme.ts`**

In `apps/web/src/components/theme.ts`, delete lines 13–24 (the `badgeStyles` constant). Result: file shrinks from 94 to ~80 lines. Keep everything else intact.

- [ ] **Step 4: Run tests + lint**

```bash
pnpm --filter @gitrelic/web test
pnpm lint
```
Expected: all tests pass. Badge has no test file but its rendering is exercised indirectly through `NarrativeKPI.test.tsx` and any tab tests that mount tabs containing Badge usage.

- [ ] **Step 5: Self-review**

```bash
grep -rn "badgeStyles" apps/web/src/
```
Expected: 0 matches (the constant is gone, nothing imports it anymore).

```bash
grep -n "style={{" apps/web/src/components/shared/Badge.tsx
```
Expected: 0 matches.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/shared/Badge.tsx apps/web/src/components/theme.ts
git commit -m "refactor(web): migrate Badge to badgeClasses + delete badgeStyles (RELIC-336)"
```

---

## Task 3: Migrate SortableTable.tsx

**Goal:** Migrate `apps/web/src/components/shared/SortableTable.tsx` (175 lines, 6 styles). Has tests at `SortableTable.test.tsx`.

**Files:**
- Modify: `apps/web/src/components/shared/SortableTable.tsx`

- [ ] **Step 1: Read the file**

Read `apps/web/src/components/shared/SortableTable.tsx` end-to-end. Identify the 6 style blocks. Pay attention to:
- The header cell with sort-direction indicator (likely conditional active state).
- Any row-hover or selected-state classNames.
- Whether sort indicators are styled differently when active vs. inactive.

- [ ] **Step 2: Translate each style block**

Apply the cookbook. For conditional/state-driven styles (e.g., active sort column), use `cn()` with conditional classes. Add `import { cn } from '../../utils/cn';` if needed.

- [ ] **Step 3: Run tests + lint**

```bash
pnpm --filter @gitrelic/web test SortableTable.test.tsx
pnpm lint apps/web/src/components/shared/SortableTable.tsx
```
Expected: all tests pass; lint clean. SortableTable's tests likely assert on column headers, row counts, sort behavior — class assertions may need updates if any test checks specific style-derived behavior. Behavior-focused tests should pass untouched.

- [ ] **Step 4: Self-review**

```bash
grep -n "style={{" apps/web/src/components/shared/SortableTable.tsx
```
Expected: 0 matches (no documented carve-outs in this file).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shared/SortableTable.tsx
git commit -m "refactor(web): migrate SortableTable to Tailwind (RELIC-336)"
```

---

## Task 4: Migrate TopBar.tsx

**Goal:** Migrate `apps/web/src/components/layout/TopBar.tsx` (77 lines, 9 styles). No test file.

**Files:**
- Modify: `apps/web/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Read the file end-to-end.**

- [ ] **Step 2: Translate every style block to Tailwind via the cookbook.**

If any styles are state-driven (theme toggle, active-tab indicator), use `cn()` with conditional classes.

- [ ] **Step 3: Run lint + full web test suite (since no per-file test exists, the safety check is the broader suite).**

```bash
pnpm lint apps/web/src/components/layout/TopBar.tsx
pnpm --filter @gitrelic/web test
```
Expected: lint clean, no broader test breaks.

- [ ] **Step 4: Self-review.**

```bash
grep -n "style={{" apps/web/src/components/layout/TopBar.tsx
```
Expected: 0 matches.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/components/layout/TopBar.tsx
git commit -m "refactor(web): migrate TopBar to Tailwind (RELIC-336)"
```

---

## Task 5: Migrate Sidebar.tsx

**Goal:** Migrate `apps/web/src/components/layout/Sidebar.tsx` (229 lines, 6 styles). No test file. Likely contains nav-item active state, badge integration, and section grouping.

**Files:**
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Read the file end-to-end.**

Pay attention to active-tab indicator styling (likely uses `--nav-item-active-bg`) and any badge counts (likely `--nav-badge-critical` or `--nav-badge-warning`).

- [ ] **Step 2: Translate every style block.**

Use `cn()` for active/hover state. Active nav item background is `bg-nav-item-active-bg` (the @theme bridge added this token in PR1's Task 4). Critical/warning badge backgrounds use `bg-nav-badge-critical` / `bg-nav-badge-warning`.

- [ ] **Step 3: Lint + full suite.**

```bash
pnpm lint apps/web/src/components/layout/Sidebar.tsx
pnpm --filter @gitrelic/web test
```

- [ ] **Step 4: Self-review.**

```bash
grep -n "style={{" apps/web/src/components/layout/Sidebar.tsx
```
Expected: 0 matches.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/components/layout/Sidebar.tsx
git commit -m "refactor(web): migrate Sidebar to Tailwind (RELIC-336)"
```

---

## Task 6: Migrate BottomPanel.tsx

**Goal:** Migrate `apps/web/src/components/layout/BottomPanel.tsx` (258 lines, 5 styles). No test file. Routes the active tab mode to one of 22 tab components.

**Files:**
- Modify: `apps/web/src/components/layout/BottomPanel.tsx`

- [ ] **Step 1: Read the file end-to-end.**

The 5 styles are likely structural (tab container, tab buttons, content wrapper, sticky elements). The 22 tab routing case statement does NOT need migration — it's already JSX returns of components, no styles.

- [ ] **Step 2: Translate styles.**

If there's a tab-button-active state, use `cn()`.

- [ ] **Step 3: Lint + full suite.**

- [ ] **Step 4: Self-review.**

```bash
grep -n "style={{" apps/web/src/components/layout/BottomPanel.tsx
```
Expected: 0 matches.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/components/layout/BottomPanel.tsx
git commit -m "refactor(web): migrate BottomPanel to Tailwind (RELIC-336)"
```

---

## Task 7: Migrate InspectorPanel.tsx

**Goal:** Migrate `apps/web/src/components/layout/InspectorPanel.tsx` (182 lines, 9 styles). No test file. Drill-down panel for selected file/contributor/activity.

**Files:**
- Modify: `apps/web/src/components/layout/InspectorPanel.tsx`

- [ ] **Step 1: Read the file end-to-end.**

The 9 styles likely cover: outer panel, header, close button, content wrapper, section dividers, empty state. Inspector also handles the resize handle on its left edge — that's likely `cursor: col-resize`.

- [ ] **Step 2: Translate every block.**

Resize handle: `className="cursor-col-resize"` plus background using `bg-panel-resize-handle` (PR1's @theme bridge added this token). Hover state via `hover:bg-panel-resize-handle-hover`.

- [ ] **Step 3: Lint + full suite.**

- [ ] **Step 4: Self-review.**

```bash
grep -n "style={{" apps/web/src/components/layout/InspectorPanel.tsx
```
Expected: 0 matches.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/components/layout/InspectorPanel.tsx
git commit -m "refactor(web): migrate InspectorPanel to Tailwind (RELIC-336)"
```

---

## Task 8: Migrate Shell.tsx

**Goal:** Migrate `apps/web/src/components/layout/Shell.tsx` (478 lines, 9 styles). The big one — composes Sidebar, TopBar, MetricsStrip, BottomPanel, InspectorPanel into the application layout. Has tests at `Shell.test.tsx`. Handles theme switching, resizable panel widths, and keyboard shortcuts (⌘., ⌘⇧., ⌘⇧,).

**Files:**
- Modify: `apps/web/src/components/layout/Shell.tsx`

- [ ] **Step 1: Read the file end-to-end.**

The 9 styles likely cover: app root grid/flex, panel separator/resize handle, layout-mode-driven width adjustments. Pay particular attention to:
- Theme switching: any `style` setting `data-theme` or background should stay (it's runtime state).
- Resizable panels: width values stored in state and applied via `style={{ width: sidebarWidth }}`. **This is a documented carve-out** — store widths in state, apply via inline style. Add to the carve-out list at the top of this plan.
- Layout mode (default / focus-canvas / fullscreen-hero / fullscreen-table / canvas-minimal): conditional className composition via `cn()` with `mode === '...'` checks.

- [ ] **Step 2: Document any new carve-outs.**

If you encounter a style block that legitimately can't be Tailwindified (resize handle widths, dynamic measurement-based positioning), call it out in the commit message and update this plan's "Documented carve-outs" section to add it.

- [ ] **Step 3: Translate every other block.**

Use `cn()` for layout-mode conditional classes — likely 5 mutually exclusive branches based on the active mode.

- [ ] **Step 4: Run tests + lint.**

```bash
pnpm --filter @gitrelic/web test Shell.test.tsx
pnpm lint apps/web/src/components/layout/Shell.tsx
pnpm --filter @gitrelic/web test
```
Expected: Shell.test.tsx passes (~6KB of tests — likely covers panel layout, theme switching, keyboard shortcuts). The full suite confirms nothing downstream broke.

- [ ] **Step 5: Self-review.**

```bash
grep -n "style={{" apps/web/src/components/layout/Shell.tsx
```
Expected: only documented carve-outs (likely the resize-handle width). Each survivor should have an obvious data-driven justification.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/src/components/layout/Shell.tsx
git commit -m "refactor(web): migrate Shell to Tailwind (RELIC-336)"
```

---

## Final verification (after Task 8)

Run from repo root:
```bash
pnpm test
pnpm lint
pnpm format:check
pnpm build
```

Expected:
- All tests pass (~812 / 812 like PR1, possibly slightly different if anything was added).
- 0 lint errors. Warnings should be ≤9 (only the pre-existing `no-explicit-any` warnings in 3 D3 hero files — `AuthorForceGraph.tsx`, `CouplingForceGraph.tsx`, `OwnershipBubble.tsx`. The 2 `no-constant-binary-expression` warnings from PR1 are gone after Task 1 step 1).
- Format check clean.
- Build succeeds for core, web, cli.

Then run the dashboard for visual QA:
```bash
node apps/cli/dist/index.mjs --path ~/path/to/some-repo --web
```

Click through the entire dashboard and visually compare against your baseline screenshots. Specifically verify:
- **Sidebar** — nav items, active-tab indicator, badge counts (critical/warning).
- **TopBar** — controls, layout mode dropdown.
- **MetricsStrip** — big-number colors (these come from `m.color` data, should be unchanged).
- **BottomPanel** — tab routing works for all 22 tabs (heros and tabs aren't migrated yet, but they should still render with their pre-existing inline styles).
- **InspectorPanel** — opens on row click, content displays, resize handle works.
- **Shell** — all 5 layout modes (default / focus-canvas / fullscreen-hero / fullscreen-table / canvas-minimal) toggle correctly. Theme switcher (DevTools `document.documentElement.dataset.theme = 'light'`) flips colors correctly. Resizable panels still resize.
- **Tooltips** — hover any tooltip-enabled element (Cursed Files reasons, badge titles, etc.) and verify tooltip appears at the right position with correct colors.
- **Badges** — every variant renders with correct colors. (Critical/warning/moderate/healthy/ownership/coupling/temporal/shame/parallel/stale — most appear in different tabs.)
- **HeroCaption** — present below every hero (currently rendered by every tab that uses HeroCaption).
- **ChurnLegend** — appears in Churn tab.
- **SortableTable** — sort indicators, hover states, row rendering.

---

## Self-Review (plan author)

Spec coverage:
- ✅ All 5 shared/ files (Tooltip, HeroCaption, ChurnLegend, SortableTable, Badge — NarrativeKPI done in PR1).
- ✅ All 7 layout/ files (Shell, Sidebar, TopBar, BottomPanel, MetricsStrip, InspectorPanel, LayoutControls).
- ✅ `badgeStyles` deletion from `theme.ts`.
- ✅ `cn.test.ts` lint cleanup.
- ⚠️ NOT in this plan: `react/forbid-dom-props` lint rule (PR4), root CLAUDE.md update (PR4), hero/inspector/tab migrations (PR3/PR4), `hotspotColor()` audit (deferred to PR3 when consumers are migrated).
- ⚠️ NOT addressed: migrating `Metric.color` from CSS string to Tailwind class. Documented as a future cleanup; PR2 keeps the carve-out for `style={{ color: m.color }}`.

Placeholder scan: None. Every step has the specific code, command, or expected output it needs. The cookbook covers all observed patterns; per-file tasks reference it rather than duplicate translations.

Type consistency: `BadgeVariant` import path consistent (`'../theme'` from `Badge.tsx`, `'../components/theme'` from `classMaps.ts`). `cn` import path consistent (`'../../utils/cn'` from both shared/ and layout/ — same depth). `badgeClasses` and `severityText` import path consistent (`'../../utils/classMaps'`).

Carve-out count: 4 documented (Tooltip wrapperStyle forwarding, Tooltip dynamic positioning, ChurnLegend swatch background, MetricsStrip big-number color). Plus possibly 1 in Shell (resize-handle width — discovered during migration). Total ≤5 surviving `style` sites in PR2's 12 files. PR4's lint rule will need per-line disables for each.

---

## What's next after this PR merges

PR3 picks up inspectors (FileInspector, ContributorsInspector, ActivityInspector, GuidePanel) and 22 hero components. Hero migration is mostly thin wrapper divs around D3-rendered SVG (D3 sets attrs/styles on SVG nodes directly — Tailwind doesn't apply there). Also: `hotspotColor()` audit (it's deprecated; replace React `style` consumers with `severityText` lookups, leave D3 `.attr('fill', ...)` consumers alone).

PR4 migrates 22 tab components, adds the `react/forbid-dom-props` lint rule scoped to `apps/web/**`, adds per-line disable comments to the documented `style={{}}` carve-outs (≤10 total across the migration), and writes the "Web Styling" section in root `CLAUDE.md`.
