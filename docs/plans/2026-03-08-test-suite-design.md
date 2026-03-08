# Design: Test Suite for @lore/core

> Vitest with coverage and UI, core package only, no enforced thresholds.

## Problem

Lore has no tests. All analysis logic lives in `packages/core` — analyzers, git primitives, scoring — with no way to verify correctness or catch regressions. The recent calibration work (relative thresholds, tightened scoring) especially needs test coverage since the math is nuanced.

## Solution Overview

Set up Vitest with V8 coverage and the Vitest UI across the monorepo, starting with `packages/core`. Tests are colocated with source files and use mock commit data — no real git repos needed.

## Configuration

### Dependencies (in `packages/core`)
- `vitest` — test runner
- `@vitest/coverage-v8` — V8-based coverage (fast, no instrumentation)
- `@vitest/ui` — web-based test viewer with coverage display

### Config files
- `vitest.workspace.ts` at root — workspace-aware config so CLI/web can plug in later
- `packages/core/vitest.config.ts` — package config with coverage settings

### Coverage settings
- Reporters: `text` (terminal) + `html` (for UI)
- No enforced thresholds — establish a baseline first, tighten later
- Coverage output to `packages/core/coverage/` (already gitignored)

### Scripts
- `packages/core/package.json`: `"test"`, `"test:ui"`, `"test:coverage"`
- Root `package.json`: `"test"` via turbo
- `turbo.json`: new `"test"` task (no build dependency — tests run against source via Vitest's native TS support)

## Test file structure

Colocated with source:

```
packages/core/src/
  utils/git.test.ts
  analyzers/churn.test.ts
  analyzers/bus-factor.test.ts
  analyzers/age-map.test.ts
  analyzers/contributors.test.ts
  analyzers/cursed-files.test.ts
```

## Test approach

All tests use mock `RawCommit[]` arrays built inline. No real git repos, no filesystem, no network. Fast and deterministic.

**Prerequisite**: Export `parseGitLog` and `isIgnored` from `git.ts` (currently private).

## What each test file covers

### `git.test.ts`
- `parseGitLog`: parses known git log output into `RawCommit[]`, handles empty input, skips rename noise
- `isIgnored`: exact filename matches, extension matches, prefix matches, passes through normal files

### `churn.test.ts`
- Score normalization (highest file gets 100)
- Category assignment (hot/warm/cold/frozen)
- Top files limited to 20
- Ignores deleted files not in tracked set

### `bus-factor.test.ts`
- Single-author file → critical risk
- Multi-author file → low risk
- Dominant author percentage calculation
- Critical files list accuracy

### `age-map.test.ts`
- Percentage-based thresholds at 90d, 365d, 1095d repo age
- Fresh/aging/stale/ancient classification
- Stale/ancient file counts
- Summary text adapts to repo age

### `contributors.test.ts`
- Active/ghost classification scales with repo age
- Focus areas extracted from file paths
- Lines changed aggregation
- Summary text includes correct day counts

### `cursed-files.test.ts`
- Threshold at 50 (files below don't appear)
- Multi-signal requirement (single moderate signal = excluded)
- Score contributions match calibrated values
- Score capped at 100
- Candidate pool from top churn + critical bus factor only

## Decisions

- **Core only for now** — CLI/web are thin rendering layers
- **No enforced thresholds** — baseline first, tighten later
- **V8 coverage over Istanbul** — faster, no instrumentation step
- **Workspace config at root** — future-proofs for CLI/web test packages
- **Export private functions** — `parseGitLog` and `isIgnored` need to be testable
