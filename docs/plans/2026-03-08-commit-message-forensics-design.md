# Commit Message Forensics — Design Doc

**Date:** 2026-03-08
**Status:** Approved

---

## Overview

Add a "shame score" per file based on commit message sentiment. Files with a high ratio of `revert`, `hotfix`, `oops`, and similar keywords are cursed in a different way than raw churn — they signal instability and repeated mistakes rather than just active development.

---

## Architecture

Hybrid approach: a new `ForensicsReport` lives as a top-level field on `LoreReport`, and its per-file shame scores feed into `CursedFile` scoring as an additional dimension.

---

## Section 1: Data Layer

`RawCommit` currently has no commit message field. The `git log` format string is extended to emit a `MSG|<subject>` line per commit:

```
--format=COMMIT|%H|%ae|%an|%aI%nMSG|%s
```

`parseGitLog` handles `MSG|` lines by slicing the prefix (safely handles `|` in message text). `RawCommit` gains a `message: string` field.

This is the only change to `git.ts` — all existing callers remain unaffected.

---

## Section 2: New Analyzer

### Types (`types.ts`)

```typescript
export interface ShamefulCommit {
  hash: string;
  message: string;
  date: string;
  shamePoints: number;     // weighted score from this commit's keywords
  keywords: string[];      // which keywords fired
}

export interface FileForensics {
  file: string;
  shameScore: number;          // 0–100 normalized ratio
  rawShamePoints: number;      // absolute weighted sum
  shameCommitCount: number;
  topShameCommits: ShamefulCommit[];   // top 3 by shamePoints
  dominantKeywords: string[];          // most frequent shame keywords
}

export interface ForensicsReport {
  files: FileForensics[];
  shameLeaderboard: FileForensics[];  // top 10 most shameful files
  totalShameCommits: number;
  summary: string;
}
```

### Keyword Tiers (`packages/core/src/analyzers/forensics.ts`)

| Weight | Keywords |
|--------|----------|
| 3 — Critical | `revert`, `hotfix`, `oops`, `fixup`, `broke`, `breaking` |
| 2 — Moderate | `hack`, `workaround`, `temporary`, `temp`, `kludge`, `band-aid` |
| 1 — Mild | `fix`, `bug`, `wrong`, `mistake`, `typo`, `cleanup` |

Matching is case-insensitive, whole-word against the commit subject line.

### Scoring Formula

For each file:

1. Collect all commits that touched it
2. For each commit, scan the message for shame keywords — sum weighted points → `shamePoints` for that commit
3. `rawShamePoints` = sum across all commits for the file
4. `shameScore` = `(rawShamePoints / totalCommitsForFile) * 100`, capped at 100

Ratio-based scoring ensures a file with 1 `revert` in 2 commits (shameScore ~150 → capped 100) ranks higher than 1 `revert` in 100 commits (shameScore ~3).

---

## Section 3: Integration

### `runner.ts`

```typescript
const forensics = analyzeForensics(commits, trackedFiles);
const cursedFiles = findCursedFiles(churn, busFactors, ageMap, forensics, commits.length);
```

`LoreReport` gains a `forensics: ForensicsReport` field.

### `cursed-files.ts`

Shame score adds up to **20 points** to the curse score (supporting signal, not dominant):

| Shame score | Curse bonus |
|-------------|-------------|
| ≥ 75 | +20 |
| ≥ 50 | +12 |
| ≥ 25 | +6 |
| < 25 | +0 |

Files that cross the curse threshold due to shame get a human-readable reason, e.g.:
`"5 revert commits detected — this file keeps breaking"`

---

## Section 4: CLI Surface

- **Default (no flag):** shame data works silently — feeds curse scores, appears in `CursedFile.reasons`. No dedicated output panel.
- **`--shame` flag:** renders a dedicated shame leaderboard panel showing the top shameful files with their offending commit messages and scores.

---

## Documentation

Two locations:

1. **JSDoc in `forensics.ts`** — inline documentation of keyword tiers and normalization formula for code readers
2. **`README.md` — "How Lore scores files" section** — prose + table explanation for end users covering churn score, shame score, and curse score

---

## Files Affected

| File | Change |
|------|--------|
| `packages/core/src/utils/git.ts` | Add `message` to `RawCommit`; extend format string; update `parseGitLog` |
| `packages/core/src/types.ts` | Add `ShamefulCommit`, `FileForensics`, `ForensicsReport`; add `forensics` to `LoreReport` |
| `packages/core/src/analyzers/forensics.ts` | New file — `analyzeForensics()` |
| `packages/core/src/analyzers/forensics.test.ts` | New file — unit tests |
| `packages/core/src/analyzers/cursed-files.ts` | Accept `forensics` param; add shame bonus to scoring |
| `packages/core/src/runner.ts` | Call `analyzeForensics`, pass to `findCursedFiles`, include in return |
| `apps/cli/src/index.tsx` | Add `--shame` flag |
| `apps/cli/src/components/App.tsx` | Render shame panel when flag is set |
| `README.md` | Add "How Lore scores files" section |
