# Tailwind Migration — PR4 (Tabs + Closer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out RELIC-336 by (a) migrating the 23 tab components in `apps/web/src/components/tabs/` from inline `style={{}}` to Tailwind v4 (179 inline styles), (b) sweeping deferred items accumulated through PR3a/PR3b/PR3c (tooltip background-token consistency, leftover arbitrary-value debt, duplicate `.font-mono` CSS, stale JSDoc reference), and (c) adding a "Web Styling" section to root `CLAUDE.md` so the rules established through PR1-PR3c are persistent docs the next contributor can find.

**Why this PR is the closer:** After PR4 merges, every `style={{}}` in `apps/web` is either gone or a documented runtime carve-out, every hero tooltip uses the same `bg-tooltip-bg`/`text-tooltip-text` token pair, every arbitrary Tailwind value is intentionally off-scale, and the rule-set is captured in CLAUDE.md so a fresh Claude session won't reintroduce inline styles. **No `react/forbid-dom-props` lint rule** — that was dropped during PR3b discussion (with ~70+ legitimate carve-outs by end of PR4, per-line disables would be more noise than value; CLAUDE.md docs are the structural prevention).

**Architecture:** Same shape as PR3a/PR3b/PR3c — apply the foundation primitives (`cn`, `classMaps`, `@theme` bridge) to React JSX. Tabs are container components: less D3 than heroes, more React layout (sections, headers, info bars, lists rendered via shared utilities like `SortableTable`). Per-file inline-style counts are lower than heroes on average (1–18, mean ~8), but the file count is higher (23). Most tabs follow a similar shell — section header, hero slot, drill-down list — so the cookbook applies cleanly.

**Tech Stack:** Tailwind v4 with `@theme` bridge, `cn()` (clsx + tailwind-merge), vitest 4 + happy-dom, React 19. Foundation primitives in place from PR1-PR3c.

**Spec:** `docs/superpowers/specs/2026-04-30-tailwind-migration-design.md`
**PR3c plan (most recent precedent — read this for the locked-in cookbook):** `docs/superpowers/plans/2026-05-02-tailwind-migration-pr3c-complex-heroes.md` — its "Cookbook (locked from PR1-PR3b + Task 1/2/3 corrections)" and "Tailwind v4 standard-scale precedent" sections apply verbatim to PR4.

---

## File Map

### Modified — 23 tab files (Tasks 1-3)

**Task 1 — 11 lightest tabs (1-5 styles each, 50 styles total):**
- `apps/web/src/components/tabs/KnowledgeSilosTab.tsx` (1)
- `apps/web/src/components/tabs/AgeMapTab.tsx` (4)
- `apps/web/src/components/tabs/ChurnVelocityTab.tsx` (5)
- `apps/web/src/components/tabs/ComplexityTrendTab.tsx` (4)
- `apps/web/src/components/tabs/CoAuthorsTab.tsx` (4)
- `apps/web/src/components/tabs/ParallelDevTab.tsx` (4)
- `apps/web/src/components/tabs/RenamesTab.tsx` (5)
- `apps/web/src/components/tabs/ChurnTab.tsx` (5)
- `apps/web/src/components/tabs/DebtInventoryTab.tsx` (6)
- `apps/web/src/components/tabs/DeadCodeTab.tsx` (6)
- `apps/web/src/components/tabs/RiskRegisterTab.tsx` (6)

**Task 2 — 7 medium tabs (7-8 styles each, 51 styles total):**
- `apps/web/src/components/tabs/CommitTimingTab.tsx` (7)
- `apps/web/src/components/tabs/CursedFilesTab.tsx` (7)
- `apps/web/src/components/tabs/LanguagesTab.tsx` (7)
- `apps/web/src/components/tabs/TestCoverageTab.tsx` (7)
- `apps/web/src/components/tabs/GhostFilesTab.tsx` (7)
- `apps/web/src/components/tabs/ContributorsTab.tsx` (8)
- `apps/web/src/components/tabs/CouplingTab.tsx` (8)

**Task 3 — 5 heaviest tabs (12-18 styles each, 78 styles total):**
- `apps/web/src/components/tabs/HotspotsTab.tsx` (12)
- `apps/web/src/components/tabs/BlastRadiusTab.tsx` (13)
- `apps/web/src/components/tabs/RewriteRatioTab.tsx` (17)
- `apps/web/src/components/tabs/ShameTab.tsx` (18)
- `apps/web/src/components/tabs/BusFactorTab.tsx` (18)

### Modified — sweep targets (Task 4)

**Tooltip token consistency (28 hero files):** every file in `apps/web/src/components/hero/` that has `bg-surface-elevated text-text-primary` on a tooltip container should switch to `bg-tooltip-bg text-tooltip-text`. The `@theme` bridge (verified in `apps/web/src/index.css` lines 63-64) defines:
- `--color-tooltip-bg: var(--tooltip-bg)` → `#2d333b` dark / `#1f2328` light
- `--color-tooltip-text: var(--tooltip-text)` → `#e6edf3` dark / `#ffffff` light

The `bg-surface-elevated` token resolves to `--surface-elevated` which is a different shade. PR3b heroes inherited the wrong token from earlier inline-style code; PR3c followed the precedent intentionally to avoid mid-migration debt churn. PR4 sweeps all 28 files in one targeted commit. This IS a minor visual change in both themes (tooltip backgrounds shift to the slightly darker, intentionally-distinct tooltip color) — call out in PR description.

**Standard-scale debt sweep (across hero files):** the following arbitrary values should be standard scale:
- `py-[6px]` → `py-1.5` (15 hero files, all tooltip vertical padding)
- `px-[10px]` → `px-2.5` (8 hero files, all tooltip horizontal padding)
- `max-w-[320px]` → `max-w-80` (5 hero files: RenameSankey, TestCoverageByDir, DebtScatter, StalenessScatter, GrowthTimeline)
- `rounded-[2px]` → `rounded-xs` (1 file: CommitHeatmap.tsx:100, on a `<div>` rendered per-cell — `rounded-xs` is 2px so this is exactly equivalent)

The same line in many files combines multiple of these tokens — single global find-and-replace is safe.

**`apps/web/src/index.css` cleanup:**
- Lines 253-256: delete the hand-written `.font-mono { font-family: var(--font-mono); }` block. Tailwind v4 auto-generates `font-mono` from the `--font-mono` `@theme` token (line 70), so the manual class is a duplicate.

**`apps/web/src/utils/classMaps.ts` JSDoc cleanup:**
- Lines 5-7: stale JSDoc references `badgeStyles` which was deleted in PR2. Update to remove the references (or rewrite the comment to describe what `badgeClasses` does today, without mentioning the deleted predecessor).

### Modified — root `CLAUDE.md` (Task 5)

Add a new "Web Styling" section near the existing `apps/web` package breakdown, plus a one-line pointer in the package section ("Styling: Tailwind v4 only — see Web Styling section below"). Content drafted in Task 5 below — captures the cookbook learned through PR1-PR3c.

### Untouched in PR4
- Hero files (already migrated in PR3a/PR3b/PR3c — only their tooltip token gets swept).
- Shared / layout / inspector files (PR2/PR3a — clean).
- `oxlint.config.ts` (no lint rule added — see Why this PR is the closer above).
- `apps/cli`, `apps/docs`, `packages/core` (out of `apps/web` scope).

---

## Tab-specific patterns (PR4 cookbook supplement)

PR3a/PR3b/PR3c covered hero patterns. Tabs have a few unique shapes worth documenting up-front so all 3 tab-task implementers handle them the same way:

### A. Section header / hero slot / list

The canonical tab structure is roughly:
```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
  <div style={{ ...header... }}>...</div>          {/* section header */}
  <div style={{ ...heroFrame... }}>{<HeroComponent />}</div>  {/* hero slot */}
  <div style={{ ...drillDownFrame... }}>...</div>  {/* drill-down list / table */}
</div>
```

These three layout blocks repeat across most tabs. They're all static — migrate to className. The hero component itself is already migrated (PR3a/PR3b/PR3c), so its container only needs styling for sizing/positioning relative to the tab, not internal layout.

### B. Info bar / metrics strip patterns

Some tabs render an info bar with computed values (e.g. "X files · Y commits · Z authors"). Often:
```tsx
<div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-tertiary)' }}>
  <span>...</span>
  <span style={{ opacity: 0.5 }}>·</span>
  <span>...</span>
</div>
```

Static parts → className. The static `opacity: 0.5` divider is also static — migrate. No carve-outs expected here.

### C. Conditional column highlight in tables / lists

Some tabs render rows or columns with state-dependent styling (e.g. "selected row gets accent border"). Use bare ternary on className (single conditional) per the established cookbook, NOT `cn()`:

```tsx
<div className={isSelected ? 'border-l-2 border-border-focus' : 'border-l-2 border-transparent'}>
```

Only use `cn()` when there are multiple runtime conditionals or a className needs to be spread-merged.

### D. Tab "no data" empty states

Heavier than hero empty states — tabs sometimes render a centered placeholder with explanatory text, action button, or icon. Same pattern as hero empty state but more content:
```tsx
<div className="p-8 text-text-tertiary text-center text-xs">
  <p>No coupling data yet. Run the analyzer first.</p>
</div>
```

Static, no `cn()` needed.

### E. Don't reach into hero internals

If a tab passes a `style` to a hero component as a prop (e.g. `<HeroComponent style={...} />`), this is a different surface — the prop's destination is a hero internal. Heroes are already migrated; don't add new style-prop pass-throughs. If the pattern exists, leave it alone for this task and report it as an observation — it's a hero-tab API question, not a migration question.

### F. The `SortableTable` / shared component pattern

Many tabs render rows via the shared `SortableTable` component (already migrated in PR2). When a tab passes per-row className via `getRowClassName` or similar callback, use Tailwind classes via `cn()` if conditional, bare ternary if single-condition.

---

## Cookbook (locked from PR1-PR3c — DO NOT re-litigate)

Same rules as PR3c. Re-stating the most-load-bearing ones because this is the final migration PR:

- `cn()` import path from `tabs/`: `import { cn } from '../../utils/cn';`
- `cn()` only for runtime conditionals or spread-merges. Bare ternary for single conditionals.
- Static SVG `style` props on `<rect>`/`<g>`/`<text>` migrate to `className=` (Tailwind on inline SVG works).
- D3 `.attr()`/`.style()` chains in SVG generation are NOT React style props — never migrate. (Tabs likely don't have these — they're mostly layout, but the rule applies if any tab has inline SVG D3 work.)
- `<g transform={...}>` JSX attribute — never migrate.
- D3 SVG body — DON'T migrate.
- **Static module-level constants ARE Tailwind candidates** — carve-outs are for runtime/data-driven values only. `style={{ width: SOME_CONST }}` where `SOME_CONST = 320` is `className="w-80"`, NOT a carve-out.
- **Standard scale before arbitrary** — type sizes don't have half-step scale, so `text-[10px]` is correct because `text-2.5` doesn't exist for `text-*`. Spacing/widths DO have half-step scale: 0/0.5/1/1.5/2/2.5/3/3.5/4/5/6/8/10/12 = 0/2/4/6/8/10/12/14/16/20/24/32/40/48 px.
- `borderRadius: 4` → `rounded` (4px), NOT `rounded-xs` (2px).
- `borderRadius: 2` → `rounded-xs`.
- `max-w-80` (20rem = 320px) NOT `max-w-[320px]`.
- `px-2.5` (10px) NOT `px-[10px]`.
- `py-1.5` (6px) NOT `py-[6px]`.
- `gap-1.5` (6px) NOT `gap-[6px]`.

**For tooltip styling in NEW tab code (if any tab tooltip is introduced — most tabs don't have tooltips):**
- Use `bg-tooltip-bg text-tooltip-text` (the correct tokens), NOT `bg-surface-elevated text-text-primary`. PR4 sweeps the existing wrong tokens in heroes; new tooltip code in tabs should start with the right ones.

## Tailwind tokens available (from `@theme` bridge)

- Surface: `bg-surface-primary`, `bg-surface-secondary`, `bg-surface-elevated`, `bg-surface-tertiary`
- Border: `border-border-primary`, `border-border-secondary`, `border-border-focus`
- Text: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`
- Severity (paired): `bg-severity-critical-bg text-severity-critical-text` (and warning/moderate/healthy/stale)
- Severity foreground only: `text-severity-critical` (and warning/moderate/healthy)
- Accent (paired): `bg-accent-ownership-bg text-accent-ownership-text` (and coupling/temporal/primary)
- Accent foreground only: `text-accent-ownership` (and coupling/temporal/primary)
- Tooltip: `bg-tooltip-bg text-tooltip-text` (Task 4 sweep)
- Font: `font-mono` (auto-generated by Tailwind from `--font-mono` `@theme` token)

---

## Task 0: Branch setup

**Goal:** Create the PR4 branch off main.

- [ ] **Step 1: Create branch and verify clean state**

```bash
git checkout main
git pull
git checkout -b relic-336-pr4-tabs-and-closer
git status
```

Expected: branch created, working tree clean.

- [ ] **Step 2: Verify starting lint state**

```bash
pnpm lint 2>&1 | tail -3
```

Expected: `Found 0 warnings and 0 errors.` (PR3c milestone preserved). If warnings exist, STOP — something regressed since PR3c merge.

- [ ] **Step 3: Verify starting test state**

```bash
pnpm test 2>&1 | tail -8
```

Expected: 551 web tests + core tests all pass.

- [ ] **Step 4: Snapshot starting inline-style count**

```bash
grep -rn "style={{" apps/web/src/components/tabs/ | wc -l
grep -rn "style={{" apps/web/src/components/hero/ | wc -l
```

Expected: 179 in tabs, 55 in hero. After Task 3, tabs should drop to ~30-50 (carve-outs only). Hero stays at 55 (Task 4 doesn't change hero carve-out count, only token names within static classes).

---

## Task 1: 11 lightest tabs

**Goal:** Migrate the 11 simplest tabs (1-5 styles each). 11 commits — one per file.

**Files (in this order, ascending complexity):**
- `apps/web/src/components/tabs/KnowledgeSilosTab.tsx` (1 style)
- `apps/web/src/components/tabs/AgeMapTab.tsx` (4)
- `apps/web/src/components/tabs/ChurnVelocityTab.tsx` (5)
- `apps/web/src/components/tabs/ComplexityTrendTab.tsx` (4)
- `apps/web/src/components/tabs/CoAuthorsTab.tsx` (4)
- `apps/web/src/components/tabs/ParallelDevTab.tsx` (4)
- `apps/web/src/components/tabs/RenamesTab.tsx` (5)
- `apps/web/src/components/tabs/ChurnTab.tsx` (5)
- `apps/web/src/components/tabs/DebtInventoryTab.tsx` (6)
- `apps/web/src/components/tabs/DeadCodeTab.tsx` (6)
- `apps/web/src/components/tabs/RiskRegisterTab.tsx` (6)

For each file (one commit per file):

- [ ] **Step 1: Read the file end-to-end.**

Identify each `style={{}}` block and classify:
- Static-only → `className` translation
- One conditional → bare ternary on className (NOT `cn()`)
- Multiple conditionals or spread-merge → `cn()`
- Runtime-positioned (rare in tabs — most tabs don't have tooltips) → carve-out
- Data-driven backgrounds (e.g. severity-tier swatches in tab metrics rows) → carve-out

- [ ] **Step 2: Translate** following the cookbook + PR4 tab patterns above.

- [ ] **Step 3: Run tests for this file (if a test file exists):**

```bash
ls apps/web/src/components/tabs/<FileName>.test.tsx 2>/dev/null && \
  pnpm --filter @gitrelic/web test <FileName>.test.tsx
```

Test files exist for: `BlastRadiusTab.test.tsx`, `BusFactorTab.test.tsx`, `ChurnTab.test.tsx`, `KnowledgeSilosTab.test.tsx`, `RewriteRatioTab.test.tsx`, `ShameTab.test.tsx` (verified by grep earlier in PR3c). For tabs without dedicated test files, run the full web suite at the end of the task.

Expected: pass.

- [ ] **Step 4: Self-review.**

```bash
grep -n "style={{" apps/web/src/components/tabs/<FileName>.tsx
```

Each remaining `style={{}}` should be a runtime-computed value. **Specifically check** that any `style={{ width: SOMETHING }}`, `style={{ height: SOMETHING }}`, `style={{ padding: SOMETHING }}` etc. has SOMETHING be runtime-computed, not a static const (this caught Task 3 of PR3c — see PR3c memory).

```bash
grep -n "max-w-\[320px\]\|rounded-\[2px\]\|px-\[10px\]\|py-\[6px\]\|gap-\[6px\]" apps/web/src/components/tabs/<FileName>.tsx
```

Expected: 0 matches.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/src/components/tabs/<FileName>.tsx
git commit -m "refactor(web): migrate <FileName> to Tailwind (RELIC-336)"
```

After all 11 files migrated, run:

```bash
pnpm --filter @gitrelic/web test
pnpm lint 2>&1 | tail -3
```

Expected: 551 web tests pass; lint stays clean (`Found 0 warnings and 0 errors.`).

---

## Task 2: 7 medium tabs

**Goal:** Migrate 7 mid-weight tabs (7-8 styles each). 7 commits — one per file.

**Files (alphabetical):**
- `apps/web/src/components/tabs/CommitTimingTab.tsx` (7)
- `apps/web/src/components/tabs/ContributorsTab.tsx` (8)
- `apps/web/src/components/tabs/CouplingTab.tsx` (8)
- `apps/web/src/components/tabs/CursedFilesTab.tsx` (7)
- `apps/web/src/components/tabs/GhostFilesTab.tsx` (7)
- `apps/web/src/components/tabs/LanguagesTab.tsx` (7)
- `apps/web/src/components/tabs/TestCoverageTab.tsx` (7)

Same per-file shape as Task 1 (read → translate → test → self-review → commit).

After all 7: run full suite + lint:

```bash
pnpm --filter @gitrelic/web test
pnpm lint 2>&1 | tail -3
```

Expected: 551 web tests pass; lint clean.

---

## Task 3: 5 heaviest tabs

**Goal:** Migrate the 5 heaviest tabs (12-18 styles each). 5 commits — one per file.

**Files (in order):**
- `apps/web/src/components/tabs/HotspotsTab.tsx` (12)
- `apps/web/src/components/tabs/BlastRadiusTab.tsx` (13)
- `apps/web/src/components/tabs/RewriteRatioTab.tsx` (17)
- `apps/web/src/components/tabs/ShameTab.tsx` (18)
- `apps/web/src/components/tabs/BusFactorTab.tsx` (18)

Same per-file shape as Tasks 1-2.

The 18-style tabs (ShameTab, BusFactorTab) are the largest single migrations of PR4. Allocate review time accordingly. They have test files (`ShameTab.test.tsx`, `BusFactorTab.test.tsx`) — definitely run those.

After all 5: full verification:

```bash
pnpm --filter @gitrelic/web test
pnpm lint 2>&1 | tail -3
grep -rn "style={{" apps/web/src/components/tabs/ | wc -l
```

Expected: 551 web tests pass; lint clean. Tab `style={{}}` count down from 179 to ~30-50 (the legitimate carve-outs).

---

## Task 4: Sweep deferred items

**Goal:** Resolve all deferred-during-migration items in one focused task. Multiple commits, grouped by concern.

### Step 4.1: Tooltip token consistency sweep (1 commit, 28 files)

Replace `bg-surface-elevated text-text-primary` with `bg-tooltip-bg text-tooltip-text` across all hero tooltip containers. The `@theme` bridge already exposes both token pairs; we're just switching tooltips to the intended pair.

- [ ] **Verify the sweep target** before edits:

```bash
grep -rln "bg-surface-elevated text-text-primary" apps/web/src/components/hero/ | wc -l
```

Expected: ~28 files (the hero tooltips). If far fewer or more, investigate before sweeping.

- [ ] **Apply the sweep.**

For each affected file, find the tooltip container className (it includes `absolute` and `pointer-events-none` and `bg-surface-elevated text-text-primary`) and replace ONLY the two color tokens:
- `bg-surface-elevated` → `bg-tooltip-bg`
- `text-text-primary` → `text-tooltip-text`

**Do NOT change** other uses of `bg-surface-elevated` or `text-text-primary` that are NOT in tooltip contexts (e.g. surface backgrounds, body text in inspector panels). Match by full className context — only switch the tokens when they appear together AND on a tooltip-shaped container.

Suggested tooling: read each of the 28 files, identify the tooltip JSX block by its surrounding structure (`{tooltip && (<div ...>`), and edit precisely. Don't use a global `sed` — false positives possible.

- [ ] **Verify no other surfaces accidentally changed:**

```bash
git diff apps/web/src/components/hero/ | grep "^-.*bg-surface-elevated"
```

Each removed `bg-surface-elevated` should be from a tooltip line (paired with `text-text-primary` and `pointer-events-none` in the same className). If any other context flipped, revert it.

- [ ] **Run tests:**

```bash
pnpm --filter @gitrelic/web test
pnpm lint 2>&1 | tail -3
```

Expected: 551 tests pass; lint clean. Tooltip behavior is unchanged at the React level — only the resolved color shifts.

- [ ] **Commit:**

```bash
git add apps/web/src/components/hero/
git commit -m "refactor(web): standardize hero tooltips on bg-tooltip-bg/text-tooltip-text (RELIC-336)"
```

### Step 4.2: Standard-scale debt sweep (1 commit)

Replace the lingering arbitrary-value debt across hero files:
- `py-[6px]` → `py-1.5` (15 hero files)
- `px-[10px]` → `px-2.5` (8 hero files)
- `max-w-[320px]` → `max-w-80` (5 hero files: RenameSankey, TestCoverageByDir, DebtScatter, StalenessScatter, GrowthTimeline)
- `rounded-[2px]` → `rounded-xs` (1 file: CommitHeatmap.tsx:100)

- [ ] **Verify the sweep target:**

```bash
grep -rln "py-\[6px\]\|px-\[10px\]\|max-w-\[320px\]\|rounded-\[2px\]" apps/web/src/components/hero/
```

Expected: a list of files that's a superset of the four bullets above. The exact count depends on overlap (one file may have multiple of these arbitrary values).

- [ ] **Apply the substitutions.**

Use `Edit` tool with `replace_all: true` per pattern, since these arbitrary values are unambiguous (no false-positive pattern in the codebase — `py-[6px]` is exactly one Tailwind class, not a substring of anything else):

```
py-[6px]      → py-1.5
px-[10px]     → px-2.5
max-w-[320px] → max-w-80
rounded-[2px] → rounded-xs
```

Apply each substitution per-file across all hero files. Some files have multiple of these in the same className string — that's fine, Edit handles them.

- [ ] **Verify no remaining instances:**

```bash
grep -rn "py-\[6px\]\|px-\[10px\]\|max-w-\[320px\]\|rounded-\[2px\]" apps/web/src/components/hero/
```

Expected: 0 matches.

- [ ] **Verify other arbitrary values that ARE genuinely off-scale are unchanged:**

```bash
grep -rn "text-\[10px\]\|text-\[9px\]\|text-\[8px\]\|gap-\[5px\]\|w-\[130px\]\|max-w-\[300px\]" apps/web/src/components/hero/ | wc -l
```

Expected: nonzero (these are genuine off-scale uses preserved through migrations). The point is just to confirm we didn't accidentally rewrite them.

- [ ] **Run tests + lint:**

```bash
pnpm --filter @gitrelic/web test
pnpm lint 2>&1 | tail -3
```

Expected: 551 tests pass; lint clean.

- [ ] **Commit:**

```bash
git add apps/web/src/components/hero/
git commit -m "refactor(web): use standard Tailwind scale across hero arbitrary-value debt (RELIC-336)"
```

### Step 4.3: Remove duplicate `.font-mono` from `index.css` (1 commit)

Tailwind v4 auto-generates `font-mono` from the `--font-mono` `@theme` token (defined at `index.css:70`). The hand-written block at lines 253-256 is a duplicate.

- [ ] **Read the lines to confirm:**

```bash
sed -n '250,260p' apps/web/src/index.css
```

Expected output (approximate):
```
... (other CSS rules)
.font-mono {
  font-family: var(--font-mono);
}
... (other CSS rules)
```

- [ ] **Delete lines 253-256.** Use Edit tool to replace `\n.font-mono {\n  font-family: var(--font-mono);\n}\n` with empty string (preserve surrounding blank lines as appropriate).

- [ ] **Run web build to confirm `font-mono` still works:**

```bash
pnpm --filter @gitrelic/web build
```

Expected: build succeeds. The compiled CSS should still contain the `font-mono` utility (auto-generated by Tailwind from the `@theme` block).

- [ ] **Verify:**

```bash
grep -A 1 "^\.font-mono" apps/web/dist/assets/*.css
```

Expected: Tailwind-generated `.font-mono` rule present, just from a different source.

- [ ] **Run tests:**

```bash
pnpm --filter @gitrelic/web test
```

Expected: 551 pass.

- [ ] **Commit:**

```bash
git add apps/web/src/index.css
git commit -m "refactor(web): remove duplicate .font-mono CSS (Tailwind auto-generates) (RELIC-336)"
```

### Step 4.4: Update stale JSDoc in `classMaps.ts` (1 commit)

The file `apps/web/src/utils/classMaps.ts` has a JSDoc comment (lines 5-7) referencing `badgeStyles`, which was deleted in PR2.

- [ ] **Read the current JSDoc:**

```bash
sed -n '1,15p' apps/web/src/utils/classMaps.ts
```

Expected: a JSDoc-style block at the top of the file with references to `badgeStyles`.

- [ ] **Rewrite the JSDoc** to describe what `badgeClasses` does today, without referencing the deleted predecessor. Suggested replacement (verify against actual current file content first):

```ts
/**
 * Typed Tailwind class lookups for tier-driven styling (severity, accent, domain).
 *
 * Maps `BadgeVariant` → fully-composed Tailwind class strings (bg + text together)
 * for the `badgeClasses` use case, or fg-only strings for `severityText`.
 *
 * Single source of truth: changing a tier's color means editing this file plus
 * the corresponding CSS variable in `index.css`. Class consumers don't compose
 * tier names via template literal (`text-severity-${tier}`) — that bypasses the
 * type system and is grep-hostile.
 */
```

(Adjust to match the actual exports in the file at the time of editing.)

- [ ] **Run tests + lint:**

```bash
pnpm --filter @gitrelic/web test
pnpm lint 2>&1 | tail -3
```

Expected: 551 pass; lint clean.

- [ ] **Commit:**

```bash
git add apps/web/src/utils/classMaps.ts
git commit -m "docs(web): refresh classMaps.ts JSDoc (post-badgeStyles deletion) (RELIC-336)"
```

---

## Task 5: Add "Web Styling" section to root CLAUDE.md

**Goal:** Codify the cookbook learned through PR1-PR3c so the next contributor (human or Claude session) doesn't reintroduce inline styles. 1 commit.

**File:** `/Users/danteel/Desktop/nebulord/gitrelic/CLAUDE.md`

- [ ] **Step 1: Read the current CLAUDE.md** to find the `apps/web` package breakdown section.

```bash
grep -n "apps/web" CLAUDE.md
```

Locate the section that describes `apps/web` (around line 30-40 based on PR3c-era state). The new "Web Styling" section will live AFTER this package breakdown, as a top-level `## Web Styling` heading.

- [ ] **Step 2: Add a one-line pointer in the existing `apps/web` package section.**

Find the `apps/web` description block (it explains `src/App.tsx`, normalizes via `utils/normalizeReport.ts`, etc.). Add at the bottom of the block:

```markdown
- **Styling:** Tailwind v4 only — see [Web Styling](#web-styling) section below.
```

- [ ] **Step 3: Add the "Web Styling" section** at the end of CLAUDE.md (after all existing sections, before the final newline).

Content to add (full text — paste exactly):

```markdown
## Web Styling

`apps/web` uses Tailwind v4 for all styling. Inline `style={{}}` on JSX is reserved for runtime/data-driven values only — static styling lives in className via Tailwind utilities.

### Composition primitives

- `cn()` from `apps/web/src/utils/cn.ts` (clsx + tailwind-merge) — use only for runtime conditionals or spread-merges. **Bare ternary** for single conditionals (`className={cond ? 'a' : 'b'}`, NOT `cn(cond ? 'a' : 'b')`).
- `classMaps.ts` from `apps/web/src/utils/classMaps.ts` — typed tier→class lookups for severity/accent/domain colors. Don't compose color classes by template-stringing tier names (`text-severity-${tier}`) — bypasses the type system, grep-hostile.

```tsx
import { cn } from '../../utils/cn';
import { severityText } from '../../utils/classMaps';

<div className={cn('flex gap-2', isActive && 'border-border-focus')} />
<span className={severityText[variant]}>...</span>
```

### Theme bridge

CSS variables in `apps/web/src/index.css` are the source of truth for colors and other theme values. A `@theme` block aliases them to Tailwind tokens (`bg-surface-primary`, `text-severity-critical`, `bg-tooltip-bg`, etc.). Light/dark switches via the `[data-theme]` attribute on `<html>`. **Don't introduce `dark:` variants** — they fight the existing system. **Don't migrate `index.css` to Tailwind primitives** (`@apply`, `@layer components`) — the CSS variable token system is good as CSS.

Available token domains:
- `bg-surface-*` / `border-border-*` / `text-text-*` (UI chrome)
- `bg-severity-{critical,warning,moderate,healthy,stale}-{bg,text}` + `text-severity-*` foreground only
- `bg-accent-{ownership,coupling,temporal,primary}-{bg,text}` + `text-accent-*` foreground only
- `bg-tooltip-bg` / `text-tooltip-text` (tooltip-specific token pair)

### Cookbook rules

These rules were established through the RELIC-336 migration (PR1-PR4) and are the result of multiple PR review cycles. Following them up-front avoids fixup commits.

**1. Carve-outs are for runtime values only.** A `style={{}}` block is only justified when the value depends on data, mouse coords, or other per-render state. Static module-level constants (`const ROW_HEIGHT = 40`) are NOT carve-out candidates — they're `className="h-10"` (or `className="h-[Npx]"` if off-scale).

**2. Standard Tailwind scale before arbitrary values.** Spacing/widths half-step scale: 0/0.5/1/1.5/2/2.5/3/3.5/4/5/6/8/10/12 = 0/2/4/6/8/10/12/14/16/20/24/32/40/48 px. So:
- `py-1.5` (6px), NOT `py-[6px]`
- `px-2.5` (10px), NOT `px-[10px]`
- `gap-1.5` (6px), NOT `gap-[6px]`
- `max-w-80` (320px), NOT `max-w-[320px]`

Type sizes don't have half-step scale — `text-[10px]`, `text-[11px]`, `text-[9px]` are correct (they're between standard `text-xs`=12px and below). Genuinely off-scale values (5px, 7px, 9px, 11px, 13px, 130px) use arbitrary `[Npx]` syntax.

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

### Patterns and primitives to look at

- `apps/web/src/components/shared/NarrativeKPI.tsx` — canary component, foundation reference
- `apps/web/src/components/shared/Tooltip.tsx` — tooltip primitive with the dynamic-position carve-out pattern
- `apps/web/src/components/shared/Badge.tsx` — uses `badgeClasses` from `classMaps.ts`
- `apps/web/src/utils/classMaps.ts` — typed tier→class registry

### Don't

- Add `dark:` variants — fight the `[data-theme]` system.
- Migrate `index.css` to `@apply` / `@layer components`.
- Add `class-variance-authority` or similar.
- Compose color classes via template strings (`text-severity-${tier}`).
- Mass-disable lint rules with file-level `/* oxlint-disable */` for migration shortcuts.
```

- [ ] **Step 4: Verify the file structure is intact.**

```bash
head -n 5 CLAUDE.md
tail -n 30 CLAUDE.md
```

Expected: file starts with the existing top-of-file content; ends with the new Web Styling section.

- [ ] **Step 5: Run repo-wide checks** (CLAUDE.md change can't break tests, but run anyway as a sanity check):

```bash
pnpm test
pnpm lint
pnpm format:check
```

Expected: all green.

- [ ] **Step 6: Commit.**

```bash
git add CLAUDE.md
git commit -m "docs: add Web Styling section to CLAUDE.md (RELIC-336)"
```

---

## Final verification (after Task 5)

Run from repo root:

```bash
pnpm test
pnpm lint
pnpm format:check
pnpm build
```

Expected:
- All tests pass (551 web + core).
- **Lint: 0 errors, 0 warnings.** Preserve the milestone.
- Format clean.
- Build succeeds.

### Carve-out audit — final state

```bash
echo "Tabs:"
grep -rn "style={{" apps/web/src/components/tabs/ | wc -l
echo "Heroes:"
grep -rn "style={{" apps/web/src/components/hero/ | wc -l
echo "Inspectors:"
grep -rn "style={{" apps/web/src/components/inspector/ | wc -l
echo "Layout:"
grep -rn "style={{" apps/web/src/components/layout/ | wc -l
echo "Shared:"
grep -rn "style={{" apps/web/src/components/shared/ | wc -l
echo "All apps/web:"
grep -rn "style={{" apps/web/src/ | wc -l
```

Expected (approximate):
- Tabs: 30-50 (carve-outs only)
- Heroes: 55 (unchanged from PR3c — Task 4's sweep changed token names, not carve-out count)
- Inspectors: existing carve-out count from PR3a
- Layout: existing carve-out count from PR2
- Shared: existing carve-out count from PR2 (Tooltip dynamic position)
- All apps/web total: ~150-180 final count, all genuinely runtime-driven

Document the actual numbers in the PR description so it's clear what the migration delivered.

### Visual QA

```bash
pnpm build
node apps/cli/dist/index.mjs --path ~/path/to/some-repo --web
```

Click through every tab in both themes (DevTools `document.documentElement.dataset.theme = 'light'`):

- All 23 analyzers' tabs (Churn, Bus Factor, Rewrite Ratio, Hotspots, etc.) — verify section layout, hero rendering, drill-down lists.
- Hover any hero with a tooltip — verify tooltip background uses the correct `--tooltip-bg` color in both themes (slightly darker than `--surface-elevated`).
- Verify `font-mono` still renders code-style text correctly (it should — Tailwind auto-generates the utility from `@theme`).

### PR description checklist (when raising the PR)

- 23 tabs migrated; 179 inline styles processed
- 28 hero tooltips standardized on `bg-tooltip-bg`/`text-tooltip-text`
- ~30 hero arbitrary-value sites moved to standard scale
- Duplicate `.font-mono` CSS removed from `index.css`
- Stale JSDoc in `classMaps.ts` refreshed
- Root `CLAUDE.md` "Web Styling" section added — 5 cookbook rules + carve-out criteria + token domain reference
- Closes RELIC-336 — Tailwind migration complete
- Visual QA: <list of tabs eyeballed in both themes>

---

## Self-Review (plan author)

**Spec coverage:**
- ✅ All 23 tab files (Tasks 1-3)
- ✅ "Web Styling" section in root CLAUDE.md (Task 5)
- ✅ Tooltip token consistency sweep (Task 4 step 4.1) — defers from PR3b/PR3c
- ✅ Standard-scale arbitrary-value debt sweep (Task 4 step 4.2) — defers from PR3b
- ✅ Duplicate `.font-mono` removal (Task 4 step 4.3) — defers from PR3a/PR3b plan checklists
- ✅ Stale `badgeStyles` JSDoc cleanup (Task 4 step 4.4) — defers from PR3a/PR3b plan checklists
- ⚠️ NOT in this plan: `react/forbid-dom-props` lint rule. Decision documented above and in PR3c memory — dropped intentionally.

**Placeholder scan:** None. All commands are concrete. Per-file translations follow the established cookbook. The CLAUDE.md content is verbatim text. Implementer reads each tab to translate.

**Type consistency:** No new types introduced. The existing `cn` import path, classMaps exports, and theme bridge tokens are reused. The CLAUDE.md prose references existing files at established paths.

**Carve-out anticipation:** Tabs are container components — fewer carve-outs per file than heroes. Estimated 30-50 carve-outs across all 23 tabs (vs 55 across 27 heroes after PR3c). Most tabs likely have 0-2 carve-outs each (some tabs have 0 inline styles after migration; KnowledgeSilosTab with 1 style may go to 0).

**Branch and commit hygiene:** ~28-30 commits expected (23 tab files + 4 sweep commits + 1 CLAUDE.md). Squash-merge at PR time per the established pattern.

**Migration milestone:** Closes RELIC-336. After PR4 merges, every static styling decision in `apps/web` is a Tailwind className, every carve-out is documented runtime, and the cookbook is in CLAUDE.md so future drift is reviewable, not undetected.

---

## What's next

Nothing in the migration sequence — RELIC-336 is closed. Resume the Polish Initiative (per `docs/polish-pattern.md` and `docs/polish-tasks.md`). New analyzer / hero work uses the cookbook from CLAUDE.md as the styling baseline.
