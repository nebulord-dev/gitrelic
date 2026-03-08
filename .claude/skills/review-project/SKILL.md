---
name: review-project
description: Review the Lore application for issues
---

Review ${0:-all packages} for bugs, security issues, and code quality problems. Focus on practical issues, not style nitpicks.

1. Check the monorepo structure (`packages/core`, `apps/cli`, `apps/web`)
2. Verify build configuration (Turbo, tsup, Vite, pnpm workspaces)
3. Review the three main packages:
   - **core**: Git analysis engine — analyzers (`churn`, `bus-factor`, `age-map`, `contributors`, `cursed-files`), runner orchestration, git primitives
   - **cli**: Terminal interface with Ink — Commander flags, `--web` server, `--json` output
   - **web**: React dashboard — tabbed layout (Overview, Hotspots, Contributors, Cursed Files, Age Map)
4. Analyze data flow: `git log` → `runLore()` → analyzers → `LoreReport` → CLI/Web rendering
5. Check for:
   - Threshold logic issues (hardcoded values that don't scale with repo size/age)
   - Git edge cases (empty repos, single-commit repos, repos with no tracked files)
   - Type safety between `LoreReport` shape and web/CLI consumers
   - `import type` discipline in `apps/web` (must not import values from `@lore/core`)
   - Performance concerns in analyzers (nested loops over commits × files)
6. Suggest architectural improvements
