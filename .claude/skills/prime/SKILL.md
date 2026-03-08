---
description: Prime agent with codebase understanding
---

# Prime: Load Project Context

## Objective

Build comprehensive understanding of the Lore monorepo before starting work. This is a pnpm workspace with three packages (`core`, `cli`, `web`) and strict build dependency order.

## Process

### 1. Analyze Project Structure

List all tracked files:
!`git ls-files`

Show directory structure:
!`find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.turbo/*' | sort`

### 2. Read Core Documentation

Read in this order — each builds on the previous:

- `CLAUDE.md` — project rules, architecture overview, file navigation guide
- `.claude/kanban.md` — current task board (Backlog → In Progress → Done)

List available design docs:
!`ls .claude/plans/ 2>/dev/null || echo "No plans directory yet"`

Read any plan docs relevant to the current task.

### 3. Identify Key Files

Read based on the task at hand:

**If working on analyzers or report data:**
- `packages/core/src/types.ts` — core interfaces (`LoreReport`, `ChurnReport`, `CursedFile`, etc.)
- `packages/core/src/runner.ts` — orchestrator that calls all analyzers, entry point is `runLore()`
- `packages/core/src/utils/git.ts` — raw git primitives (`getAllCommits`, `getTrackedFiles`, `RawCommit`)
- `packages/core/src/analyzers/` — individual analyzers:
  - `churn.ts` — file churn frequency analysis
  - `bus-factor.ts` — ownership concentration per file
  - `age-map.ts` — last-commit age per file, staleness thresholds
  - `contributors.ts` — per-author stats, active/ghost classification
  - `cursed-files.ts` — cross-analyzer risk scoring

**If working on terminal UI:**
- `apps/cli/src/index.tsx` — CLI entry, Commander setup, `--web` server
- `apps/cli/src/components/App.tsx` — root Ink component (loading → results)

**If working on web dashboard:**
- `apps/web/src/App.tsx` — loads `/lore-report.json`, passes to Dashboard
- `apps/web/src/components/Dashboard.tsx` — tabbed layout (Overview, Hotspots, Contributors, Cursed Files, Age Map)

### 4. Understand Current State

Check recent activity:
!`git log -10 --oneline`

Check current branch and status:
!`git status`

## Output Report

Provide a concise summary covering:

### Project Overview

- Purpose and current phase of development
- What's actively being worked on (from kanban In Progress)
- What's coming next (from kanban Backlog)

### Architecture

- Monorepo package dependency order (`core` → `cli` → `web`)
- Key architectural patterns: analyzers receive `(commits, trackedFiles)` and return typed reports
- Data flows from `git log` → `runLore()` → analyzers → `LoreReport` → CLI/Web rendering

### Tech Stack

- TypeScript throughout; Ink (React for terminals) in CLI; Vite + React + Tailwind in web
- pnpm workspaces + Turbo for build orchestration
- tsup for bundling core/cli; Vite for web

### Current State

- Active branch and recent commits
- Kanban status: what's in progress, what's blocked
- Immediate next actions

**Make this summary easy to scan — use bullet points and clear headers.**
