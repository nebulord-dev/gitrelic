# GitRelic — Claude Code Guide

## Project Overview

**GitRelic** is a git archaeology CLI. It analyzes a git repository's _history_ to surface churn patterns, bus factor risks, file age, contributor profiles, and "cursed files" — files at the intersection of high churn, concentrated ownership, and age anomalies.

## Monorepo Architecture

pnpm workspace + Turbo. Strict dependency order:

```
@gitrelic/core (foundation — private)
    ↓
@gitrelic/scene       (framework-free browser derivations — private, ships TS source)
    ↓
gitrelic              (CLI, the only published package; bundles core inline)
@gitrelic/web         (classic browser dashboard; served by CLI --web flag)
@gitrelic/atlas       (Svelte 5 dashboard replacing web — private; served by CLI --ui atlas)
@gitrelic/docs        (VitePress site; deploys separately via .github/workflows/docs.yml)
```

Workspace names in `pnpm --filter <n>` commands: `@gitrelic/core`, `@gitrelic/scene`, `gitrelic` (NOT `@gitrelic/cli`), `@gitrelic/web`, `@gitrelic/atlas`, `@gitrelic/docs`.

## Package Breakdown

### `packages/core` — Analysis Engine

- `src/runner.ts` — orchestrates all analyzers, entry point is `runGitrelic()`
- `src/types.ts` — all TypeScript interfaces (`GitrelicReport`, `ChurnReport`, etc.)
- `src/utils/git.ts` — raw git primitives (parsing `git log`, `Co-authored-by` trailers via git's native trailer parser into `RawCommit.coAuthors`). The runner resolves `--branch` once (`resolveCommit`) and reads files (`git ls-tree`) and LOC (`git cat-file --batch`) from that commit, never the working copy: uncommitted edits don't count, and Git LFS files count their pointer, not the smudged content.
- `src/utils/identity.ts` — `mergeIdentities()`: runs in `runner.ts` right after `getAllCommits` (which reads `%aE|%aN`, so `.mailmap` already applies) and folds one person's split emails (case variants, GitHub noreply logins, same multi-word name) into a canonical identity. Every analyzer and `report.commits` see canonical emails; merges are listed in `report.identities`. Bots/AI never merge by name. Disable with `RunGitrelicOptions.mergeIdentities: false`.
- `src/utils/fileClass.ts` — `classifyFile()`: `source | test | fixture | generated` by path (precedence generated > fixture > test). The runner records non-source files in `report.fileClasses` and keeps fixture/generated files out of bus factor's input by default (so ghost files, knowledge concentration, hotspot clusters and `filesOwned` inherit it; cursed files gets the excluded set explicitly, since its candidates also come from churn); counts land in `busFactors.excluded`. `includeFixtures` / `--include-fixtures` opts back in. The dashboards use `makeFileKind` from `@gitrelic/scene` (source / test-incl-fixture / generated), which prefers `fileClasses` and falls back to `isTestPath` for reports without it.
- `src/utils/authorClassification.ts` — pure-function AI/bot/human classifier (Claude / Copilot / Aider / Devin / Cursor + dependabot / renovate / semantic-release / github-actions). Shared infrastructure; consumed by co-author and by cursed-files, which uses it to withhold files whose churn is majority bot-authored. Use `classifyAuthor`, not `isBotEmail`, when AI commits should count as human — only the former checks AI patterns first.
- `src/analyzers/` — 22 analyzers, each with a corresponding `.test.ts`:
  - `churn.ts` — file churn frequency analysis
  - `bus-factor.ts` — ownership concentration per file
  - `age-map.ts` — last-commit age per file
  - `contributors.ts` — per-author stats and profiles
  - `cursed-files.ts` — cross-analyzer risk scoring; withholds majority-bot churn
  - `forensics.ts` — commit message shame scoring
  - `parallel-dev.ts` — multi-author overlap detection per week
  - `loc.ts` — lines of code + language breakdown
  - `hotspot.ts` — churn × LOC composite scoring
  - `coupling.ts` — co-change frequency between file pairs
  - `churn-velocity.ts` — accelerating vs decelerating churn
  - `rewrite-ratio.ts` — insertion/deletion balance
  - `blast-radius.ts` — co-changed file count per commit
  - `dead-code.ts` — ancient + untouched file candidates
  - `test-coverage.ts` — test file proximity proxy
  - `ghost-files.ts` — files owned by inactive authors
  - `knowledge-concentration.ts` — single-author file ratio
  - `co-author.ts` — AI adoption + human pair-programming attribution from `Co-authored-by:` trailers
  - `hotspot-clustering.ts` — multi-dimensional hotspot grouping
  - `complexity-trend.ts` — monthly file growth curves
  - `commit-timing.ts` — late-night/weekend stress patterns
  - `rename-tracking.ts` — file rename chain detection

### `packages/scene` — Shared Browser Derivations

Pure TypeScript that turns a `GitrelicReport` into what a dashboard shows: `normalizeReport`, the `*ByDirectory` aggregations, ownership rankings, AI/bot author classification, `makeFileKind`, `fileFacts` (the file inspector's rows, with semantic tiers rather than colors), the other inspector cards' data (`personFacts`, `dirFacts`, `fileContributors`, `coupledWith`), `weeklyActivity` / `weeklyHits` / `touchesEntity` / `previousNamesOf` (the time strip's weeks and the selection's share of them; a renamed file matches under its old paths too), `headcountTier`, swimlane/weekly binning, the co-author graph, and the theme contract (`THEMES`, `THEME_TOKENS`). Both dashboards import it.

- **The scene model** (`model.ts`, `ids.ts`): layouts are pure `(ViewInput, Viewport) => Scene` functions; a `Scene` is marks, links and guides in world units. Marks share one flat geometry record (`MarkGeom`) whatever their shape, and are painted with theme roles (`Paint`), never colors, so a theme switch re-tints without a rebuild. Every mark is keyed by an entity id (`file:`, `dir:`, `person:`, `cell:`, `week:`, `commit:`, `analyzer:`, `repo`) that stays the same across views — that's what lets a mark travel between layouts. `parentOf` derives ancestry from the id. Layout tests run `checkScene` (finite numbers, unique ids, links between existing marks, marks inside bounds).
- **Motion and labels** are planned here, run in Atlas: `motion/plan.ts` `planTransition(next, live)` matches marks by id against what is on screen now (including mid-flight values, so interruptions continue smoothly): leaving links retract, marks move, entering marks grow from their nearest ancestor on screen, leaving ones shrink into their nearest ancestor in the next scene (a mark with `foldOnExit`, like a fan's, first closes into its ancestor where it is now), and new links draw in, staggered, from 250 ms into the move. Guides fade in and out, and one that stays (same id) moves with the marks. Each step starts once the one before is mostly done (`TIMING.retractLead`, `foldLead`, `drawAfter`), never waiting out an out-cubic tail: a still stage after a click reads as a stall. Reduced motion makes everything a fade. `labels/plan.ts` `planLabels` is greedy priority culling over a grid hash (cap 150; pinned labels always shown).
- **Views:** `views/index.ts` `VIEWS` maps each Atlas lens to its `AnalyzerView` (a test keeps it in step with `catalog.atlas`). The first is `views/overview.ts`: the Repo map lens drawn by `layouts/ring.ts`. The ring's data is `overview/readings.ts` (`lensReadings`: a short reading and an outlier grade per lens) and `overview/topEntities.ts` (`lensTopEntities`: a lens's top entities for the fan-out, only ids the index resolves). `ViewInput` carries `focus` (the shell's choice of what to fan) and `index`. The second is `views/hotspots.ts`: the field (`layouts/field.ts`) and By package (`layouts/packages.ts`), fed by `hotspots/points.ts` (`hotspotPoints`, memoised per report as `hotspotPointsOf`; `hotspotScale` recovers core's score curve); a selected file fans out its `hotspots/facets.ts` `fileFacets` beside a narrowed field. The third is `views/churn.ts`: the per-package swarm (`layouts/swarm.ts`), fed by `churn/swarm.ts` (`churnSwarmOf`: source files by package with commits, lines and a character), with lockstep groups from coupling. The selected file's **What to do** is `advice/whatToDo.ts`: a priority-ordered rule table over the analyzers' signals (thresholds named beside the rules), at most three actions, each with its evidence and the inspector section that shows it. A `Mark` may carry `tip` (the hover tooltip's plain-text lines) and an `AnalyzerView` a `table` (`LensTable`, for the table drawer). A `Layout` declares `caption` (the stage's how-to-read line) and `focusKinds` (the selection kinds it re-forms around; any other selection gives it no focus, so it isn't rebuilt per click). Layout-only marks (axis ticks, callouts, density bins, package names) use ids outside the entity kinds (`tick:`, `callout:`, `bin:`, `package:`, the fan's `facet:` and `home:`…): the index never resolves them, so clicking one selects nothing. A mark's `labelAnchor` picks its label's side.
- **Navigation data:** `catalog.ts` lists all 23 presets (label, group, docs path, one-line explanation, `atlas` flag) in lens order, with `lensesOf(view)`, `defaultLens(view)` (a view's first lens with an Atlas view) and `isPresetGroup` (a type guard for hash values); a web test (`catalogParity.test.ts`) keeps it in step with classic's registry. `badges.ts` `outlierGrades` grades each rule 0–3 against repo size (thresholds in one `RULES` table) and `computeOutlierBadges` is grade ≥ 2 — never on max-normalized scores, whose top tier always has members. Stale Files has no rule (its count measures the window). `entities.ts` indexes analyzers, people, directories and files by entity id; `search/rank.ts` is the palette's fuzzy ranker.
- **Commit-based derivations take `CommitLike[]`**, not `RawCommit[]`. Classic adapts `report.commits` with `fromRawCommits`; Atlas adapts the columnar `/gitrelic-commits.json` with `fromCommitIndex`.

- **No build step.** `exports` points at `src/index.ts`; each consumer's bundler compiles it. Turbo still hashes scene's files into dependents' build hashes, so the cache stays correct without a `build` script.
- **No framework, no Node, no DOM.** Its tsconfig has `lib: ES2022` with no `types`, and an oxlint override bans `react`, `svelte` and `node:*` imports. It has no runtime dependencies.
- Imports from `@gitrelic/core` are `import type` only, like any browser code.
- Tests sit next to each file (`*.test.ts`); run with `pnpm --filter @gitrelic/scene test`.
- `test/fixtures/report.small.json` + `commits.small.json` — the deterministic sample repo's report and commit index, used by scene tests and the Atlas dev server. Regenerate with `node scripts/make-scene-fixtures.mjs` (needs a built core); a scene test fails when the fixture lacks a field `normalizeReport` backfills.

### `apps/cli` — Terminal Interface (published as `gitrelic` on npm)

- `src/index.tsx` — Commander entry, Ink render, `--web` / `--ui` / `--no-open`
- `src/server.ts` — the dashboard HTTP server: dashboards mounted by URL prefix (`--ui atlas` puts Atlas at `/` and classic at `/classic/`), the JSON endpoints at the root, Host-header and traversal guards
- `src/components/App.tsx` — root Ink component (loading → results)
- `scripts/copy-web-dist.mjs` — tsdown `onSuccess` hook: copies `apps/web/dist` → `apps/cli/dist/web` and `apps/atlas/dist` → `apps/cli/dist/atlas` so both dashboards ship inside the published tarball
- `tsdown.config.ts` — `deps.alwaysBundle: ['@gitrelic/core']` inlines core's source into the CLI bundle (core stays private)

### `apps/web` — Web Dashboard (classic)

> **Migration note:** a new dashboard, **Atlas** (Svelte 5, `apps/atlas` + `packages/scene`), is being built alongside this one and will replace it. Everything in this section and in [Web Styling](#web-styling) applies to the **classic React app only**. Don't carry its React/Tailwind conventions (`cn()`, `classMaps.ts`, `style={{}}` carve-outs, the disabled theme toggle) into Atlas code.

- `src/App.tsx` — loads `/gitrelic-report.json`, normalizes missing fields via `normalizeReport` (from `@gitrelic/scene`), then renders `Shell`
- `src/components/layout/Shell.tsx` — top-level layout (sidebar + top bar + main pane + bottom panel + inspector)
- `src/components/layout/Sidebar.tsx` — left nav, switches between overview and tab modes
- `src/components/layout/BottomPanel.tsx` — routes to the 22 tab components under `components/tabs/`
- `src/components/layout/InspectorPanel.tsx` — drill-down panel for the selected file/contributor/activity
- `src/components/hero/` — D3 visualizations (commit graph, swimlanes, treemaps, force graphs, etc.). Biggest XSS surface — must only use `.text()`, never `.html()`
- `src/components/tabs/` — 22 deep-dive tabs, one per analyzer
- Critical rule: only `import type` from `@gitrelic/core` — see [Browser code imports](#browser-code-imports).
- **Styling:** Tailwind v4 only — see [Web Styling](#web-styling) section below.

### `apps/atlas` — Web Dashboard (Atlas, in progress)

Svelte 5 (runes) + Vite + Tailwind v4. Served by `gitrelic --ui atlas` (implies `--web`) at `/`, with classic under `/classic/`; classic's `useSelection` reads `#preset=<id>` on load, so Atlas can link analyzers it has no view for to `/classic/#preset=<id>` (the rail does that from PR 3.1).

**Read `docs/atlas-views.md` before building or changing a view.** It holds the navigation shape (five group views in the rail, one lens bar of analyzers, corner-toggle forms for the rare alternate picture — never a second tab row), where trend/distribution/leaderboard live (time strip, inspector chart, detail table), the URL fields, and each view's design-checkpoint outcome. Every view starts with a checkpoint with a maintainer, recorded there before it's built.

- `src/App.svelte` — loads `/gitrelic-report.lite.json` via `lib/data/loadReport.ts` (normalized with `normalizeReport`), applies the theme, renders `lib/shell/Shell.svelte` (top bar, collapsible rail, stage, inspector). `loadCommits()` fetches `/gitrelic-commits.json` once, only when a view needs commits.
- `src/lib/state/hash.ts` + `nav.svelte.ts` — the URL hash `#v=&l=&f=&s=&t=` (view, lens, form, selected entity id, time window) and the `Nav` runes class that owns it. Everything read from the hash is checked — a view must be a rail group, a lens an Atlas view (`catalog.atlas`) in that view, a form one its lens declares, a selection one scene's `buildEntityIndex` resolves, (`t`, the time window, is dropped until a lens reads it) — and anything else is dropped, never rendered (the URL is rewritten without it). Defaults (the Overview view, a view's default lens) stay out of the URL. Selecting replaces the history entry; opening a view, lens or form pushes one. `inspectorPref.ts` remembers the collapsed inspector in localStorage, like the theme.
- `src/lib/shell/` — `Rail` (the five views, 56px; a view's dot rolls up its lenses' `computeOutlierBadges`), `LensBar` (the open view's lenses from scene `lensesOf`; those without an Atlas view link to `/classic/#preset=<id>` with ↗), `Inspector` (lens mode with nothing selected, otherwise cards by selection kind; 400px docked from 1200px, a drawer below that; `I` collapses it to a 52px strip), `GuideSheet` (`?`: every analyzer by view, the open lens pinned), `CommandPalette` (⌘K / Ctrl+K / `/`, scene `rankEntities`; an empty query lists analyzers), `Stage`, `TopBar`. `shortcut.ts` `pressed()` is the single-key shortcut test (never while typing in a field).
- `Stage` takes the open layout's `caption` and the lens's docs link (both along its bottom edge), a Fit button (the `0` key's twin), and, for a lens with alternate forms, `FormToggle` in its corner; Shell keeps the primary form out of the URL. Its `frameKey` (lens + form) makes a new picture reframe even after the viewer zoomed (`AtlasStage.show(scene, { reframe })`); a selection re-forming the same picture keeps their zoom.
- `src/lib/table/` — `TableDrawer` (the full-width detail table over the stage: `T`, filter, tier toggles, sortable headers; a row's hover lights its mark through `AtlasStage.hover`, a click selects; Escape closes it first) and `tableRows.ts` (`visibleRows`, `nextSort`; pure). It renders a lens's `AnalyzerView.table`.
- `src/lib/time/` — `TimeStrip` (the shared strip under the stage: commits per week, the selection's weeks lit, following renames; Shell computes the totals once and only the selection's hits per click) and `ActivityStrip`, the bars both it and the inspector's Activity card draw.
- `src/lib/inspector/` — the cards: `RepositoryCard`, `ExplainCard`, `FileCard` (name, folder via `PathText` — breaks only after a slash — then `WhatToDoCard` from scene `whatToDo`, `FlaggedBy` from scene `fileFacts`, people from `fileContributors`, `ActivityCard`, `coupledWith`), `PersonCard` (`personFacts`), `DirCard` (`dirFacts`), `FindingCard` (entity chips only for ids the index knows). Each card is its own `card` surface. Fact tiers colour through the `--risk-*` ramp (`text-risk-0..3`). The inspector wraps names and never truncates them.
- `src/lib/views/fanFocus.ts` — which lens the Overview ring fans (kept while one of its fanned entities is selected). Shell builds the open lens's layout from scene `VIEWS` in a fixed 1200×800 world; the stage fits it.
- `src/lib/engine/` — the canvas engine. `AtlasStage` ties it together (Stage.svelte and the bench are thin shells around it; it frames the first scene with marks and glides the camera to a changed extent until the viewer pans or zooms; a new lens or form reframes regardless): `MarkStore` (marks as structure-of-arrays Float32Arrays in insertion order; `drawOrder` — arcs under the rest, then `z`, then slot — is the one paint order the renderer draws in and the hit test picks by), `TweenEngine` (plays a scene `TransitionPlan` into the store per animation frame, sleeps when idle, injectable `FrameClock` for tests; `repaint` re-tints on a theme switch), `viewport.ts` + `viewportInput.ts` (pan/zoom/fit math and the wheel/drag/pinch/key wiring), `hitTest.ts` (grid-indexed mark picking, polar test for arcs, segment distance for links), `labelLayer.ts` (DOM labels over the canvas via `planLabels`, `textContent` only), `tooltipLayer.ts` (the hovered mark's `tip` lines in a card beside it, updated per frame like the labels, `textContent` only), `themeBridge.ts` (computed CSS tokens → `Palette`; `test/themePalette.test.ts` checks every colour role in both themes parses), `reducedMotion.ts`.
- `src/lib/engine/pixiStage.ts` — the PixiJS v8 (WebGL) renderer behind the `StageRenderer` interface. **Never rebuild display objects per frame:** marks are particles in one `ParticleContainer` sharing one generated sprite atlas (dot, ring, square, halo), links are one custom-shader mesh with per-vertex colour (`linkGeometry.ts` tessellates, pure and tested), arcs (`arcBand.ts`) and guides are a `Graphics` each, re-tessellated only on frames marked dirty. Cards and text are DOM overlays, never canvas. Without WebGL the stage shows a link to classic. Custom GLSL follows Pixi's ES 3.00 convention (`in`/`out`, `out vec4 finalColor`). `pixi.js` is pinned to an exact version on purpose: the link shader's uniform names and `ParticleContainer`'s `dynamicProperties` have shifted between v8 minors, so bump it deliberately and re-run the bench.
- `bench.html` + `src/dev/bench.ts` — the performance gate, dev-only (`/bench.html` on the dev server; the build only takes `index.html`): 5,000 marks and 2,000 curved links morphing grid ↔ fan, a 168-cell arc ring, 300 labels, Interrupt/Theme/Motion buttons, live p50/p95 frame interval and draw CPU. `?morph` and `?glow` set the starting state. Frame timing comes from a rAF probe loop (the browser's frame timestamps), not draw completion. Headless (SwiftShader) numbers are meaningless. The gate: no dropped frames while morphing (p95 interval within the display's refresh, ≤ 16.7 ms at 60 Hz), in both themes, on an M2 MacBook Air with Chrome DevTools' 4× CPU slowdown (standing in for a 2020-era Intel laptop; the per-frame work is CPU-bound).
- `dev/devData.ts` — Vite dev plugin serving both JSON endpoints: the scene fixture by default, or a live analysis with `GITRELIC_DEV_REPO=<path>` (`GITRELIC_DEV_SINCE` defaults to `12 months ago` like the CLI, `all` for full history; needs a built core). Node-side, so it may value-import core.
- Dev port 7778 (`pnpm --filter @gitrelic/atlas dev`); 7777 is classic's and the CLI's.
- `typecheck` is `svelte-check` for `src` plus `tsc -p tsconfig.node.json` for `vite.config.ts`, `dev/` and `test/`, so browser code never sees Node types.
- **No raw HTML.** Report data (commit messages, names, paths) is attacker-influenced; `test/noRawHtml.test.ts` fails on `{@html}`, `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `src`.

### `apps/docs` — VitePress Documentation Site

- `.vitepress/config.ts` — site config, base `/gitrelic/`
- `guide/`, `analyzers/`, `dashboard/`, `advanced/` — content
- Deployed to `nebulord-dev.github.io/gitrelic` via `.github/workflows/docs.yml` on `apps/docs/**` changes to `main`
- **Excluded from root `pnpm build`** — docs has its own deploy workflow. `pnpm docs:dev` / `pnpm docs:build` to work locally.


## IMPORTANT

Add tests to all changes that can benefit from tests.  If a test is deemed not needed, explain why.

## Key Concepts

### Report flow

1. `runGitrelic()` in core runs all analyzers
2. CLI receives `GitrelicReport` and renders Ink UI
3. With `--web` (or `--ui`): CLI starts HTTP server (`apps/cli/src/server.ts`; preferred port 7777), serves the dashboard dist(s) plus three JSON endpoints at the root, each serialized and gzipped once on first request:
   - `/gitrelic-report.json` — the full report (classic dashboard)
   - `/gitrelic-report.lite.json` — the report with `commits: []` (what Atlas loads first)
   - `/gitrelic-commits.json` — `buildCommitIndex(report.commits)`: columnar `CommitIndex` (authors/paths stored once, per-commit UTC offset for local-time views), ~9× smaller than `RawCommit[]`

`node scripts/measure-report.mjs <repo> [--since all]` (after `pnpm build`) prints report size per top-level key — use it before adding anything large to the report.

### Browser code imports

Any code that runs in the browser — `apps/web`, `packages/scene` and `apps/atlas` — may only `import type` from `@gitrelic/core`. An oxlint `typescript/no-restricted-imports` override in `oxlint.config.ts` enforces it (Vite 8 only warns when it externalizes a Node built-in, so the build alone won't catch it). Value imports bundle Node.js modules (execa, `node:fs`) into the browser build and break Vite. The one sanctioned exception is Node-side build tooling (e.g. `apps/atlas/dev/devData.ts`, the Vite dev plugin that calls `runGitrelic` to serve dev data), which never reaches the browser bundle. Scene and Atlas compile with `verbatimModuleSyntax`, so oxlint also requires `import type { X }` over `import { type X }` there: the inline form survives as a side-effect import of core.

### Adding a new analyzer

1. Create `packages/core/src/analyzers/my-analyzer.ts`
2. Export a function `analyzeX(commits, trackedFiles): XReport`
3. Add result to `GitrelicReport` in `types.ts`, and an `EMPTY_*` fallback in `runner.ts` for `safeRun`
4. Call it in `runner.ts` and include in return value
5. Backfill a default in `packages/scene/src/report/normalizeReport.ts` (with a test) — older saved reports lack the field, and the dashboard crashes on `undefined` sections. The same applies to any new top-level `GitrelicReport` field, not just analyzers.
6. Regenerate the scene fixture: `node scripts/make-scene-fixtures.mjs` (after `pnpm --filter @gitrelic/core build`).

### Architectural review

After cross-package changes (new analyzers, new web visualizations, refactors touching multiple packages), invoke the **monorepo-architect** agent (`.claude/agents/monorepo-architect.md`) to validate:

- Dependency direction (core → cli/web, never the reverse)
- Web imports from core are `import type` only (no value imports — they'd bundle Node.js into the browser)
- Git commands are centralized in `utils/git.ts`, not scattered in analyzers (exec-discipline)
- New analyzers are wired into `runner.ts`, typed in `types.ts`, and exported from `index.ts`

### Audit skills

For deeper, package-scoped audits use the `audit-*` skills under `.claude/skills/`. Each one has a targeted checklist and dispatches an appropriate reviewer agent:

- `audit-architecture` — monorepo boundaries, publishing invariant, exec discipline, dependency direction
- `audit-core` — analyzer correctness, runner orchestration, edge cases, cross-platform paths
- `audit-cli` — packaging, Commander flag validation, web server security, Ink patterns
- `audit-web` — import discipline, D3 XSS surface, report loading, large-report performance

Run these before merging large feature branches or when onboarding to a specific package. The `exec-discipline` skill documents the rule that all git subprocess calls must live in `utils/git.ts`.

### Data source

Git is the foundation: `git log` for history, the analyzed commit's tree for files and LOC. External tools are allowed (decided 2026-10-18) where they make an analyzer more robust — e.g. cloc/scc for LOC, git-sizer for repo health. The rules:

- **Optional.** gitrelic installs from npm, so a tool may be missing. Detect it, fall back to the git-only behaviour, and say in the report which source was used. That's a new `GitrelicReport` field, so it gets a `normalizeReport` backfill and a regenerated scene fixture (see Adding a new analyzer, steps 5–6).
- **Reads the analyzed commit, never the checkout.** Like the git-only path, a tool sees the resolved `--branch` commit, so uncommitted edits, untracked files and smudged LFS content never count, and both paths agree on the same repo. Only cloc takes a commit directly (`cloc <sha>` runs `git archive` itself); scc needs a materialised tree, e.g. a temporary directory from `git archive <sha>`. git-sizer measures the whole repository, not a commit, and says so in the report.
- **Centralised.** Tool processes run from `packages/core/src/utils/tools.ts`, never inside analyzers (the same exec discipline as `utils/git.ts`, and the exec-discipline skill allows exactly these two modules). Run them with `execa` argument arrays — never a shell — and timeouts: they come from `PATH` and run against untrusted repos. (`utils/git.ts` doesn't set timeouts today.)
- **Never bundled or downloaded.** Tools are system binaries the user installs. gitrelic doesn't ship them, and doesn't depend on npm packages that bundle one or download it in `postinstall` — that's shipping it in all but name. A wrapper that only calls a binary already on `PATH` is fine, and as a core runtime dep it follows the bundled-deps mirror (see Publishing invariants).
- **Docs move with the first tool.** `apps/cli/README.md` (its intro and the "22 Analyzers" section) and the docs homepage (`apps/docs/index.md`, the "Zero Dependencies" card) still promise no external tools; the PR that integrates the first tool updates all three.

### Publishing invariants

The published `gitrelic` package relies on two invariants that CI enforces. Both are load-bearing — break either one and `npm install gitrelic` crashes at runtime.

1. **Bundled-deps mirror.** `apps/cli/tsdown.config.ts` inlines `@gitrelic/core`'s source via `deps.alwaysBundle`. The bundled code still calls `require('execa')` (and anything else core declares) against the CLI's own `node_modules` — so every runtime dep in `packages/core/package.json` MUST also appear in `apps/cli/package.json` with matching version ranges. The `install-smoke` CI job diffs the two dependency lists and fails on drift.

2. **Published-asset mirror.** `apps/cli/package.json` ships `files: ["dist"]`, so only `dist/` lands in the tarball. The dashboards live at `apps/web/dist/` and `apps/atlas/dist/`, outside the tarball — `scripts/copy-web-dist.mjs` (run as tsdown `onSuccess`) copies them into `apps/cli/dist/web/` and `apps/cli/dist/atlas/` at build time. Without this, `--web` crashes with `ENOENT` on every published version. Turbo orders both dashboard builds first because `apps/cli/package.json` declares `@gitrelic/web` and `@gitrelic/atlas` as `devDependency: workspace:*`. Classic builds with `base: './'` so the same dist works at `/` and under `/classic/`.

Changes to either side (new core dep, removed core dep, web dist layout change) must keep both invariants intact in the same PR.

## Issue tracking

Issues live in Linear under the GitRelic team. Track GitRelic work only in Linear — not Jira, and not a markdown kanban file. The team backlog is hand-ordered
— top of the list is the next thing to work on. When asked "what's next" or
"pick up the next issue," look at the GitRelic backlog (sorted by manual order,
not priority or date) and start with the topmost issue in Todo state.

### Polish Initiative (frozen during the Atlas migration)

**Paused.** Classic hero/bottom-panel polish is on hold while Atlas is built — don't
start `Polish:` tickets without a maintainer confirming. `docs/polish-pattern.md` is now input
to each Atlas view's design checkpoint (what the analyzer must communicate), not a spec
for new React work.

Issues prefixed `Polish: <analyzer>` belong to the Polish Initiative — a forensic pass
to optimize each analyzer's hero graphs and bottom panels. Before working on any
Polish ticket, read `docs/polish-pattern.md` — it maps each analyzer to its decided
bottom-panel form (narrative-KPI, table, etc.) and lists per-analyzer specs. Update
the doc when a polish ticket discovers the spec is wrong or when a new pattern emerges.

## Build Commands

```bash
pnpm build                          # core + cli + web + atlas (apps/docs excluded)
pnpm --filter @gitrelic/core build
pnpm --filter gitrelic build        # NOT @gitrelic/cli — published package is unscoped
pnpm --filter @gitrelic/web build
pnpm --filter @gitrelic/atlas build
pnpm docs:build                     # apps/docs (VitePress) — separate from pnpm build
pnpm dev                            # watch all
```

TypeScript 6 throughout (`tsconfig.base.json` + `pnpm-workspace.yaml` catalog). tsdown bundles core and CLI; Vite bundles web and atlas; VitePress bundles docs.

## Linting & Formatting

oxlint + oxfmt (not ESLint/Prettier). Config at root: `oxlint.config.ts`, `.oxfmtrc.json`.

```bash
pnpm lint                           # run oxlint
pnpm lint:fix                       # auto-fix lint issues
pnpm format                         # format all files with oxfmt
pnpm format:check                   # check formatting without writing
```

Pre-commit hook (husky + lint-staged) runs `oxlint --fix` and `oxfmt` on staged files automatically, `.svelte` included: oxlint checks their `<script>` blocks, and oxfmt formats them through its bundled `prettier-plugin-svelte` (`"svelte": true` in `.oxfmtrc.json`), which is why `svelte` is a root devDependency.

## Testing

```bash
pnpm test                           # build, then run all tests (core + scene + web + atlas + cli)
pnpm test:core                      # core package tests with Vitest UI
pnpm test:scene                     # scene package tests with Vitest UI
pnpm test:web                       # web package tests with Vitest UI
pnpm test:atlas                     # atlas package tests with Vitest UI
pnpm test:coverage                  # coverage report
```

`apps/cli`'s tests are integration tests: they spawn the built binary and
analyze this repo, because the behavior worth pinning there (stdout flushing,
exit codes, stderr/stdout separation) only exists in a real process. That is why
`pnpm test` builds first — running `pnpm -r test` directly on a clean tree fails
with an explicit "Run `pnpm build`" error rather than skipping.

## Running Locally

```bash
node apps/cli/dist/index.mjs --path ~/path/to/any-git-repo
node apps/cli/dist/index.mjs --path ~/path/to/any-git-repo --web
node apps/cli/dist/index.mjs --path ~/path/to/any-git-repo --ui atlas --no-open
node apps/cli/dist/index.mjs --path ~/path/to/any-git-repo --json
```

The built output is `dist/index.mjs` (matches `apps/cli/package.json` `bin` field). To verify the published layout, pack the tarball: `cd apps/cli && pnpm pack && tar -tzf gitrelic-*.tgz` (both `dist/web/index.html` and `dist/atlas/index.html` must be there).

## Dependency Hygiene

GitRelic has three dependency surfaces and each is scanned / updated differently:

1. **Per-package `dependencies` / `devDependencies`** in `packages/core`, `apps/cli`, `apps/web`, `apps/docs`
2. **Workspace catalog** in `pnpm-workspace.yaml` (shared `typescript`, `tsdown`, `vitest`, `@types/*`, etc.)
3. **pnpm overrides** in root `package.json` (narrow pins for security / compat — e.g. `vitepress>vite`)

### `pnpm outdated` vs `taze`

They answer different questions — use both.

- **`pnpm -r outdated`** — "Is my **installed** version behind the latest?" Reads the lockfile. Reports nothing if your declared range (e.g. `^9.5.2`) already resolves to the current latest (`9.6.1`). Great for catching real upgrades available without range-bumping.
- **`pnpm dlx taze -r`** — "Is my **declared range** behind the latest?" Reads `package.json`. Flags `^9.5.2` even if the resolved install is already `9.6.1`, because the floor of the range is stale. Also understands catalog entries. Runs with `npx taze -r` too.

Both tools together give the full picture. Taze also has a known parse error on pnpm's range-selector override keys (`picomatch@>=4.0.0 <4.0.4`) — harmless, the report above the error is complete.

### Bumping

```bash
pnpm -r update --latest <pkg>        # rewrites package.json ranges AND lockfile (-L short form)
pnpm -r up -L --interactive          # pick-list — use this for anything majorish
```

- `pnpm update` (no `--latest`) only refreshes within the existing range — it won't raise the declared floor
- `pnpm -r up -L` does NOT touch the workspace catalog; bump `pnpm-workspace.yaml` by hand (or use taze)
- Overrides in root `package.json` are also invisible to `pnpm update` — edit directly

### Bundled-deps mirror discipline

When bumping any runtime dep in `packages/core`, bump the matching entry in `apps/cli/package.json` in the **same commit**. The `install-smoke` CI job (and the same step in `publish.yml`) compares `name@range` pairs, so a missing dep *or* a drifted range fails the build.

`pnpm -r up -L <pkg>` handles this automatically when both packages declare the dep (common case: `execa`).

### Why `vitepress>vite` is pinned to vite 6

That override is **scoped** — it only pins vite **where vitepress depends on it**, not the top-level vite used by `apps/web`. VitePress 1.x was built against vite 6; vite 7+ has breaking changes VitePress 1.x never absorbed. The lockfile happily holds both `vite@6.4.x` (inside vitepress) and `vite@8.x` (for `apps/web`). Taze will flag the top-level vite range even though the override pins a different vite instance to 6 — that's not drift, it's two separate vites in the graph. Drop the override only when moving to VitePress 2.x (which supports vite 7+).

The heading deliberately says "vite 6" rather than a patch version — the pin gets bumped on every vite 6 security patch, and a version in the heading goes stale immediately.

### Security overrides

`package.json` is JSON and can't hold comments, so the advisory backing each security override is recorded here. Without this table nobody can tell whether a boundary is correct, or when a pin becomes safe to drop.

| Override | Advisories | Drop when |
| --- | --- | --- |
| `ws@>=8.0.0 <8.21.0` | GHSA-96hv-2xvq-fx4p, GHSA-58qx-3vcg-4xpx | `ink` ships a release resolving ws ≥ 8.21.0 |
| `undici@>=6.0.0 <6.28.1` | GHSA-8xcm-r25x-g524, GHSA-m8rv-5g2x-5cg5, GHSA-v3r7-h72x-cjcm, GHSA-35p6-xmwp-9g52, GHSA-g8m3-5g58-fq7m, GHSA-p88m-4jfj-68fv, GHSA-3wwx-pv8p-q78v, GHSA-r53p-7pc4-xj5r, GHSA-rfgv-xxqx-mfg5 | `semantic-release` → `@actions/core` drops undici 6 |
| `undici@>=7.0.0 <7.29.1` | GHSA-4cwx-7wf7-3272, GHSA-jr45-8vmc-qm54, GHSA-hm92-r4w5-c3mj, GHSA-vmh5-mc38-953g, GHSA-pr7r-676h-xcf6, GHSA-3wwx-pv8p-q78v, GHSA-pmjh-fq2x-6v4x, GHSA-r53p-7pc4-xj5r, GHSA-rfgv-xxqx-mfg5, GHSA-3xpg-4rpp-hhhm, GHSA-2jfj-6hjv-fm6j, GHSA-2gqq-gqf2-x968, GHSA-w293-vg96-wgc3, GHSA-8436-99hf-9mmv, GHSA-rx4f-c7p8-82vq | `@semantic-release/github` requires undici ≥ 7.29.1 |
| `js-yaml@>=4.0.0 <4.3.2` | GHSA-5p4m-2wfm-xmqj, GHSA-52cp-r559-cp3m, GHSA-h67p-54hq-rp68, GHSA-2883-xcg3-v3hh | `cosmiconfig` requires js-yaml ≥ 4.3.2 |
| `postcss@>=8.0.0 <8.5.23` | GHSA-fxqj-rqcc-2cmp, GHSA-r28c-9q8g-f849 | vitepress/vue toolchain resolves postcss ≥ 8.5.23 |
| `dompurify@>=3.0.0 <3.4.16` | GHSA-55q2-fjhq-7xh7, GHSA-c2j3-45gr-mqc4, GHSA-p98j-92pf-mc4p, GHSA-6688-9rhm-gjv2 | `mermaid` requires dompurify ≥ 3.4.16 |
| `esbuild@>=0.27.3 <0.28.1` | GHSA-g7r4-m6w7-qqqr | nothing in the tree can match the selector (see below) |
| `vitepress>vite` | GHSA-fx2h-pf6j-xcff, GHSA-v6wh-96g9-6wx3 | moving to VitePress 2.x |

### Ignored advisories

`pnpm.auditConfig.ignoreGhsas` in `package.json` silences advisories that have no usable fix and no reachable attack path. Each one needs a row here, and drops out the moment its condition clears. Don't add to the list just to make `pnpm audit` quiet.

| Advisory | Package / path | Why ignored | Revisit when |
| --- | --- | --- | --- |
| GHSA-vfj7-8cjw-p6xm (high) | `braces` ≤ 3.0.3 via `@semantic-release/git` → `micromatch` | No patched release exists. The DoS needs attacker-controlled glob patterns; the only patterns are the two hardcoded `assets` in `.releaserc.json`, run in CI. | `braces` ships a fix, or `@semantic-release/git` drops micromatch |
| GHSA-238p-pmpm-9mq7 (low) | `katex` < 0.18.2 via `apps/docs` → `mermaid` | Fix is katex 0.18, but mermaid 11 pins `^0.16` — overriding would force a breaking line on it. Docs-site only, needs pre-existing prototype pollution, and we author every diagram. | `mermaid` 11.x widens to katex ≥ 0.18.2, or docs move to mermaid 12 |

**Always bound the lower end at the major.** Write `ws@>=8.0.0 <8.21.0`, never `ws@<8.21.0`. A bare `<X` selector also matches every earlier major, so the override would silently force a major upgrade on any future transitive that pulls an older line — a breaking change disguised as a security pin. Nothing in the tree triggers it today, which is exactly why it would be missed. The `postcss` and `dompurify` entries are narrowed to the 8.x / 3.x lines for this reason even though their advisories nominally cover everything below the patched version.

**The `esbuild` override is a tripwire, not an upgrade.** esbuild is an *optional* `peerDependency` of vite 8, and vite 8 bundles rolldown as its actual bundler — it never calls esbuild. Narrowing the peer range caused pnpm to **drop** esbuild and its 26 `@esbuild/*` platform packages from the vite 8 subtree rather than install 0.28.1. That's the desired outcome (the vulnerable copy is gone, builds verified green), but it means no esbuild in the tree matches the selector anymore. Leave it in place as a guard against a future dep reintroducing a 0.27.x. The separate `esbuild@<0.25.0` floor and the surviving `esbuild@0.25.12` under vite 6 are unrelated and not vulnerable — GHSA-g7r4-m6w7-qqqr starts at 0.27.3.

Regenerate this table from the live feed with:

```bash
gh api repos/nebulord-dev/gitrelic/dependabot/alerts --paginate \
  -q '.[] | select(.state=="open") | "\(.dependency.package.name)\t\(.security_advisory.ghsa_id)\t\(.security_vulnerability.vulnerable_version_range)"' | sort -u
```

## Releases & Versioning

Releases are automated by semantic-release on push to `main` (see `.releaserc.json` and `.github/workflows/publish.yml`). The published package is `gitrelic` on npm (`apps/cli` is `pkgRoot`).

**Pre-1.0 guard:** GitRelic is in pre-alpha and must stay on 0.x. `.releaserc.json` contains a `releaseRules` override on `@semantic-release/commit-analyzer` that reclassifies breaking changes as a **minor** bump instead of major:

```json
["@semantic-release/commit-analyzer", {
  "releaseRules": [
    { "breaking": true, "release": "minor" }
  ]
}]
```

Effect during pre-1.0:

- `fix:` → patch (0.1.0 → 0.1.1)
- `feat:` → minor (0.1.0 → 0.2.0)
- `feat!:` / `chore!:` / `BREAKING CHANGE:` → **minor** (0.1.0 → 0.2.0), not major

**Do not remove this rule casually.** It exists because a single `chore!:` commit (the gitlore→gitrelic rename) once caused semantic-release to jump straight to `v2.0.0`, which had to be unpublished and reset. Remove it only when intentionally cutting `1.0.0`, and do so in the same PR that marks the 1.0 release.

## Atlas Styling

`apps/atlas` uses Tailwind v4 over a CSS-variable theme. None of the classic rules below (`cn()`, `classMaps.ts`, carve-out lists) apply.

- **Themes:** `src/styles/tokens.css` defines every name in `THEME_TOKENS` (`packages/scene/src/theme/tokens.ts`) under `:root[data-theme='glow']` and `:root[data-theme='flat']`. Adding a token means adding it to the list and to both themes; `test/tokens.test.ts` fails otherwise. Token values are literals (no `color-mix` or `var()` chains) so the canvas renderer can read them with `getComputedStyle`. Flat is the default; the viewer's choice is kept in localStorage, not the URL.
- **Tailwind sees only theme roles.** `src/app.css` clears the default palette (`--color-*: initial`) and aliases tokens with `@theme inline` (`bg-bg`, `text-muted`, `bg-accent`, `text-accent-ink`, `border-control-border`, `rounded-chip`…). `panel` and `card` are `@utility` classes for the two surface styles, and `modal` the solid one for dialogs over the stage (Glow's glass surfaces would let the canvas show through).
- **Conditional classes** use Svelte's built-in array/object `class={[...]}` syntax; there is no `cn()` helper.

## Web Styling

> Classic dashboard (`apps/web`) only.

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
