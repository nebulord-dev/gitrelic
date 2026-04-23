# GitRelic — Claude Code Guide

## Project Overview

**GitRelic** is a git archaeology CLI. It analyzes a git repository's _history_ to surface churn patterns, bus factor risks, file age, contributor profiles, and "cursed files" — files at the intersection of high churn, concentrated ownership, and age anomalies.

## Monorepo Architecture

pnpm workspace + Turbo. Strict dependency order:

```
@gitrelic/core (foundation — private)
    ↓
gitrelic              (CLI, the only published package; bundles core inline)
@gitrelic/web         (browser dashboard; served by CLI --web flag)
@gitrelic/docs        (VitePress site; deploys separately via .github/workflows/docs.yml)
```

Workspace names in `pnpm --filter <name>` commands: `@gitrelic/core`, `gitrelic` (NOT `@gitrelic/cli`), `@gitrelic/web`, `@gitrelic/docs`.

## Package Breakdown

### `packages/core` — Analysis Engine

- `src/runner.ts` — orchestrates all analyzers, entry point is `runGitrelic()`
- `src/types.ts` — all TypeScript interfaces (`GitrelicReport`, `ChurnReport`, etc.)
- `src/utils/git.ts` — raw git primitives (parsing `git log`, `git ls-files`)
- `src/analyzers/` — 22 analyzers, each with a corresponding `.test.ts`:
  - `churn.ts` — file churn frequency analysis
  - `bus-factor.ts` — ownership concentration per file
  - `age-map.ts` — last-commit age per file
  - `contributors.ts` — per-author stats and profiles
  - `cursed-files.ts` — cross-analyzer risk scoring
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
  - `co-author.ts` — co-authorship pair analysis
  - `hotspot-clustering.ts` — multi-dimensional hotspot grouping
  - `complexity-trend.ts` — monthly file growth curves
  - `commit-timing.ts` — late-night/weekend stress patterns
  - `rename-tracking.ts` — file rename chain detection

### `apps/cli` — Terminal Interface (published as `gitrelic` on npm)

- `src/index.tsx` — Commander entry, Ink render, `--web` server
- `src/components/App.tsx` — root Ink component (loading → results)
- `scripts/copy-web-dist.mjs` — tsdown `onSuccess` hook: copies `apps/web/dist/*` → `apps/cli/dist/web/*` so the dashboard ships inside the published tarball
- `tsdown.config.ts` — `deps.alwaysBundle: ['@gitrelic/core']` inlines core's source into the CLI bundle (core stays private)

### `apps/web` — Web Dashboard

- `src/App.tsx` — loads `/gitrelic-report.json`, normalizes missing fields via `utils/normalizeReport.ts`, then renders `Shell`
- `src/utils/normalizeReport.ts` — fills empty defaults for analyzer fields missing from older reports so tabs don't crash
- `src/components/layout/Shell.tsx` — top-level layout (sidebar + top bar + main pane + bottom panel + inspector)
- `src/components/layout/Sidebar.tsx` — left nav, switches between overview and tab modes
- `src/components/layout/BottomPanel.tsx` — routes to the 22 tab components under `components/tabs/`
- `src/components/layout/InspectorPanel.tsx` — drill-down panel for the selected file/contributor/activity
- `src/components/hero/` — D3 visualizations (commit graph, swimlanes, treemaps, force graphs, etc.). Biggest XSS surface — must only use `.text()`, never `.html()`
- `src/components/tabs/` — 22 deep-dive tabs, one per analyzer
- Critical rule: only `import type` from `@gitrelic/core`. Value imports bundle Node.js modules into the browser build and break Vite.

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
3. With `--web`: CLI starts HTTP server (dynamic port via `getFreePort`, preferred 7777), serves web/dist + `/gitrelic-report.json`

### Adding a new analyzer

1. Create `packages/core/src/analyzers/my-analyzer.ts`
2. Export a function `analyzeX(commits, trackedFiles): XReport`
3. Add result to `GitrelicReport` in `types.ts`
4. Call it in `runner.ts` and include in return value

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

Everything comes from `git log` and `git ls-files`. No external tool dependencies — pure git.

### Publishing invariants

The published `gitrelic` package relies on two invariants that CI enforces. Both are load-bearing — break either one and `npm install gitrelic` crashes at runtime.

1. **Bundled-deps mirror.** `apps/cli/tsdown.config.ts` inlines `@gitrelic/core`'s source via `deps.alwaysBundle`. The bundled code still calls `require('execa')` (and anything else core declares) against the CLI's own `node_modules` — so every runtime dep in `packages/core/package.json` MUST also appear in `apps/cli/package.json` with matching version ranges. The `install-smoke` CI job diffs the two dependency lists and fails on drift.

2. **Published-asset mirror.** `apps/cli/package.json` ships `files: ["dist"]`, so only `dist/` lands in the tarball. The web dashboard lives at `apps/web/dist/`, outside the tarball — `scripts/copy-web-dist.mjs` (run as tsdown `onSuccess`) copies it into `apps/cli/dist/web/` at build time. Without this, `--web` crashes with `ENOENT` on every published version. Turbo orders the web build first because `apps/cli/package.json` declares `@gitrelic/web` as a `devDependency: workspace:*`.

Changes to either side (new core dep, removed core dep, web dist layout change) must keep both invariants intact in the same PR.

## Task Management

Tasks are tracked in **Jira** (nebulord.atlassian.net, project KAN, epic KAN-6 for GitRelic). Use the Atlassian MCP tools to read and update tasks. Do not create or edit local task files.

## Build Commands

```bash
pnpm build                          # core + cli + web (apps/docs excluded)
pnpm --filter @gitrelic/core build
pnpm --filter gitrelic build        # NOT @gitrelic/cli — published package is unscoped
pnpm --filter @gitrelic/web build
pnpm docs:build                     # apps/docs (VitePress) — separate from pnpm build
pnpm dev                            # watch all
```

TypeScript 6 throughout (`tsconfig.base.json` + `pnpm-workspace.yaml` catalog). tsdown bundles core and CLI; Vite bundles web; VitePress bundles docs.

## Linting & Formatting

oxlint + oxfmt (not ESLint/Prettier). Config at root: `oxlint.config.ts`, `.oxfmtrc.json`.

```bash
pnpm lint                           # run oxlint
pnpm lint:fix                       # auto-fix lint issues
pnpm format                         # format all files with oxfmt
pnpm format:check                   # check formatting without writing
```

Pre-commit hook (husky + lint-staged) runs `oxlint --fix` and `oxfmt` on staged files automatically.

## Testing

```bash
pnpm test                           # run all tests (231 core + 29 web)
pnpm test:core                      # core package tests with Vitest UI
pnpm test:web                       # web package tests with Vitest UI
pnpm test:coverage                  # coverage report
```

## Running Locally

```bash
node apps/cli/dist/index.mjs --path ~/path/to/any-git-repo
node apps/cli/dist/index.mjs --path ~/path/to/any-git-repo --web
node apps/cli/dist/index.mjs --path ~/path/to/any-git-repo --json
```

The built output is `dist/index.mjs` (matches `apps/cli/package.json` `bin` field). To verify the published layout, pack the tarball: `cd apps/cli && pnpm pack && tar -tzf gitrelic-*.tgz`.

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

When bumping any runtime dep in `packages/core`, bump the matching entry in `apps/cli/package.json` in the **same commit**. The `install-smoke` CI only checks that keys match, not versions — so two declarations can drift to different ranges while CI stays green, and a future fresh install could resolve them differently.

`pnpm -r up -L <pkg>` handles this automatically when both packages declare the dep (common case: `execa`).

### Why `vitepress>vite` is pinned to `^6.4.2`

That override is **scoped** — it only pins vite **where vitepress depends on it**, not the top-level vite used by `apps/web`. VitePress 1.x was built against vite 6; vite 7+ has breaking changes VitePress 1.x never absorbed. The lockfile happily holds both `vite@6.4.x` (inside vitepress) and `vite@8.x` (for `apps/web`). Taze will flag the top-level vite range even though the override pins a different vite instance to 6 — that's not drift, it's two separate vites in the graph. Drop the override only when moving to VitePress 2.x (which supports vite 7+).

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
