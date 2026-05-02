# Tailwind Migration — PR3a (Inspectors) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the 4 inspector components in `apps/web/src/components/inspector/` (GuidePanel, ActivityInspector, FileInspector, ContributorsInspector — total 761 lines, 55 inline-style blocks) from `style={{}}` to Tailwind classes via `cn()` and `classMaps.ts`. Establish a pattern for handling module-level named style constants (which inspectors lean on heavily).

**Why split:** The original spec (`docs/superpowers/specs/2026-04-30-tailwind-migration-design.md`) scoped PR3 as "Inspectors + 22 hero components" — but that's ~10,500 lines and ~305 inline styles, ~5× PR2's scope. Splitting into PR3a (inspectors, this plan) and PR3b (heroes, future plan) keeps each PR reviewable in one sitting and lets visual QA happen in two narrower passes. PR4 (tabs + lint rule + CLAUDE.md) is unchanged as the closing PR.

**Architecture:** Apply the foundation primitives (`cn`, `badgeClasses`/`severityText` from `classMaps.ts`, `@theme` bridge from `index.css`) to 4 component files. Inspectors are React-heavy (drill-down panels for selected file/contributor/activity) — minimal D3, no SVG canvases. Most styling is layout + typography + color tokens, well covered by the PR1/PR2 cookbook.

**Tech Stack:** Tailwind v4 with `@theme` bridge, `cn()` (clsx + tailwind-merge), vitest 4 + happy-dom, React 19. All foundation primitives already in place from PR1/PR2.

**Spec:** `docs/superpowers/specs/2026-04-30-tailwind-migration-design.md`
**PR1 plan (canonical translation reference):** `docs/superpowers/plans/2026-04-30-tailwind-migration-pr1-foundation.md`
**PR2 plan (cookbook + carve-out patterns):** `docs/superpowers/plans/2026-05-01-tailwind-migration-pr2-shared-layout.md`

---

## File Map

### Modified (4 component files)
- `apps/web/src/components/inspector/GuidePanel.tsx` (158 lines, 5 styles — smallest, warm-up)
- `apps/web/src/components/inspector/ActivityInspector.tsx` (177 lines, 8 inline + 4 module-level `CSSProperties` constants — sets the pattern for handling module-level style constants)
- `apps/web/src/components/inspector/FileInspector.tsx` (206 lines, 12 styles — similar shape to ActivityInspector)
- `apps/web/src/components/inspector/ContributorsInspector.tsx` (220 lines, 30 styles — heaviest)

### Untouched in PR3a
- All hero components (PR3b — separate plan).
- All tab components (PR4).
- `oxlint.config.ts` — `react/forbid-dom-props` rule lands in PR4.
- `index.css`, root `CLAUDE.md` — final polish in PR4.

---

## New Pattern for PR3a: Module-Level Style Constants

PR3a is the first time the migration encounters **module-level `CSSProperties` constants** (i.e., declared once at file top, reused at multiple JSX sites). ActivityInspector uses 4 of them (`sectionLabel`, `statRow`, `statLabel`, `statValue`); FileInspector and ContributorsInspector likely use similar patterns.

**Decision:** Convert each `CSSProperties` constant to a module-level **string constant** holding the Tailwind className. Pattern:

```tsx
// before
const sectionLabel: React.CSSProperties = {
  fontSize: 9, textTransform: 'uppercase', letterSpacing: 1,
  color: 'var(--text-tertiary)', marginBottom: 6, marginTop: 14,
};
// ...
<div style={sectionLabel}>Churn</div>

// after
const sectionLabel = 'text-[9px] uppercase tracking-[1px] text-text-tertiary mb-1.5 mt-3.5';
// ...
<div className={sectionLabel}>Churn</div>
```

**Why module-level string constants, not inline:** Same DRY rationale as the original `CSSProperties` constants — these are reused at 4-10+ JSX sites per inspector. Inlining would bloat the JSX and risk drift between sites (one site updates the class, others don't).

**Why string constants, not `cn()`:** All 4 ActivityInspector constants are static. `cn()` is reserved for runtime conditionals.

**Why not extract to a shared `inspectorStyles.ts` utility:** Premature abstraction — wait until PR3a wraps and we see whether the same patterns repeat across all 3-4 inspectors. If they do, a follow-up commit (or PR3b) can lift them to `apps/web/src/components/inspector/styles.ts`. For now, keep each file's constants local.

**Spread-merge `{...statValue, fontSize: 10}`** (a pattern used in ActivityInspector lines 82, 119): in JSX, this spreads a CSSProperties object and overrides one key. After migration, this becomes `cn(statValue, 'text-[10px]')` — `tailwind-merge` resolves the `text-*` conflict so the override wins. The migration must catch every spread site and convert to `cn()`.

---

## Carve-out Anticipations

Looking at the 4 inspector files, I anticipate **0 new carve-outs**. Inspectors render report data into static layouts — no drag-resize, no runtime-computed positions, no caller-supplied style props (Inspector.tsx doesn't have a `wrapperStyle`-equivalent prop), no data-driven colors that aren't already covered by `severityText[variant]` or `badgeClasses[variant]`.

If something unexpected emerges (e.g., a data-driven color string that doesn't map to `BadgeVariant`), document it in the implementer's report and update this plan's carve-out section.

PR2 ended at 6 carve-outs total. PR3a expected to add 0.

---

## Task 1: GuidePanel (warm-up, 5 styles)

**Files:**
- Modify: `apps/web/src/components/inspector/GuidePanel.tsx`

GuidePanel renders 4 metric groups (Code Health / Ownership & Risk / Team & Activity / Structure) as a static reference card. No state, no props, all styles are static.

- [ ] **Step 1: Read** the file end-to-end. Identify the 5 style sites:
  1. Group wrapper `<div>` — `marginBottom: 14`
  2. Group label `<div>` — `fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: var(--text-tertiary), marginBottom: 6`
  3. Metric wrapper `<div>` — `marginBottom: 8`
  4. Metric name `<div>` — `fontSize: 11, color: var(--text-primary), fontWeight: 500`
  5. Metric description `<div>` — `fontSize: 10, color: var(--text-secondary), lineHeight: 1.4`

- [ ] **Step 2: Translate** each. Use plain `className="..."` (all static, no `cn()` needed).

  | # | Tailwind |
  |---|---|
  | 1 | `mb-3.5` (14 = 3.5×4) |
  | 2 | `text-[9px] uppercase tracking-[1px] text-text-tertiary mb-1.5` |
  | 3 | `mb-2` |
  | 4 | `text-[11px] text-text-primary font-medium` |
  | 5 | `text-[10px] text-text-secondary leading-[1.4]` |

  Note: `lineHeight: 1.4` → `leading-[1.4]` (arbitrary; standard `leading-snug` is 1.375 which is close but not exact).

- [ ] **Step 3: Verify**:
  ```bash
  pnpm lint apps/web/src/components/inspector/GuidePanel.tsx
  pnpm --filter @gitrelic/web test
  ```
  No test file for GuidePanel — verification is via lint + the broader suite (no consumer should break).

- [ ] **Step 4: Self-review**:
  ```bash
  grep -n "style=" apps/web/src/components/inspector/GuidePanel.tsx
  ```
  Expected: 0 matches.

- [ ] **Step 5: Commit**:
  ```bash
  git add apps/web/src/components/inspector/GuidePanel.tsx
  git commit -m "refactor(web): migrate GuidePanel to Tailwind (RELIC-336)"
  ```

---

## Task 2: ActivityInspector (8 inline + 4 module-level constants)

**Files:**
- Modify: `apps/web/src/components/inspector/ActivityInspector.tsx`

ActivityInspector renders churn/velocity/ownership/shame data for a selected file. Has 4 module-level `CSSProperties` constants (`sectionLabel`, `statRow`, `statLabel`, `statValue`) reused across the JSX, plus 8 inline `style={{}}` blocks. Two of the inline blocks use the spread-merge pattern `{ ...statValue, fontSize: 10 }`.

- [ ] **Step 1: Read** the file end-to-end. Note the 4 module-level constants and where each is used. Note the 2 spread-merge sites (lines 82 and 119 in the current code).

- [ ] **Step 2: Convert the 4 module-level constants** from `CSSProperties` to string Tailwind classes:

  ```tsx
  const sectionLabel = 'text-[9px] uppercase tracking-[1px] text-text-tertiary mb-1.5 mt-3.5';
  const statRow = 'flex justify-between items-center py-[3px] text-[11px]';
  const statLabel = 'text-text-secondary';
  const statValue = 'font-mono text-text-primary font-medium';
  ```

  Notes:
  - `padding: '3px 0'` → `py-[3px]` (3 is off-scale).
  - `marginTop: 14` → `mt-3.5` (14 = 3.5 × 4).
  - `marginBottom: 6` → `mb-1.5` (6 = 1.5 × 4).
  - `fontWeight: 500` → `font-medium`.

- [ ] **Step 3: Update each consumer**:
  - `<div style={sectionLabel}>` → `<div className={sectionLabel}>` (4-5 sites).
  - `<div style={statRow}>` → `<div className={statRow}>` (8+ sites).
  - `<span style={statLabel}>` → `<span className={statLabel}>` (multiple sites).
  - `<span style={statValue}>` → `<span className={statValue}>` (multiple sites).
  - **Spread-merge sites** (`{ ...statValue, fontSize: 10 }`) → `cn(statValue, 'text-[10px]')`. Add `import { cn } from '../../utils/cn';` to the imports.

- [ ] **Step 4: Translate the 8 inline styles** that aren't covered by the constants. Each gets a static `className="..."`. Reading the file:
  - **File header** (line 61-69): `text-xs font-mono text-text-primary font-semibold mb-1`. (`fontSize: 12` → `text-xs`.)
  - **Shame commit row** (line 132-136): `py-1.5 border-b border-border-primary`. (`padding: '6px 0'` → `py-1.5`.)
  - **Shame commit message** (line 138): `text-[10px] text-text-primary mb-[3px]`.
  - **Shame commit metadata row** (line 141): `flex gap-1 items-center`.
  - **Shame commit date** (line 143-147): `text-[9px] text-text-tertiary font-mono`.
  - **Empty state** (line 164-170): `text-text-tertiary text-[11px] mt-5 text-center`.
  - **Spread-merges** (lines 82, 119) — covered by `cn(statValue, 'text-[10px]')` per Step 3.

- [ ] **Step 5: Verify**:
  ```bash
  pnpm lint apps/web/src/components/inspector/ActivityInspector.tsx
  pnpm --filter @gitrelic/web test
  ```
  Expected: lint clean; full suite passes.

- [ ] **Step 6: Self-review**:
  ```bash
  grep -n "style=" apps/web/src/components/inspector/ActivityInspector.tsx
  ```
  Expected: 0 matches.

  Also verify the constants are correctly typed as `string` (not `CSSProperties`) and that no `import type { CSSProperties }` from React remains (delete the import if it's no longer used).

- [ ] **Step 7: Commit**:
  ```bash
  git add apps/web/src/components/inspector/ActivityInspector.tsx
  git commit -m "refactor(web): migrate ActivityInspector to Tailwind (RELIC-336)"
  ```

---

## Task 3: FileInspector (12 styles, similar pattern to ActivityInspector)

**Files:**
- Modify: `apps/web/src/components/inspector/FileInspector.tsx`

FileInspector is the per-file drill-down panel — likely shares the same `sectionLabel`/`statRow`/`statLabel`/`statValue` pattern as ActivityInspector. Read the file to confirm.

- [ ] **Step 1: Read** the file end-to-end. Identify:
  - Module-level `CSSProperties` constants (likely 3-5).
  - Inline `style={{}}` blocks (12 expected).
  - Any spread-merge sites (`{ ...x, y: z }`).
  - Whether the constants are byte-identical to ActivityInspector's. If yes, **note this** in your report — it's a candidate for extraction to a shared `inspectorStyles.ts` (but defer to a later commit, not this task).

- [ ] **Step 2: Translate** following the Task 2 pattern:
  - Module-level `CSSProperties` constants → string Tailwind classes (use `sectionLabel`/`statRow`/`statLabel`/`statValue` naming if they match Activity's; use new names if they differ).
  - Inline styles → `className="..."`.
  - Spread-merges → `cn(constant, 'extra-class')`.

- [ ] **Step 3: Verify**:
  ```bash
  pnpm lint apps/web/src/components/inspector/FileInspector.tsx
  pnpm --filter @gitrelic/web test
  ```

- [ ] **Step 4: Self-review**:
  ```bash
  grep -n "style=" apps/web/src/components/inspector/FileInspector.tsx
  ```
  Expected: 0 matches.

- [ ] **Step 5: Commit**:
  ```bash
  git add apps/web/src/components/inspector/FileInspector.tsx
  git commit -m "refactor(web): migrate FileInspector to Tailwind (RELIC-336)"
  ```

---

## Task 4: ContributorsInspector (30 styles, heaviest)

**Files:**
- Modify: `apps/web/src/components/inspector/ContributorsInspector.tsx`

The heaviest single inspector — 30 inline styles across 220 lines. Likely renders contributor cards with stats, badges, and possibly avatar/initials. May have its own module-level style constants and possibly conditional styling (e.g., active vs inactive contributor highlight).

- [ ] **Step 1: Read** the file end-to-end. Identify:
  - All 30 style sites (some may be inside a `.map()` loop, so the count could be misleading — e.g., 5 styles inside a per-contributor render that fires 20+ times).
  - Module-level `CSSProperties` constants (likely several).
  - Spread-merges.
  - **Conditional styling** (state-driven or data-driven) — these are `cn()` candidates.
  - Any data-driven colors that aren't covered by `severityText`/`badgeClasses` — these may be carve-outs.

- [ ] **Step 2: Translate**. Use `cn()` for conditional classes; use string constants for module-level. Document any patterns that don't fit the cookbook.

- [ ] **Step 3: Verify**:
  ```bash
  pnpm lint apps/web/src/components/inspector/ContributorsInspector.tsx
  pnpm --filter @gitrelic/web test
  ```

- [ ] **Step 4: Self-review**:
  ```bash
  grep -n "style=" apps/web/src/components/inspector/ContributorsInspector.tsx
  ```
  Expected: 0 matches OR documented carve-outs only (with justification).

- [ ] **Step 5: Commit**:
  ```bash
  git add apps/web/src/components/inspector/ContributorsInspector.tsx
  git commit -m "refactor(web): migrate ContributorsInspector to Tailwind (RELIC-336)"
  ```

---

## Final verification (after Task 4)

Run from repo root:
```bash
pnpm test
pnpm lint
pnpm format:check
pnpm build
```

Expected:
- All tests pass (812/812 like PR2 — no tests added or removed).
- 0 lint errors. Warnings ≤9 (only pre-existing `no-explicit-any` in 3 D3 hero files; PR3a doesn't touch heroes).
- Format check clean.
- Build succeeds for core, web, cli.

Then run the dashboard for visual QA:
```bash
pnpm build
node apps/cli/dist/index.mjs --path ~/path/to/some-repo --web
```

Click any file row in any tab to open the **right-side InspectorPanel**. Then:
- Click through the **3 inspector tabs** at the top: File / Contributors / Activity. Verify each renders correctly.
- Click the **Guide** tab in the bottom utility section. Verify all 4 metric groups render with correct typography (uppercase labels, proper spacing).
- Test in **both themes** (DevTools `document.documentElement.dataset.theme = 'light'`).

Specifically verify:
- Section labels (uppercase, 9px, tertiary, with letter-spacing).
- Stat rows (label-value pairs, mono font on values).
- File headers (mono font, semibold).
- Shame commit cards (proper border-bottom dividers, badge colors).
- Empty states (centered, tertiary text).
- Contributor cards (active vs inactive highlight, stat layout, badges).

---

## Self-Review (plan author)

**Spec coverage:**
- ✅ All 4 inspectors (`GuidePanel`, `ActivityInspector`, `FileInspector`, `ContributorsInspector`).
- ⚠️ NOT in this plan: 22 hero files (deferred to PR3b). Original spec scoped them with inspectors; the split is documented at the top of this plan and in the upcoming PR3a PR description.
- ⚠️ NOT in this plan: hero `hotspotColor()` audit, `react/forbid-dom-props` lint rule, root CLAUDE.md update — all deferred to PR3b/PR4 per the spec.

**New pattern introduced (module-level style constants):** Each `CSSProperties` constant becomes a `string` constant holding Tailwind classes. Spread-merge consumers (`{ ...constant, override }`) become `cn(constant, 'override-class')`. Documented up-top so all 4 task implementers apply consistently.

**Placeholder scan:** None. Each task has specific files, specific line counts, specific class translations for the patterns I observed by reading 2 of the 4 files (GuidePanel + ActivityInspector). Tasks 3-4 trust the cookbook + the same pattern; the implementer reads the source to translate.

**Type consistency:** `cn` import path consistent (`'../../utils/cn'` from `inspector/`). Constants are `string` type (no `CSSProperties`).

**Carve-out anticipation:** 0 expected. PR2 ended at 6; if PR3a stays at 6, the migration is on track. Any carve-out discovered should be documented in the implementer's report and added to this plan retroactively.

---

## What's next

PR3b (heroes) — 22 files, ~9,800 lines, ~250 inline styles. Heroes are mostly thin React shells around D3-generated SVG content; the React `style={{}}` count is for wrapper divs, tooltips, legends, empty states. Plus the `hotspotColor()` audit (deprecated; replace React `style` consumers with `severityText` lookups, leave D3 `.attr('fill', ...)` consumers alone). A separate plan will be written when PR3a lands.

PR4 — 22 tab components, `react/forbid-dom-props` lint rule scoped to `apps/web/**`, per-line disable comments on the documented carve-outs (now 6, may grow during PR3a/PR3b), root `CLAUDE.md` "Web Styling" section.
