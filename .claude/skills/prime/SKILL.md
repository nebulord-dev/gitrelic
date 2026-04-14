---
name: prime
description: Prime agent with codebase understanding
---

# Prime: Load Project Context

## Objective

Build comprehensive understanding of the GitRelic monorepo before starting work. This is a pnpm workspace with three packages (`core`, `cli`, `web`) and strict build dependency order.

## Process

### 1. Analyze Project Structure

List all tracked files:
!`git ls-files`

Show directory structure:
!`find . -maxdepth 3 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.turbo/*' | sort`

### 2. Read Core Documentation

Read in this order — each builds on the previous:

- `CLAUDE.md` — project rules, architecture overview, file navigation guide
- Jira project KAN (nebulord.atlassian.net) — current task board, epic KAN-6 for GitRelic

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

- `apps/cli/src/index.tsx` — CLI entry, Commander setup, `--web` server
- `apps/cli/src/components/App.tsx` — root Ink component (loading → results)

**If working on web dashboard:**

- `apps/web/src/App.tsx` — fetches `/gitrelic-report.json`, normalizes via `utils/normalizeReport.ts`, renders `Shell`
- `apps/web/src/utils/normalizeReport.ts` — fills empty defaults for analyzer fields missing from older reports
- `apps/web/src/components/layout/Shell.tsx` — top-level layout (sidebar + top bar + main pane + bottom panel + inspector)
- `apps/web/src/components/layout/BottomPanel.tsx` — routes the active tab mode to one of 22 tab components under `components/tabs/`
- `apps/web/src/components/layout/InspectorPanel.tsx` — drill-down panel for selected file/contributor/activity
- `apps/web/src/components/hero/` — D3 hero visualizations. Biggest XSS surface — must only use `.text()`, never `.html()`
- `apps/web/src/components/tabs/` — 22 tabs, one per analyzer
- Critical rule: only `import type` from `@gitrelic/core`. Value imports leak Node.js modules into the browser bundle.

**For package-scoped audits:**

- `.claude/skills/audit-architecture/` — monorepo boundaries, publishing invariant, exec discipline
- `.claude/skills/audit-core/` — analyzer correctness, runner orchestration, edge cases
- `.claude/skills/audit-cli/` — packaging, Commander validation, web server security, Ink patterns
- `.claude/skills/audit-web/` — import discipline, D3 XSS surface, report loading, perf
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
- What's actively being worked on (from Jira In Progress)
- What's coming next (from Jira To Do)

### Architecture

- Monorepo package dependency order (`core` → `cli` → `web`)
- Key architectural patterns: analyzers receive `(commits, trackedFiles)` and return typed reports
- Data flows from `git log` → `runGitrelic()` → analyzers → `GitrelicReport` → CLI/Web rendering

### Tech Stack

- TypeScript throughout; Ink (React for terminals) in CLI; Vite + React 19 + Tailwind in web
- pnpm workspaces + Turbo for build orchestration
- tsup for bundling core/cli; Vite for web
- oxlint + oxfmt for linting/formatting; husky + lint-staged for pre-commit hooks

### Sister Project: Sickbay

GitRelic's sister project lives at `/Desktop/nebulord/sickbay`. Both share the same stack and are built by the same developer. **Keep them aligned.**

Key libraries Sickbay has that GitRelic will need as features grow:

- `@xyflow/react` + `dagre` — graph visualization, already used for dependency graph. Port to GitRelic when building the commit graph or coupling map.
- `react-syntax-highlighter` — code display with syntax highlighting. Port when building file drill-down.
- `madge` — static import/dependency analysis with circular dep detection. Port to GitRelic `@gitrelic/core` when building the dependency graph analyzer.

### Current State

- Active branch and recent commits
- Jira status: what's in progress, what's blocked
- Immediate next actions

**Make this summary easy to scan — use bullet points and clear headers.**
