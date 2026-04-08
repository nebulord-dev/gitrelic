---
name: audit-core
description: Use when auditing packages/core for analyzer correctness, exec-discipline violations, cross-platform path bugs, runner orchestration edge cases, or error handling gaps in git primitives.
---

# Audit: packages/core

Deep audit of the analysis engine. Focus on correctness and robustness — this is what GitLore runs against user repositories, and every analyzer consumes the same commit/file data.

## Checklist

### 1. Exec Discipline (Critical)

All git command execution MUST go through `src/utils/git.ts`. See the `exec-discipline` skill for the full rule.

- Run: `grep -r "from 'execa'" packages/core/src/ --include='*.ts' | grep -v 'utils/git.ts' | grep -v '.test.ts'` — any result is a violation
- Known existing violation: `src/analyzers/rename-tracking.ts` imports execa directly. Flag if still present
- New git commands must be added to `utils/git.ts`, accept `repoPath` first, return typed data — not raw stdout

### 2. Analyzer Contract

Each file in `src/analyzers/` exports a pure function `analyzeX(commits, trackedFiles, ...extras): XReport`. Verify:

- Analyzer functions are **pure** — no I/O, no state mutation of inputs. The only exceptions (e.g. `analyzeLoc` reading files, `analyzeRenameTracking` hitting git) must be clearly justified
- Input `commits` and `trackedFiles` must not be mutated — downstream analyzers share the same arrays
- Every new analyzer is wired into `src/runner.ts`, typed in `src/types.ts`, and (if public) exported from `src/index.ts`
- Each analyzer has a corresponding `.test.ts` next to it — flag any missing

### 3. Runner Orchestration

Review `src/runner.ts`:

- What happens when `getAllCommits()` returns zero commits? (Currently throws — is that the right behavior for `--since` filters that match nothing?)
- Analyzers run sequentially with `onProgress` callbacks. A thrown analyzer aborts the whole run — is that acceptable for every analyzer, or should non-essential ones (`renameTracking`, `complexityTrend`) be allowed to fail soft?
- The `backfill filesOwned` loop on contributors depends on `busFactors` running first — verify ordering invariants are documented or encoded, not just implicit
- `cursedFiles` depends on churn/busFactor/ageMap/forensics/parallelDev — verify all those run before it

### 4. Noise Filtering (`isIgnored`)

`utils/git.ts` filters noise files (lockfiles, images, dist/, .claude/, docs/, CLAUDE.md, CONTRIBUTING.md). Review:

- `IGNORED_PATTERNS.prefixes` hardcodes `docs/` and `.claude/` — this is opinionated. Projects that put real source under `docs/` will silently have it excluded. Is this the intended behavior?
- Rename-syntax lines (`src/{a => b}/file.ts`) are dropped entirely in `parseGitLog` — verify rename-tracking analyzer isn't expecting those rows
- Binary extensions list — is it complete? `.webp`, `.avif`, `.wasm`, `.pdf` are not excluded

### 5. Cross-Platform Path Handling

All analyzers consume file paths straight from `git ls-files` and `git log`, which always returns forward-slash paths on every OS — so analyzers are generally safe. Verify:

- No analyzer calls `path.join` and then compares to a forward-slash git path
- No analyzer uses `fullPath.replace(projectRoot + '/', '')` — this silently breaks on Windows
- `analyzeLoc` reads files from disk; verify it joins with `path.join(repoPath, file)` and doesn't double-separate

### 6. Date and Time Handling

Commit dates come in as ISO strings from `git log --format=%aI`. Review:

- Any analyzer doing date math — does it parse correctly across timezones?
- `commit-timing.ts` computes late-night/weekend patterns — is it using the commit's author timezone, or the runner's local time? Either choice has implications
- `ageInDays = (lastCommit - firstCommit) / 86_400_000` in `runner.ts` — this can be zero or negative for single-commit repos

### 7. Edge Cases Per Analyzer

Sample 5–6 analyzers and verify each handles:

- **Empty repo / empty commit list** — what does `analyzeX([], [])` return? Should not throw or divide by zero
- **Single author** — bus factor, knowledge concentration, ghost files should all produce sensible output
- **Single file** — coupling, blast radius, parallel-dev need ≥2 files to be meaningful
- **Single commit** — churn velocity, complexity trend need a time series
- **Very large repos** — `analyzeCoupling` builds N² file pairs; is there a cap or downsampling?

### 8. Type Contract Stability

`src/types.ts` is the wire format — the web dashboard and JSON consumers depend on it.

- Any recent renames or field removals? These silently break the web build (type-only imports won't catch at runtime)
- Fields that are optional on the wire (`?`) must have consumers that handle `undefined`

## Key Files

```
packages/core/src/
├── runner.ts               # Orchestrator — ordering, progress, error propagation
├── types.ts                # Wire format — stability matters
├── index.ts                # Public exports
├── utils/git.ts            # ALL git execution — exec-discipline boundary
└── analyzers/              # 22 analyzers — sample 5–6 for contract compliance
    ├── cursed-files.ts     # Cross-analyzer consumer — ordering-sensitive
    ├── coupling.ts         # N² risk
    ├── rename-tracking.ts  # Known exec-discipline violator
    └── commit-timing.ts    # Timezone-sensitive
```

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. Start with the exec-discipline grep, then sample 5–6 analyzers for empty-input edge cases, then review `runner.ts` ordering. Skip style issues and docstring nits entirely — focus on correctness findings.
