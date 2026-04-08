---
name: audit-architecture
description: Use when auditing GitLore's monorepo architecture for boundary violations, dependency order problems, publishing invariants, or cross-package import issues. Run before merging large feature branches or after adding new packages.
---

# Audit: Monorepo Architecture

Dispatch the `monorepo-architect` agent (`.claude/agents/monorepo-architect.md`) to review structural integrity across all GitLore packages.

## Checklist

### 1. Package Boundary Violations

**Critical rule:** `apps/web` must NEVER import values from `@gitlore/core`. Only `import type` is allowed — value imports would bundle Node.js modules (`execa`, `node:fs`, `node:http`) into the browser build and break Vite.

- Run: `grep -r "from '@gitlore/core'" apps/web/src` — every match must be `import type`
- Run: `grep -r "require('@gitlore/core')" apps/web/src` — must be zero
- Check for any shared constants (thresholds, weights) that should be duplicated in `apps/web/src/utils/`, not imported from core

### 2. Dependency Direction

The enforced direction is: `@gitlore/core` → `@gitlore/cli` and `@gitlore/web` (the latter two are siblings, neither depends on the other).

- `packages/core` must not import from `apps/cli` or `apps/web`
- `apps/cli` must not import from `apps/web` (the web dist/ is served as static files at runtime, not imported at build time)
- `apps/web` must not import values from `apps/cli` or `packages/core`
- Check `turbo.json` — the `build.dependsOn: ["^build"]` chain must reflect this via workspace dependencies
- Check `pnpm-workspace.yaml` — no circular workspace references

### 3. Publishing Invariant (High-Priority)

`apps/cli/package.json` (the published `gitlore` package) declares `@gitlore/core: workspace:*` as a runtime dependency. But `packages/core/package.json` is `"private": true`. Once `pnpm publish` rewrites `workspace:*` to a real version, `npm install gitlore` will fail because `@gitlore/core` was never published.

Three possible fixes — verify which one is in place:

1. **Bundle core into cli** — `apps/cli/tsup.config.ts` has `noExternal: ['@gitlore/core']`, so core's source is inlined at build time. Core stays private. In this case, every runtime dep of core (currently just `execa`) must also appear in `apps/cli/package.json` dependencies, because the bundled code does `require('execa')` against cli's own `node_modules`
2. **Publish core** — remove `"private": true` from `packages/core/package.json` and publish it separately
3. **Don't publish cli yet** — fine for pre-release, but flag as a known blocker

Current state (as of last audit): tsup config has NO `noExternal`, core is still private. This is a latent breakage. Confirm the current state and flag if unresolved.

### 4. Exec Discipline Invariant

All git command execution MUST go through `packages/core/src/utils/git.ts`. See the `exec-discipline` skill for the full rule. This is an architectural invariant because it encodes the core package's boundary with the git subprocess.

- Run: `grep -r "from 'execa'" packages/core/src/ --include='*.ts' | grep -v 'utils/git.ts' | grep -v '.test.ts'`
- `apps/cli` and `apps/web` must not import `execa` at all — all subprocess work belongs in core
- Known existing violation: `packages/core/src/analyzers/rename-tracking.ts` imports execa directly. Flag if still present

### 5. Circular Dependencies Within Packages

- `madge --circular packages/core/src/` — must return no cycles
- `madge --circular apps/cli/src/` — same
- `madge --circular apps/web/src/` — same
- Pay attention to `packages/core/src/analyzers/` — analyzers must not import from each other. Cross-analyzer composition belongs in `runner.ts` or in a dedicated consumer like `cursed-files.ts` (which takes other analyzers' output as arguments, not by importing them)

### 6. Type Export Discipline

- `packages/core/src/index.ts` — what's exported? Types should be exported; internal implementation (individual analyzer functions, git utils) should only be exported if intentionally public API
- `apps/cli` and `apps/web` should import from `@gitlore/core` via the package name (workspace import), not via relative paths like `../../../packages/core/src`. Relative path imports across packages bypass the build system and cause subtle bugs

### 7. Linting and Formatting Consistency

GitLore uses oxlint + oxfmt at the root (NOT ESLint/Prettier).

- Check root `oxlint.config.ts` and `.oxfmtrc.json` exist and are wired in
- Run `pnpm lint` and `pnpm format:check` — both must pass
- Pre-commit hook (husky + lint-staged) runs on staged files — verify `.husky/pre-commit` still exists and is executable
- Per-package `package.json` should not add its own lint/format config that would conflict with root

### 8. New Package Registration

If any new package was added since the last audit:

- Is it in `pnpm-workspace.yaml`?
- Does it have its own `tsconfig.json` extending the root (if there is one)?
- Does it have a `build` script that tsup or Vite can run?
- Does `turbo.json` need any package-specific overrides?
- Does the published `gitlore` CLI need to depend on it?

## Key Files

```
gitlore/
├── turbo.json                           # Build pipeline
├── pnpm-workspace.yaml                  # Workspace members + catalog
├── oxlint.config.ts, .oxfmtrc.json      # Linting/formatting
├── packages/core/
│   ├── package.json                     # Private? execa dep?
│   ├── src/index.ts                     # Public exports
│   ├── src/utils/git.ts                 # Exec-discipline boundary
│   └── src/analyzers/rename-tracking.ts # Known exec-discipline violator
├── apps/cli/
│   ├── package.json                     # Published — dep on @gitlore/core
│   └── tsup.config.ts                   # Bundling config (noExternal?)
└── apps/web/
    └── src/                             # grep for `from '@gitlore/core'`
```

## How to Run

```
Use the monorepo-architect agent. Provide it this checklist plus the current
state of: turbo.json, pnpm-workspace.yaml, packages/core/package.json,
apps/cli/package.json, apps/cli/tsup.config.ts, and the results of grepping
for cross-package imports in apps/web/src.
```

Focus findings on §1 (web import discipline), §3 (publishing invariant), and §4 (exec discipline) — these are the ones that cause real breakage. Skip purely cosmetic structural nits.
