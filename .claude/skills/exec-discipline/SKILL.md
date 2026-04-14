---
name: exec-discipline
description: "Enforce use of utils/git.ts for all git command execution — never raw execa imports in analyzers or other modules"
---

# Exec Discipline

## Rule

All git command execution in `@gitrelic/core` MUST go through `packages/core/src/utils/git.ts`. No other file should import `execa` directly for running git commands.

## Why

Gitrelic's core package runs many git commands across its analyzers. Centralizing execution through `utils/git.ts` ensures:

- **Consistent error handling** — one place to catch and wrap git failures
- **Consistent `cwd` passing** — every git call needs `repoPath`, enforced by the function signatures
- **Testability** — mock one module instead of scattered execa calls
- **Future-proofing** — if we need to add logging, caching, or rate-limiting to git calls, there's one place to do it

This is the same pattern the Vite+ team uses with their `vite_command` crate — all subprocess spawning goes through one module, never raw `std::process::Command`.

## How to Apply

### When writing new analyzers or modifying existing ones:

1. **NEVER** add `import { execa } from 'execa'` in any file outside `utils/git.ts`
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
grep -r "from 'execa'" packages/core/src/ --include='*.ts' | grep -v 'utils/git.ts' | grep -v '.test.ts'
```

Any results are violations that need refactoring.

### Known Existing Violation

`packages/core/src/analyzers/rename-tracking.ts` currently imports execa directly. This should be refactored — the rename log fetching should be a function in `utils/git.ts`.

## Checklist

Before completing work that touches git command execution:

- [ ] No new `import { execa } from 'execa'` outside `utils/git.ts`
- [ ] Any new git primitives added to `utils/git.ts` with proper typing
- [ ] New functions accept `repoPath: string` as first parameter
- [ ] New functions return structured data, not raw stdout
- [ ] Existing violation in `rename-tracking.ts` addressed (if touching that file)
