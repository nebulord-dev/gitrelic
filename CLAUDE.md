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
- `src/utils/git.ts` — raw git primitives (parsing `git log`, `Co-authored-by` trailers via git's native trailer parser into `RawCommit.coAuthors`). Every call goes through `runGit` (the streaming `cat-file` uses the same options): a time limit (`GIT_QUICK_TIMEOUT_MS` 30 s for lookups, each of fix rate's `blameFixedLines` diff-and-blame calls included, `GIT_HEAVY_TIMEOUT_MS` 10 min for `log`, the rename log, `ls-tree` and `cat-file`, the latter set by `RunGitrelicOptions.gitTimeoutMs` / `--git-timeout`) and `GIT_TERMINAL_PROMPT=0`, so git never waits on a prompt. A limit hit throws `GitTimeoutError`, which fails the run for history, the file list and the repo root, and falls back for check-mailmap (unmapped co-authors), the current branch (`HEAD`), LOC and renames (the analyzer's fallback, with the message on stderr). The runner resolves `--branch` once (`resolveCommit`) and reads files (`git ls-tree`) and LOC (`git cat-file --batch`) from that commit, never the working copy: uncommitted edits don't count, and Git LFS files count their pointer, not the smudged content.
- `src/utils/identity.ts` — `mergeIdentities()`: runs in `runner.ts` right after `getAllCommits` (which reads `%aE|%aN`, so `.mailmap` already applies) and folds one person's split emails (case variants, GitHub noreply logins, same multi-word name) into a canonical identity. Every analyzer and `report.commits` see canonical emails; merges are listed in `report.identities`. Bots/AI never merge by name. Disable with `RunGitrelicOptions.mergeIdentities: false`.
- `src/utils/fileClass.ts` — `classifyFile()`: `source | test | fixture | generated` by path (precedence generated > fixture > test). The runner records non-source files in `report.fileClasses` and keeps fixture/generated files out of bus factor's input by default (so ghost files, knowledge concentration, hotspot clusters and `filesOwned` inherit it; cursed files gets the excluded set explicitly, since its candidates also come from churn); counts land in `busFactors.excluded`. `includeFixtures` / `--include-fixtures` opts back in. The dashboards use `makeFileKind` from `@gitrelic/scene` (source / test-incl-fixture / generated), which prefers `fileClasses` and falls back to `isTestPath` for reports without it.
- `src/utils/authorClassification.ts` — pure-function AI/bot/human classifier (Claude / Copilot / Aider / Devin / Cursor + dependabot / renovate / semantic-release / github-actions). Shared infrastructure; consumed by co-author and by cursed-files, which uses it to withhold files whose churn is majority bot-authored. Use `classifyAuthor`, not `isBotEmail`, when AI commits should count as human — only the former checks AI patterns first.
- `src/analyzers/` — 23 analyzers, each with a corresponding `.test.ts`:
  - `churn.ts` — file churn frequency analysis
  - `bus-factor.ts` — ownership concentration per file
  - `age-map.ts` — last-commit age per file
  - `contributors.ts` — per-author stats and profiles
  - `cursed-files.ts` — cross-analyzer risk scoring; withholds majority-bot churn
  - `forensics.ts` — commit message shame scoring
  - `fix-rate.ts` — changes followed within 30 days by a fix of their lines (fix/revert commits traced with `blameFixedLines` in `utils/git.ts`, a lightweight SZZ); replaces Shame
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

- **The scene model** (`model.ts`, `ids.ts`): layouts are pure `(ViewInput, Viewport) => Scene` functions; a `Scene` is marks, links and guides in world units. Marks share one flat geometry record (`MarkGeom`) whatever their shape, and are painted with theme roles (`Paint`), never colors, so a theme switch re-tints without a rebuild. Every mark is keyed by an entity id (`file:`, `dir:`, `person:`, `cell:`, `week:`, `commit:`, `analyzer:`, `view:`, `repo`) that stays the same across views — that's what lets a mark travel between layouts. `parentOf` derives ancestry from the id. Layout tests run `checkScene` (finite numbers, unique ids, links between existing marks, marks inside bounds).
- **Motion and labels** are planned here, run in Atlas: `motion/plan.ts` `planTransition(next, live)` matches marks by id against what is on screen now (including mid-flight values, so interruptions continue smoothly): leaving links retract, marks move, entering marks grow from their nearest ancestor on screen, leaving ones shrink into their nearest ancestor in the next scene (a mark with `foldOnExit`, like a fan's, first closes into its ancestor where it is now), and new links draw in, staggered, from 250 ms into the move. A mark or link entering in a leaving one's `slot` (same slot, else same group: `fan:3` is in `fan`) takes it over instead: it starts from that one's live geometry, colour or drawn length and moves like an update, and the leaving one goes at once (the fan's entities, lenses and branches morph rather than fold and regrow). Guides fade in and out, and one that stays (same id) moves with the marks. Each step starts once the one before is mostly done (`TIMING.retractLead`, `foldLead`, `drawAfter`), never waiting out an out-cubic tail: a still stage after a click reads as a stall. Reduced motion makes everything a fade. `labels/plan.ts` `planLabels` is greedy priority culling over a grid hash (cap 150; pinned labels always shown).
- **Views** (`views/index.ts` `VIEWS`, kept in step with `catalog.atlas` by a test): one `AnalyzerView` per Atlas lens, its data in a folder memoised per report (`*Of(report)`), drawn by one or more layouts. What each lens shows, its thresholds, tooltips and why: `docs/atlas-views.md`.

  | Lens | View | Layouts (first is primary) | Data |
  |---|---|---|---|
  | Repo map | `views/overview.ts` | `dashboard`, `fan` | `overview/readings.ts`, `overview/topEntities.ts`, `overview/viewHeadlines.ts`, `overview/vitals.ts` (shared parts: `layouts/overviewParts.ts`) |
  | Hotspots | `views/hotspots.ts` | `field`, `packages` | `hotspots/points.ts`, `hotspots/facets.ts` |
  | Churn | `views/churn.ts` | `swarm`, `rhythm` (needs commits) | `churn/swarm.ts`, `churn/lockstep.ts`, `churn/rhythm.ts` |
  | Risk (`cursed-files`) | `views/risk.ts` | `stacks`, `rootCauses` | `risk/stacks.ts`, `risk/rootCauses.ts` |
  | Fix rate (`fix-rate`, Atlas-only) | `views/fixRate.ts` | `funnel` (its lane needs commits) | `fixRate/points.ts` (`aboveChance`, the lens's one threshold; core has the same test) |
  | Contributors | `views/contributors.ts` | `flow`, `lanes` (both need commits) | `contributors/flow.ts`, `contributors/lanes.ts` (bins: `time/bins.ts`, shared with Rhythm) |
  | Parallel Dev | `views/parallelDev.ts` | `pairs`, `collisions` | `parallel/pairs.ts`, `parallel/collisions.ts` (core's `parallelDev.pairs` and per-file `windows`; no commits needed) |

- **The layout contract.** A `Layout` declares `caption` (the stage's how-to-read line) and `focusKinds` (the selection kinds it re-forms around; any other selection isn't rebuilt per click). A `Mark` may carry `tip` (tooltip lines), `labelAnchor`, `labelSub` (a quieter second line), `labelLead` (a short lead before the label, a fan card's number), `labelClass` (a CSS role from Atlas's `app.css`, never a colour) and `labelLean`; a `Link` may set `bow` (an arc's bow as a share of its length), be an `s-curve` (level at both ends) or a `band` (an s-curve whose width is vertical, for a flow), offset its two ends from their marks' centres (`ends`, so bands stack along a node), and carry a `tip` (shown by the pointer when no mark is under it); a circle `Guide` may be dashed (`dash`, screen px). A centred label on a `card` mark with a size is drawn as the card itself (Atlas's label layer). An `AnalyzerView` may carry a `table` (`LensTable`, for the table drawer). Layout-only marks (ticks, callouts, bins, package names, the fan's `facet:`/`home:`…) use ids outside the entity kinds, so clicking one selects nothing unless it names its entity in `selects`; one with `toggles` is a switch, flipping a key in `ViewInput.open` (the shell's open panels) instead. Shape `ring` has a stroke that scales with its radius; `outline` is a thin one for a large circle.
- **What to do** (`advice/whatToDo.ts`): a priority-ordered rule table over the analyzers' signals (thresholds named beside the rules), at most three actions per file, each with its evidence and the inspector section that shows it.
- **Navigation data:** `catalog.ts` lists classic's presets, less those merged into an Atlas lens (`ATLAS_MERGES`; today `risk` → `cursed-files` and `shame` → `fix-rate`) and plus the Atlas-only ones (`ATLAS_ONLY`: `fix-rate`) (label, group, docs path, one-line explanation, `atlas` flag) in lens order, with `lensesOf(view)`, `defaultLens(view)` (a view's first lens with an Atlas view) and `isPresetGroup` (a type guard for hash values); a web test (`catalogParity.test.ts`) keeps it in step with classic's registry. `badges.ts` `outlierGrades` grades each rule 0–3 against repo size (thresholds in one `RULES` table) and `computeOutlierBadges` is grade ≥ 2 — never on max-normalized scores, whose top tier always has members. Stale Files has no rule (its count measures the window). `entities.ts` indexes views, analyzers, people, directories and files by entity id; `search/rank.ts` is the palette's fuzzy ranker.
- **Commit-based derivations take `CommitLike[]`**, not `RawCommit[]`. Classic adapts `report.commits` with `fromRawCommits`; Atlas adapts the columnar `/gitrelic-commits.json` with `fromCommitIndex`.

- **No build step.** `exports` points at `src/index.ts`; each consumer's bundler compiles it. Turbo still hashes scene's files into dependents' build hashes, so the cache stays correct without a `build` script.
- **No framework, no Node, no DOM.** Its tsconfig has `lib: ES2022` with no `types`, and an oxlint override bans `react`, `svelte` and `node:*` imports. It has no runtime dependencies.
- Imports from `@gitrelic/core` are `import type` only, like any browser code.
- Tests sit next to each file (`*.test.ts`); run with `pnpm --filter @gitrelic/scene test`.
- `test/fixtures/report.small.json` + `commits.small.json` — the deterministic sample repo's report and commit index, used by scene tests and the Atlas dev server. Regenerate with `node scripts/make-scene-fixtures.mjs` (needs a built core); a scene test fails when the fixture lacks a field `normalizeReport` backfills. The sample repo is too small for some lenses' data (fix rate rates no file in it): tests that need it build a synthetic report instead (`test/fixRateReport.ts`, `test/riskFixesReport.ts`, `test/rootCausesReport.ts`).

### `apps/cli` — Terminal Interface (published as `gitrelic` on npm)

- `src/index.tsx` — Commander entry, Ink render, `--web` / `--ui` / `--no-open`
- `src/server.ts` — the dashboard HTTP server: dashboards mounted by URL prefix (`--ui atlas` puts Atlas at `/` and classic at `/classic/`), the JSON endpoints at the root, Host-header and traversal guards
- `src/components/App.tsx` — root Ink component (loading → results)
- `scripts/copy-web-dist.mjs` — tsdown `onSuccess` hook: copies `apps/web/dist` → `apps/cli/dist/web` and `apps/atlas/dist` → `apps/cli/dist/atlas` so both dashboards ship inside the published tarball
- `tsdown.config.ts` — `deps.alwaysBundle: ['@gitrelic/core']` inlines core's source into the CLI bundle (core stays private)

### `apps/web` — Web Dashboard (classic)

The React dashboard Atlas is replacing; it stays served under `/classic/` and by `--ui classic`. Its file map, Tailwind rules and cookbook are in `apps/web/CLAUDE.md` (loaded when you work there). Don't carry its conventions (`cn()`, `classMaps.ts`, `style={{}}` carve-outs) into Atlas. Like all browser code it may only `import type` from `@gitrelic/core`.

### `apps/atlas` — Web Dashboard (Atlas, replacing classic)

Svelte 5 (runes) + Vite + Tailwind v4. Served by `gitrelic --ui atlas` (implies `--web`) at `/`, with classic under `/classic/`; classic's `useSelection` reads `#preset=<id>` on load, so Atlas can link analyzers it has no view for to `/classic/#preset=<id>` (the rail does that from PR 3.1).

**Read `docs/atlas-views.md` before building or changing a view.** It holds the navigation shape (five group views in the rail, one lens bar of analyzers, corner-toggle forms for the rare alternate picture — never a second tab row), where trend/distribution/leaderboard live (time strip, inspector chart, detail table), the URL fields, and each view's design-checkpoint outcome. Every view starts with a checkpoint with a maintainer, recorded there before it's built.

- **Read `apps/atlas/CLAUDE.md`** for the file map: data loading, the URL hash, the shell, table drawer, time strip, inspector cards and the canvas engine.
- **Rules that hold everywhere:**
  - **No raw HTML.** Report data is attacker-influenced; `test/noRawHtml.test.ts` fails on `{@html}`, `innerHTML`, `outerHTML` or `insertAdjacentHTML` in `src`.
  - **Never rebuild display objects per frame** in the Pixi renderer.
  - **`pixi.js` is pinned** to an exact version on purpose.
  - **Theme tokens:** a name added to `THEME_TOKENS` (`packages/scene/src/theme/tokens.ts`) must be defined in both themes in `apps/atlas/src/styles/tokens.css` as a literal value; `test/tokens.test.ts` enforces it (details in `apps/atlas/CLAUDE.md`, Styling).
- **Dev server.** It runs on port 7778 (`pnpm --filter @gitrelic/atlas dev`), serving the scene fixture by default, or a live analysis with `GITRELIC_DEV_REPO=<path>` (needs a built core). 7777 is classic's and the CLI's.

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
- **Centralised.** Tool processes run from `packages/core/src/utils/tools.ts`, never inside analyzers (the same exec discipline as `utils/git.ts`, and the exec-discipline skill allows exactly these two modules). Run them with `execa` argument arrays — never a shell — and timeouts: they come from `PATH` and run against untrusted repos. (`utils/git.ts` does the same through `runGit`.)
- **Never bundled or downloaded.** Tools are system binaries the user installs. gitrelic doesn't ship them, and doesn't depend on npm packages that bundle one or download it in `postinstall` — that's shipping it in all but name. A wrapper that only calls a binary already on `PATH` is fine, and as a core runtime dep it follows the bundled-deps mirror (see Publishing invariants).
- **Docs move with the first tool.** `apps/cli/README.md` (its intro and the "22 Analyzers" section) and the docs homepage (`apps/docs/index.md`, the "Zero Dependencies" card) still promise no external tools; the PR that integrates the first tool updates all three.

### Publishing invariants

The published `gitrelic` package relies on two invariants that CI enforces. Both are load-bearing — break either one and `npm install gitrelic` crashes at runtime.

1. **Bundled-deps mirror.** `apps/cli/tsdown.config.ts` inlines `@gitrelic/core`'s source via `deps.alwaysBundle`. The bundled code still calls `require('execa')` (and anything else core declares) against the CLI's own `node_modules` — so every runtime dep in `packages/core/package.json` MUST also appear in `apps/cli/package.json` with matching version ranges. The `install-smoke` CI job diffs the two dependency lists and fails on drift.

2. **Published-asset mirror.** `apps/cli/package.json` ships `files: ["dist"]`, so only `dist/` lands in the tarball. The dashboards live at `apps/web/dist/` and `apps/atlas/dist/`, outside the tarball — `scripts/copy-web-dist.mjs` (run as tsdown `onSuccess`) copies them into `apps/cli/dist/web/` and `apps/cli/dist/atlas/` at build time. Without this, `--web` crashes with `ENOENT` on every published version. Turbo orders both dashboard builds first because `apps/cli/package.json` declares `@gitrelic/web` and `@gitrelic/atlas` as `devDependency: workspace:*`. Classic builds with `base: './'` so the same dist works at `/` and under `/classic/`.

Changes to either side (new core dep, removed core dep, web dist layout change) must keep both invariants intact in the same PR.

## Issue tracking

Issues live in Linear under the GitRelic team, Atlas work in the Atlas project. Track GitRelic work only in Linear — not Jira, and not a markdown kanban file. The backlog is hand-ordered (top is next), but the Linear MCP can't read that order: when asked "what's next", ask the maintainer rather than guessing from priority or date.

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

**tsdown sometimes hangs after finishing** (core or CLI, with or without Turbo): the bundle is written but the process never exits. A CLI build takes about a second, so anything idle for minutes is this. Kill it and rerun; for unattended runs wrap it in a watchdog (`perl -e 'alarm shift; exec @ARGV' 600 pnpm build`).

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

The full guide — the three dependency surfaces, `pnpm outdated` vs `taze`, bumping, the `vitepress>vite` pin, and the advisory behind every security override and ignored advisory — is `docs/dependencies.md`. The rules that bite every time:

- **Bump a core runtime dep and its CLI mirror in the same commit** (`pnpm -r up -L <pkg>` does both when both declare it); `install-smoke` fails on drift.
- **Every security override and ignored advisory gets a row in `docs/dependencies.md`** with its advisories and when it can go. Don't ignore an advisory just to quiet `pnpm audit`.
- **Bound an override's lower end at the major** (`ws@>=8.0.0 <8.21.0`, never `ws@<8.21.0`): a bare `<X` silently forces earlier majors up.
- `pnpm -r up -L` doesn't touch the workspace catalog (`pnpm-workspace.yaml`) or root overrides; edit those by hand.

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
