# apps/web — classic dashboard

The React + D3 dashboard that Atlas (`apps/atlas`) is replacing. It's still served under `/classic/` (and by `--ui classic`), and Atlas links lenses it has no view for to `/classic/#preset=<id>`. Everything here applies to this app only: don't carry `cn()`, `classMaps.ts` or `style={{}}` carve-outs into Atlas.

**Polish tickets are frozen.** Classic hero/bottom-panel polish (`Polish: <analyzer>` issues) is on hold while Atlas is built; don't start one without the maintainer confirming. `docs/polish-pattern.md` is now input to each Atlas view's design checkpoint (what an analyzer must communicate), not a spec for new React work.

## Files

- `src/App.tsx` — loads `/gitrelic-report.json`, normalizes missing fields via `normalizeReport` (from `@gitrelic/scene`), then renders `Shell`
- `src/components/layout/Shell.tsx` — top-level layout (sidebar + top bar + main pane + bottom panel + inspector)
- `src/components/layout/Sidebar.tsx` — left nav, switches between overview and tab modes
- `src/components/layout/BottomPanel.tsx` — routes to the 22 tab components under `components/tabs/`
- `src/components/layout/InspectorPanel.tsx` — drill-down panel for the selected file/contributor/activity
- `src/components/hero/` — D3 visualizations (commit graph, swimlanes, treemaps, force graphs, etc.). Biggest XSS surface — must only use `.text()`, never `.html()`
- `src/components/tabs/` — 22 deep-dive tabs, one per analyzer
- Critical rule: only `import type` from `@gitrelic/core` (see the root `CLAUDE.md`, Browser code imports).
- **Styling:** Tailwind v4 only — see Styling below.

## Styling

`apps/web` uses Tailwind v4 for all styling. Inline `style={{}}` on JSX is reserved for runtime/data-driven values only — static styling lives in className via Tailwind utilities.

### Composition primitives

- `cn()` from `apps/web/src/utils/cn.ts` (clsx + tailwind-merge) — use only for runtime conditionals or spread-merges. **Bare ternary** for single conditionals (`className={cond ? 'a' : 'b'}`, NOT `cn(cond ? 'a' : 'b')`). Even with shared base classes, prefer the bare-ternary form (`className={cond ? 'base a' : 'base b'}`) over `cn('base', cond ? 'a' : 'b')` — established precedent through PR3c heroes and PR4 tabs.
- `classMaps.ts` from `apps/web/src/utils/classMaps.ts` — typed tier→class lookups for severity/accent/domain colors. Don't compose color classes by template-stringing tier names (`text-severity-${tier}`) — bypasses the type system, grep-hostile.

```tsx
import { cn } from '../../utils/cn';
import { severityText } from '../../utils/classMaps';

<div className={cn('flex gap-2', isActive && 'border-border-focus')} />
<span className={severityText[variant]}>...</span>
```

### Theme bridge

CSS variables in `apps/web/src/index.css` are the source of truth for colors and other theme values. A `@theme` block aliases them to Tailwind tokens (`bg-surface-primary`, `text-severity-critical`, `bg-tooltip-bg`, etc.). Light/dark is designed to switch via `[data-theme='light']` on `<html>`, but the toggle is currently disabled in `TopBar.tsx` pending full hero/graph coverage — dark is the active default. **Don't introduce `dark:` variants** — they fight the existing system. **Don't migrate `index.css` to Tailwind primitives** (`@apply`, `@layer components`) — the CSS variable token system is good as CSS.

Available token domains:
- `bg-surface-*` / `border-border-*` / `text-text-*` (UI chrome)
- `bg-severity-{critical,warning,moderate,healthy}-{bg,text}` + `text-severity-{critical,warning,moderate,healthy}` foreground only
- `stale` is a `BadgeVariant` but resolves to `bg-surface-tertiary text-text-tertiary` via `classMaps.ts` (no dedicated severity token)
- `bg-accent-{ownership,coupling,temporal}-{bg,text}` + `text-accent-{ownership,coupling,temporal}` foreground only
- `bg-accent-primary` / `text-accent-primary` (bare — no `-bg`/`-text` variants)
- `bg-tooltip-bg` / `text-tooltip-text` (tooltip-specific token pair — distinct from `bg-surface-elevated` which is for general elevated surfaces)

### Cookbook rules

These rules were established through the RELIC-336 migration (PR1–PR4) and are the result of multiple PR review cycles. Following them up-front avoids fixup commits.

**1. Carve-outs are for runtime values only.** A `style={{}}` block is only justified when the value depends on data, mouse coords, or other per-render state. Static module-level constants (`const ROW_HEIGHT = 40`) are NOT carve-out candidates — they're `className="h-10"` (or `className="h-[Npx]"` if off-scale).

**2. Standard Tailwind scale before arbitrary values.** Spacing/widths half-step scale: 0/0.5/1/1.5/2/2.5/3/3.5/4/5/6/8/10/12 = 0/2/4/6/8/10/12/14/16/20/24/32/40/48 px. So:
- `py-1.5` (6px), NOT `py-[6px]`
- `px-2.5` (10px), NOT `px-[10px]`
- `gap-1.5` (6px), NOT `gap-[6px]`
- `max-w-80` (320px), NOT `max-w-[320px]`

Type sizes don't have half-step scale — `text-[10px]`, `text-[11px]`, `text-[9px]` are correct (they're between standard `text-xs`=12px and below). Genuinely off-scale values (5px, 7px, 11px, 13px, 22px, 50px, 130px, 250px, 300px, 350px) use arbitrary `[Npx]` syntax.

**3. Border radius mapping:** `borderRadius: 4` → `rounded` (4px). `borderRadius: 2` → `rounded-xs` (2px). Don't confuse them.

**4. Tooltip styling:** use `bg-tooltip-bg text-tooltip-text` token pair (NOT `bg-surface-elevated`/`text-text-primary` — those are surface tokens, render slightly different in light/dark themes).

**5. SVG-specific rules:**
- Static `style` props on JSX `<rect>`/`<g>`/`<text>` migrate to `className=` (Tailwind utilities work on inline SVG).
- D3 `.attr('fill', ...)` and `.style('fill', ...)` calls inside `useEffect`/`useMemo` are NOT React style props — leave alone.
- `<g transform={...}>` is a JSX attribute, not a React `style` prop — never migrate.

### When carve-outs are correct

- Tooltip dynamic position (`style={{ left: tooltip.x, top: tooltip.y }}`)
- Data-driven backgrounds (`style={{ background: bubbleColor(author) }}`)
- D3 scale outputs (`style={{ left: xScale(d.date) }}`)
- Untokenizable rgba opacity variants (`style={{ color: 'rgba(248,81,73,0.8)' }}` — when no theme token resolves to that exact value)
- Per-row dynamic positioning computed from index/data (`style={{ top: i * rowHeight }}`)
- Runtime percentage bar widths (`style={{ width: \`${percentage}%\` }}`)

### Patterns and primitives to look at

- `apps/web/src/components/shared/NarrativeKPI.tsx` — canary component, foundation reference
- `apps/web/src/components/shared/Tooltip.tsx` — tooltip primitive with `wrapperClassName` API for layout customization
- `apps/web/src/components/shared/Badge.tsx` — uses `badgeClasses` from `classMaps.ts`
- `apps/web/src/utils/classMaps.ts` — typed tier→class registry

### Don't

- Add `dark:` variants — fight the `[data-theme]` system.
- Migrate `index.css` to `@apply` / `@layer components`.
- Add `class-variance-authority` or similar.
- Compose color classes via template strings (`text-severity-${tier}`).
- Mass-disable lint rules with file-level `/* oxlint-disable */` for migration shortcuts.
