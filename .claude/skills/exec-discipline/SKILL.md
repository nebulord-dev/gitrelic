---
name: exec-discipline
description: "Enforce that processes run only from utils/git.ts (git) and utils/tools.ts (optional external tools) — never raw execa imports in analyzers or other modules"
---

# Exec Discipline

## Rule

All git command execution in `@gitrelic/core` MUST go through `packages/core/src/utils/git.ts`, and every external tool (cloc/scc, git-sizer — optional, see CLAUDE.md › Data source) through `packages/core/src/utils/tools.ts`. No other file imports `execa` or `child_process`. Both modules run processes with argument arrays (never a shell). Both also set a timeout on every call (tools come from `PATH`, and both run against untrusted repos). In `utils/git.ts` that means going through `runGit`, which also sets `GIT_TERMINAL_PROMPT=0`: flag any new `execa('git', …)` that bypasses it.

## Why

Gitrelic's core package runs many git commands across its analyzers. Centralizing execution through `utils/git.ts` ensures:

- **Consistent error handling** — one place to catch and wrap git failures
- **Consistent `cwd` passing** — every git call needs `repoPath`, enforced by the function signatures
- **Testability** — mock one module instead of scattered execa calls
- **Future-proofing** — if we need to add logging, caching, or rate-limiting to git calls, there's one place to do it

This is the same pattern the Vite+ team uses with their `vite_command` crate — all subprocess spawning goes through one module, never raw `std::process::Command`.

## How to Apply

### When writing new analyzers or modifying existing ones:

1. **NEVER** add `import { execa } from 'execa'` in any file outside `utils/git.ts` and `utils/tools.ts`
2. **USE** existing functions from `utils/git.ts`:
   - `getAllCommits(repoPath, options)` — full commit log with numstat
   - `getTrackedFiles(repoPath)` — current tracked files
   - `getCurrentBranch(repoPath)` — current branch name
   - `getBranches(repoPath)` — all local branches
   - `parseGitLog(raw)` — parse raw git log output
   - `isIgnored(file)` — check if file matches noise patterns
   - `detectPrimaryLanguage(files)` — detect language from extensions

3. **If you need a new git command** that doesn't have a function yet:
   - Add the new function to `utils/git.ts`
   - Give it a clear name describing the data it returns (e.g., `getFileBlame`, `getCommitDiff`)
   - Accept `repoPath: string` as the first parameter
   - Return typed data, not raw stdout strings
   - Then import and use it from your analyzer

### When reviewing code:

Run this check to find violations:

```bash
grep -r "from 'execa'" packages/core/src/ --include='*.ts' | grep -v 'utils/git.ts' | grep -v 'utils/tools.ts' | grep -v '.test.ts'
```

Any results are violations that need refactoring.

### Known Existing Violations

None. (`rename-tracking.ts` used to import execa; it now calls `getRenameLog` from `utils/git.ts`.)

## Checklist

Before completing work that touches git command execution:

- [ ] No new `import { execa } from 'execa'` outside `utils/git.ts` / `utils/tools.ts`
- [ ] A tool call reads the analyzed commit, not the working copy, and falls back to git-only when the tool is missing
- [ ] Any new git primitives added to `utils/git.ts` with proper typing
- [ ] New functions accept `repoPath: string` as first parameter
- [ ] New functions return structured data, not raw stdout
