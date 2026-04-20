---
name: audit-core
description: Use when auditing packages/core for analyzer correctness, exec-discipline violations, cross-platform path bugs, runner orchestration edge cases, report privacy leaks, date/time handling, or error handling gaps in git primitives. Run before merging any change that touches packages/core/.
---

# Audit: packages/core

Deep audit of the analysis engine. Focus on correctness, robustness, and what gets leaked into reports — this is what GitRelic runs against user repositories, and reports are served from the CLI's local HTTP server and written to stdout as JSON.

## Checklist

### 1. Exec Discipline (Critical)

All git command execution MUST go through `src/utils/git.ts`. See the `exec-discipline` skill for the full rule — this is the architectural invariant that lets core be reasoned about, tested, and mocked.

- Run: `grep -r "from 'execa'" packages/core/src/ --include='*.ts' | grep -v 'utils/git.ts' | grep -v '.test.ts'` — any result is a violation
- No `child_process` imports outside `utils/git.ts`, either — same rule applies
- New git commands must be added to `utils/git.ts`, accept `repoPath` as the first argument, and return typed data — never raw stdout. Parsing belongs in the git util, not scattered across analyzers

### 2. Analyzer Contract

Each file in `src/analyzers/` exports a pure function `analyzeX(commits, trackedFiles, ...extras): XReport`. Verify:

- Analyzer functions are **pure** — no I/O, no state mutation of inputs. The only exceptions (e.g. `analyzeLoc` reading files, `analyzeRenameTracking` calling into `utils/git.ts`) must be clearly justified and routed through the git util
- Input `commits` and `trackedFiles` must not be mutated — downstream analyzers share the same arrays. A sort-in-place in one analyzer silently reorders data for every later analyzer
- Every new analyzer is wired into `src/runner.ts`, typed in `src/types.ts`, and (if public) exported from `src/index.ts` — all three
- Each analyzer has a corresponding `.test.ts` next to it — flag any missing; a new analyzer without tests is a regression trap
- Analyzers that take thresholds or tuning knobs expose them via named options, not hardcoded literals buried in loops

### 3. Runner Orchestration

Review `src/runner.ts`:

- What happens when `getAllCommits()` returns zero commits? Currently throws — verify that's the right behavior for `--since` filters that match nothing (consider: `--since "tomorrow"` should fail fast with a clear message, not a cryptic crash)
- Analyzers run sequentially with `onProgress` callbacks. A thrown analyzer aborts the whole run — is that acceptable for every analyzer, or should non-essential ones (`renameTracking`, `complexityTrend`) be allowed to fail soft and leave an empty section in the report?
- The `backfill filesOwned` loop on contributors depends on `busFactors` running first — verify ordering invariants are documented or encoded, not just implicit
- `cursedFiles` consumes churn/busFactor/ageMap/forensics/parallelDev output — verify all those run before it, and that each is non-null when cursedFiles reads it
- `onProgress` callback is called frequently. It must not be allowed to crash the run if the caller throws (e.g. a broken Ink setState) — wrap callback invocations or document the contract

### 4. Noise Filtering (`isIgnored`)

`utils/git.ts` filters noise files (lockfiles, images, `dist/`, `.claude/`, `docs/`, `CLAUDE.md`, `CONTRIBUTING.md`). Review:

- `IGNORED_PATTERNS.prefixes` hardcodes `docs/` and `.claude/` — this is opinionated. Projects that put real source under `docs/` (VitePress sites like this one!) will silently have it excluded. Is this intended? If yes, is it configurable or documented?
- Rename-syntax lines (`src/{a => b}/file.ts`) are dropped entirely in `parseGitLog` — verify the rename-tracking analyzer isn't expecting those rows, since it relies on `git log --diff-filter=R --find-renames --name-status` instead
- Binary extensions list — is it complete? `.webp`, `.avif`, `.wasm`, `.pdf`, `.heic`, `.mp4`, `.mov` are easy misses; any asset class not excluded shows up in churn/LOC as a "file" with fake text content
- Pattern evaluation cost — `isIgnored` runs on every file of every commit. Any regex compilation inside the loop or O(n × patterns) pass over long strings is a hot spot

### 5. Cross-Platform Path Handling

All analyzers consume file paths straight from `git ls-files` and `git log`, which return forward-slash paths on every OS — so analyzer code is generally safe. But any crossing of the boundary into Node's `path` module is a risk.

- No analyzer should call `path.join` and then compare the result to a forward-slash git path — that breaks on Windows
- No analyzer uses `fullPath.replace(projectRoot + '/', '')` — this silently breaks on Windows where the separator is `\`
- `analyzeLoc` reads files from disk; verify it joins with `path.join(repoPath, file)` and doesn't double-separate, and that the file it reads is the one the git output named (not a case-folded variant on case-insensitive filesystems)
- Any runtime path derived from `import.meta.url` must go through `fileURLToPath` — `URL#pathname` returns `/C:/Users/...` on Windows and `node:fs` can't open it

### 6. Date and Time Handling

Commit dates come in as ISO strings from `git log --format=%aI` (author date) or `%cI` (committer date). Review:

- Any analyzer doing date math — does it parse correctly across timezones?
- `commit-timing.ts` computes late-night/weekend patterns. The report should reflect the **committer's local time** (which is what `%aI` encodes via offset), not the runner's local time. If it reprojects commits into the runner's timezone, it will misclassify every commit from a different timezone
- `ageInDays = (lastCommit - firstCommit) / 86_400_000` in `runner.ts` — can be zero (single-commit repo) or negative if someone rewrote history with backdated commits. Downstream code must not divide by it
- `--since` parsing is delegated to `git log`. Any value validation should happen in the CLI, not core; core should pass it through opaquely

### 7. Edge Cases Per Analyzer

Sample 5–6 analyzers (rotate each audit) and verify each handles:

- **Empty repo / empty commit list** — what does `analyzeX([], [])` return? Should return an empty-but-valid report, not throw or divide by zero
- **Single author** — bus factor, knowledge concentration, ghost files should all produce sensible output (bus factor of 1 is a real answer, not a null)
- **Single file** — coupling, blast radius, parallel-dev need ≥2 files to be meaningful; verify they return empty reports, not crashes
- **Single commit** — churn velocity, complexity trend need a time series; single-commit case must degrade gracefully
- **Very large repos** — `analyzeCoupling` builds N² file pairs. Is there a cap, a min-support filter, or downsampling? A 10k-file repo with no cap is ~50M pairs, which will OOM the process or produce an unrenderable report
- **Merge commits** — `git log` without `--no-merges` includes them. Do analyzers double-count changes that appear in both the merge and its parents?
- **Re-parenting / rebase-rewritten history** — do analyzers tolerate non-linear history, or do they assume chronological order?

### 8. Report Privacy

Reports are served from the CLI's local HTTP server (`--web`), written to stdout as JSON (`--json`), and end up in PR attachments and bug reports. Audit what leaks out.

- **Absolute paths with usernames** — every path in a report must be repo-relative. `git ls-files` and `git log --name-only` already return relative paths, but any analyzer that builds `path.join(repoPath, file)` and then embeds that absolute path in the report is a leak. Grep for `repoPath` in analyzer files and trace where its value flows
- **Author emails** — `contributors.ts` includes email addresses by design. Confirm this is intentional (it is — but the report is trivially shareable, so users should be able to understand it's in there)
- **Commit messages in `forensics.ts` / `cursed-files.ts`** — these can contain anything the committer wrote: API keys, internal URLs, offensive language. The report embeds them verbatim. Acceptable (this is what the git log contains), but worth a mental check whenever the selection logic changes
- **Stack traces** — if an analyzer fails and the runner embeds the error in a report section, the stack trace can contain absolute paths. Scrub or redact before embedding
- **Environment variables** — grep `packages/core/src/` for `process.env`. Any serialization of `process.env.*` into a report field is a leak

### 9. Type Contract Stability

`src/types.ts` is the wire format — the web dashboard, JSON consumers, and snapshot tests all depend on it.

- Any recent renames or field removals? Type-only imports in the web won't catch these at build time — the dashboard silently receives `undefined` and crashes at render
- Fields that are optional on the wire (`?`) must have consumers that handle `undefined`. The dashboard's `normalizeReport.ts` backfills missing sections for older reports — verify it stays aligned with the current type shape
- Adding a new field is safe; renaming or removing one is a breaking change for every downstream consumer. Treat wire-format diffs as a separate review concern

### 10. Snapshot Regression Suite

`src/fixture-regression.test.ts` builds a deterministic fixture repo via `tests/fixtures/build-sample-repo.sh` (pinned authors/dates/messages → stable commit hashes) and runs the full `runGitrelic()` pipeline against it. Each analyzer section is snapshotted separately so drift shows up as a focused diff instead of a monolithic blob.

- Run `pnpm --filter @gitrelic/core test -- fixture-regression` — must pass
- After any change to a runner, analyzer, scoring, or `isIgnored` — intentional diffs get updated with `-u` and explained in the PR description
- A snapshot diff in an analyzer section you didn't intend to affect is a leak — trace it before updating. Common culprits: a shared helper in `utils/git.ts` changing its output shape, or `isIgnored` expanding its filter set
- The fixture repo itself must stay deterministic — any change to `build-sample-repo.sh` that touches author names, dates, or commit order invalidates every committed snapshot

### 11. Test Coverage

- Every analyzer in `src/analyzers/` must have a corresponding `.test.ts`
- Critical utils (`utils/git.ts`) must have thorough unit tests — parsing `git log` output is where subtle format drift hides
- Check for analyzers with no tests or only smoke tests; flag them. Current count: 22 analyzers; every one should be testable offline (no live git repo required) using hand-constructed `RawCommit[]` arrays

## Key Files

```
packages/core/src/
├── runner.ts                  # Orchestrator — ordering, progress, error propagation
├── types.ts                   # Wire format — stability matters
├── index.ts                   # Public exports
├── fixture-regression.test.ts # End-to-end snapshot suite
├── utils/git.ts               # ALL git execution — exec-discipline boundary
└── analyzers/                 # 22 analyzers — sample 5–6 for contract compliance
    ├── cursed-files.ts        # Cross-analyzer consumer — ordering-sensitive
    ├── coupling.ts            # N² risk
    ├── rename-tracking.ts     # Hits git via utils/git.ts
    ├── commit-timing.ts       # Timezone-sensitive
    ├── forensics.ts           # Embeds raw commit messages — privacy surface
    └── loc.ts                 # Reads files from disk — path.join + Windows risk
tests/fixtures/build-sample-repo.sh  # Deterministic fixture generator
```

## Output Format

Dispatched reviewer should report findings as:

```
[Severity: High|Medium|Low] path/to/file.ts:123
What's wrong: <one-line description>
Why it matters: <impact on users or maintainers>
Suggested fix: <concrete change>
```

Skip style/formatting issues entirely — oxlint and oxfmt handle those.

## How to Run

Dispatch a `feature-dev:code-reviewer` agent. First action: run the exec-discipline grep and flag any violation. Then run `pnpm --filter @gitrelic/core test -- fixture-regression` and surface the result. Then sample 5–6 analyzers for empty-input edge cases, review `runner.ts` ordering, and scan `forensics.ts` / `cursed-files.ts` for privacy concerns.

Prioritize in this order: exec discipline → snapshot regressions → analyzer purity / mutation of shared inputs → N² performance → privacy → everything else.

## Related Audits

- Adding/removing a runtime dep in core → run **audit-architecture** (bundled-deps mirror must update in the same PR)
- Changing `types.ts` → run **audit-web** (type-only imports must still compile; `normalizeReport.ts` must backfill missing fields)
- New `utils/git.ts` function used by the CLI → run **audit-cli** (lifecycle / error propagation)
