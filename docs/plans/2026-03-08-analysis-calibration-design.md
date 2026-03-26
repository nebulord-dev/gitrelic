# Design: Analysis Calibration

> Four tightly coupled fixes to make Gitlore's analysis meaningful across repos of all sizes and ages.

## Problem

Running Gitlore against a 115-file, 3-month-old Next.js repo surfaced 63 cursed files (over half), flagged contributors as "ghosts" in a repo that's barely existed, and included noise files like `pnpm-lock.yaml` in churn analysis. The root causes:

1. No ignore list — lock files, assets, and generated files pollute every analyzer
2. Cursed file scoring is too loose — moderate signals in any two dimensions qualify a file
3. Active/ghost/stale thresholds are hardcoded to absolute time — they don't scale with repo age
4. No `--since` default — young repos get penalized by analyzing their entire (short) history as if it were decades of tech debt

## Solution Overview

All four fixes live in `packages/core` with a small CLI default change. They're ordered by dependency: ignore list first (reduces noise for everything else), then scoring, then time-relative thresholds, then `--since` default.

---

## 1. Ignore List (Hardcoded Defaults)

**File**: `packages/core/src/utils/git.ts` — `getTrackedFiles()`

Filter `git ls-files` output through a built-in ignore list before returning. Every analyzer benefits automatically.

**Patterns:**
```
// Lock files
package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lockb

// Assets & binary-ish files
*.ico, *.png, *.jpg, *.jpeg, *.gif, *.svg, *.woff, *.woff2, *.ttf, *.eot

// Generated / build output
*.min.js, *.min.css, *.map
.next/*, dist/*, coverage/*

// Common framework generated files
next-env.d.ts, vite-env.d.ts
```

**Approach**: Simple matching — `string.endsWith` for extensions, exact match for filenames, `string.startsWith` for directory prefixes. No full gitignore parser needed.

**Future**: The kanban has a `lore.config.ts` item for user-configurable ignore patterns. This hardcoded list will become the defaults that config extends.

---

## 2. Tighten Cursed File Scoring

**File**: `packages/core/src/analyzers/cursed-files.ts`

**Raise minimum threshold** from 30 → 50.

**Recalibrated score contributions:**

| Signal | Current | New |
|--------|---------|-----|
| Churn > 75 | +40 | +35 |
| Churn > 40 | +20 | +15 |
| Bus factor critical (>80% one author) | +35 | +30 |
| Bus factor high | +20 | +15 |
| Too many authors (>5) | +15 | +10 |
| Age paradox (young + high churn) | +10 | +10 |

**Key effect**: A file now needs at least two strong signals to qualify. Moderate churn + high bus factor = 30, which is under threshold. Only genuinely multi-signal files like hot churn + critical ownership = 65 clear comfortably.

**Candidate pool**: Unchanged — still `churn.topFiles` (top 20) + `busFactor.criticalFiles`.

---

## 3. Relative Active Windows (Percentage-Based)

**Files**: `packages/core/src/analyzers/contributors.ts` + `packages/core/src/analyzers/age-map.ts`

All time thresholds become percentages of repo age. The runner already computes `ageInDays`.

**Contributors:**
- "active" = committed in last **25%** of repo age
- "ghost" = no commits in last **50%** of repo age

**Age map:**
- fresh = ≤ **8%** of repo age
- aging = ≤ **33%** of repo age
- stale = ≤ **66%** of repo age
- ancient = > **66%** of repo age

**Scaling examples:**

| Repo age | Active | Ghost | Fresh | Aging | Stale | Ancient |
|----------|--------|-------|-------|-------|-------|---------|
| 3mo (90d) | 23d | 45d | 7d | 30d | 59d | 59d+ |
| 1yr (365d) | 91d | 183d | 29d | 120d | 241d | 241d+ |
| 3yr (1095d) | 274d | 548d | 88d | 361d | 723d | 723d+ |

The 1-year row nearly matches current hardcoded values — existing behavior preserved for typical repos.

**Signature changes:**
- `analyzeAgeMap(commits, trackedFiles)` → `analyzeAgeMap(commits, trackedFiles, repoAgeDays)`
- `analyzeContributors(commits)` → `analyzeContributors(commits, repoAgeDays)`

Both receive `ageInDays` from the runner, which already computes it.

---

## 4. `--since` Default to 12 Months

**Files**: `apps/cli/src/index.tsx` (default value)

- Default `--since` to `"12 months ago"` when omitted
- Support `--since all` as a special keyword that passes `undefined` to core (no filter)
- Young repos (< 12 months) naturally return all their commits anyway — no special handling needed

---

## Decisions

- **Hardcoded ignore list only** — no config file yet (future kanban item)
- **Percentage-based scaling with no floors** — a 1-month repo having 7-day "active" window feels right
- **Score tightening over hard caps** — no artificial "top N" limit on cursed files
- **`--since all` keyword** — simple opt-out for full history analysis
