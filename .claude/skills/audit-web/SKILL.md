---
name: audit-web
description: Use when auditing the browser dashboards (apps/web classic and apps/atlas) for Node.js import violations, raw-HTML sinks, XSS in tabs/visualizations rendering git data, D3/SVG rendering bugs with user-controlled values, report loading edge cases, display-fidelity bugs between scanner data and derived UI state, or large-report performance. Run before merging any change that touches apps/web/ or apps/atlas/.
---

# Audit: apps/web + apps/atlas

The browser dashboards: classic (`apps/web`, React + D3) and Atlas (`apps/atlas`, Svelte 5 runes, replacing classic), both fed by `packages/scene`. Two critical constraints: never import values from `@gitrelic/core` (would bundle Node.js into the browser), and never render user-controlled git data (commit messages, file paths, author names) unsanitized — especially inside D3-built SVG nodes, which is the biggest XSS surface in this codebase.

Sections marked **(classic)** apply only to `apps/web`; **(Atlas)** only to `apps/atlas`. Unmarked sections apply to both. Don't carry classic's React/Tailwind conventions into Atlas findings — see CLAUDE.md "Atlas Styling".

## Checklist

### 1. Import Discipline (Critical)

**Rule:** `apps/web`, `apps/atlas` and `packages/scene` may only use `import type` from `@gitrelic/core`. Any value import (functions, classes, constants) pulls in Node.js deps (`execa`, `node:fs`, `node:http`, `node:child_process`) and breaks the browser build. Value imports from `@gitrelic/scene` are fine.

- Run: `grep -rn "from '@gitrelic/core'" apps/web/src apps/atlas/src packages/scene/src` — every match outside `*.test.ts` must be `import type`
- Run: `grep -rn "require('@gitrelic/core')" apps/web/src apps/atlas/src` — must be zero
- **(Atlas)** `import { type X } from '@gitrelic/core'` is a violation under `verbatimModuleSyntax` — it survives as a side-effect import of core. Must be `import type { X }` (oxlint `typescript/no-import-type-side-effects`)
- **(Atlas)** `apps/atlas/dev/devData.ts` value-imports core by design (Node-side Vite dev plugin, never bundled). It's a finding only if anything under `apps/atlas/src/` imports it
- **(Atlas)** `typecheck` runs `svelte-check` on `src` and `tsc -p tsconfig.node.json` on `vite.config.ts`, `dev/` and `test/` — if a browser file gains Node types (`@types/node` in the src tsconfig), that separation is broken
- Check `packages/scene/src/` (shared derivations) and `apps/web/src/utils/` — any constants from core (thresholds, weights, category labels) should be duplicated here intentionally. If they're missing and being imported from core, that's a violation
- Run `pnpm --filter @gitrelic/web build` / `pnpm --filter @gitrelic/atlas build` — a Node.js import usually shows up only as a "Module externalized for browser compatibility" **warning** (Vite 8) while the build succeeds. Read the output; the greps above are the real check

### 2. XSS Surface (Overview) (classic)

The dashboard renders user-controlled data from git: file paths, commit messages, commit hashes, author names/emails, branch names, dates. All of these can contain arbitrary unicode, angle brackets, quotes, or control characters. Review every component that renders report data:

- **Commit messages in `ShameTab`, `CursedFilesTab`, any tab surfacing forensics** — shame narratives include the raw commit message. React's default text-node escaping handles this safely, but verify no raw-HTML escape hatches are in use
- **File paths everywhere** — rendered in most tabs and every D3 hero visualization. Paths can contain characters that look benign as text but behave differently as SVG attribute values (e.g. a literal `">` breaks out of an attribute). See §3 below for the D3-specific rules
- **Author names and emails** — `ContributorsTab`, `CoAuthorsTab`, `OwnershipSunburst`, `OwnershipBubble`, `ContributorSwimlanes`. Same risk as file paths inside D3 text labels
- **Tooltip content** — `components/shared/Tooltip.tsx` and any inline tooltip rendering. Verify they render user data as React text nodes, not via any raw-HTML prop
- **Grep for escape hatches across the package:** search for React's raw-HTML-injection prop (`grep -r "SetInnerHTML" apps/web/src`) and `grep -r "\.innerHTML" apps/web/src` — both must be zero

### 2a. No Raw HTML (Atlas, Critical)

Svelte escapes `{expr}` interpolation, so Atlas's only markup-injection paths are `{@html}`, `.innerHTML`, `.outerHTML` and `insertAdjacentHTML`. `apps/atlas/test/noRawHtml.test.ts` fails on any of them in `src/**/*.{svelte,ts}` (non-test files).

- Confirm the test still exists, still scans `.svelte` and `.ts`, and its regex hasn't been narrowed
- Grep anyway: `grep -rnE "\{@html|innerHTML|outerHTML|insertAdjacentHTML" apps/atlas/src` — zero outside tests
- Any canvas or SVG renderer added to Atlas: text must reach the DOM as text (`textContent`, Svelte interpolation, `fillText`), never parsed as markup. Attribute bindings with report data (`href`, `xlink:href`, `style`) need the same scrutiny classic's D3 code gets
- **The URL hash is untrusted** (`lib/state/hash.ts`, `#v=&l=&s=`). The selection id must be resolved through the entity map, never rendered or used as a lookup key into unvalidated objects — a crafted link is attacker input

### 3. D3 / SVG Rendering with User Data (classic, Critical)

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

### 4. Report Loading (`apps/web/src/App.tsx`, `apps/atlas/src/lib/data/loadReport.ts`, `normalizeReport` in `packages/scene/src/report/`)

Classic's `App.tsx` fetches `/gitrelic-report.json`, parses it, runs it through `normalizeReport`, then renders `Shell`. Atlas's `loadReport.ts` fetches `/gitrelic-report.lite.json` (normalized the same way) and, only when a view needs commits, `/gitrelic-commits.json` — rejecting any `CommitIndex.version` other than 1 at the boundary. Review edge cases for both:

- **404 when opened standalone** (no CLI server) — current error message ("No report found. Run gitrelic --web to generate one.") is fine. Verify the error view still renders, doesn't crash, and doesn't leak the underlying fetch exception
- **Malformed JSON** — `r.json()` rejects. The current catch handler surfaces "Report file is malformed. Re-run gitrelic --web." — verify it still fires rather than falling through to a generic SyntaxError
- **Structurally valid but missing fields** — e.g. a report missing `hotspotClusters` (older CLI version) will crash the corresponding tab. `normalizeReport` backfills empty defaults for missing sections — its field list must stay aligned with `types.ts`. Adding a new analyzer section without also adding a default here causes a silent runtime crash in that tab
- **No report validation beyond normalization** — `as Promise<Partial<GitrelicReport>>` is an unchecked cast. A crafted JSON blob (e.g. loaded into `localStorage` for a share feature, or via a future `?report=...` param) could contain arbitrary data. Verify every consumer handles missing/malformed fields defensively. Consider a minimal shape check in `normalizeReport` itself — it already touches every section
- **Large report, slow network** — the loading state (`◌ Excavating git history...`) renders while the fetch is pending. No timeout — a stalled fetch shows the spinner forever. Acceptable for localhost, worth noting if the dashboard is ever hosted

- **(Atlas)** The commit index is columnar (`authors`/`paths` stored once, indices per commit). Views must decode it through scene's `fromCommitIndex`, not hand-roll index lookups — an out-of-range index in a crafted file should fail cleanly, not render `undefined`

### 4a. Mounting and URLs (classic)

`gitrelic --ui atlas` serves classic under `/classic/` (Atlas at `/`), so classic must not assume it lives at the root.

- `apps/web/vite.config.ts` must keep `base: './'`. Any absolute asset path in `apps/web/src` or `apps/web/index.html` (`/assets/...`, `url(/...)`, `new URL('/x', ...)`) 404s under `/classic/`. The dev-only `src="/src/main.tsx"` in `index.html` is rewritten by Vite at build time
- Data fetches stay root-absolute on purpose: the JSON endpoints are always served at `/` whatever the mounts
- Classic reads `#preset=<id>` on load (`src/presets/presetFromHash.ts`, used by `hooks/useSelection.ts`) — how Atlas links to analyzers it has no view for yet. The hash is user-controlled: the id must be validated against `PRESETS` with `Object.hasOwn` (not `in`, which accepts `__proto__`/`constructor`) and never rendered

### 5. Display Fidelity (Source of Truth)

When components derive UI state from report fields, the display must source each value from the **same place** the signal came from. Mixing an analyzer's raw output with a derived / rolled-up field produces misleading UI without any type error.

- **Canonical risk:** if a tab shows "churn" for a file, the number must come from `report.churn.files[...]` — not from a recomputation in the component using `commits.length`, which drops merges and applies different noise filters
- **File paths in hero visualizations** — if the hero displays a path, it must be the same path string that the analyzer keyed its output on. Normalizing (stripping prefixes, truncating) for display is fine; using a normalized path to look up the underlying data isn't
- **Author identity** — `contributors.ts` canonicalizes authors by email (subject to aliases). If a tab groups activity by name string, it will split single authors who commit from multiple machines with slightly different configs. Always key on the canonical identifier
- **Test construction:** for each derived UI state, construct a test where the raw analyzer output and the component's computed display value are different, and assert the rendered cell shows the analyzer's value

### 6. Large-Report Performance (mostly classic)

Git repos can produce very large reports: thousands of files, tens of thousands of commits, hundreds of contributors. Review:

- Tabs that render the full file list unvirtualized (`HotspotsTab`, `ContributorsTab`, `CursedFilesTab`, `DeadCodeTab`) — do they paginate, virtualize, or cap? A 10k-row table locks the browser on initial render
- `CommitDAG`, `CommitBranches`, `Timeline` — do they downsample for >10k commits, or render every node? D3 force simulations with thousands of nodes freeze the main thread
- `CouplingForceGraph` — N² coupling pairs can explode; the analyzer may already cap, but verify the component doesn't attempt to render more than a useful number
- `useSelection` hook — if state grows to include thousands of selected items, any O(n²) operations will show up in profiler traces
- `normalizeReport` — runs once per report load, synchronously. Verify it's O(n), not O(n²), on report size
- **(Atlas)** `/gitrelic-commits.json` must be fetched once and only by views that need it — a view that triggers `loadCommits()` on every render, or loads the full `/gitrelic-report.json`, defeats the lite/commits split

### 7. Hero Visualization Library Boundaries (classic)

The dashboard uses `d3-force`, `d3-hierarchy`, `d3-scale`, `d3-shape`. These are ESM-only and tree-shakeable. Risks:

- A subcomponent importing `d3` (the umbrella package) instead of `d3-*` submodules balloons the bundle
- Pre-bundled d3 types (`@types/d3-*`) must match the runtime versions; version drift causes TS errors that hide real bugs
- Home-grown reimplementations of force layouts, treemaps, or timelines tend to accumulate UX bugs. If a hero component is >500 LOC of D3 plumbing, consider whether a dedicated library would be smaller and better — precedent: sickbay replaced a home-grown dep graph with a link to Node Modules Inspector

### 8. CSS and Theme Consistency (classic; Atlas themes → CLAUDE.md "Atlas Styling", enforced by `apps/atlas/test/tokens.test.ts`)

`theme.ts` and `index.css` define the visual system. Tailwind v4 is configured via `@tailwindcss/vite`. Lower priority than the XSS sections, but:

- SVG `<text>` elements need explicit `fill` — they don't inherit from CSS `color` in all browsers. Verify heroes set `fill` explicitly (or via a `fill=` attribute on the D3 selection)
- Does any tab hardcode colors instead of pulling from the theme? Inconsistent colors across tabs make the dashboard feel unpolished
- Dark-mode toggle currently hidden (KAN-168 complete). If re-enabled, every hero must be tested in both modes — D3 axes and tooltips often hardcode stroke/fill

### 9. Report Endpoint Contract

Classic fetches `/gitrelic-report.json`; Atlas fetches `/gitrelic-report.lite.json` and `/gitrelic-commits.json` — all from the same origin (the CLI's web server, `apps/cli/src/server.ts`), always at the root regardless of which dashboard is mounted where. This is same-origin, so no CORS surface. But:

- If a dashboard is ever deployed statically (e.g. KAN-83 HTML export, KAN-86 share), the fetch path must be abstracted so static builds can inline the report at build time or fetch from a different URL. Any hardcoded `/gitrelic-report.json` will break the static deploy
- The CLI's web server emits `Content-Type: application/json` for this endpoint — verify the dashboard's fetch handles a missing or unexpected content-type gracefully, since a proxy in the path could strip it

### 10. Component Smell-Test (classic)

Components not otherwise called out that render user-controlled data:

- `Sidebar.tsx`, `TopBar.tsx` — repo name, branch name, date range. Text-node rendering is safe
- `MetricsStrip.tsx` — numeric metrics. Check number formatting doesn't throw on `NaN` or `Infinity`
- `GuidePanel.tsx` — static content; low risk
- `Badge.tsx`, `SortableTable.tsx`, `Tooltip.tsx` — shared components. XSS-free by construction iff consumers pass raw text as children, not markup

## Key Files

```
apps/web/src/
├── App.tsx                          # Report loading — edge cases
├── utils/                           # cn, classMaps, colors (normalizeReport lives in packages/scene/src/report/)
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
├── presets/presetFromHash.ts        # #preset=<id> — untrusted, validated against PRESETS
└── hooks/useSelection.ts            # Selection state — perf with large reports
apps/web/vite.config.ts              # base: './' — classic must work under /classic/

apps/atlas/
├── src/App.svelte                   # Loads the lite report, applies theme, renders Shell
├── src/lib/data/loadReport.ts       # Lite report + lazy commit index — edge cases
├── src/lib/state/hash.ts            # #v=&l=&s= — selection is untrusted
├── src/lib/shell/Shell.svelte       # Top bar, rail, stage, inspector
├── dev/devData.ts                   # Node-side dev plugin — may value-import core
└── test/noRawHtml.test.ts           # Raw-HTML ban over src
```

## Output Format

Dispatched reviewer should report findings as:

```
[Severity: High|Medium|Low] path/to/file.tsx:123
What's wrong: <one-line description>
Why it matters: <impact on users or security>
Suggested fix: <concrete change>
```

Skip visual/styling issues entirely. Prioritize in this order: import discipline → D3 `.html()` calls (classic) / raw-HTML sinks (Atlas) → React raw-HTML-injection escape hatches → untrusted URL hash handling → display-fidelity / source-of-truth → report-loading edge cases → everything else.

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. First action: run the import-discipline grep (§1) across web, atlas and scene and flag any value import. Second: sweep `apps/web/src/components/hero/` for `.html(` on D3 selections (§3) and `apps/atlas/src` for raw-HTML sinks (§2a). Third: grep `apps/web/src` for React's raw-HTML-injection prop name and for any `.innerHTML` assignment. Then work through hash handling (§2a, §4a), report loading, display fidelity, and the component smell-test. Scope to whichever dashboard the branch touched.

## Related Audits

- Changes that touch the CLI's web server, its mounts, or the JSON endpoints → cross-check **audit-cli** (content-type, path traversal, mount routing)
- Changes to constants in `packages/scene/src/` or `apps/web/src/utils/` → verify against core's source (run **audit-core** side-by-side to confirm thresholds haven't drifted)
- New component rendering report fields → consider XSS implications, verify source-of-truth rule, extend this checklist
