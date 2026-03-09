# Lore — Claude Code Guide

## Project Overview

**Lore** is a git archaeology CLI. It analyzes a git repository's *history* to surface churn patterns, bus factor risks, file age, contributor profiles, and "cursed files" — files at the intersection of high churn, concentrated ownership, and age anomalies.

## Monorepo Architecture

pnpm workspace + Turbo. Strict dependency order:

```
@lore/core (foundation)
    ↓
@lore/cli (depends on core)
@lore/web (independent, served by CLI --web flag)
```

## Package Breakdown

### `packages/core` — Analysis Engine

- `src/runner.ts` — orchestrates all analyzers, entry point is `runLore()`
- `src/types.ts` — all TypeScript interfaces (`LoreReport`, `ChurnReport`, etc.)
- `src/utils/git.ts` — raw git primitives (parsing `git log`, `git ls-files`)
- `src/analyzers/churn.ts` — file churn frequency analysis
- `src/analyzers/bus-factor.ts` — ownership concentration per file
- `src/analyzers/age-map.ts` — last-commit age per file
- `src/analyzers/contributors.ts` — per-author stats and profiles
- `src/analyzers/cursed-files.ts` — cross-analyzer risk scoring

### `apps/cli` — Terminal Interface

- `src/index.tsx` — Commander entry, Ink render, `--web` server
- `src/components/App.tsx` — root Ink component (loading → results)

### `apps/web` — Web Dashboard

- `src/App.tsx` — loads `/lore-report.json`, passes to Dashboard
- `src/components/Dashboard.tsx` — tabbed layout (Overview, Hotspots, Contributors, Cursed Files, Age Map)

## Key Concepts

### Report flow

1. `runLore()` in core runs all analyzers
2. CLI receives `LoreReport` and renders Ink UI
3. With `--web`: CLI starts HTTP server, serves web/dist + `/lore-report.json`

### Adding a new analyzer

1. Create `packages/core/src/analyzers/my-analyzer.ts`
2. Export a function `analyzeX(commits, trackedFiles): XReport`
3. Add result to `LoreReport` in `types.ts`
4. Call it in `runner.ts` and include in return value

### Data source

Everything comes from `git log` and `git ls-files`. No external tool dependencies — pure git.

## Kanban / Task Board

When the user mentions "kanban", "task", "backlog", or "add a task", they are referring to `.claude/kanban.md`. This is the project's task board — read and edit it directly when managing tasks.

## Build Commands

```bash
pnpm build                          # all packages
pnpm --filter @lore/core build
pnpm --filter @lore/cli build
pnpm --filter @lore/web build
pnpm dev                            # watch all
```

## Testing Locally

```bash
node apps/cli/dist/index.js --path ~/path/to/any-git-repo
node apps/cli/dist/index.js --path ~/path/to/any-git-repo --web
node apps/cli/dist/index.js --path ~/path/to/any-git-repo --json
```
