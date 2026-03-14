# Phase 2 Batch 2: Churn Velocity, Rewrite Ratio, Blast Radius, Dead Code — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four new core analyzers with CLI panels. Web surfaces deferred to Phase 3.

**Architecture:** Four stateless synchronous analyzer functions. All work from existing `RawCommit[]` data — no new git primitives or filesystem access needed. Each produces an independent report on `CodeloreReport`.

**Tech Stack:** TypeScript, Vitest, Ink (CLI)

---

## File Structure

**New files:**
| File | Responsibility |
|------|----------------|
| `packages/core/src/analyzers/churn-velocity.ts` | Per-file churn rate trend (accelerating/decelerating/stable) |
| `packages/core/src/analyzers/churn-velocity.test.ts` | Tests |
| `packages/core/src/analyzers/rewrite-ratio.ts` | Per-file insertion/deletion rewrite scoring |
| `packages/core/src/analyzers/rewrite-ratio.test.ts` | Tests |
| `packages/core/src/analyzers/blast-radius.ts` | Per-file co-change breadth measurement |
| `packages/core/src/analyzers/blast-radius.test.ts` | Tests |
| `packages/core/src/analyzers/dead-code.ts` | Files with zero churn in analysis window |
| `packages/core/src/analyzers/dead-code.test.ts` | Tests |

**Modified files:**
| File | Change |
|------|--------|
| `packages/core/src/types.ts` | Add 4 report types + fields on `CodeloreReport` |
| `packages/core/src/index.ts` | Export new types |
| `packages/core/src/runner.ts` | Call 4 new analyzers, add progress steps |
| `apps/cli/src/components/App.tsx` | Add 4 CLI panels |

---

## Chunk 1: Types

### Task 1: Add types for all four analyzers

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add Churn Velocity types to `types.ts`**

Add after the Coupling section:

```typescript
// ─── Churn velocity ──────────────────────────────────────────────────────────

export interface FileChurnVelocity {
  file: string;
  velocityScore: number;        // 0-100, higher = more accelerating
  trend: ChurnTrend;
  recentCommits: number;        // commits in recent half of window
  olderCommits: number;         // commits in older half of window
  totalCommits: number;
}

export type ChurnTrend = 'accelerating' | 'decelerating' | 'stable';

export interface ChurnVelocityReport {
  files: FileChurnVelocity[];
  acceleratingFiles: FileChurnVelocity[];  // top 10 accelerating
  summary: string;
}

// ─── Rewrite ratio ──────────────────────────────────────────────────────────

export interface FileRewriteRatio {
  file: string;
  rewriteScore: number;         // 0-100, higher = more rewriting
  totalInsertions: number;
  totalDeletions: number;
  ratio: number;                // 0-1, min(ins,del)/max(ins,del)
}

export interface RewriteRatioReport {
  files: FileRewriteRatio[];
  topRewriters: FileRewriteRatio[];  // top 10 by rewrite score
  summary: string;
}

// ─── Blast radius ───────────────────────────────────────────────────────────

export interface FileBlastRadius {
  file: string;
  blastScore: number;           // 0-100, normalized
  avgCoChangedFiles: number;    // average other files in same commit
  maxCoChangedFiles: number;    // peak co-changed files in a single commit
  totalCommits: number;
}

export interface BlastRadiusReport {
  files: FileBlastRadius[];
  topBlasters: FileBlastRadius[];  // top 10 by blast score
  summary: string;
}

// ─── Dead code candidates ───────────────────────────────────────────────────

export interface DeadCodeCandidate {
  file: string;
  lastCommitDate: string;       // ISO date, from age map
  ageInDays: number;
  language: string;             // from LOC data
  loc: number;                  // from LOC data
}

export interface DeadCodeReport {
  candidates: DeadCodeCandidate[];
  totalDeadFiles: number;
  totalDeadLines: number;
  summary: string;
}
```

- [ ] **Step 2: Add new fields to `CodeloreReport`**

```typescript
export interface CodeloreReport {
  // ... existing fields ...
  coupling: CouplingReport;
  churnVelocity: ChurnVelocityReport;
  rewriteRatio: RewriteRatioReport;
  blastRadius: BlastRadiusReport;
  deadCode: DeadCodeReport;
}
```

- [ ] **Step 3: Export new types from `index.ts`**

```typescript
  ChurnVelocityReport,
  FileChurnVelocity,
  ChurnTrend,
  RewriteRatioReport,
  FileRewriteRatio,
  BlastRadiusReport,
  FileBlastRadius,
  DeadCodeReport,
  DeadCodeCandidate,
```

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts
git commit -m "feat(core): add churn velocity, rewrite ratio, blast radius, dead code types"
```

---

## Chunk 2: Churn Velocity Analyzer

### Task 2: Churn Velocity — Tests then Implementation

**Files:**
- Create: `packages/core/src/analyzers/churn-velocity.test.ts`
- Create: `packages/core/src/analyzers/churn-velocity.ts`

**Signature:**
```typescript
analyzeChurnVelocity(commits: RawCommit[], trackedFiles: string[]): ChurnVelocityReport
```

**Algorithm:**
1. For each tracked file, collect its commit dates.
2. Split the analysis time window (first commit to last commit) into two halves.
3. Count commits in each half: `recentCommits` vs `olderCommits`.
4. Velocity score: `recentCommits / (recentCommits + olderCommits) × 100`. Score of 50 = stable, >50 = accelerating, <50 = decelerating.
5. Trend: `accelerating` if score > 60, `decelerating` if score < 40, otherwise `stable`.
6. Files with fewer than 2 commits: excluded (not enough data for trend).

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import type { RawCommit } from '../utils/git.js';
import { analyzeChurnVelocity } from './churn-velocity.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc', authorEmail: 'a@b.com', authorName: 'A',
    date: '2025-06-01T00:00:00Z', message: '', files: [],
    insertions: 0, deletions: 0, ...overrides,
  };
}

describe('analyzeChurnVelocity', () => {
  it('classifies file with recent-heavy commits as accelerating', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-10-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-11-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '4', date: '2025-12-01T00:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.files[0].trend).toBe('accelerating');
    expect(result.files[0].velocityScore).toBeGreaterThan(60);
  });

  it('classifies file with old-heavy commits as decelerating', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-02-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-03-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '4', date: '2025-12-01T00:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.files[0].trend).toBe('decelerating');
    expect(result.files[0].velocityScore).toBeLessThan(40);
  });

  it('classifies evenly spread commits as stable', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-04-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '3', date: '2025-08-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '4', date: '2025-12-01T00:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.files[0].trend).toBe('stable');
  });

  it('excludes files with fewer than 2 commits', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('only includes tracked files', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts', 'deleted.ts'] }),
      makeCommit({ hash: '2', date: '2025-06-01T00:00:00Z', files: ['a.ts', 'deleted.ts'] }),
    ];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.files.map(f => f.file)).toEqual(['a.ts']);
  });

  it('returns top 10 accelerating files', () => {
    const result = analyzeChurnVelocity([], []);
    expect(result.acceleratingFiles).toBeDefined();
  });

  it('produces a summary', () => {
    const commits = [
      makeCommit({ hash: '1', date: '2025-01-01T00:00:00Z', files: ['a.ts'] }),
      makeCommit({ hash: '2', date: '2025-12-01T00:00:00Z', files: ['a.ts'] }),
    ];
    const result = analyzeChurnVelocity(commits, ['a.ts']);
    expect(result.summary).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm --filter @codelore/core test -- --run src/analyzers/churn-velocity.test.ts`

- [ ] **Step 3: Implement**

```typescript
import type { RawCommit } from '../utils/git.js';
import type { ChurnVelocityReport, FileChurnVelocity, ChurnTrend } from '../types.js';

function getTrend(score: number): ChurnTrend {
  if (score > 60) return 'accelerating';
  if (score < 40) return 'decelerating';
  return 'stable';
}

export function analyzeChurnVelocity(commits: RawCommit[], trackedFiles: string[]): ChurnVelocityReport {
  if (commits.length === 0) {
    return { files: [], acceleratingFiles: [], summary: 'No commits to analyze' };
  }

  const trackedSet = new Set(trackedFiles);

  // Find global time window
  const dates = commits.map(c => new Date(c.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const midpoint = minDate + (maxDate - minDate) / 2;

  // Collect per-file commit timestamps
  const fileCommitDates = new Map<string, number[]>();
  for (const commit of commits) {
    const ts = new Date(commit.date).getTime();
    for (const file of commit.files) {
      if (!trackedSet.has(file)) continue;
      if (!fileCommitDates.has(file)) fileCommitDates.set(file, []);
      fileCommitDates.get(file)!.push(ts);
    }
  }

  const files: FileChurnVelocity[] = [];

  for (const [file, timestamps] of fileCommitDates) {
    if (timestamps.length < 2) continue;

    const recentCommits = timestamps.filter(t => t >= midpoint).length;
    const olderCommits = timestamps.filter(t => t < midpoint).length;
    const total = recentCommits + olderCommits;
    const velocityScore = Math.round((recentCommits / total) * 100);

    files.push({
      file,
      velocityScore,
      trend: getTrend(velocityScore),
      recentCommits,
      olderCommits,
      totalCommits: total,
    });
  }

  files.sort((a, b) => b.velocityScore - a.velocityScore);

  const acceleratingFiles = files.filter(f => f.trend === 'accelerating').slice(0, 10);
  const accCount = files.filter(f => f.trend === 'accelerating').length;
  const decCount = files.filter(f => f.trend === 'decelerating').length;
  const summary = `${accCount} file${accCount !== 1 ? 's' : ''} accelerating, ${decCount} decelerating`;

  return { files, acceleratingFiles, summary };
}
```

- [ ] **Step 4: Run tests, verify they pass**
- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analyzers/churn-velocity.ts packages/core/src/analyzers/churn-velocity.test.ts
git commit -m "feat(core): add churn velocity analyzer"
```

---

## Chunk 3: Rewrite Ratio Analyzer

### Task 3: Rewrite Ratio — Tests then Implementation

**Files:**
- Create: `packages/core/src/analyzers/rewrite-ratio.test.ts`
- Create: `packages/core/src/analyzers/rewrite-ratio.ts`

**Signature:**
```typescript
analyzeRewriteRatio(commits: RawCommit[], trackedFiles: string[]): RewriteRatioReport
```

**Algorithm:**
1. For each tracked file, sum insertions and deletions across all commits that touch it.
2. Ratio: `min(insertions, deletions) / max(insertions, deletions)`. Range 0-1.
3. Score: `ratio × 100`. High score = lots of rewriting (code doesn't stick). Low score = mostly growth or mostly deletion.
4. Files with zero insertions AND zero deletions: excluded.
5. Note: `RawCommit` has repo-wide `insertions`/`deletions`, not per-file. We need per-file stats from numstat. Check if the existing git parsing gives per-file ins/del — if not, approximate using the commit-level totals divided equally among files (less accurate but functional).

**Important implementation note:** The existing `RawCommit` stores `insertions` and `deletions` at the commit level, not per-file. The `git log --numstat` output does have per-file data (`ins\tdel\tfile`), but `parseGitLog` in `git.ts` only accumulates the totals. For this analyzer, we need per-file insertion/deletion data.

**Two options:**
- (A) Extend `parseGitLog` to store per-file ins/del (breaking change to RawCommit.files from `string[]` to `{file: string, insertions: number, deletions: number}[]`)
- (B) Add a parallel data structure — keep `files: string[]` but add `fileStats: {file: string, insertions: number, deletions: number}[]`

**Go with (B)** — non-breaking. Add `fileStats` to `RawCommit` in `git.ts` and populate it from the numstat parsing that already exists.

- [ ] **Step 1: Extend RawCommit with fileStats**

In `packages/core/src/utils/git.ts`, add to `RawCommit`:

```typescript
export interface FileStats {
  file: string;
  insertions: number;
  deletions: number;
}

export interface RawCommit {
  // ... existing fields ...
  fileStats: FileStats[];
}
```

Update `parseGitLog` to populate `fileStats` alongside `files`:

In the initial commit creation:
```typescript
current = { hash, authorEmail, authorName, date, message: '', files: [], fileStats: [], insertions: 0, deletions: 0 };
```

In the numstat parsing block, after pushing to `current.files`:
```typescript
current.fileStats.push({ file, insertions: parseInt(ins, 10) || 0, deletions: parseInt(del, 10) || 0 });
```

- [ ] **Step 2: Verify existing git tests still pass**

Run: `cd /Users/tracericochet/Desktop/dev/lore && pnpm --filter @codelore/core test -- --run src/utils/git.test.ts`

- [ ] **Step 3: Write rewrite ratio tests**

```typescript
import { describe, it, expect } from 'vitest';
import type { RawCommit } from '../utils/git.js';
import { analyzeRewriteRatio } from './rewrite-ratio.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc', authorEmail: 'a@b.com', authorName: 'A',
    date: '2025-06-01T00:00:00Z', message: '', files: [],
    fileStats: [], insertions: 0, deletions: 0, ...overrides,
  };
}

describe('analyzeRewriteRatio', () => {
  it('scores high when insertions and deletions are balanced', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 50, deletions: 50 }] }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files[0].rewriteScore).toBe(100);
    expect(result.files[0].ratio).toBe(1);
  });

  it('scores low when mostly insertions (growth)', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 100, deletions: 10 }] }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files[0].rewriteScore).toBe(10);
  });

  it('scores low when mostly deletions (shrinking)', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 5, deletions: 100 }] }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files[0].rewriteScore).toBe(5);
  });

  it('accumulates across multiple commits', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 30, deletions: 20 }] }),
      makeCommit({ hash: '2', files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 20, deletions: 30 }] }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    // total: 50 ins, 50 del → ratio 1.0 → score 100
    expect(result.files[0].rewriteScore).toBe(100);
  });

  it('excludes files with zero insertions and zero deletions', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 0, deletions: 0 }] }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files).toHaveLength(0);
  });

  it('only includes tracked files', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'gone.ts'],
        fileStats: [
          { file: 'a.ts', insertions: 10, deletions: 10 },
          { file: 'gone.ts', insertions: 10, deletions: 10 },
        ] }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files.map(f => f.file)).toEqual(['a.ts']);
  });

  it('returns top 10 rewriters', () => {
    const result = analyzeRewriteRatio([], []);
    expect(result.topRewriters).toBeDefined();
  });

  it('produces a summary', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 50, deletions: 50 }] }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.summary).toBeTruthy();
  });
});
```

- [ ] **Step 4: Implement rewrite ratio analyzer**

```typescript
import type { RawCommit } from '../utils/git.js';
import type { RewriteRatioReport, FileRewriteRatio } from '../types.js';

export function analyzeRewriteRatio(commits: RawCommit[], trackedFiles: string[]): RewriteRatioReport {
  if (commits.length === 0) {
    return { files: [], topRewriters: [], summary: 'No commits to analyze' };
  }

  const trackedSet = new Set(trackedFiles);
  const fileStats = new Map<string, { insertions: number; deletions: number }>();

  for (const commit of commits) {
    for (const stat of (commit.fileStats ?? [])) {
      if (!trackedSet.has(stat.file)) continue;
      const entry = fileStats.get(stat.file) ?? { insertions: 0, deletions: 0 };
      entry.insertions += stat.insertions;
      entry.deletions += stat.deletions;
      fileStats.set(stat.file, entry);
    }
  }

  const files: FileRewriteRatio[] = [];

  for (const [file, stats] of fileStats) {
    const { insertions, deletions } = stats;
    if (insertions === 0 && deletions === 0) continue;

    const maxVal = Math.max(insertions, deletions);
    const minVal = Math.min(insertions, deletions);
    const ratio = maxVal > 0 ? Math.round((minVal / maxVal) * 100) / 100 : 0;
    const rewriteScore = Math.round(ratio * 100);

    files.push({ file, rewriteScore, totalInsertions: insertions, totalDeletions: deletions, ratio });
  }

  files.sort((a, b) => b.rewriteScore - a.rewriteScore);
  const topRewriters = files.slice(0, 10);

  const highRewrite = files.filter(f => f.rewriteScore >= 70).length;
  const summary = `${highRewrite} file${highRewrite !== 1 ? 's' : ''} with high rewrite ratio (code that doesn't stick)`;

  return { files, topRewriters, summary };
}
```

- [ ] **Step 5: Run all tests, verify they pass**
- [ ] **Step 6: Commit**

```bash
git add packages/core/src/utils/git.ts packages/core/src/analyzers/rewrite-ratio.ts packages/core/src/analyzers/rewrite-ratio.test.ts
git commit -m "feat(core): add rewrite ratio analyzer with per-file stats"
```

---

## Chunk 4: Blast Radius Analyzer

### Task 4: Blast Radius — Tests then Implementation

**Files:**
- Create: `packages/core/src/analyzers/blast-radius.test.ts`
- Create: `packages/core/src/analyzers/blast-radius.ts`

**Signature:**
```typescript
analyzeBlastRadius(commits: RawCommit[], trackedFiles: string[]): BlastRadiusReport
```

**Algorithm:**
1. Exclude commits touching 30+ files (same as coupling — bulk operations).
2. For each tracked file, find all commits that touch it.
3. For each such commit, count how many *other* tracked files it also touches.
4. `avgCoChangedFiles` = average of those counts across all commits for this file.
5. `maxCoChangedFiles` = maximum in a single commit.
6. Normalize to 0-100 relative to repo max average.

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import type { RawCommit } from '../utils/git.js';
import { analyzeBlastRadius } from './blast-radius.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc', authorEmail: 'a@b.com', authorName: 'A',
    date: '2025-06-01T00:00:00Z', message: '', files: [],
    fileStats: [], insertions: 0, deletions: 0, ...overrides,
  };
}

describe('analyzeBlastRadius', () => {
  it('measures average co-changed files per commit', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts', 'c.ts'] }),
      makeCommit({ hash: '2', files: ['a.ts'] }),
    ];
    const result = analyzeBlastRadius(commits, ['a.ts', 'b.ts', 'c.ts']);
    const fileA = result.files.find(f => f.file === 'a.ts')!;
    // commit 1: 2 others, commit 2: 0 others → avg = 1
    expect(fileA.avgCoChangedFiles).toBe(1);
    expect(fileA.maxCoChangedFiles).toBe(2);
  });

  it('excludes commits touching 30+ files', () => {
    const bigFiles = Array.from({ length: 30 }, (_, i) => `f${i}.ts`);
    const commits = [
      makeCommit({ hash: '1', files: bigFiles }),
      makeCommit({ hash: '2', files: ['a.ts', 'b.ts'] }),
    ];
    const result = analyzeBlastRadius(commits, ['a.ts', 'b.ts', ...bigFiles]);
    // a.ts only appears in commit 2 (commit 1 excluded)
    const fileA = result.files.find(f => f.file === 'a.ts')!;
    expect(fileA.avgCoChangedFiles).toBe(1);
    expect(fileA.totalCommits).toBe(1);
  });

  it('normalizes blast score to 0-100', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts', 'c.ts', 'd.ts'] }),
      makeCommit({ hash: '2', files: ['e.ts'] }),
    ];
    const tracked = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'];
    const result = analyzeBlastRadius(commits, tracked);
    const fileA = result.files.find(f => f.file === 'a.ts')!;
    expect(fileA.blastScore).toBe(100); // highest average
    const fileE = result.files.find(f => f.file === 'e.ts')!;
    expect(fileE.blastScore).toBe(0); // solo commit
  });

  it('only includes tracked files', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['tracked.ts', 'gone.ts'] }),
    ];
    const result = analyzeBlastRadius(commits, ['tracked.ts']);
    expect(result.files.map(f => f.file)).toEqual(['tracked.ts']);
  });

  it('returns empty report for no commits', () => {
    const result = analyzeBlastRadius([], []);
    expect(result.files).toHaveLength(0);
  });

  it('returns top 10 blasters', () => {
    const result = analyzeBlastRadius([], []);
    expect(result.topBlasters).toBeDefined();
  });

  it('produces a summary', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts'] }),
    ];
    const result = analyzeBlastRadius(commits, ['a.ts', 'b.ts']);
    expect(result.summary).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement blast radius analyzer**

```typescript
import type { RawCommit } from '../utils/git.js';
import type { BlastRadiusReport, FileBlastRadius } from '../types.js';

const MAX_FILES_PER_COMMIT = 30;

export function analyzeBlastRadius(commits: RawCommit[], trackedFiles: string[]): BlastRadiusReport {
  if (commits.length === 0) {
    return { files: [], topBlasters: [], summary: 'No commits to analyze' };
  }

  const trackedSet = new Set(trackedFiles);
  const fileCoChanges = new Map<string, { coChangedCounts: number[]; maxCoChanged: number }>();

  for (const commit of commits) {
    const files = commit.files.filter(f => trackedSet.has(f));
    if (files.length >= MAX_FILES_PER_COMMIT) continue;

    const otherCount = files.length - 1;
    for (const file of files) {
      if (!fileCoChanges.has(file)) fileCoChanges.set(file, { coChangedCounts: [], maxCoChanged: 0 });
      const entry = fileCoChanges.get(file)!;
      entry.coChangedCounts.push(otherCount);
      entry.maxCoChanged = Math.max(entry.maxCoChanged, otherCount);
    }
  }

  const rawFiles: { file: string; avg: number; max: number; total: number }[] = [];

  for (const [file, data] of fileCoChanges) {
    const avg = data.coChangedCounts.reduce((s, n) => s + n, 0) / data.coChangedCounts.length;
    rawFiles.push({ file, avg, max: data.maxCoChanged, total: data.coChangedCounts.length });
  }

  const maxAvg = Math.max(...rawFiles.map(f => f.avg), 1);

  const files: FileBlastRadius[] = rawFiles
    .map(f => ({
      file: f.file,
      blastScore: Math.round((f.avg / maxAvg) * 100),
      avgCoChangedFiles: Math.round(f.avg * 10) / 10,
      maxCoChangedFiles: f.max,
      totalCommits: f.total,
    }))
    .sort((a, b) => b.blastScore - a.blastScore);

  const topBlasters = files.slice(0, 10);
  const highBlast = files.filter(f => f.blastScore >= 70).length;
  const summary = `${highBlast} high blast-radius file${highBlast !== 1 ? 's' : ''} (architectural load-bearers)`;

  return { files, topBlasters, summary };
}
```

- [ ] **Step 3: Run tests, verify they pass**
- [ ] **Step 4: Commit**

```bash
git add packages/core/src/analyzers/blast-radius.ts packages/core/src/analyzers/blast-radius.test.ts
git commit -m "feat(core): add blast radius analyzer"
```

---

## Chunk 5: Dead Code Analyzer

### Task 5: Dead Code — Tests then Implementation

**Files:**
- Create: `packages/core/src/analyzers/dead-code.test.ts`
- Create: `packages/core/src/analyzers/dead-code.ts`

**Signature:**
```typescript
analyzeDeadCode(commits: RawCommit[], trackedFiles: string[], ageMap: AgeMapReport, locReport: LocReport): DeadCodeReport
```

**Algorithm:**
1. Find all tracked files that appear in zero commits in the analysis window.
2. Cross-reference with `ageMap` for last-commit date and age.
3. Cross-reference with `locReport` for language and LOC.
4. Sort by age descending (oldest untouched files first).

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest';
import type { RawCommit } from '../utils/git.js';
import type { AgeMapReport, LocReport } from '../types.js';
import { analyzeDeadCode } from './dead-code.js';

function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc', authorEmail: 'a@b.com', authorName: 'A',
    date: '2025-06-01T00:00:00Z', message: '', files: [],
    fileStats: [], insertions: 0, deletions: 0, ...overrides,
  };
}

function makeAgeMap(files: { file: string; ageInDays: number }[]): AgeMapReport {
  return {
    files: files.map(f => ({
      file: f.file,
      lastCommitDate: '2025-01-01T00:00:00Z',
      ageInDays: f.ageInDays,
      status: 'stale' as const,
    })),
    staleFiles: [],
    ancientFiles: [],
    medianAgeDays: 0,
    summary: '',
  };
}

function makeLocReport(files: { file: string; lines: number }[]): LocReport {
  return {
    totalFiles: files.length,
    totalLines: 0,
    files: files.map(f => ({ file: f.file, lines: f.lines, language: 'TypeScript' })),
    languages: [],
    summary: '',
  };
}

describe('analyzeDeadCode', () => {
  it('identifies files with zero commits in window', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['active.ts'] }),
    ];
    const tracked = ['active.ts', 'dead.ts'];
    const ageMap = makeAgeMap([
      { file: 'active.ts', ageInDays: 5 },
      { file: 'dead.ts', ageInDays: 200 },
    ]);
    const loc = makeLocReport([
      { file: 'active.ts', lines: 100 },
      { file: 'dead.ts', lines: 50 },
    ]);

    const result = analyzeDeadCode(commits, tracked, ageMap, loc);

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].file).toBe('dead.ts');
    expect(result.candidates[0].ageInDays).toBe(200);
    expect(result.candidates[0].loc).toBe(50);
  });

  it('returns empty when all files have commits', () => {
    const commits = [
      makeCommit({ hash: '1', files: ['a.ts', 'b.ts'] }),
    ];
    const ageMap = makeAgeMap([
      { file: 'a.ts', ageInDays: 5 },
      { file: 'b.ts', ageInDays: 5 },
    ]);
    const loc = makeLocReport([
      { file: 'a.ts', lines: 100 },
      { file: 'b.ts', lines: 100 },
    ]);

    const result = analyzeDeadCode(commits, ['a.ts', 'b.ts'], ageMap, loc);

    expect(result.candidates).toHaveLength(0);
  });

  it('sorts by age descending (oldest first)', () => {
    const commits = [makeCommit({ hash: '1', files: ['active.ts'] })];
    const tracked = ['active.ts', 'old.ts', 'older.ts'];
    const ageMap = makeAgeMap([
      { file: 'active.ts', ageInDays: 1 },
      { file: 'old.ts', ageInDays: 100 },
      { file: 'older.ts', ageInDays: 300 },
    ]);
    const loc = makeLocReport([
      { file: 'active.ts', lines: 10 },
      { file: 'old.ts', lines: 20 },
      { file: 'older.ts', lines: 30 },
    ]);

    const result = analyzeDeadCode(commits, tracked, ageMap, loc);

    expect(result.candidates[0].file).toBe('older.ts');
    expect(result.candidates[1].file).toBe('old.ts');
  });

  it('counts total dead lines', () => {
    const commits = [makeCommit({ hash: '1', files: ['active.ts'] })];
    const tracked = ['active.ts', 'dead1.ts', 'dead2.ts'];
    const ageMap = makeAgeMap([
      { file: 'active.ts', ageInDays: 1 },
      { file: 'dead1.ts', ageInDays: 100 },
      { file: 'dead2.ts', ageInDays: 200 },
    ]);
    const loc = makeLocReport([
      { file: 'active.ts', lines: 100 },
      { file: 'dead1.ts', lines: 50 },
      { file: 'dead2.ts', lines: 75 },
    ]);

    const result = analyzeDeadCode(commits, tracked, ageMap, loc);

    expect(result.totalDeadFiles).toBe(2);
    expect(result.totalDeadLines).toBe(125);
  });

  it('produces a summary', () => {
    const result = analyzeDeadCode([], ['dead.ts'],
      makeAgeMap([{ file: 'dead.ts', ageInDays: 100 }]),
      makeLocReport([{ file: 'dead.ts', lines: 50 }])
    );
    expect(result.summary).toBeTruthy();
  });
});
```

- [ ] **Step 2: Implement dead code analyzer**

```typescript
import type { RawCommit } from '../utils/git.js';
import type { AgeMapReport, LocReport, DeadCodeReport, DeadCodeCandidate } from '../types.js';

export function analyzeDeadCode(
  commits: RawCommit[],
  trackedFiles: string[],
  ageMap: AgeMapReport,
  locReport: LocReport,
): DeadCodeReport {
  // Find files that appear in at least one commit
  const activeFiles = new Set<string>();
  for (const commit of commits) {
    for (const file of commit.files) {
      activeFiles.add(file);
    }
  }

  // Build lookup maps
  const ageByFile = new Map(ageMap.files.map(f => [f.file, f]));
  const locByFile = new Map(locReport.files.map(f => [f.file, f]));

  // Dead = tracked but not in any commit during the analysis window
  const candidates: DeadCodeCandidate[] = [];

  for (const file of trackedFiles) {
    if (activeFiles.has(file)) continue;

    const age = ageByFile.get(file);
    const loc = locByFile.get(file);

    candidates.push({
      file,
      lastCommitDate: age?.lastCommitDate ?? 'unknown',
      ageInDays: age?.ageInDays ?? 0,
      language: loc?.language ?? 'Other',
      loc: loc?.lines ?? 0,
    });
  }

  candidates.sort((a, b) => b.ageInDays - a.ageInDays);

  const totalDeadFiles = candidates.length;
  const totalDeadLines = candidates.reduce((s, c) => s + c.loc, 0);
  const summary = totalDeadFiles > 0
    ? `${totalDeadFiles} file${totalDeadFiles !== 1 ? 's' : ''} (${totalDeadLines.toLocaleString()} lines) with no commits in the analysis window`
    : 'No dead code candidates found';

  return { candidates, totalDeadFiles, totalDeadLines, summary };
}
```

- [ ] **Step 3: Run tests, verify they pass**
- [ ] **Step 4: Commit**

```bash
git add packages/core/src/analyzers/dead-code.ts packages/core/src/analyzers/dead-code.test.ts
git commit -m "feat(core): add dead code candidates analyzer"
```

---

## Chunk 6: Runner Integration + CLI Panels

### Task 6: Wire all four analyzers into runner

**Files:**
- Modify: `packages/core/src/runner.ts`

- [ ] **Step 1: Add imports**

```typescript
import { analyzeChurnVelocity } from './analyzers/churn-velocity.js';
import { analyzeRewriteRatio } from './analyzers/rewrite-ratio.js';
import { analyzeBlastRadius } from './analyzers/blast-radius.js';
import { analyzeDeadCode } from './analyzers/dead-code.js';
```

- [ ] **Step 2: Add analyzer calls** after coupling and before cursedFiles:

```typescript
  onProgress?.('Analyzing churn velocity...');
  const churnVelocity = analyzeChurnVelocity(commits, trackedFiles);

  onProgress?.('Calculating rewrite ratios...');
  const rewriteRatio = analyzeRewriteRatio(commits, trackedFiles);

  onProgress?.('Measuring blast radius...');
  const blastRadius = analyzeBlastRadius(commits, trackedFiles);

  onProgress?.('Finding dead code candidates...');
  const deadCode = analyzeDeadCode(commits, trackedFiles, ageMap, loc);
```

- [ ] **Step 3: Add to return object**

```typescript
    churnVelocity,
    rewriteRatio,
    blastRadius,
    deadCode,
```

- [ ] **Step 4: Build and verify**: `pnpm --filter @codelore/core build`
- [ ] **Step 5: Run all core tests**: `pnpm --filter @codelore/core test -- --run`
- [ ] **Step 6: Commit**

```bash
git add packages/core/src/runner.ts
git commit -m "feat(core): wire churn velocity, rewrite ratio, blast radius, dead code into runner"
```

---

### Task 7: Add four CLI panels

**Files:**
- Modify: `apps/cli/src/components/App.tsx`

- [ ] **Step 1: Add `VelocityPanel` component**

```typescript
function VelocityPanel({ report }: { report: CodeloreReport }) {
  const { churnVelocity } = report;
  if (churnVelocity.acceleratingFiles.length === 0) return null;
  return (
    <Box flexDirection="column">
      <Text color="yellow" bold>
        {'── Churn Velocity ──────────────────────────────────────────'}
      </Text>
      <Text color="gray" dimColor>{churnVelocity.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {churnVelocity.acceleratingFiles.slice(0, 8).map(f => (
          <Box key={f.file} gap={2}>
            <Text color="red">▲</Text>
            <Text color="white">{truncatePath(f.file, 45)}</Text>
            <Text color="gray" dimColor>{f.recentCommits} recent / {f.olderCommits} older</Text>
            <Text color="red">{f.velocityScore}%</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Add `RewritePanel` component**

```typescript
function RewritePanel({ report }: { report: CodeloreReport }) {
  const { rewriteRatio } = report;
  if (rewriteRatio.topRewriters.length === 0) return null;
  return (
    <Box flexDirection="column">
      <Text color="magenta" bold>
        {'── Rewrite Ratio (code that doesn\'t stick) ──────────────────'}
      </Text>
      <Text color="gray" dimColor>{rewriteRatio.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {rewriteRatio.topRewriters.slice(0, 8).map(f => (
          <Box key={f.file} gap={2}>
            <Text color="magenta">{churnBar(f.rewriteScore)}</Text>
            <Text color="white">{truncatePath(f.file, 40)}</Text>
            <Text color="gray" dimColor>+{f.totalInsertions} -{f.totalDeletions}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 3: Add `BlastRadiusPanel` component**

```typescript
function BlastRadiusPanel({ report }: { report: CodeloreReport }) {
  const { blastRadius } = report;
  if (blastRadius.topBlasters.length === 0) return null;
  return (
    <Box flexDirection="column">
      <Text color="red" bold>
        {'── Blast Radius (architectural load-bearers) ────────────────'}
      </Text>
      <Text color="gray" dimColor>{blastRadius.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {blastRadius.topBlasters.slice(0, 8).map(f => (
          <Box key={f.file} gap={2}>
            <Text color="red">{churnBar(f.blastScore)}</Text>
            <Text color="white">{truncatePath(f.file, 40)}</Text>
            <Text color="gray" dimColor>avg {f.avgCoChangedFiles} files, peak {f.maxCoChangedFiles}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 4: Add `DeadCodePanel` component**

```typescript
function DeadCodePanel({ report }: { report: CodeloreReport }) {
  const { deadCode } = report;
  if (deadCode.candidates.length === 0) return null;
  return (
    <Box flexDirection="column">
      <Text color="gray" bold>
        {`── Dead Code Candidates (${deadCode.totalDeadFiles} files, ${deadCode.totalDeadLines.toLocaleString()} lines) ─────`}
      </Text>
      <Text color="gray" dimColor>{deadCode.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {deadCode.candidates.slice(0, 8).map(f => (
          <Box key={f.file} gap={2}>
            <Text color="gray">◌</Text>
            <Text color="white">{truncatePath(f.file, 45)}</Text>
            <Text color="gray" dimColor>{f.loc} LOC</Text>
            <Text color="gray" dimColor>{f.ageInDays}d untouched</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 5: Wire panels into render** — add after BusFactorPanel and before ShamePanel:

```tsx
      <Newline />
      <VelocityPanel report={report} />
      <Newline />
      <RewritePanel report={report} />
      <Newline />
      <BlastRadiusPanel report={report} />
      <Newline />
      <DeadCodePanel report={report} />
```

- [ ] **Step 6: Build and verify**: `pnpm build`
- [ ] **Step 7: Commit**

```bash
git add apps/cli/src/components/App.tsx
git commit -m "feat(cli): add velocity, rewrite, blast radius, and dead code panels"
```

---

## Chunk 7: Smoke Test

### Task 8: End-to-end verification

- [ ] **Step 1: Run all tests**: `pnpm test`
- [ ] **Step 2: Run CodeLore against its own repo**: `node apps/cli/dist/index.js --path . --since all`
- [ ] **Step 3: Verify JSON output**: write to file and check for `churnVelocity`, `rewriteRatio`, `blastRadius`, `deadCode` fields
- [ ] **Step 4: Fix any issues, commit if needed**
