# GitLore — Claude Code Guide

## Project Overview

**GitLore** is a git archaeology CLI. It analyzes a git repository's _history_ to surface churn patterns, bus factor risks, file age, contributor profiles, and "cursed files" — files at the intersection of high churn, concentrated ownership, and age anomalies.

## Monorepo Architecture

pnpm workspace + Turbo. Strict dependency order:

```
@gitlore/core (foundation)
    ↓
@gitlore/cli (depends on core)
@gitlore/web (independent, served by CLI --web flag)
```

## Package Breakdown

### `packages/core` — Analysis Engine

- `src/runner.ts` — orchestrates all analyzers, entry point is `runGitlore()`
- `src/types.ts` — all TypeScript interfaces (`GitloreReport`, `ChurnReport`, etc.)
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

### `apps/cli` — Terminal Interface

- `src/index.tsx` — Commander entry, Ink render, `--web` server
- `src/components/App.tsx` — root Ink component (loading → results)

### `apps/web` — Web Dashboard

- `src/App.tsx` — loads `/gitlore-report.json`, passes to Dashboard
- `src/components/Dashboard.tsx` — tabbed layout (Overview, Hotspots, Contributors, Cursed Files, Age Map, Shame)
- `src/components/HotspotClusters.tsx` — hotspot cluster visualization component

## Key Concepts

### Report flow

1. `runGitlore()` in core runs all analyzers
2. CLI receives `GitloreReport` and renders Ink UI
3. With `--web`: CLI starts HTTP server, serves web/dist + `/gitlore-report.json`

### Adding a new analyzer

1. Create `packages/core/src/analyzers/my-analyzer.ts`
2. Export a function `analyzeX(commits, trackedFiles): XReport`
3. Add result to `GitloreReport` in `types.ts`
4. Call it in `runner.ts` and include in return value

### Architectural review

After cross-package changes (new analyzers, new web visualizations, refactors touching multiple packages), invoke the **monorepo-architect** agent (`.claude/agents/monorepo-architect.md`) to validate:

- Dependency direction (core → cli/web, never the reverse)
- Web imports from core are `import type` only (no value imports — they'd bundle Node.js into the browser)
- Git commands are centralized in `utils/git.ts`, not scattered in analyzers (exec-discipline)
- New analyzers are wired into `runner.ts`, typed in `types.ts`, and exported from `index.ts`

### Data source

Everything comes from `git log` and `git ls-files`. No external tool dependencies — pure git.

## Task Management

Tasks are tracked in **Jira** (nebulord.atlassian.net, project KAN, epic KAN-6 for GitLore). Use the Atlassian MCP tools to read and update tasks. Do not create or edit local task files.

## Build Commands

```bash
pnpm build                          # all packages
pnpm --filter @gitlore/core build
pnpm --filter @gitlore/cli build
pnpm --filter @gitlore/web build
pnpm dev                            # watch all
```

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
pnpm test                           # run all tests (207 across core)
pnpm test:core                      # core package tests with UI
pnpm test:coverage                  # coverage report
```

## Running Locally

```bash
node apps/cli/dist/index.js --path ~/path/to/any-git-repo
node apps/cli/dist/index.js --path ~/path/to/any-git-repo --web
node apps/cli/dist/index.js --path ~/path/to/any-git-repo --json
```
