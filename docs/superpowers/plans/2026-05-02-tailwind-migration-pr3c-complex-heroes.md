# Tailwind Migration — PR3c (Complex Heroes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the remaining 12 complex hero components in `apps/web/src/components/hero/` (5 bars, 3 trends/trees, 3 force graphs + bubble, ContributorSwimlanes) — **145 inline styles total** — and tighten the 9 pre-existing `no-explicit-any` lint warnings in the 3 D3-force / hierarchy files. After this PR merges, all 28 heroes use Tailwind and `apps/web` lint runs clean (0 warnings, 0 errors). PR4 (tabs + CLAUDE.md "Web Styling" section) ships next.

**Why this PR:** PR3b drew the line at "simple wrappers" vs "complex viz" because 28 heroes × up to 22 styles per file is too much for one PR. PR3c is the heavier half — bars with data-driven swatches, sunburst/heatmap with rotation transforms, force graphs with simulation refs, and the heaviest single hero (ContributorSwimlanes, 22 styles). The cookbook is locked from PR1-PR3b; this is mechanical migration with one new typing side quest.

**Architecture:** Same shape as PR3b — apply the foundation primitives (`cn`, `classMaps`, `@theme` bridge) to React JSX wrappers; leave D3-generated SVG bodies alone. The new wrinkle is Task 3, where each force-graph file additionally tightens its `D3Simulation<any, any>` ref + `forceLink` callback types using `SimulationNodeDatum` / `SimulationLinkDatum` from `d3-force`. OwnershipBubble's `hierarchy<DirBubble>({ children: dirs } as any)` gets a synthetic-root type (no more `as any`).

**Tech Stack:** Tailwind v4 with `@theme` bridge, `cn()` (clsx + tailwind-merge), vitest 4 + happy-dom, React 19, d3-force, d3-hierarchy. Foundation primitives in place from PR1/PR2/PR3a/PR3b.

**Spec:** `docs/superpowers/specs/2026-04-30-tailwind-migration-design.md`
**PR3b plan (canonical hero cookbook):** `docs/superpowers/plans/2026-05-01-tailwind-migration-pr3b-simple-heroes.md` — read its **Hero-Specific Patterns** section before starting; it covers D3 mount container, tooltip overlay carve-out, empty state, inline legend with data-driven swatch, SVG body don't-migrate rule, severity color in SVG fills don't-migrate rule. PR3c uses every one of those patterns.

---

## File Map

### Modified (12 hero files)

**Task 1 — Bars (5 files, 56 styles):**
- `apps/web/src/components/hero/ChurnBar.tsx` (12 styles)
- `apps/web/src/components/hero/OwnershipBar.tsx` (12 styles)
- `apps/web/src/components/hero/RewriteDivergingBar.tsx` (11 styles)
- `apps/web/src/components/hero/ShameLeaderboard.tsx` (11 styles)
- `apps/web/src/components/hero/LanguagesStackedBar.tsx` (10 styles)

**Task 2 — Trends / trees (3 files, 34 styles):**
- `apps/web/src/components/hero/ShameTrend.tsx` (11 styles)
- `apps/web/src/components/hero/OwnershipSunburst.tsx` (10 styles)
- `apps/web/src/components/hero/RiskHeatmap.tsx` (13 styles)

**Task 3 — Force graphs + bubble + typing fixes (3 files, 33 styles, 9 lint warnings → 0):**
- `apps/web/src/components/hero/AuthorForceGraph.tsx` (7 styles, 4 `any` warnings)
- `apps/web/src/components/hero/CouplingForceGraph.tsx` (6 styles, 4 `any` warnings)
- `apps/web/src/components/hero/OwnershipBubble.tsx` (20 styles, 1 `any` warning)

**Task 4 — ContributorSwimlanes solo (1 file, 22 styles):**
- `apps/web/src/components/hero/ContributorSwimlanes.tsx` (22 styles, the heaviest single hero in the codebase)

### Untouched in PR3c
- All 22 tab files (PR4).
- `oxlint.config.ts`, `index.css`, root `CLAUDE.md` — final polish in PR4.

---

## New patterns specific to PR3c (cookbook supplement)

PR3b's hero patterns cover most cases. Three additional patterns surface in PR3c — document up-front so all 4 task implementers handle them consistently:

### A. d3-force typing pattern (Task 3 only)

Both force-graph files have:
```ts
const simRef = useRef<D3Simulation<any, any> | null>(null);
// ...
forceLink(simLinks)
  .id((d: any) => d.id)
  .strength((d: any) => /* ... */),
```

Replace with proper `SimulationNodeDatum` / `SimulationLinkDatum` extension:
```ts
import type {
  Simulation as D3Simulation,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3-force';

// Per-file: extend the existing local node/link interfaces with the d3-force base.
interface SimNode extends SimulationNodeDatum {
  id: string;
  // ... whatever the existing node shape declares (hotspotScore, category, etc.)
}
interface SimLink extends SimulationLinkDatum<SimNode> {
  // ... the existing link fields (strength, coAuthoredCommits, etc.)
}

const simRef = useRef<D3Simulation<SimNode, SimLink> | null>(null);
// ...
forceLink<SimNode, SimLink>(simLinks)
  .id((d) => d.id)                           // d is now SimNode, no `: any`
  .strength((d) => /* ... */),               // d is now SimLink, no `: any`
```

Notes:
- `SimulationNodeDatum` has optional `index`, `x`, `y`, `vx`, `vy`, `fx`, `fy` — all the runtime fields d3-force adds. The existing local shapes (`AuthorGraphNode`, `GraphNode`) already declare `x?` / `y?`; extending `SimulationNodeDatum` is type-compatible.
- `SimulationLinkDatum<NodeDatum>` types `source`/`target` as `string | number | NodeDatum`. The current code uses string IDs initially, then d3-force resolves them to node references after `.id()` — this is why the strict typing works.
- `AuthorForceGraph` has its own `AuthorGraphNode` type imported from `./authorGraph.ts` — extend that there, OR define a local `SimNode` wrapper if cross-file type changes feel risky. Either is fine; pick the smaller diff.
- The migration commit and the typing fix go in the **same commit** (file's already touched, types are small). Commit message: `refactor(web): migrate AuthorForceGraph to Tailwind + tighten d3-force types (RELIC-336)`.

### B. d3-hierarchy synthetic-root typing (Task 3, OwnershipBubble only)

Line 153 today:
```ts
const root = hierarchy<DirBubble>({ children: dirs } as any)
  .sum((d) => d.totalLoc ?? 0)
  .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
```

The synthetic root only has `children` — `DirBubble` has more required fields. Fix by using a union with a synthetic-root type and accessing `totalLoc` defensively:
```ts
type DirBubbleRoot = { children: DirBubble[] };
const root = hierarchy<DirBubble | DirBubbleRoot>({ children: dirs })
  .sum((d) => ('totalLoc' in d ? d.totalLoc ?? 0 : 0))
  .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

const layout = pack<DirBubble | DirBubbleRoot>().size([dims.width, dims.height]).padding(8);
return layout(root).leaves() as HierarchyCircularNode<DirBubble>[];
```

The `as HierarchyCircularNode<DirBubble>[]` cast at the end is fine — leaves are guaranteed to be the data type, not the synthetic root, and the existing code already used this cast. Goal is only to remove the `as any` in the `hierarchy()` call.

### C. SVG `<g transform={...}>` is a JSX attribute, not a React style prop

OwnershipSunburst and OwnershipBubble both use `<g transform={\`translate(${cx}, ${cy})\`}>` and similar rotation transforms. **These are JSX attributes on SVG elements, not the React `style` prop** — they don't trigger `react/forbid-dom-props` and don't need migration. Keep them as-is. Only React `style={{}}` blocks migrate.

This was already implicit in PR3b's "SVG body don't-migrate" rule, but PR3c surfaces it more visibly (sunbursts and bubbles have lots of `transform=` props). Don't mistake them for inline styles.

### D. ShameLeaderboard and OwnershipBar — data-driven swatches in legend rows

These two heroes have inline legend strips with per-row swatches whose `background` is computed from the row's category/severity. Same shape as ChurnLegend's swatch carve-out (PR2): static legend container/row classes migrate; the `style={{ background: dynamicColor }}` per-swatch stays as a carve-out.

### E. ContributorSwimlanes (Task 4) — JS layout constants

ContributorSwimlanes computes per-row Y positions in JavaScript and renders rows with `style={{ top: rowY, height: rowHeight }}`. Same carve-out pattern as PR3b heroes that read `tooltip.x` / `tooltip.y`: dynamic positioning stays inline. Static row chrome (background, border, padding, transition) migrates to className. Expected carve-outs: ~3-5 (one per dynamically-positioned element).

---

## Pattern reminders (from PR1-PR3b — don't re-litigate)

- `cn()` only for runtime conditionals or spread-merges. Bare ternary for single conditionals (`className={cond ? 'a' : 'b'}`, NOT `cn(cond ? 'a' : 'b')`).
- Static SVG `style` props on JSX `<rect>`/`<g>`/`<text>` migrate to `className=` (Tailwind utilities work on inline SVG). Reviewers caught misclassification twice in PR3b.
- Dynamic SVG cursor (state-conditional) → bare ternary on className.
- Standard scale before arbitrary: `0.5/1.5/2.5/3.5` ARE on the scale (2/6/10/14 px). Use `text-[Npx]` only for genuinely off-scale values.
- D3 `.attr()` and `.style()` chains in SVG generation are NOT React style props — never migrate.
- Tooltip spec from PR2: `className="absolute bg-tooltip-bg text-tooltip-text px-2 py-1 rounded text-[10px] whitespace-nowrap pointer-events-none z-[100] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"` — but PR3b heroes have been preserving `bg-surface-elevated` / `text-text-primary` from the original (pre-existing debt). Stay consistent with PR3b — preserve `bg-surface-elevated` / `text-text-primary` in PR3c heroes too (PR4 will sweep all hero tooltip mismatches in one pass).
- `font-medium` (500) vs `font-semibold` (600) — distinct, don't conflate.
- Bare-number React inline-style values are px (`letterSpacing: 1` → `tracking-[1px]`).
- Carve-outs running total going into PR3c: 32. PR3c expected to add ~30-40 more (~62-72 cumulative going into PR4).

---

## Task 0: Branch setup

**Goal:** Create the PR3c branch off main.

- [ ] **Step 1: Create branch and verify clean state**

```bash
git checkout main
git pull
git checkout -b relic-336-pr3c-complex-heroes
git status
```

Expected: branch created, working tree clean.

- [ ] **Step 2: Verify starting lint state**

```bash
pnpm lint 2>&1 | tail -5
```

Expected: `Found 9 warnings and 0 errors.` These 9 warnings are the `no-explicit-any` ones in AuthorForceGraph (4) + CouplingForceGraph (4) + OwnershipBubble (1). All 9 should reach 0 by end of Task 3.

- [ ] **Step 3: Verify starting test state**

```bash
pnpm test 2>&1 | tail -5
```

Expected: all tests pass (812/812 from PR3b, plus any new tests added since — same baseline either way).

---

## Task 1: 5 bars

**Goal:** Migrate the 5 bar heroes. 5 commits total.

**Files:**
- `apps/web/src/components/hero/ChurnBar.tsx`
- `apps/web/src/components/hero/OwnershipBar.tsx`
- `apps/web/src/components/hero/RewriteDivergingBar.tsx`
- `apps/web/src/components/hero/ShameLeaderboard.tsx`
- `apps/web/src/components/hero/LanguagesStackedBar.tsx`

For each file (one commit per file, in any order):

- [ ] **Step 1: Read the file end-to-end**

Identify each `style={{}}` block and classify:
- Static-only → `className` translation
- One conditional → bare ternary on className
- Multiple conditionals or spread-merge → `cn()`
- Runtime-positioned (tooltip x/y, dynamic bar widths from data) → carve-out (keep `style={{}}`)
- Data-driven swatch background (legend rows in OwnershipBar/ShameLeaderboard) → carve-out (`style={{ background: dynamicColor }}`)

- [ ] **Step 2: Translate**

Apply the cookbook + PR3b's hero-specific patterns + PR3c additions §D (data-driven swatches). Do not migrate D3-generated SVG. Do not migrate `transform=` JSX attributes.

- [ ] **Step 3: Run tests for this file (if a test exists)**

Most bars have a `*.test.tsx` (`ChurnBar.test.tsx`, `OwnershipBar.test.tsx`, `RewriteDivergingBar.test.tsx`, `ShameLeaderboard.test.tsx`, `LanguagesStackedBar.test.tsx`). Run:

```bash
pnpm --filter @gitrelic/web test ChurnBar.test.tsx
```

(Replace name per file.) Expected: pass.

- [ ] **Step 4: Self-review the carve-outs**

```bash
pnpm exec grep -n "style={{" apps/web/src/components/hero/ChurnBar.tsx
```

Expected: 0 matches OR a small number of carve-outs, each justifiable as a runtime value (tooltip position, data-driven swatch, dynamic bar width). If a "carve-out" is actually a static value, it should have been migrated.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/hero/ChurnBar.tsx
git commit -m "refactor(web): migrate ChurnBar to Tailwind (RELIC-336)"
```

(Replace component name per file.)

After all 5 bars migrated, run full suite + lint:

```bash
pnpm --filter @gitrelic/web test
pnpm lint 2>&1 | tail -5
```

Expected: all web tests pass; lint reports `Found 9 warnings and 0 errors.` (the 9 force-graph/bubble warnings are unchanged — Task 3 fixes them).

---

## Task 2: 3 trends / trees

**Goal:** Migrate ShameTrend, OwnershipSunburst, RiskHeatmap. 3 commits total.

**Files:**
- `apps/web/src/components/hero/ShameTrend.tsx`
- `apps/web/src/components/hero/OwnershipSunburst.tsx`
- `apps/web/src/components/hero/RiskHeatmap.tsx`

Same per-file shape as Task 1 (read → translate → test → self-review → commit). Apply PR3b cookbook + PR3c §C (transform attributes are JSX, not styles — don't migrate).

OwnershipSunburst is the trickiest of the 3 because it has `<g transform={\`rotate(${angle})\`}>` segments. The transforms are JSX attributes on SVG `<g>` — leave them. Only the React `style={{}}` on outer container/tooltip/empty-state divs migrates.

After all 3: `pnpm --filter @gitrelic/web test`, `pnpm lint 2>&1 | tail -5`. Expected: tests pass; still 9 lint warnings (Task 3 territory).

Per-file commit message: `refactor(web): migrate ShameTrend to Tailwind (RELIC-336)` (and per file).

---

## Task 3: 3 force graphs + bubble + typing fixes

**Goal:** Migrate AuthorForceGraph, CouplingForceGraph, OwnershipBubble AND tighten the 9 `no-explicit-any` warnings. 3 commits total — typing fix lives in the same commit as the file's migration.

**Files:**
- `apps/web/src/components/hero/AuthorForceGraph.tsx`
- `apps/web/src/components/hero/CouplingForceGraph.tsx`
- `apps/web/src/components/hero/OwnershipBubble.tsx`

### Step 1: AuthorForceGraph

- [ ] **Read the file end-to-end.** Note the 7 `style={{}}` sites and the 4 `any` sites (line 30 has 2 — `<any, any>` — plus lines 70 and 72).

- [ ] **Apply the typing pattern** from §A above. Add `SimulationNodeDatum` / `SimulationLinkDatum` imports from `d3-force`. Either extend the existing `AuthorGraphNode` (in `./authorGraph.ts`) with `SimulationNodeDatum`, or define a local `SimNode extends SimulationNodeDatum & AuthorGraphNode` in this file — whichever is the smaller diff. The simNode produced inside `useEffect` is `nodes.map((n) => ({ ...n, x, y }))`, so SimNode needs `x?` and `y?` — `SimulationNodeDatum` already provides those.

- [ ] **Migrate the 7 `style={{}}` sites** following PR3b's hero patterns: container div → `w-full h-full relative`, cursor `style={{ cursor: 'pointer' }}` on `<g>` → `className="cursor-pointer"` (Tailwind classes work on inline SVG; verified in PR3b), tooltip overlay → static className + dynamic-position carve-out, etc.

- [ ] **Run tests** (no test file exists for AuthorForceGraph — `pnpm --filter @gitrelic/web test` to confirm full suite still passes).

- [ ] **Self-review:** verify 0 remaining `any` and that the file's lint warnings drop to 0 from the previous 4:

```bash
pnpm exec grep -n ": any\|<any\| as any" apps/web/src/components/hero/AuthorForceGraph.tsx
pnpm lint apps/web/src/components/hero/AuthorForceGraph.tsx 2>&1 | tail -3
```

Expected: 0 matches; 0 warnings on this file.

- [ ] **Commit:**

```bash
git add apps/web/src/components/hero/AuthorForceGraph.tsx apps/web/src/components/hero/authorGraph.ts
git commit -m "refactor(web): migrate AuthorForceGraph to Tailwind + tighten d3-force types (RELIC-336)"
```

(If you didn't touch `authorGraph.ts`, drop it from `git add`.)

After this commit, full lint should report **5 warnings** remaining (4 in CouplingForceGraph, 1 in OwnershipBubble). Verify:

```bash
pnpm lint 2>&1 | tail -5
```

Expected: `Found 5 warnings and 0 errors.`

### Step 2: CouplingForceGraph

Same shape as Step 1 but with `GraphNode` and `GraphLink` (both defined locally in this file at lines 16-28). Extend them with `SimulationNodeDatum` / `SimulationLinkDatum<SimNode>`. The `any` sites are lines 67 (×2), 100, 102.

- [ ] Read, apply typing pattern §A, migrate 6 `style={{}}` sites, verify lint, commit:

```bash
git add apps/web/src/components/hero/CouplingForceGraph.tsx
git commit -m "refactor(web): migrate CouplingForceGraph to Tailwind + tighten d3-force types (RELIC-336)"
```

Lint after this commit: `Found 1 warnings and 0 errors.` (only OwnershipBubble's `as any` remains.)

### Step 3: OwnershipBubble

- [ ] **Read the file end-to-end.** 20 `style={{}}` sites — this is the second-heaviest file in PR3c. Note the `as any` on line 153.

- [ ] **Apply the synthetic-root typing pattern** from §B above. Define `type DirBubbleRoot = { children: DirBubble[] }`, change `hierarchy<DirBubble>(...)` to `hierarchy<DirBubble | DirBubbleRoot>(...)`, change `pack<DirBubble>()` to `pack<DirBubble | DirBubbleRoot>()`, defensively access `totalLoc` in `.sum()` callback. Keep the `as HierarchyCircularNode<DirBubble>[]` cast on `.leaves()`.

- [ ] **Migrate the 20 `style={{}}` sites** following the cookbook. OwnershipBubble has tooltip + legend + selection chrome — expect 3-5 carve-outs (data-driven swatches in legend, dynamic tooltip position).

- [ ] **Run tests** (`OwnershipBubble.test.tsx` exists):

```bash
pnpm --filter @gitrelic/web test OwnershipBubble.test.tsx
```

Expected: pass.

- [ ] **Self-review:**

```bash
pnpm exec grep -n "as any\| any\>" apps/web/src/components/hero/OwnershipBubble.tsx
pnpm lint 2>&1 | tail -5
```

Expected: 0 matches; `Found 0 warnings and 0 errors.` 🎉

- [ ] **Commit:**

```bash
git add apps/web/src/components/hero/OwnershipBubble.tsx
git commit -m "refactor(web): migrate OwnershipBubble to Tailwind + remove hierarchy any cast (RELIC-336)"
```

---

## Task 4: ContributorSwimlanes solo

**Goal:** Migrate the heaviest single hero in the codebase (22 styles). 1 commit.

**File:** `apps/web/src/components/hero/ContributorSwimlanes.tsx`

This is the file's own task because 22 styles in one file warrants focused review attention — same rationale as PR3a Task 2 (the inspector with the most styles got its own task).

- [ ] **Read the file end-to-end.** Inventory each `style={{}}` site. Expect a mix of:
  - Container chrome (static — migrate to className)
  - Per-row dynamic positioning (`top: rowY`, `height: rowHeight` — carve-out per §E)
  - Tooltip (static + dynamic position carve-out per PR3b §2)
  - Legend (static + data-driven swatch carve-out per PR3b §4)
  - Empty state (static — migrate to className)

- [ ] **Translate.** Follow cookbook + PR3b hero patterns + PR3c §E (JS layout constants).

- [ ] **Run tests** (`ContributorSwimlanes.test.tsx` exists):

```bash
pnpm --filter @gitrelic/web test ContributorSwimlanes.test.tsx
```

Expected: pass.

- [ ] **Self-review carve-outs:**

```bash
pnpm exec grep -c "style={{" apps/web/src/components/hero/ContributorSwimlanes.tsx
```

Expected: 3-7 carve-outs (per-row dynamic top/height, tooltip dynamic position, data-driven swatches). Down from 22 — most should migrate.

- [ ] **Commit:**

```bash
git add apps/web/src/components/hero/ContributorSwimlanes.tsx
git commit -m "refactor(web): migrate ContributorSwimlanes to Tailwind (RELIC-336)"
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
- All tests pass (812/812 or higher — heroes have test files, behavior should be unchanged).
- **Lint: 0 errors, 0 warnings.** This is the milestone — the 9 pre-existing `no-explicit-any` warnings are gone and no new ones introduced.
- Format check clean.
- Build succeeds.

### Carve-out audit

```bash
pnpm exec grep -rn "style={{" apps/web/src/components/hero/
```

Expected: each migrated hero in PR3c has 0 OR a small number of carve-outs. PR3c carve-out additions: estimated 30-40. Cumulative total going into PR4: estimated 62-72.

Document the actual count per file in the PR description so PR4 has accurate carve-out scope for the (deferred) `react/forbid-dom-props` lint rule discussion.

### Visual QA

```bash
pnpm build
node apps/cli/dist/index.mjs --path ~/path/to/some-repo --web
```

Click through every tab that uses a PR3c hero — at minimum:
- Churn (ChurnBar)
- Bus Factor (OwnershipBar)
- Rewrite Ratio (RewriteDivergingBar)
- Shame (ShameLeaderboard, ShameTrend)
- Languages (LanguagesStackedBar)
- Cursed Files / Risk Register (RiskHeatmap)
- Knowledge Silos (OwnershipSunburst)
- Co-Authors (AuthorForceGraph)
- Coupling (CouplingForceGraph)
- Ownership Bubble — wherever surfaced (likely Knowledge Silos or Languages)
- Contributors / Activity (ContributorSwimlanes)

Verify in both themes (DevTools `document.documentElement.dataset.theme = 'light'`).

Per hero, verify:
- D3 SVG renders correctly (the chart itself — bars, sunburst rings, force-directed graph layout, swimlane rows).
- Tooltip overlay appears on hover at the correct position.
- Empty state shows centered "No data" when applicable.
- Wrapper sizes correctly (full width/height of its container).
- Selection chrome (clicked row/node highlight) appears correctly.
- Bubble pack layout renders without the synthetic-root regression (specifically: empty `dirs` shouldn't crash — verified by the existing test, but eyeball it too).

### PR description checklist (when raising the PR)

- 12 heroes migrated; 145 inline styles processed
- 9 `no-explicit-any` warnings → 0 (force graphs + bubble)
- All 28 hero components now use Tailwind
- Carve-out count: <actual> added (cumulative total <X>)
- Closes RELIC-336 PR3c (PR4 closer ships next: 22 tabs + CLAUDE.md "Web Styling" section)
- Visual QA: <list of tabs eyeballed in both themes>

---

## Self-Review (plan author)

**Spec coverage:**
- ✅ All 12 remaining heroes (Tasks 1-4).
- ✅ 9 `no-explicit-any` warnings cleared (Task 3).
- ⚠️ NOT in this plan: 22 tab files (PR4), `react/forbid-dom-props` lint rule (PR4 — but per memory, that rule was dropped from PR4 scope; just CLAUDE.md docs), root `CLAUDE.md` "Web Styling" section (PR4).

**Placeholder scan:** None. Tasks reference the cookbook + per-file class translations follow the established pattern. The typing fix has actual code samples in §A and §B. Implementer reads each source to translate styles.

**Type consistency:** `cn` import path consistent (`'../../utils/cn'` from `hero/`). All new tokens in className strings are bridged in `@theme` (verified through PR3b — no new tokens needed for PR3c). The `SimNode`/`SimLink` interface names in §A are stand-ins; implementer can use the existing local node names per file (`AuthorGraphNode`, `GraphNode`) since each force-graph file already has its own local interfaces.

**Carve-out anticipation:** ~30-40 new carve-outs (per-row dynamic positioning in swimlanes, data-driven swatches in bars/sunburst, tooltip dynamic positioning). Cumulative running total going into PR4: estimated 62-72.

**Branch and commit hygiene:** 12 commits expected (5 bars + 3 trends/trees + 3 force-graphs/bubble + 1 swimlanes). One file per commit. Force-graph and bubble commits combine the migration and the typing fix because they touch the same file in the same scope. Squash-merge at PR time per the established pattern.

**Lint milestone:** This PR drives `apps/web` lint warnings from 9 → 0 — the first time the web package has been clean. Worth calling out in the PR description.

---

## What's next

PR4 — 22 tab components in `apps/web/src/components/tabs/` + add the "Web Styling" section to root `CLAUDE.md`. **No `react/forbid-dom-props` lint rule** (decision made during PR3b: with 60+ carve-outs by end of PR3c, per-line disables become noise; documentation in CLAUDE.md is the actual root-cause fix). PR4 is also when the deferred sweep happens for `bg-surface-elevated` → `bg-tooltip-bg` mismatches in hero tooltips, the `font-mono` index.css duplication, and tooltip padding standardization.
