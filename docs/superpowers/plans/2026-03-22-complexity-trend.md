# Complexity Over Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complexity-trend analyzer that tracks net LOC growth per file across monthly buckets, surfacing which files are growing vs. shrinking.

**Architecture:** Pure function analyzer using existing `fileStats` (insertions/deletions) from `RawCommit`. Buckets net lines by `YYYY-MM`, computes cumulative growth and recent growth rate, classifies trend as growing/shrinking/stable. Same pattern as all other analyzers.

**Tech Stack:** TypeScript, Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-complexity-trend-design.md`

---

### Task 1: Add types to `types.ts`

**Files:**
- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: Add complexity trend types**

Add after the `HotspotClusterReport` section (after line 413):

```typescript
// ─── Complexity trend ─────────────────────────────────────────────────

export interface FileGrowthBucket {
  month: string;        // "2025-06"
  netLines: number;     // insertions - deletions that month
  cumulative: number;   // running total of net lines within the analysis window (not absolute file size)
}

export interface FileComplexityTrend {
  file: string;
  buckets: FileGrowthBucket[];
  totalNetLines: number;          // sum of all net lines across all buckets
  recentGrowthRate: number;       // avg net lines/month over last 3 active months
  trend: GrowthTrend;
}

export type GrowthTrend = 'growing' | 'shrinking' | 'stable';

export interface ComplexityTrendReport {
  files: FileComplexityTrend[];
  growingFiles: FileComplexityTrend[];   // top 10 growers by recentGrowthRate
  shrinkingFiles: FileComplexityTrend[]; // top 10 shrinkers
  summary: string;
}
```

- [ ] **Step 2: Add `complexityTrend` to `GitloreReport`**

Add `complexityTrend: ComplexityTrendReport;` to the `GitloreReport` interface, after the `hotspotClusters` field (line 26):

```typescript
  hotspotClusters: HotspotClusterReport;
  complexityTrend: ComplexityTrendReport;
```

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core): add complexity trend types"
```

---

### Task 2: Write tests for the analyzer

**Files:**
- Create: `packages/core/src/analyzers/complexity-trend.test.ts`

- [ ] **Step 1: Write test file**

Use the `makeCommit` helper pattern from `churn-velocity.test.ts`. The `fileStats` field on `RawCommit` is an array of `{ file, insertions, deletions }`.

```typescript
import { describe, it, expect } from 'vitest';
import type { RawCommit } from '../utils/git.js';
import { analyzeComplexityTrend } from './complexity-trend.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc', authorEmail: 'a@b.com', authorName: 'A',
    date: '2025-06-01T00:00:00Z', message: '', files: [],
    fileStats: [], insertions: 0, deletions: 0, ...overrides,
  };
}

describe('analyzeComplexityTrend', () => {
  it('returns empty report for no commits', () => {
    const result = analyzeComplexityTrend([], []);
    expect(result.files).toHaveLength(0);
    expect(result.growingFiles).toHaveLength(0);
    expect(result.shrinkingFiles).toHaveLength(0);
    expect(result.summary).toBeTruthy();
  });

  it('classifies a growing file', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 20, deletions: 5 }] }),
      makeCommit({ hash: '2', date: '2025-02-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 25, deletions: 3 }] }),
      makeCommit({ hash: '3', date: '2025-03-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 30, deletions: 10 }] }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.files).toHaveLength(1);
    expect(result.files[0].trend).toBe('growing');
    expect(result.files[0].totalNetLines).toBe(57); // (20-5) + (25-3) + (30-10)
    expect(result.growingFiles).toHaveLength(1);
  });

  it('classifies a shrinking file', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 2, deletions: 20 }] }),
      makeCommit({ hash: '2', date: '2025-02-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 3, deletions: 25 }] }),
      makeCommit({ hash: '3', date: '2025-03-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 1, deletions: 15 }] }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.files[0].trend).toBe('shrinking');
    expect(result.shrinkingFiles).toHaveLength(1);
  });

  it('classifies a stable file (net change within threshold)', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 10, deletions: 8 }] }),
      makeCommit({ hash: '2', date: '2025-02-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 5, deletions: 7 }] }),
      makeCommit({ hash: '3', date: '2025-03-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 8, deletions: 6 }] }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.files[0].trend).toBe('stable');
  });

  it('excludes files with fewer than 2 active months', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 50, deletions: 0 }] }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('uses last 3 active months for recentGrowthRate, not calendar months', () => {
    // Activity in Jan, Mar, Sep (skipping Feb, Apr-Aug)
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 10, deletions: 0 }] }),
      makeCommit({ hash: '2', date: '2025-03-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 20, deletions: 0 }] }),
      makeCommit({ hash: '3', date: '2025-09-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 30, deletions: 0 }] }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    // Last 3 active months: Jan(+10), Mar(+20), Sep(+30) → avg = 20
    expect(result.files[0].recentGrowthRate).toBe(20);
  });

  it('excludes files not in trackedFiles', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-15T00:00:00Z', files: ['a.ts', 'deleted.ts'], fileStats: [
        { file: 'a.ts', insertions: 10, deletions: 0 },
        { file: 'deleted.ts', insertions: 10, deletions: 0 },
      ] }),
      makeCommit({ hash: '2', date: '2025-02-15T00:00:00Z', files: ['a.ts', 'deleted.ts'], fileStats: [
        { file: 'a.ts', insertions: 10, deletions: 0 },
        { file: 'deleted.ts', insertions: 10, deletions: 0 },
      ] }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.files.map(f => f.file)).toEqual(['a.ts']);
  });

  it('computes cumulative values correctly across buckets', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 10, deletions: 0 }] }),
      makeCommit({ hash: '2', date: '2025-02-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 2, deletions: 5 }] }),
      makeCommit({ hash: '3', date: '2025-03-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 8, deletions: 0 }] }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    const buckets = result.files[0].buckets;
    expect(buckets[0]).toEqual({ month: '2025-01', netLines: 10, cumulative: 10 });
    expect(buckets[1]).toEqual({ month: '2025-02', netLines: -3, cumulative: 7 });
    expect(buckets[2]).toEqual({ month: '2025-03', netLines: 8, cumulative: 15 });
  });

  it('sorts by absolute recentGrowthRate with alphabetical tiebreaker', () => {
    const commits = [
      // b.ts: +10/month (growing)
      makeCommit({ hash: '1', date: '2025-01-15T00:00:00Z', files: ['b.ts'], fileStats: [{ file: 'b.ts', insertions: 10, deletions: 0 }] }),
      makeCommit({ hash: '2', date: '2025-02-15T00:00:00Z', files: ['b.ts'], fileStats: [{ file: 'b.ts', insertions: 10, deletions: 0 }] }),
      // a.ts: +10/month (growing, same rate, but alphabetically first)
      makeCommit({ hash: '3', date: '2025-01-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 10, deletions: 0 }] }),
      makeCommit({ hash: '4', date: '2025-02-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 10, deletions: 0 }] }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts', 'b.ts']);
    expect(result.files[0].file).toBe('a.ts');
    expect(result.files[1].file).toBe('b.ts');
  });

  it('produces a summary with counts', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 20, deletions: 0 }] }),
      makeCommit({ hash: '2', date: '2025-02-15T00:00:00Z', files: ['a.ts'], fileStats: [{ file: 'a.ts', insertions: 20, deletions: 0 }] }),
    ];
    const result = analyzeComplexityTrend(commits, ['a.ts']);
    expect(result.summary).toContain('growing');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/tracericochet/Desktop/dev/gitlore && pnpm --filter @gitlore/core test -- --run src/analyzers/complexity-trend.test.ts`

Expected: FAIL — `analyzeComplexityTrend` does not exist yet.

- [ ] **Step 3: Commit test file**

```bash
git add packages/core/src/analyzers/complexity-trend.test.ts
git commit -m "test(core): add complexity trend analyzer tests"
```

---

### Task 3: Implement the analyzer

**Files:**
- Create: `packages/core/src/analyzers/complexity-trend.ts`

- [ ] **Step 1: Write the analyzer**

```typescript
import type { RawCommit } from '../utils/git.js';
import type { ComplexityTrendReport, FileComplexityTrend, FileGrowthBucket, GrowthTrend } from '../types.js';

function getTrend(rate: number): GrowthTrend {
  if (rate > 5) return 'growing';
  if (rate < -5) return 'shrinking';
  return 'stable';
}

export function analyzeComplexityTrend(commits: RawCommit[], trackedFiles: string[]): ComplexityTrendReport {
  if (commits.length === 0) {
    return { files: [], growingFiles: [], shrinkingFiles: [], summary: 'No commits to analyze' };
  }

  const trackedSet = new Set(trackedFiles);

  // Step 1: Bucket net lines by file and month
  const fileBuckets = new Map<string, Map<string, number>>();
  for (const commit of commits) {
    const month = commit.date.slice(0, 7); // "YYYY-MM"
    for (const stat of (commit.fileStats ?? [])) {
      if (!trackedSet.has(stat.file)) continue;
      if (stat.insertions === 0 && stat.deletions === 0) continue;
      if (!fileBuckets.has(stat.file)) fileBuckets.set(stat.file, new Map());
      const months = fileBuckets.get(stat.file)!;
      months.set(month, (months.get(month) ?? 0) + stat.insertions - stat.deletions);
    }
  }

  // Step 2-5: Build entries, cumulate, classify, filter
  const files: FileComplexityTrend[] = [];
  for (const [file, monthMap] of fileBuckets) {
    const sortedMonths = [...monthMap.keys()].sort();
    if (sortedMonths.length < 2) continue;

    let cumulative = 0;
    const buckets: FileGrowthBucket[] = sortedMonths.map(month => {
      const netLines = monthMap.get(month)!;
      cumulative += netLines;
      return { month, netLines, cumulative };
    });

    const totalNetLines = buckets.reduce((sum, b) => sum + b.netLines, 0);
    const recentBuckets = buckets.slice(-3);
    const recentGrowthRate = Math.round(recentBuckets.reduce((sum, b) => sum + b.netLines, 0) / recentBuckets.length);

    files.push({ file, buckets, totalNetLines, recentGrowthRate, trend: getTrend(recentGrowthRate) });
  }

  // Step 6: Sort by absolute recentGrowthRate desc, alphabetical tiebreaker
  files.sort((a, b) => {
    const diff = Math.abs(b.recentGrowthRate) - Math.abs(a.recentGrowthRate);
    return diff !== 0 ? diff : a.file.localeCompare(b.file);
  });

  // Step 7: Top lists
  const growingFiles = files.filter(f => f.trend === 'growing').slice(0, 10);
  const shrinkingFiles = files
    .filter(f => f.trend === 'shrinking')
    .sort((a, b) => a.recentGrowthRate - b.recentGrowthRate)
    .slice(0, 10);

  // Step 8: Summary
  const growCount = files.filter(f => f.trend === 'growing').length;
  const shrinkCount = files.filter(f => f.trend === 'shrinking').length;
  const stableCount = files.filter(f => f.trend === 'stable').length;
  const summary = `${growCount} file${growCount !== 1 ? 's' : ''} growing, ${shrinkCount} shrinking, ${stableCount} stable`;

  return { files, growingFiles, shrinkingFiles, summary };
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd /Users/tracericochet/Desktop/dev/gitlore && pnpm --filter @gitlore/core test -- --run src/analyzers/complexity-trend.test.ts`

Expected: All 9 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/analyzers/complexity-trend.ts
git commit -m "feat(core): add complexity trend analyzer"
```

---

### Task 4: Integrate into runner and exports

**Files:**
- Modify: `packages/core/src/runner.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add import and call in `runner.ts`**

Add import after the hotspot-clustering import (line 27):

```typescript
import { analyzeComplexityTrend } from './analyzers/complexity-trend.js';
```

Add the analyzer call after the hotspot clustering call (after line 118), before the cursed files call:

```typescript
  onProgress?.('Tracking complexity trends...');
  const complexityTrend = analyzeComplexityTrend(commits, trackedFiles);
```

Add `complexityTrend` to the return object (after `hotspotClusters`):

```typescript
    hotspotClusters,
    complexityTrend,
```

- [ ] **Step 2: Add exports to `index.ts`**

Add to the type re-export block in `packages/core/src/index.ts`, after the `MultiSignalFile` line (line 57):

```typescript
  ComplexityTrendReport,
  FileComplexityTrend,
  FileGrowthBucket,
  GrowthTrend,
```

- [ ] **Step 3: Build core package to verify compilation**

Run: `cd /Users/tracericochet/Desktop/dev/gitlore && pnpm --filter @gitlore/core build`

Expected: Clean build, no errors.

- [ ] **Step 4: Run all core tests to verify nothing broke**

Run: `cd /Users/tracericochet/Desktop/dev/gitlore && pnpm --filter @gitlore/core test -- --run`

Expected: All tests pass, including the new complexity-trend tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/runner.ts packages/core/src/index.ts
git commit -m "feat(core): integrate complexity trend into runner and exports"
```

---

### Task 5: Update kanban

**Files:**
- Modify: `.claude/kanban.md`

- [ ] **Step 1: Strike through backlog entry**

Change the "Complexity over time" backlog entry to:

```markdown
~~#### Complexity over time~~ _(Done — see Done column)_
```

Remove the description line below it.

- [ ] **Step 2: Add Done entry**

Add to the Done section, after the hotspot health sentiment entry:

```markdown
### Complexity over time
Tracks net LOC growth per file across monthly buckets using existing `fileStats` data. Buckets insertions minus deletions by `YYYY-MM`, computes running cumulative, classifies each file as `growing`/`shrinking`/`stable` based on average net lines/month over last 3 active months (threshold: 5 lines/month). Files with <2 active months excluded. Sorted by absolute growth rate with alphabetical tiebreaker. 9 unit tests. Design spec: `docs/superpowers/specs/2026-03-22-complexity-trend-design.md`.
```

- [ ] **Step 3: Commit**

```bash
git add .claude/kanban.md
git commit -m "docs: update kanban — complexity trend done"
```
