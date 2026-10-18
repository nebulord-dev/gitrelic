---
name: prime
description: Prime agent with codebase understanding
---

# Prime: Load Project Context

## Objective

Build comprehensive understanding of the GitRelic monorepo before starting work. This is a pnpm workspace + Turbo with six workspaces (`core`, `scene`, `cli`, `web`, `atlas`, `docs`) and strict build dependency order.

## Process

### 1. Analyze Project Structure

List all tracked files:
!`git ls-files`

Show directory structure:
!`find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.turbo/*' | sort`

### 2. Read Core Documentation

Read in this order — each builds on the previous:

- `CLAUDE.md` — project rules, architecture overview, file navigation guide


List available design docs:
!`ls docs/superpowers/plans/ docs/superpowers/specs/ 2>/dev/null || echo "No plans directory yet"`

List available skills:
!`ls .claude/skills/ 2>/dev/null`

Read any plan docs relevant to the current task.

### 3. Identify Key Files

Read based on the task at hand:

**If working on analyzers or report data:**

- `packages/core/src/types.ts` — core interfaces (`GitrelicReport`, `ChurnReport`, `CursedFile`, etc.)
- `packages/core/src/runner.ts` — orchestrator that calls all analyzers, entry point is `runGitrelic()`
- `packages/core/src/utils/git.ts` — raw git primitives (`getAllCommits`, `getTrackedFiles`, `RawCommit`)
- `packages/core/src/analyzers/` — individual analyzers:
  - `churn.ts` — file churn frequency analysis
  - `bus-factor.ts` — ownership concentration per file
  - `age-map.ts` — last-commit age per file, staleness thresholds
  - `contributors.ts` — per-author stats, active/ghost classification
  - `cursed-files.ts` — cross-analyzer risk scoring

**If working on terminal UI:**

- `apps/cli/src/index.tsx` — CLI entry, Commander setup (`--web`, `--ui classic|atlas` which implies `--web`, `--no-open`), `serveWebDashboard` picks the mounts
- `apps/cli/src/server.ts` — `createDashboardServer({ report, mounts })`: Host-header check, dashboards by URL prefix (longest wins; `--ui atlas` puts Atlas at `/` and classic at `/classic/`), and the three JSON endpoints always at the root
- `apps/cli/src/components/App.tsx` — root Ink component (loading → results)
- `apps/cli/tsdown.config.ts` — `deps.alwaysBundle: ['@gitrelic/core']` (bundles core inline) + `onSuccess` dashboard-copy hook
- `apps/cli/scripts/copy-web-dist.mjs` — copies `apps/web/dist` → `apps/cli/dist/web` and `apps/atlas/dist` → `apps/cli/dist/atlas` at build time
- **Two publishing invariants** enforced by the `install-smoke` CI job (`.github/workflows/ci.yml`): every runtime dep of core must be mirrored in `apps/cli/package.json`; and `node_modules/gitrelic/dist/web/index.html` and `dist/atlas/index.html` must exist after installing the packed tarball (the job also probes `--web` and `--ui atlas`). Changes that touch the CLI should verify both still hold — see `.claude/skills/audit-cli/` §1–§2 for detail

**If working on the classic web dashboard** (`apps/web`, being replaced by Atlas — React/Tailwind conventions here don't carry over):

- `apps/web/src/App.tsx` — fetches `/gitrelic-report.json`, normalizes via `normalizeReport` from `@gitrelic/scene`, renders `Shell`
- `packages/scene/src/` — framework-free derivations shared by the dashboards: `report/normalizeReport.ts` (fills empty defaults for fields missing from older reports), `directory/*ByDirectory.ts`, ownership rankings, author classification. Type-only imports from core; no React/Svelte/Node
- `apps/web/src/components/layout/Shell.tsx` — top-level layout (sidebar + top bar + main pane + bottom panel + inspector)
- `apps/web/src/components/layout/BottomPanel.tsx` — routes the active tab mode to one of 22 tab components under `components/tabs/`
- `apps/web/src/components/layout/InspectorPanel.tsx` — drill-down panel for selected file/contributor/activity
- `apps/web/src/components/hero/` — D3 hero visualizations. Biggest XSS surface — must only use `.text()`, never `.html()`
- `apps/web/src/components/tabs/` — 22 tabs, one per analyzer
- Critical rule: only `import type` from `@gitrelic/core`. Value imports leak Node.js modules into the browser bundle.
- Builds with `base: './'` so it also works under `/classic/`; reads `#preset=<id>` on load (`src/presets/presetFromHash.ts`)

**If working on Atlas** (`apps/atlas`, Svelte 5 runes + Vite + Tailwind v4; each view starts with a design checkpoint with a maintainer):

- `apps/atlas/src/App.svelte` — loads `/gitrelic-report.lite.json` via `lib/data/loadReport.ts`, applies the theme, renders `lib/shell/Shell.svelte`
- `apps/atlas/src/lib/state/hash.ts` — `#v=&l=&s=` URL state; the selection is untrusted (resolve via the entity map, never render it)
- `apps/atlas/dev/devData.ts` — Vite dev plugin serving the JSON endpoints (scene fixture, or `GITRELIC_DEV_REPO=<path>`); Node-side, the one place Atlas may value-import core
- `apps/atlas/src/styles/tokens.css` + `packages/scene/src/theme/tokens.ts` — theme tokens (see CLAUDE.md "Atlas Styling")
- Rules: `import type { X }` from core only (not `import { type X }`); no raw HTML (`test/noRawHtml.test.ts`); dev port 7778

**If working on the documentation site:**

- `apps/docs/` — VitePress site (workspace name `@gitrelic/docs`), deploys to `nebulord-dev.github.io/gitrelic` via `.github/workflows/docs.yml` on `apps/docs/**` changes to `main`
- `apps/docs/.vitepress/config.ts` — site config and sidebar
- Excluded from root `pnpm build`; use `pnpm docs:dev` / `pnpm docs:build`

**For package-scoped audits:**

- `.claude/skills/audit-architecture/` — monorepo boundaries, publishing invariant, exec discipline
- `.claude/skills/audit-core/` — analyzer correctness, runner orchestration, edge cases
- `.claude/skills/audit-cli/` — packaging, Commander validation, web server security, Ink patterns
- `.claude/skills/audit-web/` — both dashboards: import discipline, D3 XSS surface (classic), raw-HTML ban and untrusted hash (Atlas), report loading, perf
- `.claude/skills/exec-discipline/` — the rule that all git subprocess calls must live in `packages/core/src/utils/git.ts`

### 4. Understand Current State

Check recent activity:
!`git log -10 --oneline`

Check current branch and status:
!`git status`

## Output Report

Provide a concise summary covering:

### Project Overview

- Purpose and current phase of development


### Architecture

- Monorepo package dependency order (`core` → `scene` → `web` / `atlas`; `core` → `cli`, which builds last because it copies both dashboard dists)
- Key architectural patterns: analyzers receive `(commits, trackedFiles)` and return typed reports
- Data flows from `git log` → `runGitrelic()` → analyzers → `GitrelicReport` → CLI/Web rendering

### Tech Stack

- TypeScript throughout; Ink (React for terminals) in CLI; Vite + React 19 + Tailwind in web; Vite + Svelte 5 + Tailwind v4 in atlas
- pnpm workspaces + Turbo for build orchestration
- tsdown for bundling core/cli; Vite for web and atlas; scene has no build step (ships TS source)
- oxlint + oxfmt for linting/formatting; husky + lint-staged for pre-commit hooks

### Sister Project: Sickbay

GitRelic's sister project lives at `/Desktop/nebulord/sickbay`. Both share the same stack and are built by the same developer. **Keep them aligned.**

Key libraries Sickbay has that GitRelic will need as features grow:

- `@xyflow/react` + `dagre` — graph visualization, already used for dependency graph. Port to GitRelic when building the commit graph or coupling map.
- `react-syntax-highlighter` — code display with syntax highlighting. Port when building file drill-down.
- `madge` — static import/dependency analysis with circular dep detection. Port to GitRelic `@gitrelic/core` when building the dependency graph analyzer.

### Current State

- Active branch and recent commits
- Immediate next actions

**Make this summary easy to scan — use bullet points and clear headers.**
