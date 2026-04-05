# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 8-tab web dashboard with a single synthesized dashboard page using a warm earthy color palette, CSS custom properties for light/dark theming, and inline signal badges per file row.

**Architecture:** Big-bang rebuild of the web package's presentation layer. `App.tsx` data flow unchanged (fetch JSON → render). `Dashboard.tsx` is replaced entirely. New components are extracted into focused files under `apps/web/src/components/`. CSS custom properties in `index.css` drive theming. No core package changes.

**Tech Stack:** React 19, Tailwind CSS 4, CSS custom properties, Vite

**Spec:** `docs/superpowers/specs/2026-04-05-dashboard-redesign-design.md`
**Mockup:** `redesign-assets/Mockup.png`

---

## File Structure

```
apps/web/src/
  index.css                    # MODIFY — replace body styles with CSS custom property system (light + dark)
  App.tsx                      # MODIFY — update loading/error states to use theme variables
  components/
    Dashboard.tsx              # REWRITE — new single-page layout orchestrating all sections
    HotspotClusters.tsx        # MODIFY — restyle cluster cards to match earthy palette
    StatsBar.tsx               # CREATE — 5-cell grid showing top-level metrics
    HotspotTable.tsx           # CREATE — ranked file table with inline signal badges
    ContributorsSection.tsx    # CREATE — contributor rows with avatar circles
    BusFactorSection.tsx       # CREATE — single-owner file list
    AgeDistribution.tsx        # CREATE — 4-cell fresh/aging/stale/ancient grid
    ShameSection.tsx           # CREATE — compact shame leaderboard for dashboard footer
    Badge.tsx                  # CREATE — reusable badge component with semantic color variants
    theme.ts                   # CREATE — shared color/badge helper functions
```

**Rationale:** The current `Dashboard.tsx` is ~700 lines with 8 tab components, helper functions, and style utilities all in one file. The redesign splits into focused components by dashboard section. Each component receives its slice of `GitloreReport` as props. `theme.ts` centralizes badge color logic and helper functions shared across components. `Badge.tsx` is the only reusable UI primitive — everything else is a dashboard section.

**Deferred interactions (will be added in a follow-up polish pass with the user):**
- Sortable table columns (spec: "The hotspot table should be sortable by Score, Churn, or LOC columns")
- File row click-through / inline drill-down (spec: "Clicking a file name... should expand an inline detail panel")
- These are interaction layers on top of the visual redesign — the user wants to get the look and feel right first, then work on tweaks together.

**Spec deviation notes:**
- The mockup shows a 3-column layout (Contributors / Clusters / Bus Factor) and a 2-column footer (Age / Shame). The spec's ASCII diagram shows only 2 columns + no Shame section. We follow the mockup, which is the more recent artifact.
- All section labels use `letter-spacing: 0.08em` per spec. Table headers use `0.06em`.

---

## Task 1: CSS Custom Property System

**Files:**
- Modify: `apps/web/src/index.css`

Sets up the foundation that all subsequent components depend on. No visual changes yet — just the variable definitions.

- [ ] **Step 1: Replace `index.css` body styles with CSS custom properties**

Replace the entire contents of `index.css` with the design spec's custom property system. This includes:
- Light theme variables under `:root` (bg, fg, border, semantic accent colors with -bg/-fg variants)
- Dark theme variables under `@media (prefers-color-scheme: dark)`
- Spacing, border, and radius tokens
- Body styles using the new variables
- Keep the Tailwind `@import 'tailwindcss'` at the top

Reference values from the design spec:
- Light bg: `#F5F2EC`, dark bg: `#1C1B18`
- Light fg: `#1A1A18`, dark fg: `#E4E1D8`
- Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`
- Mono: `'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace`
- All semantic colors (red, amber, teal, blue, purple) with their light and dark variants

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web build`
Expected: Build succeeds (existing components will look wrong with the new variables — that's expected)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/index.css
git commit -m "style(web): replace dark theme with CSS custom property system

Warm earthy palette with light/dark theme support via prefers-color-scheme.
Semantic accent colors: red (critical), amber (warning), teal (healthy),
blue (coupling), purple (ownership)."
```

---

## Task 2: Badge Component and Theme Helpers

**Files:**
- Create: `apps/web/src/components/Badge.tsx`
- Create: `apps/web/src/components/theme.ts`

Small, self-contained utilities that later components import. No integration yet.

- [ ] **Step 1: Create `theme.ts` with badge color mappings and helper functions**

Export the following:

```ts
// Badge variant → CSS variable mappings
export type BadgeVariant = 'critical' | 'warning' | 'ownership' | 'coupling' | 'temporal' | 'shame' | 'parallel' | 'stale';

export const badgeStyles: Record<BadgeVariant, { bg: string; fg: string }> = {
  critical:  { bg: 'var(--red-bg)',    fg: 'var(--red-fg)' },
  warning:   { bg: 'var(--amber-bg)',  fg: 'var(--amber-fg)' },
  ownership: { bg: 'var(--purple-bg)', fg: 'var(--purple-fg)' },
  coupling:  { bg: 'var(--blue-bg)',   fg: 'var(--blue-fg)' },
  temporal:  { bg: 'var(--teal-bg)',   fg: 'var(--teal-fg)' },
  shame:     { bg: 'var(--red-bg)',    fg: 'var(--red-fg)' },
  parallel:  { bg: 'var(--amber-bg)',  fg: 'var(--amber-fg)' },
  stale:     { bg: 'var(--bg3)',       fg: 'var(--fg3)' },
};

// Hotspot category → bar/badge color
export function hotspotColor(category: string): string
// returns var(--red) for critical, var(--amber) for warning, var(--teal) for moderate/low

// Age status → color
export function ageColor(status: string): string
// returns var(--teal) for fresh, var(--amber) for aging, var(--red) for stale, var(--fg3) for ancient

// Cluster dimension → badge variant
export function clusterVariant(dimension: string): BadgeVariant
// structural → temporal, ownership → ownership, temporal → warning, coupling-hub → coupling

// Format large numbers with locale separators
export function fmt(n: number): string
// returns n.toLocaleString()

// Extract filename from path
export function fileName(path: string): string
// returns last segment after /

// Extract directory from path (everything before last /)
export function filePath(path: string): string
// returns everything before the last /
```

- [ ] **Step 2: Create `Badge.tsx`**

A small inline-block pill component:

```tsx
import { badgeStyles, type BadgeVariant } from './theme';

export default function Badge({ variant, children }: { variant: BadgeVariant; children: React.ReactNode }) {
  const style = badgeStyles[variant];
  return (
    <span style={{ backgroundColor: style.bg, color: style.fg }}
      className="inline-block text-[10px] font-medium px-[7px] py-[2px] rounded-[3px] tracking-[0.02em]">
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web typecheck`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/Badge.tsx apps/web/src/components/theme.ts
git commit -m "feat(web): add Badge component and theme helpers

Reusable badge with semantic color variants (critical, warning, ownership,
coupling, temporal, shame, parallel, stale). Theme helpers for hotspot colors,
age colors, cluster dimension mapping, and formatting utilities."
```

---

## Task 3: Stats Bar

**Files:**
- Create: `apps/web/src/components/StatsBar.tsx`

The 5-cell metric grid at the top of the dashboard (matching mockup).

- [ ] **Step 1: Create `StatsBar.tsx`**

Props: `{ report: GitloreReport }`

Five cells (left to right, matching mockup):
1. **Critical Hotspots**: `report.hotspots.topHotspots.filter(f => f.category === 'critical').length` — color `var(--red)`
2. **Warnings**: `report.hotspots.topHotspots.filter(f => f.category === 'warning').length` — color `var(--amber)`
3. **Cursed Files**: `report.cursedFiles.length` — color `var(--amber)`
4. **Bus Factor Risk**: `report.busFactors.criticalFiles.length` — color `var(--red)`
5. **Ghost Authors**: `report.contributors.ghostContributors.length` — color `var(--fg3)`

Layout: CSS grid `repeat(5, 1fr)`, gap `1px`, background `var(--border)`. Each cell has background `var(--bg)`, padding `14px 16px`. Label is 11px uppercase `var(--fg3)` with `letter-spacing: 0.08em`. Value is 22px weight 500, colored by severity as listed above. Use outer `border-radius: 8px` with `overflow: hidden` on the grid container.

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/StatsBar.tsx
git commit -m "feat(web): add StatsBar component

Top-level metric grid: critical hotspots, warnings, cursed files,
bus factor risk, ghost authors."
```

---

## Task 4: Hotspot Table (Centerpiece)

**Files:**
- Create: `apps/web/src/components/HotspotTable.tsx`

The main ranked file table with inline signal badges. This is the most complex component — each row synthesizes data from multiple analyzers.

- [ ] **Step 1: Create `HotspotTable.tsx`**

Props: `{ report: GitloreReport }`

**Signal badge logic per file:** For each hotspot entry, look up the file across multiple reports to determine which badges to show:

```
- Category badge: 'critical' or 'warning' from hotspot category (skip moderate/low)
- Ownership badge: "{N} authors" from busFactors.files where uniqueAuthors >= 3, variant 'ownership'
- Coupling badge: "coupling hub" if file appears in coupling.topPairs, variant 'coupling'
- Cluster badge: "{N} clusters" if file appears in hotspotClusters.multiSignalFiles, variant 'coupling'
- Temporal badge: month of churn inflection from hotspotClusters.clusters where dimension='temporal', variant 'temporal'
- Shame badge: "fix churn" if file appears in forensics.shameLeaderboard with shameScore > 30, variant 'shame'
- Parallel badge: "parallel dev" if file appears in parallelDev.hotFiles, variant 'parallel'
```

Build lookup maps once at the top of the component (not per-render — use `useMemo`):
- `busFactorMap`: Map<string, FileBusFactor> from `report.busFactors.files`
- `churnMap`: Map<string, FileChurn> from `report.churn.files` — needed for raw `commitCount` in the Churn column
- `shameMap`: Map<string, FileForensics> from `report.forensics.files`
- `parallelMap`: Set<string> from `report.parallelDev.hotFiles`
- `couplingSet`: Set<string> from `report.coupling.topPairs` (both fileA and fileB)
- `multiSignalMap`: Map<string, MultiSignalFile> from `report.hotspotClusters.multiSignalFiles`

**Table columns** (from spec):
| Column | Width | Content |
|--------|-------|---------|
| File | ~50% | `fileName(f.file)` in mono 12px + `filePath(f.file)` below in 11px `var(--fg3)` |
| Signals | flex | inline Badge components |
| Score | 80px | 4px colored bar + number in mono |
| Churn | 50px | raw commit count from `churnMap.get(f.file)?.commitCount` in mono (NOT `churnScore`) |
| LOC | 50px | `f.loc` in mono |
| Severity | auto | Badge with category text |

Table header row: 11px uppercase `var(--fg3)`, `letter-spacing: 0.06em`.
Row separators: `0.5px solid var(--border)`, no zebra striping.
Score bar: 4px tall, width proportional to score, color from `hotspotColor(category)`.

Data source: `[...report.hotspots.files].sort((a, b) => b.hotspotScore - a.hotspotScore).slice(0, 50)` — explicitly sort rather than relying on insertion order.

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/HotspotTable.tsx
git commit -m "feat(web): add HotspotTable with inline signal badges

Ranked file table synthesizing hotspot, bus factor, coupling, shame,
parallel dev, and cluster data into per-row signal badges."
```

---

## Task 5: Contributors Section

**Files:**
- Create: `apps/web/src/components/ContributorsSection.tsx`

- [ ] **Step 1: Create `ContributorsSection.tsx`**

Props: `{ report: GitloreReport }`

Section label: "CONTRIBUTORS — OWNERSHIP CONCENTRATION" in 11px uppercase `var(--fg3)`, `letter-spacing: 0.08em`.

Show top contributors (up to 8) from `report.contributors.contributors` sorted by `c.commitCount` descending. Each row:
- 24px avatar circle: colored background from a deterministic palette based on initials, 10px white initials text
- Name: `c.name` in 13px regular `var(--fg)`
- Stats: 11px mono `var(--fg3)` — `c.commitCount` commits, `c.filesOwned` files. If contributor owns hotspot files, show the hotspot ownership percentage in `var(--red)` (compute: count files in `report.hotspots.topHotspots` where `report.busFactors.files` has this contributor as `dominantAuthor`, divided by total topHotspots)

Footer line: "{N} active · {N} ghosts ({N}+ days)" in `var(--fg3)`.

Avatar color: derive from first character of the name using a small palette of the accent colors (rotate through red, amber, teal, blue, purple).

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ContributorsSection.tsx
git commit -m "feat(web): add ContributorsSection with avatar circles

Top contributors with commit count, files owned, and hotspot ownership
percentage."
```

---

## Task 6: Bus Factor Section

**Files:**
- Create: `apps/web/src/components/BusFactorSection.tsx`

- [ ] **Step 1: Create `BusFactorSection.tsx`**

Props: `{ report: GitloreReport }`

Section label: "BUS FACTOR RISK — SINGLE-OWNER FILES" in 11px uppercase `var(--fg3)`, `letter-spacing: 0.08em`.

Header line: "{N} files owned by a single author" in `var(--fg)`.

List the top single-owner files (from `report.busFactors.criticalFiles`, up to 8). Each row:
- File path in mono 12px `var(--fg)`
- Dominant author percent on the right in `var(--red)` (e.g., "100%")

Footer: identify the most at-risk directory — find the directory with the most critical bus factor files and show "{directory} is most at risk".

Rows separated by `0.5px solid var(--border)`.

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/BusFactorSection.tsx
git commit -m "feat(web): add BusFactorSection

Single-owner file list with ownership percentages and most-at-risk
directory identification."
```

---

## Task 7: Restyle HotspotClusters

**Files:**
- Modify: `apps/web/src/components/HotspotClusters.tsx`

- [ ] **Step 1: Restyle `HotspotClusters.tsx` to match new design**

Update to use CSS custom properties instead of Tailwind dark-mode classes. Changes:

- Replace `dimensionBadge` record to use the `Badge` component with `clusterVariant()` from `theme.ts`
- Cluster card: `background: var(--bg2)`, `border-radius: 6px`, padding `12px 14px`
- Each card shows: badge + label line (default collapsed), expandable to show 1-line description in `var(--fg2)` and flex-wrap row of file chips
- Keep collapsible behavior per spec: show badge + label + score by default, expand to show file list on click. Restyle the existing `Collapsible` to use `var(--bg2)` / `var(--fg)` / `var(--fg3)` instead of gray-800/900
- Remove multi-signal files section (that data is now shown as badges in the HotspotTable)
- File chips: mono 10px, `background: var(--bg)`, `color: var(--fg2)`, `border-radius: 3px`, padding `2px 6px`
- Score text: `var(--fg3)`

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/HotspotClusters.tsx
git commit -m "style(web): restyle HotspotClusters for new dashboard design

CSS custom properties, Badge component, simplified card layout without
collapsible wrapper."
```

---

## Task 8: Age Distribution

**Files:**
- Create: `apps/web/src/components/AgeDistribution.tsx`

- [ ] **Step 1: Create `AgeDistribution.tsx`**

Props: `{ report: GitloreReport }`

Section label: "CODEBASE AGE — {N} FILES UNTOUCHED {N}+ DAYS" in 11px uppercase `var(--fg3)`, `letter-spacing: 0.08em`. Compute the untouched count from `report.ageMap.ancientFiles.length` and days from the oldest ancient file's `ageInDays`.

4-cell grid, same technique as StatsBar (grid with 1px gap, border background, `border-radius: 8px`, `overflow: hidden`). Values:
- Fresh count: `report.ageMap.files.filter(f => f.status === 'fresh').length` — colored `var(--teal)`
- Aging count: `report.ageMap.files.filter(f => f.status === 'aging').length` — colored `var(--amber)`
- Stale count: `report.ageMap.files.filter(f => f.status === 'stale').length` — colored `var(--red)`
- Ancient count: `report.ageMap.files.filter(f => f.status === 'ancient').length` — colored `var(--fg3)`

Labels below values in 11px uppercase `var(--fg3)`.

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/AgeDistribution.tsx
git commit -m "feat(web): add AgeDistribution component

4-cell grid showing fresh/aging/stale/ancient file counts."
```

---

## Task 9: Shame Section

**Files:**
- Create: `apps/web/src/components/ShameSection.tsx`

- [ ] **Step 1: Create `ShameSection.tsx`**

Props: `{ report: GitloreReport }`

Section label: "SHAME — FILES WITH REPEATED FIX COMMITS" in 11px uppercase `var(--fg3)`, `letter-spacing: 0.08em`.

Show top shame files (from `report.forensics.shameLeaderboard`, up to 6). Each row:
- File path in mono 12px `var(--fg)`
- `f.shameScore` on the right in `var(--red)`

Footer: "`report.forensics.totalShameCommits` shame commits total" in `var(--fg3)`.

Rows separated by `0.5px solid var(--border)`.

- [ ] **Step 2: Verify typecheck**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ShameSection.tsx
git commit -m "feat(web): add ShameSection component

Compact shame leaderboard showing top files with repeated fix commits."
```

---

## Task 10: Dashboard Assembly and App Update

**Files:**
- Rewrite: `apps/web/src/components/Dashboard.tsx`
- Modify: `apps/web/src/App.tsx`

This is the integration task — wire all the new components into the page layout.

- [ ] **Step 1: Rewrite `Dashboard.tsx`**

Props: `{ report: GitloreReport }`

Layout (top to bottom, all in a single scrollable page with `max-width: 1400px` centered):

**Header:**
- Repo name: 18px weight 500 `var(--fg)`
- Subtitle: "git archaeology" in 13px mono `var(--fg3)`
- Meta stats inline: "{commits} commits · {files} files · {authors} authors · {age}y · {language}" in 13px `var(--fg3)`

**Nav:**
- Three text links: "Dashboard" (active), "Coupling graph", "Age map"
- Active: `var(--fg)` with `1.5px solid var(--fg)` bottom border
- Inactive: `var(--fg3)` with transparent bottom border
- Coupling graph and Age map are non-functional placeholders for now (just styled, no click handler needed beyond showing they exist)

**Section dividers:** `0.5px solid var(--border)` with `1.5rem` vertical margin

**Body (in order):**
1. `<StatsBar report={report} />`
2. Section label "HOTSPOT FILES — RANKED BY COMPOSITE RISK" + `<HotspotTable report={report} />`
3. Three-column grid (`grid-cols-3`):
   - `<ContributorsSection report={report} />`
   - `<HotspotClusters data={report.hotspotClusters} />`
   - `<BusFactorSection report={report} />`
4. Two-column grid (`grid-cols-[1fr_1fr]`):
   - `<AgeDistribution report={report} />`
   - `<ShameSection report={report} />`

**Footer:**
- "GitLore — git archaeology" in 11px `var(--fg3)`, centered, with top border

Delete all old tab components (OverviewTab, ChurnTab, ContributorsTab, CursedTab, AgeTab, CouplingTab, ShameTab, ParallelTab) and all old helper functions (churnDot, churnBar, churnBadge, ageColor, reasonBadge, ageBorder, hotspotDot, hotspotBar, hotspotBadge, shameKeywordBadge, Stat, Card, Collapsible).

- [ ] **Step 2: Update `App.tsx` loading and error states**

Replace Tailwind dark-mode classes with CSS custom property references:
- Loading state: use `var(--fg3)` for text, `var(--fg2)` for the pulsing icon
- Error state: use `var(--red)` for error text, `var(--fg3)` for hint text, `var(--purple)` for the code element
- Background: remove inline `min-h-screen` bg colors — the body styles from `index.css` handle it

- [ ] **Step 3: Build and verify**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Verify typecheck**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm --filter @gitlore/web typecheck`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Dashboard.tsx apps/web/src/App.tsx
git commit -m "feat(web): assemble redesigned dashboard

Single-page synthesized layout replacing 8-tab system. Header with
repo meta, stats bar, hotspot table with signal badges, three-column
contributors/clusters/bus-factor section, age distribution and shame
footer."
```

---

## Task 11: Visual QA and Polish

**Files:**
- May touch any of the above files

This is the manual verification and polish pass.

- [ ] **Step 1: Build and serve the dashboard**

Run: `cd /Users/tracericochet/Desktop/nebulord/gitlore && pnpm build`

Then run against a real repo to generate a report and serve it:
```bash
node apps/cli/dist/index.js --path /Users/tracericochet/Desktop/nebulord/gitlore --web
```

Open the browser and compare against the mockup at `redesign-assets/Mockup.png`.

- [ ] **Step 2: Check light and dark themes**

In browser devtools, toggle `prefers-color-scheme` between light and dark. Verify:
- All text is readable in both themes
- Badges have sufficient contrast
- Borders are visible but subtle
- No hardcoded colors leaking through (search for any remaining `text-gray-*`, `bg-gray-*`, `text-red-*`, etc. Tailwind classes that bypass the CSS variables)

- [ ] **Step 3: Verify responsive behavior**

Check at common widths:
- 1440px+ (widescreen) — full layout as designed
- 1024px — three-column section should still work
- 768px — may need to stack columns

- [ ] **Step 4: Fix any issues found and commit**

```bash
git add -A apps/web/src/
git commit -m "style(web): visual QA polish for dashboard redesign"
```
