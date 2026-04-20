---
name: audit-web
description: Use when auditing apps/web for Node.js import violations, XSS in tabs/visualizations rendering git data, D3/SVG rendering bugs with user-controlled values, report loading edge cases, display-fidelity bugs between scanner data and derived UI state, or large-report performance. Run before merging any change that touches apps/web/.
---

# Audit: apps/web

The browser dashboard. Two critical constraints: never import values from `@gitrelic/core` (would bundle Node.js into the browser), and never render user-controlled git data (commit messages, file paths, author names) unsanitized — especially inside D3-built SVG nodes, which is the biggest XSS surface in this codebase.

## Checklist

### 1. Import Discipline (Critical)

**Rule:** `apps/web` may only use `import type` from `@gitrelic/core`. Any value import (functions, classes, constants) pulls in Node.js deps (`execa`, `node:fs`, `node:http`, `node:child_process`) and breaks the browser build.

- Run: `grep -r "from '@gitrelic/core'" apps/web/src` — every match must be `import type`
- Run: `grep -r "require('@gitrelic/core')" apps/web/src` — must be zero
- Check `apps/web/src/utils/` — any constants from core (thresholds, weights, category labels) should be duplicated here intentionally. If they're missing and being imported from core, that's a violation
- Run `pnpm --filter @gitrelic/web build` — a Node.js import violation fails Vite at build time with a "Module externalized for browser compatibility" error. The error is cryptic; the audit exists partly because this error is easy to miss

### 2. XSS Surface (Overview)

The dashboard renders user-controlled data from git: file paths, commit messages, commit hashes, author names/emails, branch names, dates. All of these can contain arbitrary unicode, angle brackets, quotes, or control characters. Review every component that renders report data:

- **Commit messages in `ShameTab`, `CursedFilesTab`, any tab surfacing forensics** — shame narratives include the raw commit message. React's default text-node escaping handles this safely, but verify no raw-HTML escape hatches are in use
- **File paths everywhere** — rendered in most tabs and every D3 hero visualization. Paths can contain characters that look benign as text but behave differently as SVG attribute values (e.g. a literal `">` breaks out of an attribute). See §3 below for the D3-specific rules
- **Author names and emails** — `ContributorsTab`, `CoAuthorsTab`, `OwnershipSunburst`, `OwnershipBubble`, `ContributorSwimlanes`. Same risk as file paths inside D3 text labels
- **Tooltip content** — `components/shared/Tooltip.tsx` and any inline tooltip rendering. Verify they render user data as React text nodes, not via any raw-HTML prop
- **Grep for escape hatches across the package:** search for React's raw-HTML-injection prop (`grep -r "SetInnerHTML" apps/web/src`) and `grep -r "\.innerHTML" apps/web/src` — both must be zero

### 3. D3 / SVG Rendering with User Data (Critical)

The `components/hero/` visualizations are the biggest XSS surface in the project. D3 builds DOM nodes from commit data; the rule that separates safe from unsafe is which setter is used.

**Rule:** Text inside SVG nodes must go through D3's `.text()` (which creates a text node and HTML-escapes the value), never `.html()` (which parses and executes the value as HTML), and never raw `innerHTML` assignment.

- Run: `grep -rn "\.html(" apps/web/src/components/hero/` — any match on a D3 selection is a potential XSS sink. Inspect each hit to confirm the argument is a static string, not a value derived from the report
- Run: `grep -rn "innerHTML" apps/web/src/` — should be zero; any hit needs scrutiny

Hero components to sweep on every audit, one per analyzer surface:

- `CommitDAG.tsx`, `CommitBranches.tsx`, `CommitGraph.tsx` — commit hashes and messages
- `ContributorSwimlanes.tsx` — author names as row labels
- `OwnershipBubble.tsx`, `OwnershipSunburst.tsx` — file paths and author names as labels
- `ChurnTreemap.tsx`, `HotspotScatter.tsx`, `DebtScatter.tsx`, `RiskHeatmap.tsx` — file paths as labels and tooltip contents
- `CouplingForceGraph.tsx`, `CouplingHeatmap.tsx` — pairs of file paths as labels
- `Timeline.tsx`, `GrowthTimeline.tsx`, `CommitHeatmap.tsx` — dates (safe) and commit messages (unsafe if ever rendered as HTML)

For each: confirm every text binding uses `.text(d => d.label)` or a React text child, never `.html(...)`.

### 4. Report Loading (`apps/web/src/App.tsx` + `utils/normalizeReport.ts`)

`App.tsx` fetches `/gitrelic-report.json`, parses it, runs it through `normalizeReport`, then renders `Shell`. Review edge cases:

- **404 when opened standalone** (no CLI server) — current error message ("No report found. Run gitrelic --web to generate one.") is fine. Verify the error view still renders, doesn't crash, and doesn't leak the underlying fetch exception
- **Malformed JSON** — `r.json()` rejects. The current catch handler surfaces "Report file is malformed. Re-run gitrelic --web." — verify it still fires rather than falling through to a generic SyntaxError
- **Structurally valid but missing fields** — e.g. a report missing `hotspotClusters` (older CLI version) will crash the corresponding tab. `normalizeReport` backfills empty defaults for missing sections — its field list must stay aligned with `types.ts`. Adding a new analyzer section without also adding a default here causes a silent runtime crash in that tab
- **No report validation beyond normalization** — `as Promise<Partial<GitrelicReport>>` is an unchecked cast. A crafted JSON blob (e.g. loaded into `localStorage` for a share feature, or via a future `?report=...` param) could contain arbitrary data. Verify every consumer handles missing/malformed fields defensively. Consider a minimal shape check in `normalizeReport` itself — it already touches every section
- **Large report, slow network** — the loading state (`◌ Excavating git history...`) renders while the fetch is pending. No timeout — a stalled fetch shows the spinner forever. Acceptable for localhost, worth noting if the dashboard is ever hosted

### 5. Display Fidelity (Source of Truth)

When components derive UI state from report fields, the display must source each value from the **same place** the signal came from. Mixing an analyzer's raw output with a derived / rolled-up field produces misleading UI without any type error.

- **Canonical risk:** if a tab shows "churn" for a file, the number must come from `report.churn.files[...]` — not from a recomputation in the component using `commits.length`, which drops merges and applies different noise filters
- **File paths in hero visualizations** — if the hero displays a path, it must be the same path string that the analyzer keyed its output on. Normalizing (stripping prefixes, truncating) for display is fine; using a normalized path to look up the underlying data isn't
- **Author identity** — `contributors.ts` canonicalizes authors by email (subject to aliases). If a tab groups activity by name string, it will split single authors who commit from multiple machines with slightly different configs. Always key on the canonical identifier
- **Test construction:** for each derived UI state, construct a test where the raw analyzer output and the component's computed display value are different, and assert the rendered cell shows the analyzer's value

### 6. Large-Report Performance

Git repos can produce very large reports: thousands of files, tens of thousands of commits, hundreds of contributors. Review:

- Tabs that render the full file list unvirtualized (`HotspotsTab`, `ContributorsTab`, `CursedFilesTab`, `DeadCodeTab`) — do they paginate, virtualize, or cap? A 10k-row table locks the browser on initial render
- `CommitDAG`, `CommitBranches`, `Timeline` — do they downsample for >10k commits, or render every node? D3 force simulations with thousands of nodes freeze the main thread
- `CouplingForceGraph` — N² coupling pairs can explode; the analyzer may already cap, but verify the component doesn't attempt to render more than a useful number
- `useSelection` hook — if state grows to include thousands of selected items, any O(n²) operations will show up in profiler traces
- `normalizeReport` — runs once per report load, synchronously. Verify it's O(n), not O(n²), on report size

### 7. Hero Visualization Library Boundaries

The dashboard uses `d3-force`, `d3-hierarchy`, `d3-scale`, `d3-shape`. These are ESM-only and tree-shakeable. Risks:

- A subcomponent importing `d3` (the umbrella package) instead of `d3-*` submodules balloons the bundle
- Pre-bundled d3 types (`@types/d3-*`) must match the runtime versions; version drift causes TS errors that hide real bugs
- Home-grown reimplementations of force layouts, treemaps, or timelines tend to accumulate UX bugs. If a hero component is >500 LOC of D3 plumbing, consider whether a dedicated library would be smaller and better — precedent: sickbay replaced a home-grown dep graph with a link to Node Modules Inspector

### 8. CSS and Theme Consistency

`theme.ts` and `index.css` define the visual system. Tailwind v4 is configured via `@tailwindcss/vite`. Lower priority than the XSS sections, but:

- SVG `<text>` elements need explicit `fill` — they don't inherit from CSS `color` in all browsers. Verify heroes set `fill` explicitly (or via a `fill=` attribute on the D3 selection)
- Does any tab hardcode colors instead of pulling from the theme? Inconsistent colors across tabs make the dashboard feel unpolished
- Dark-mode toggle currently hidden (KAN-168 complete). If re-enabled, every hero must be tested in both modes — D3 axes and tooltips often hardcode stroke/fill

### 9. Report Endpoint Contract

The dashboard fetches `/gitrelic-report.json` from the same origin (the CLI's web server). This is same-origin, so no CORS surface. But:

- If the dashboard is ever deployed statically (e.g. KAN-83 HTML export, KAN-86 share), the fetch path must be abstracted so static builds can inline the report at build time or fetch from a different URL. Any hardcoded `/gitrelic-report.json` will break the static deploy
- The CLI's web server emits `Content-Type: application/json` for this endpoint — verify the dashboard's fetch handles a missing or unexpected content-type gracefully, since a proxy in the path could strip it

### 10. Component Smell-Test

Components not otherwise called out that render user-controlled data:

- `Sidebar.tsx`, `TopBar.tsx` — repo name, branch name, date range. Text-node rendering is safe
- `MetricsStrip.tsx` — numeric metrics. Check number formatting doesn't throw on `NaN` or `Infinity`
- `GuidePanel.tsx` — static content; low risk
- `Badge.tsx`, `SortableTable.tsx`, `Tooltip.tsx` — shared components. XSS-free by construction iff consumers pass raw text as children, not markup

## Key Files

```
apps/web/src/
├── App.tsx                          # Report loading — edge cases
├── utils/
│   └── normalizeReport.ts           # Backfill for missing/older report sections
├── components/
│   ├── layout/
│   │   ├── Shell.tsx                # Top-level layout
│   │   ├── Sidebar.tsx, TopBar.tsx  # Header/nav
│   │   └── BottomPanel.tsx          # Routes 22 tabs
│   ├── tabs/                        # 22 deep-dive tabs — user-controlled text rendering
│   ├── hero/                        # D3 visualizations — biggest XSS surface
│   │   ├── CommitDAG.tsx, CommitBranches.tsx, CommitGraph.tsx
│   │   ├── ContributorSwimlanes.tsx, OwnershipSunburst.tsx, OwnershipBubble.tsx
│   │   ├── ChurnTreemap.tsx, HotspotScatter.tsx, RiskHeatmap.tsx
│   │   └── CouplingForceGraph.tsx, CouplingHeatmap.tsx
│   ├── inspector/                   # File/contributor/activity drill-downs
│   └── shared/Tooltip.tsx           # Generic tooltip — verify text-only
└── hooks/useSelection.ts            # Selection state — perf with large reports
```

## Output Format

Dispatched reviewer should report findings as:

```
[Severity: High|Medium|Low] path/to/file.tsx:123
What's wrong: <one-line description>
Why it matters: <impact on users or security>
Suggested fix: <concrete change>
```

Skip visual/styling issues entirely. Prioritize in this order: import discipline → D3 `.html()` calls → React raw-HTML-injection escape hatches → display-fidelity / source-of-truth → report-loading edge cases → everything else.

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. First action: run the import-discipline grep (§1) and flag any value import. Second: sweep `apps/web/src/components/hero/` for `.html(` on D3 selections (§3). Third: grep the whole package for React's raw-HTML-injection prop name and for any `.innerHTML` assignment. Then work through report loading, display fidelity, and the component smell-test.

## Related Audits

- Changes that touch the CLI's web server or `/gitrelic-report.json` endpoint → cross-check **audit-cli** (CORS parity, content-type, path traversal)
- Changes to `apps/web/src/utils/` constants → verify against core's source (run **audit-core** side-by-side to confirm thresholds haven't drifted)
- New component rendering report fields → consider XSS implications, verify source-of-truth rule, extend this checklist
