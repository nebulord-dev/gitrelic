# Phase 2: LOC, Hotspot Score & Coupling Map

**Date:** 2026-03-14
**Status:** Approved
**Scope:** Three new core analyzers + runner integration + CLI/web UI surfaces

## Context

GitLore's Phase 1 (hygiene, tests, rename) is complete. Phase 2 introduces the core analyzers that make GitLore a serious behavioral code analysis tool. This spec covers the first batch: LOC counting, the Tornhill hotspot formula, and temporal coupling detection.

**Dependency chain:** `loc` → `hotspot` (needs LOC data). `coupling` is independent.

## Design Decisions

- **Pure filesystem for LOC** — no `cloc` dependency. Count lines by reading tracked files directly. Keeps GitLore's zero-external-tool philosophy intact. Language detection via file extension mapping (extending existing `detectPrimaryLanguage` logic).
- **Three independent analyzers** — follows established pattern of stateless functions. LOC produces data reusable by future features (treemap sizing, language panel, file drill-down).
- **Coupling filters** — minimum 3 co-occurrences AND minimum 30% coupling strength. Commits touching 30+ files excluded (bulk operations create false coupling).
- **No cursed file changes** — hotspot and coupling data could feed into curse scoring later but that's a separate decision.

---

## Analyzer 1: LOC (`loc.ts`)

**File:** `packages/core/src/analyzers/loc.ts`

**Signature:**
```typescript
analyzeLoc(trackedFiles: string[], repoPath: string): Promise<LocReport>
```

First async analyzer in the codebase (requires filesystem access).

### Types

```typescript
interface FileLocEntry {
  file: string;
  lines: number;
  language: string;       // derived from file extension
}

interface LanguageBreakdown {
  language: string;
  files: number;
  lines: number;
  percentage: number;     // of total LOC
}

interface LocReport {
  totalFiles: number;
  totalLines: number;
  files: FileLocEntry[];
  languages: LanguageBreakdown[];
  summary: string;          // e.g. "42,130 lines across 215 files (68% TypeScript, 20% CSS)"
}
```

### Behavior

- Read each tracked file, count newlines (`\n`).
- Binary files already filtered by `getTrackedFiles()` ignore list.
- Map file extensions to language names using an extended version of the existing extension map from `detectPrimaryLanguage`.
- Aggregate per-language stats (file count, total lines, percentage of repo).
- Files that fail to read (permissions, symlinks, etc.) silently skipped with `lines: 0`.

---

## Analyzer 2: Hotspot Score (`hotspot.ts`)

**File:** `packages/core/src/analyzers/hotspot.ts`

**Signature:**
```typescript
analyzeHotspots(churnReport: ChurnReport, locReport: LocReport): HotspotReport
```

Synchronous — pure math on two existing reports.

### Types

```typescript
interface HotspotEntry {
  file: string;
  hotspotScore: number;     // 0-100, normalized
  churnScore: number;       // from ChurnReport
  loc: number;              // from LocReport
  category: 'critical' | 'warning' | 'moderate' | 'low';
}

interface HotspotReport {
  files: HotspotEntry[];       // sorted by hotspotScore descending
  topHotspots: HotspotEntry[]; // top 20
  summary: string;             // e.g. "5 critical hotspots, 12 warnings across 215 files"
}
```

### Scoring Formula

```
rawScore = churnScore × log2(loc)
```

`churnScore` is the existing 0-100 normalized value from `FileChurn.churnScore`, not the raw commit count. Logarithmic LOC because complexity grows sublinearly with file size — a 10,000-line file isn't 100x more complex than a 100-line file. Standard Tornhill approach.

Normalize all raw scores to 0-100 relative to the repo maximum (same pattern as churn scoring).

### Categories

| Category | Score Range |
|----------|------------|
| critical | 75-100 |
| warning  | 50-74 |
| moderate | 25-49 |
| low      | 0-24 |

### Edge Cases

- Files in churn but not in LOC (deleted since last commit): excluded.
- Files in LOC but not in churn (zero commits in window): excluded — no churn = no hotspot.
- Files with 0 or 1 lines: clamp LOC to `Math.max(1, loc)` before applying `log2` to avoid `-Infinity`. Result: `log2(1) = 0`, hotspot score = 0. Correct — tiny/empty files aren't complexity risks.

---

## Analyzer 3: Coupling Map (`coupling.ts`)

**File:** `packages/core/src/analyzers/coupling.ts`

**Signature:**
```typescript
analyzeCoupling(commits: RawCommit[], trackedFiles: string[]): CouplingReport
```

Synchronous — works from in-memory commit data.

### Types

```typescript
interface CoupledPair {
  fileA: string;
  fileB: string;
  coCommits: number;         // times co-appearing in the same commit
  totalCommitsA: number;
  totalCommitsB: number;
  couplingStrength: number;  // 0-100
}

interface FileCouplingProfile {
  file: string;
  partners: CoupledPair[];    // sorted by couplingStrength descending
  topPartner: string | null;
  couplingScore: number;      // 0-100, average strength across partners
}

interface CouplingReport {
  pairs: CoupledPair[];                // all qualifying pairs, sorted by strength
  fileProfiles: FileCouplingProfile[];  // per-file view
  topPairs: CoupledPair[];             // top 20 strongest
  summary: string;                     // e.g. "38 coupled pairs found, strongest: auth.ts ↔ session.ts (92%)"
}
```

### Algorithm

1. Filter out commits touching 30+ files (bulk operations).
2. For each remaining commit, record every file pair that co-appeared.
3. Accumulate co-occurrence counts across all commits.
4. Filter pairs: minimum 3 co-occurrences AND minimum 30% coupling strength.
5. Build per-file profiles from qualifying pairs.

### Coupling Strength Formula

```
couplingStrength = coCommits / min(totalCommitsA, totalCommitsB) × 100
```

Uses the less-changed file's count as denominator. If `auth.ts` has 50 commits and `session.ts` has 10, and they co-appear 8 times, strength = 80%. The signal: `session.ts` almost never changes without `auth.ts`.

### Per-File Coupling Score

Average coupling strength across all qualifying partners. Files with many strong coupling partners score high — they're architectural nexuses.

---

## Runner Integration

**File:** `packages/core/src/runner.ts`

### Execution Order

```
commits → churn, busFactor, ageMap, contributors, forensics, parallelDev
        → loc (async, reads filesystem)
        → hotspots (from churn + loc)
        → coupling (from commits)
        → cursedFiles (unchanged)
```

LOC runs after git-based analyzers (filesystem access). Hotspots after LOC + churn complete. Coupling independent.

### Progress Callbacks

Three new steps added to `onProgress`:
- `"Counting lines of code..."`
- `"Computing hotspot scores..."`
- `"Mapping file coupling..."`

### GitloreReport Additions

```typescript
interface GitloreReport {
  // ... existing fields ...
  loc: LocReport;
  hotspots: HotspotReport;
  coupling: CouplingReport;
}
```

---

## UI Surfaces

### CLI (Ink)

**Hotspot Panel** (Red/Orange) — top 10 files by hotspot score. Each row: filename, hotspot score bar (`█░`), LOC count, category badge. Shows by default.

**Coupling Panel** (Blue) — top 10 strongest coupled pairs. Each row: `fileA ↔ fileB`, coupling strength percentage, co-commit count. Shows by default.

### Web Dashboard

**Hotspots tab** — replaces current "Hotspots" tab (which currently shows raw churn). Shows composite hotspot score alongside churn and LOC per file, sorted by hotspot score. Category badges color-coded (critical=red, warning=orange, moderate=yellow, low=green).

**Coupling tab** — new sixth tab. Top coupled pairs as ranked list with strength bars. Below: searchable per-file view, click any file to see its coupling partners.

**Overview tab** — "Top Hotspots" card switches from churn data to hotspot scores (more meaningful ranking).

### Not in scope

Phase 3 visualizations (treemap, force-directed coupling graph, hotspot matrix scatter plot) consume this data but are not part of this batch. This spec covers the data layer and basic list/table views only.

---

## Testing Strategy

All tests colocated with source files.

**`loc.test.ts`:**
- Count lines for known file contents (mock `fs.readFile`)
- Language detection from extensions
- Language breakdown aggregation
- Graceful handling of unreadable files

**`hotspot.test.ts`:**
- Score formula: known churn + LOC inputs → expected hotspot scores
- Normalization to 0-100
- Category assignment at boundaries
- Edge cases: deleted files, zero-churn files, single-line files

**`coupling.test.ts`:**
- Co-occurrence counting from known commit sets
- Filtering: 30+ file commits excluded
- Threshold filtering: min 3 co-occurrences, min 30% strength
- Strength formula with asymmetric commit counts
- Per-file profile aggregation
- Empty case: no qualifying pairs → empty report

---

## Files Modified/Created

**New files:**
- `packages/core/src/analyzers/loc.ts`
- `packages/core/src/analyzers/loc.test.ts`
- `packages/core/src/analyzers/hotspot.ts`
- `packages/core/src/analyzers/hotspot.test.ts`
- `packages/core/src/analyzers/coupling.ts`
- `packages/core/src/analyzers/coupling.test.ts`

**Modified files:**
- `packages/core/src/types.ts` — add `LocReport`, `HotspotReport`, `CouplingReport` types and add fields to `GitloreReport`
- `packages/core/src/runner.ts` — call new analyzers, add progress steps
- `apps/cli/src/components/App.tsx` — add Hotspot Panel and Coupling Panel
- `apps/web/src/components/Dashboard.tsx` — replace Hotspots tab content, add Coupling tab, update Overview card
