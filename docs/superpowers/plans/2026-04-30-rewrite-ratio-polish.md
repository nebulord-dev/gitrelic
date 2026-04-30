# Rewrite Ratio Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the RELIC-314 polish for the Rewrite Ratio analyzer — fix the score formula so `+1/-1` files stop tying with `+116/-116` at 100, expose three new aggregates on `RewriteRatioReport`, drop two non-rewrite-ratio alt-tabs, add a `<HeroCaption>` to the diverging bar, ship a new `<RewriteHistogram>` distribution view, replace the rotated SortableTable with a `<NarrativeKPI>` that mirrors Blast Radius / Shame, fix the misleading "High Rewriters" metric tile, and write the analyzer's docs page.

**Architecture:** Three layers move independently. (1) `packages/core/src/analyzers/rewrite-ratio.ts` gains a confidence-multiplier formula keyed on `min(ins, del)` and emits three new aggregates (`totalInsertions`, `totalDeletions`, `highRewrite`). (2) `apps/web/src/components/hero/` gets a backported `<HeroCaption>` on the existing `RewriteDivergingBar` plus a brand-new `RewriteHistogram` that mirrors `BlastHistogram` 1:1. (3) `apps/web/src/components/tabs/RewriteRatioTab.tsx` is rewritten end-to-end as a `<NarrativeKPI>` consumer with a directory rollup util (`rewriteByDirectory.ts`) feeding the `extras` slot. Cross-cutting registry / Shell / metrics-strip tweaks pin the wiring.

**Tech Stack:** TypeScript 6, Vitest, React 19, D3-less SVG (existing `BlastHistogram` convention), `@testing-library/react` for tab/hero/util tests.

**Worktree:** `/Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio` on branch `relic-314-polish-rewrite-ratio`. Spec at `docs/superpowers/specs/2026-04-30-rewrite-ratio-polish-design.md` (already committed to `main`).

**Test commands (one-shot, agent-friendly):**

```bash
# Core (analyzer, snapshot regen)
pnpm --filter @gitrelic/core test --run

# Web (heroes, tab, utils, metrics)
pnpm --filter @gitrelic/web test --run

# Both
pnpm test
```

**Convention reminders:**

- Every Bash command in this plan starts with `cd <worktree>` (per `feedback_subagent_cwd_discipline` memory — without it, commits drift to main).
- Tab tests use `getByTestId('narrative-kpi-big-number')`, NOT `getByText` (per `reference_narrative_kpi_testid`).
- Style assertions against happy-dom serialization use `flex-grow: 1`, NOT `flex: 1` (per `feedback_happy_dom_flex_shorthand`).
- Top-N file lists in tabs slice from the **threshold-filtered subset**, not from the analyzer's whole-repo `topX` field (per `feedback_topn_under_threshold` — encoded in spec §C1).

---

## Setup Task: Worktree baseline

**Files:** none (toolchain only)

- [ ] **Step 1: Create worktree from `main`**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic
git worktree add .worktrees/relic-314-polish-rewrite-ratio -b relic-314-polish-rewrite-ratio
```

Expected: a new worktree at `.worktrees/relic-314-polish-rewrite-ratio` on a fresh branch tracking `main`. From now on every command starts with `cd .worktrees/relic-314-polish-rewrite-ratio`.

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm install
```

Expected: pnpm resolves and links the workspace. Warnings are acceptable; errors are not.

- [ ] **Step 3: Run baseline tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm test
```

Expected: all pre-existing tests pass. Anything failing on the clean baseline indicates environment drift — **stop and investigate before proceeding.**

- [ ] **Step 4: Confirm dev tools work**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm lint && pnpm format:check && pnpm build
```

Expected: clean lint, clean format, full build succeeds. Don't proceed if any fail.

---

## Task 1: Tier A — Confidence-multiplier formula + new aggregates

**Files:**
- Modify: `packages/core/src/types.ts` (add three fields to `RewriteRatioReport`)
- Modify: `packages/core/src/analyzers/rewrite-ratio.ts` (formula + emit new aggregates)
- Modify: `packages/core/src/analyzers/rewrite-ratio.test.ts` (update existing expectations + add multiplier tests)
- Update: `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` (regen)

This is the single backend commit. Spec §A1 + §A2.

- [ ] **Step 1: Add three fields to `RewriteRatioReport`**

In `packages/core/src/types.ts`, replace the `RewriteRatioReport` interface body with:

```ts
export interface RewriteRatioReport {
  files: FileRewriteRatio[];
  topRewriters: FileRewriteRatio[];
  totalInsertions: number;
  totalDeletions: number;
  highRewrite: number;
  summary: string;
}
```

Leave `FileRewriteRatio` unchanged.

- [ ] **Step 2: Write failing tests for the new formula and aggregates**

In `packages/core/src/analyzers/rewrite-ratio.test.ts`, append a new describe block at the bottom:

```ts
describe('confidence multiplier (min(ins, del) / 30)', () => {
  it('dampens scores when min(ins,del) is below the floor', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 1, deletions: 1 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    // raw = 100, confidence = 1/30, dampened to round(100 * 1/30) = 3
    expect(result.files[0].rewriteScore).toBe(3);
  });

  it('half-dampens at min(ins,del) = 15', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 15, deletions: 15 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    // raw = 100, confidence = 15/30 = 0.5, dampened to 50
    expect(result.files[0].rewriteScore).toBe(50);
  });

  it('reaches full confidence at min(ins,del) = 30', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 30, deletions: 30 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files[0].rewriteScore).toBe(100);
  });

  it('stays at full confidence beyond the floor', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 200, deletions: 200 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files[0].rewriteScore).toBe(100);
  });

  it('leaves the raw ratio field untouched (no floor applied to ratio)', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts'],
        fileStats: [{ file: 'a.ts', insertions: 1, deletions: 1 }],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.files[0].ratio).toBe(1);
  });
});

describe('aggregate fields', () => {
  it('emits totalInsertions and totalDeletions across tracked files', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts', 'b.ts'],
        fileStats: [
          { file: 'a.ts', insertions: 50, deletions: 30 },
          { file: 'b.ts', insertions: 100, deletions: 40 },
        ],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts', 'b.ts']);
    expect(result.totalInsertions).toBe(150);
    expect(result.totalDeletions).toBe(70);
  });

  it('only counts tracked files in the totals', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['a.ts', 'gone.ts'],
        fileStats: [
          { file: 'a.ts', insertions: 10, deletions: 10 },
          { file: 'gone.ts', insertions: 99, deletions: 99 },
        ],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['a.ts']);
    expect(result.totalInsertions).toBe(10);
    expect(result.totalDeletions).toBe(10);
  });

  it('emits highRewrite as count of files with score >= 70', () => {
    const commits = [
      makeCommit({
        hash: '1',
        files: ['hi.ts', 'mid.ts', 'low.ts'],
        fileStats: [
          { file: 'hi.ts', insertions: 50, deletions: 50 }, // score 100, ≥70
          { file: 'mid.ts', insertions: 60, deletions: 30 }, // raw 50 → score 50
          { file: 'low.ts', insertions: 100, deletions: 5 }, // raw 5 → score 1 with floor
        ],
      }),
    ];
    const result = analyzeRewriteRatio(commits, ['hi.ts', 'mid.ts', 'low.ts']);
    expect(result.highRewrite).toBe(1);
  });

  it('returns zero aggregates when files is empty', () => {
    const result = analyzeRewriteRatio([], []);
    expect(result.totalInsertions).toBe(0);
    expect(result.totalDeletions).toBe(0);
    expect(result.highRewrite).toBe(0);
  });
});
```

Then update three existing test expectations — the `+100/-10`, `+5/-100`, and the multi-commit accumulation cases — because the formula change shifts their expected scores. Find and replace these:

```ts
// 'scores low when mostly insertions (growth)'
// Before: expect(result.files[0].rewriteScore).toBe(10);
expect(result.files[0].rewriteScore).toBe(3);
// raw = 10, min = 10, confidence = 10/30, dampened: round(10 * 0.333) = 3

// 'scores low when mostly deletions (shrinking)'
// Before: expect(result.files[0].rewriteScore).toBe(5);
expect(result.files[0].rewriteScore).toBe(1);
// raw = 5, min = 5, confidence = 5/30, dampened: round(5 * 0.166) = 1
```

The `+50/-50` (perfectly balanced, min = 50 ≥ 30) and accumulated `+30/-20 + +20/-30 = 50/50` cases stay at 100 — no test change needed.

- [ ] **Step 3: Run tests; expect failures**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/core test --run rewrite-ratio
```

Expected: the new tests fail (formula not yet changed, aggregates not yet emitted), the two updated existing tests fail with the new expectations.

- [ ] **Step 4: Implement the formula + aggregates**

Replace the body of `analyzeRewriteRatio` in `packages/core/src/analyzers/rewrite-ratio.ts` with:

```ts
import type { RewriteRatioReport, FileRewriteRatio } from '../types.js';
import type { RawCommit } from '../utils/git.js';

const CONFIDENCE_FLOOR = 30;
const HIGH_REWRITE_THRESHOLD = 70;

export function analyzeRewriteRatio(
  commits: RawCommit[],
  trackedFiles: string[],
): RewriteRatioReport {
  if (commits.length === 0) {
    return {
      files: [],
      topRewriters: [],
      totalInsertions: 0,
      totalDeletions: 0,
      highRewrite: 0,
      summary: 'No commits to analyze',
    };
  }

  const trackedSet = new Set(trackedFiles);
  const fileStats = new Map<string, { insertions: number; deletions: number }>();
  let totalInsertions = 0;
  let totalDeletions = 0;

  for (const commit of commits) {
    for (const stat of commit.fileStats ?? []) {
      if (!trackedSet.has(stat.file)) continue;
      const entry = fileStats.get(stat.file) ?? { insertions: 0, deletions: 0 };
      entry.insertions += stat.insertions;
      entry.deletions += stat.deletions;
      fileStats.set(stat.file, entry);
      totalInsertions += stat.insertions;
      totalDeletions += stat.deletions;
    }
  }

  const files: FileRewriteRatio[] = [];
  for (const [file, stats] of fileStats) {
    const { insertions, deletions } = stats;
    if (insertions === 0 && deletions === 0) continue;
    const maxVal = Math.max(insertions, deletions);
    const minVal = Math.min(insertions, deletions);
    const ratio = maxVal > 0 ? Math.round((minVal / maxVal) * 100) / 100 : 0;
    const rawScore = ratio * 100;
    const confidence = Math.min(1, minVal / CONFIDENCE_FLOOR);
    const rewriteScore = Math.round(rawScore * confidence);
    files.push({
      file,
      rewriteScore,
      totalInsertions: insertions,
      totalDeletions: deletions,
      ratio,
    });
  }

  files.sort((a, b) => b.rewriteScore - a.rewriteScore);
  const topRewriters = files.slice(0, 10);
  const highRewrite = files.filter((f) => f.rewriteScore >= HIGH_REWRITE_THRESHOLD).length;
  const summary = `${highRewrite} file${highRewrite !== 1 ? 's' : ''} with high rewrite ratio (code that doesn't stick)`;

  return {
    files,
    topRewriters,
    totalInsertions,
    totalDeletions,
    highRewrite,
    summary,
  };
}
```

Note: `totalInsertions`/`totalDeletions` accumulate inside the same commit loop — single-pass over the commit data. `CONFIDENCE_FLOOR = 30` and `HIGH_REWRITE_THRESHOLD = 70` are module-scope constants (not exported — internal use; the matching frontend constants live in their consumer files).

- [ ] **Step 5: Run rewrite-ratio tests; expect pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/core test --run rewrite-ratio
```

Expected: all rewrite-ratio tests pass (the original eight + the eight new ones).

- [ ] **Step 6: Run full core suite; capture snapshot diff**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/core test --run
```

Expected: `fixture-regression.test.ts` fails because the snapshot's `rewriteRatio` block contains stale scores. Read the diff in the failure output. The shifts should be: low-volume files drop substantially, real rewrite files stay at 100.

- [ ] **Step 7: Regenerate the snapshot**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/core test --run -u
```

Expected: snapshot regenerates cleanly; rerun without `-u` confirms green:

```bash
pnpm --filter @gitrelic/core test --run
```

Expected: all core tests pass.

- [ ] **Step 8: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
git add packages/core/src/types.ts \
        packages/core/src/analyzers/rewrite-ratio.ts \
        packages/core/src/analyzers/rewrite-ratio.test.ts \
        packages/core/src/__snapshots__/fixture-regression.test.ts.snap
git commit -m "$(cat <<'EOF'
feat(core): rewrite-ratio confidence floor + new aggregates (RELIC-314)

Add a min(ins, del) / 30 confidence multiplier to the score formula so
+1/-1 files no longer tie with +116/-116 at 100. Expose three new
aggregates on RewriteRatioReport: totalInsertions, totalDeletions, and
highRewrite (count of files >=70). Snapshot regenerated.

Refs: docs/superpowers/specs/2026-04-30-rewrite-ratio-polish-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: HeroCaption on `RewriteDivergingBar`

**Files:**
- Modify: `apps/web/src/components/hero/RewriteDivergingBar.tsx` (wrap return in column flex, append HeroCaption)

Tiny commit. Backports the caption pattern Churn / Bus Factor / Shame already use. Spec §B2.

- [ ] **Step 1: Read the existing component to understand its return shape**

Open `apps/web/src/components/hero/RewriteDivergingBar.tsx` and locate the `return (...)` block. The current shape is `<div ref={containerRef}><svg>...</svg>{tooltip && <div>...</div>}</div>` — a relative-positioned container holding the SVG and the floating tooltip.

- [ ] **Step 2: Add HeroCaption**

At the top of the file, add the import:

```ts
import { HeroCaption } from '../shared/HeroCaption';
```

Then replace the entire return block with a column-flex wrapper that renders the existing SVG/tooltip stack first (inside its own relative container) and the HeroCaption strip below. Replace the existing `return (...)` block with:

```tsx
  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1, position: 'relative' }}>
        <svg width={dims.width} height={dims.height}>
          {/* (existing svg children — unchanged) */}
        </svg>
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.x + 12,
              top: tooltip.y - 8,
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              padding: '6px 10px',
              fontSize: 10,
              color: 'var(--text-primary)',
              pointerEvents: 'none',
              zIndex: 20,
              maxWidth: 320,
              wordBreak: 'break-all',
            }}
          >
            {/* (existing tooltip children — unchanged) */}
          </div>
        )}
      </div>
      <HeroCaption
        primary="Top 30 by rewrite score · bar length = lines added/removed · score on right"
        subtitle="Which files keep getting rewritten? Balanced ins/del = code that doesn't stick."
      />
    </div>
  );
```

Practical note: the cleanest mechanical path is to (a) leave the existing `<svg>` and `{tooltip && ...}` blocks completely untouched, (b) wrap them in a `<div style={{ flex: 1, position: 'relative' }}>`, and (c) wrap the whole thing in the outer column-flex `<div ref={containerRef}>`. The `containerRef` moves from the inner div to the outer; the inner div takes over `position: relative`. The existing empty-state branch (`if (rows.length === 0) return ...`) stays as-is — no caption needed for the empty path (matches what `BlastHistogram` does).

Wait — `BlastHistogram` *does* include a HeroCaption in its empty state. For consistency, mirror that: in the empty branch, return a column-flex div with a centered "No rewrite activity detected." message and a HeroCaption beneath. Use the same primary/subtitle copy as the populated branch.

- [ ] **Step 3: Verify component renders without runtime error**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/web build
```

Expected: build succeeds. If TS errors, the wrapping is malformed.

- [ ] **Step 4: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
git add apps/web/src/components/hero/RewriteDivergingBar.tsx
git commit -m "$(cat <<'EOF'
feat(web): HeroCaption on RewriteDivergingBar (RELIC-314)

Backports the caption strip pattern from Churn / Bus Factor / Shame to
the rewrite-ratio default hero. No behavior change otherwise.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `rewriteByDirectory` util

**Files:**
- Create: `apps/web/src/utils/rewriteByDirectory.ts`
- Create: `apps/web/src/utils/rewriteByDirectory.test.ts`

Spec §C2. Mirrors `apps/web/src/utils/blastByDirectory.ts` and `shameByDirectory.ts` exactly with the `FileRewriteRatio` type substituted.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/utils/rewriteByDirectory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { aggregateRewriteByDirectory } from './rewriteByDirectory';

import type { FileRewriteRatio } from '@gitrelic/core';

function f(path: string): FileRewriteRatio {
  return {
    file: path,
    rewriteScore: 80,
    totalInsertions: 100,
    totalDeletions: 100,
    ratio: 1,
  };
}

describe('aggregateRewriteByDirectory', () => {
  it('returns an empty array for no files', () => {
    expect(aggregateRewriteByDirectory([])).toEqual([]);
  });

  it('groups files by their immediate parent directory', () => {
    const rows = aggregateRewriteByDirectory([
      f('packages/a/src/x.ts'),
      f('packages/a/src/y.ts'),
      f('packages/b/src/z.ts'),
    ]);
    const dirs = rows.map((r) => r.directory);
    expect(dirs).toContain('packages/a/src');
    expect(dirs).toContain('packages/b/src');
    const aRow = rows.find((r) => r.directory === 'packages/a/src')!;
    expect(aRow.count).toBe(2);
    expect(aRow.share).toBeCloseTo(2 / 3);
  });

  it('sorts by count desc, breaking ties alphabetically', () => {
    const rows = aggregateRewriteByDirectory([
      f('zebra/x.ts'),
      f('apple/x.ts'),
      f('apple/y.ts'),
      f('mango/x.ts'),
      f('mango/y.ts'),
    ]);
    expect(rows.map((r) => r.directory)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('returns one row per distinct parent directory (no internal cap)', () => {
    const files: FileRewriteRatio[] = [];
    for (let i = 0; i < 8; i++) files.push(f(`dir${i}/file.ts`));
    expect(aggregateRewriteByDirectory(files)).toHaveLength(8);
  });

  it('represents the repo root as the empty string', () => {
    const rows = aggregateRewriteByDirectory([f('rootfile.ts')]);
    expect(rows[0].directory).toBe('');
  });

  it('computes share against the total file count, not the limited slice', () => {
    const files: FileRewriteRatio[] = [];
    files.push(f('big/a.ts'), f('big/b.ts'), f('big/c.ts'));
    for (let i = 0; i < 6; i++) files.push(f(`dir${i}/x.ts`));
    const rows = aggregateRewriteByDirectory(files);
    const big = rows.find((r) => r.directory === 'big')!;
    expect(big.share).toBeCloseTo(3 / 9);
  });
});
```

- [ ] **Step 2: Run; expect failures**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/web test --run rewriteByDirectory
```

Expected: failures because `rewriteByDirectory.ts` doesn't exist yet.

- [ ] **Step 3: Implement the util**

Create `apps/web/src/utils/rewriteByDirectory.ts`:

```ts
import type { FileRewriteRatio } from '@gitrelic/core';

export interface RewriteDirectoryRow {
  directory: string;
  count: number;
  share: number;
}

function parentDirectory(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? '' : filePath.slice(0, slash);
}

export function aggregateRewriteByDirectory(
  files: ReadonlyArray<FileRewriteRatio>,
): RewriteDirectoryRow[] {
  if (files.length === 0) return [];

  const counts = new Map<string, number>();
  for (const f of files) {
    const dir = parentDirectory(f.file);
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }

  const total = files.length;
  const rows: RewriteDirectoryRow[] = [];
  for (const [directory, count] of counts) {
    rows.push({ directory, count, share: count / total });
  }

  rows.sort((a, b) => b.count - a.count || a.directory.localeCompare(b.directory));
  return rows;
}
```

- [ ] **Step 4: Run; expect pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/web test --run rewriteByDirectory
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
git add apps/web/src/utils/rewriteByDirectory.ts apps/web/src/utils/rewriteByDirectory.test.ts
git commit -m "$(cat <<'EOF'
feat(web): rewriteByDirectory aggregator util (RELIC-314)

Mirrors blastByDirectory / shameByDirectory; feeds the upcoming
"Where they live" extras slot in RewriteRatioTab.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `RewriteHistogram` component + Shell wiring + registry alt-tab swap

**Files:**
- Create: `apps/web/src/components/hero/RewriteHistogram.tsx`
- Create: `apps/web/src/components/hero/RewriteHistogram.test.tsx`
- Modify: `apps/web/src/presets/registry.ts` (alt-tab swap)
- Modify: `apps/web/src/components/layout/Shell.tsx` (viz id label + render branch)

Spec §B1 + §B3. The histogram is a near-clone of `BlastHistogram.tsx`; the file should look almost identical structurally.

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/components/hero/RewriteHistogram.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RewriteHistogram, prepareRewriteHistogramData, rewriteTierFor } from './RewriteHistogram';

import type { GitrelicReport } from '@gitrelic/core';

const makeReport = (
  files: Array<{ file: string; rewriteScore: number }> = [],
): GitrelicReport =>
  ({
    rewriteRatio: {
      files: files.map((f) => ({
        ...f,
        totalInsertions: 100,
        totalDeletions: 100,
        ratio: 1,
      })),
      topRewriters: [],
      totalInsertions: 0,
      totalDeletions: 0,
      highRewrite: files.filter((f) => f.rewriteScore >= 70).length,
      summary: '',
    },
  }) as unknown as GitrelicReport;

describe('rewriteTierFor', () => {
  it('partitions scores into low/medium/high/critical at <25 / <50 / ≤75 / >75', () => {
    expect(rewriteTierFor(0)).toBe('low');
    expect(rewriteTierFor(24)).toBe('low');
    expect(rewriteTierFor(25)).toBe('medium');
    expect(rewriteTierFor(49)).toBe('medium');
    expect(rewriteTierFor(50)).toBe('high');
    expect(rewriteTierFor(75)).toBe('high');
    expect(rewriteTierFor(76)).toBe('critical');
    expect(rewriteTierFor(100)).toBe('critical');
  });
});

describe('prepareRewriteHistogramData', () => {
  it('produces ten contiguous bins of width 10', () => {
    const data = prepareRewriteHistogramData(makeReport([{ file: 'x.ts', rewriteScore: 50 }]));
    expect(data.buckets).toHaveLength(10);
    expect(data.buckets[0]).toMatchObject({ rangeStart: 0, rangeEnd: 9 });
    expect(data.buckets[9]).toMatchObject({ rangeStart: 90, rangeEnd: 100 });
  });

  it('counts files into the correct bucket', () => {
    const data = prepareRewriteHistogramData(
      makeReport([
        { file: 'a.ts', rewriteScore: 0 },
        { file: 'b.ts', rewriteScore: 9 },
        { file: 'c.ts', rewriteScore: 35 },
        { file: 'd.ts', rewriteScore: 100 },
      ]),
    );
    expect(data.buckets[0].count).toBe(2);
    expect(data.buckets[3].count).toBe(1);
    expect(data.buckets[9].count).toBe(1);
  });

  it('reports highRewriteCount across files >= 70', () => {
    const data = prepareRewriteHistogramData(
      makeReport([
        { file: 'a.ts', rewriteScore: 70 },
        { file: 'b.ts', rewriteScore: 95 },
        { file: 'c.ts', rewriteScore: 50 },
      ]),
    );
    expect(data.highRewriteCount).toBe(2);
  });
});

describe('RewriteHistogram render', () => {
  afterEach(() => cleanup());

  it('renders an empty-state caption when no files exist', () => {
    render(<RewriteHistogram report={makeReport([])} />);
    expect(screen.getByText(/No rewrite-ratio data available/i)).toBeTruthy();
  });

  it('renders an aria-label that announces the threshold count', () => {
    const report = makeReport([
      { file: 'a.ts', rewriteScore: 90 },
      { file: 'b.ts', rewriteScore: 85 },
      { file: 'c.ts', rewriteScore: 30 },
    ]);
    const { container } = render(<RewriteHistogram report={report} />);
    const svg = container.querySelector('svg[role="img"]') as SVGElement | null;
    expect(svg?.getAttribute('aria-label')).toMatch(/distribution histogram across 3 files/i);
    expect(svg?.getAttribute('aria-label')).toMatch(/2 files.*at or above the high-rewrite threshold of 70/i);
  });
});
```

- [ ] **Step 2: Run; expect failures**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/web test --run RewriteHistogram
```

Expected: failures (component doesn't exist).

- [ ] **Step 3: Implement the component**

Create `apps/web/src/components/hero/RewriteHistogram.tsx` by copying the structure of `apps/web/src/components/hero/BlastHistogram.tsx` and substituting:

- Constant rename: `HIGH_BLAST_THRESHOLD` → `HIGH_REWRITE_THRESHOLD = 70` (exported).
- Type rename: `BlastTier` → `RewriteTier` (exported), same `'low' | 'medium' | 'high' | 'critical'` union.
- Data source: `report.blastRadius.files` → `report.rewriteRatio.files`; field `f.blastScore` → `f.rewriteScore`.
- Function names: `prepareBlastHistogramData` → `prepareRewriteHistogramData` (exported); `blastTierFor` → `rewriteTierFor` (exported, same `<25 / <50 / ≤75 / >75` cutoffs).
- `BlastBucket` interface name → `RewriteBucket`.
- `BlastHistogramData.highBlastCount` → `RewriteHistogramData.highRewriteCount`; `totalFiles` stays.
- `aria-label`: `"Rewrite-score distribution histogram across {totalFiles} files. {n} {is/are} at or above the high-rewrite threshold of 70."` (compare to BlastHistogram's existing aria-label string).
- High-zone label: `"high rewrite (≥{HIGH_REWRITE_THRESHOLD}) · N files"`.
- X-axis label: `"Rewrite score"`.
- HeroCaption: `primary="10-bin histogram · bar height = file count · color = rewrite tier"`, `subtitle="What's the shape of rewrite churn across the repo? How many files actually keep getting rewritten?"`.
- Empty-state message: `"No rewrite-ratio data available."`.
- Tier color map (`TIER_COLORS`): identical values to `BlastHistogram` (`--severity-healthy / --severity-warning / #d27b22 / --severity-critical`).
- All the SVG geometry, hover state, padding constants, and threshold-marker math: copy verbatim — `BlastHistogram` already does it correctly.

The component takes only `report: GitrelicReport` (no other props) — matching `BlastHistogram`'s signature.

- [ ] **Step 4: Run; expect pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/web test --run RewriteHistogram
```

Expected: all RewriteHistogram tests pass.

- [ ] **Step 5: Wire the histogram into Shell**

Open `apps/web/src/components/layout/Shell.tsx`. Two edits:

(a) Add an import alongside `RewriteDivergingBar`:

```ts
import { RewriteHistogram } from '../hero/RewriteHistogram';
```

(b) In the viz-id-to-tab-label map (the object containing entries like `'rewrite-diverging-bar': 'Rewrites'` near line 118), add:

```ts
'rewrite-histogram': 'Distribution',
```

(c) Find the existing `selection.activeHeroViz === 'rewrite-diverging-bar'` render branch (around line 393, near where the Shame/Blast heroes also sit). Add a sibling branch beneath:

```tsx
{selection.activeHeroViz === 'rewrite-histogram' && (
  <RewriteHistogram report={report} />
)}
```

- [ ] **Step 6: Update the registry alt-tabs**

Open `apps/web/src/presets/registry.ts`. Find the `'rewrite-ratio'` preset entry (around lines 299–313). Change:

```ts
hero: {
  defaultViz: 'rewrite-diverging-bar',
  altTabs: ['rewrite-diverging-bar', 'scatter', 'debt-scatter'],
},
```

to:

```ts
hero: {
  defaultViz: 'rewrite-diverging-bar',
  altTabs: ['rewrite-diverging-bar', 'rewrite-histogram'],
},
```

- [ ] **Step 7: Verify Shell + registry compile and existing tests still pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/web test --run
pnpm --filter @gitrelic/web build
```

Expected: all tests pass (existing + new RewriteHistogram tests). Build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
git add apps/web/src/components/hero/RewriteHistogram.tsx \
        apps/web/src/components/hero/RewriteHistogram.test.tsx \
        apps/web/src/components/layout/Shell.tsx \
        apps/web/src/presets/registry.ts
git commit -m "$(cat <<'EOF'
feat(web): RewriteHistogram alt-tab + drop scatter/debt (RELIC-314)

New distribution histogram mirrors BlastHistogram for the rewrite-ratio
analyzer. Drops the Scatter (HotspotScatter dup) and Debt (Tech Debt's
hero) alt-tabs from the rewrite-ratio preset; both components stay,
they're still the defaults of their primary tabs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `RewriteRatioTab` rewrite to `<NarrativeKPI>`

**Files:**
- Modify: `apps/web/src/components/tabs/RewriteRatioTab.tsx` (full rewrite)
- Create: `apps/web/src/components/tabs/RewriteRatioTab.test.tsx`

Spec §C1. Mirrors `ShameTab.tsx` / `BlastRadiusTab.tsx` structurally. The current file is replaced wholesale.

- [ ] **Step 1: Write failing tests**

Create `apps/web/src/components/tabs/RewriteRatioTab.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RewriteRatioTab } from './RewriteRatioTab';

import type { GitrelicReport } from '@gitrelic/core';

const rewriteFile = (file: string, rewriteScore: number, ins = 100, del = 100) => ({
  file,
  rewriteScore,
  totalInsertions: ins,
  totalDeletions: del,
  ratio: del === 0 ? 0 : Math.min(ins, del) / Math.max(ins, del),
});

const makeReport = (overrides: Partial<GitrelicReport['rewriteRatio']> = {}): GitrelicReport =>
  ({
    rewriteRatio: {
      files: [],
      topRewriters: [],
      totalInsertions: 0,
      totalDeletions: 0,
      highRewrite: 0,
      summary: '',
      ...overrides,
    },
  }) as unknown as GitrelicReport;

describe('RewriteRatioTab', () => {
  afterEach(() => cleanup());

  it('renders Healthy state when no high-rewrite files', () => {
    render(<RewriteRatioTab report={makeReport()} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/Healthy/)).toBeTruthy();
  });

  it('renders Moderate badge when 1–4 files cross threshold', () => {
    const files = Array.from({ length: 3 }, (_, i) => rewriteFile(`f${i}.ts`, 80));
    render(
      <RewriteRatioTab
        report={makeReport({ files, highRewrite: 3 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('3');
    expect(screen.getByText('Moderate')).toBeTruthy();
  });

  it('renders High Rewrite badge when 5+ files cross threshold', () => {
    const files = Array.from({ length: 8 }, (_, i) => rewriteFile(`f${i}.ts`, 80));
    render(
      <RewriteRatioTab
        report={makeReport({ files, highRewrite: 8 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('8');
    expect(screen.getByText('High Rewrite')).toBeTruthy();
  });

  it('renders top 3 high-rewrite files in the finding slot', () => {
    const files = [
      rewriteFile('a.ts', 95, 1840, 1790),
      rewriteFile('b.ts', 92, 920, 910),
      rewriteFile('c.ts', 90, 710, 680),
      rewriteFile('low.ts', 40),
    ];
    render(
      <RewriteRatioTab
        report={makeReport({ files, highRewrite: 3 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('a.ts')).toBeTruthy();
    expect(screen.getByText('b.ts')).toBeTruthy();
    expect(screen.getByText('c.ts')).toBeTruthy();
    expect(screen.queryByText('low.ts')).toBeNull();
  });

  it('renders the repo balance subline with formatted totals', () => {
    const files = [rewriteFile('a.ts', 90), rewriteFile('b.ts', 30, 100, 10)];
    render(
      <RewriteRatioTab
        report={makeReport({
          files,
          totalInsertions: 842310,
          totalDeletions: 518440,
          highRewrite: 1,
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/Repo balance/i)).toBeTruthy();
    // toLocaleString outputs "842,310" with comma separators
    expect(screen.getByText(/842,310/)).toBeTruthy();
    expect(screen.getByText(/518,440/)).toBeTruthy();
  });

  it('renders the directory rollup ("Where they live")', () => {
    const files = [
      rewriteFile('packages/react-reconciler/src/a.ts', 95),
      rewriteFile('packages/react-reconciler/src/b.ts', 90),
      rewriteFile('packages/react-reconciler/src/c.ts', 85),
      rewriteFile('compiler/babel/x.ts', 80),
      rewriteFile('compiler/babel/y.ts', 75),
      rewriteFile('low.ts', 30), // sub-threshold, ignored
    ];
    render(
      <RewriteRatioTab
        report={makeReport({ files, highRewrite: 5 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Where they live')).toBeTruthy();
    expect(screen.getByText('packages/react-reconciler/src')).toBeTruthy();
  });

  it('fires onApplyPreset when see-also links are clicked', () => {
    const onApplyPreset = vi.fn();
    render(<RewriteRatioTab report={makeReport()} onApplyPreset={onApplyPreset} />);
    screen.getByText('Churn').click();
    screen.getByText('Hotspots').click();
    expect(onApplyPreset).toHaveBeenCalledWith('churn');
    expect(onApplyPreset).toHaveBeenCalledWith('hotspots');
  });
});
```

- [ ] **Step 2: Run; expect failures**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/web test --run RewriteRatioTab
```

Expected: every test fails because the current SortableTable-based tab does not render any of the new structures (no big-number, no Healthy badge, no see-also links, etc.).

- [ ] **Step 3: Replace `RewriteRatioTab.tsx` wholesale**

Replace the entire contents of `apps/web/src/components/tabs/RewriteRatioTab.tsx` with:

```tsx
import { aggregateRewriteByDirectory } from '../../utils/rewriteByDirectory';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import { fileName, fmt } from '../theme';

import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface RewriteRatioTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const HIGH_REWRITE_THRESHOLD = 70;
const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

function tierBadge(highRewriteCount: number): { variant: BadgeVariant; label: string } {
  if (highRewriteCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highRewriteCount < 5) return { variant: 'warning', label: 'Moderate' };
  return { variant: 'critical', label: 'High Rewrite' };
}

const monoBold = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  fontWeight: 600,
} as const;

function signed(n: number): string {
  if (n > 0) return `+${fmt(n)}`;
  if (n < 0) return `−${fmt(-n)}`;
  return '0';
}

export function RewriteRatioTab({ report, onApplyPreset }: RewriteRatioTabProps) {
  const { files, totalInsertions, totalDeletions, highRewrite } = report.rewriteRatio;
  // Slice top files from the threshold-filtered subset (per RELIC-315 lesson):
  // never include sub-threshold files in the "Top rewrite files" header.
  const highRewriteFiles = files.filter((f) => f.rewriteScore >= HIGH_REWRITE_THRESHOLD);
  const tier = tierBadge(highRewrite);
  const topFiles = highRewriteFiles.slice(0, TOP_FILES_COUNT);

  const balancedCount = files.filter((f) => f.ratio > 0.5).length;
  const balancedPct = files.length > 0 ? Math.round((balancedCount / files.length) * 100) : 0;

  const allDirectoryRows = aggregateRewriteByDirectory(highRewriteFiles);
  const directoryRows = allDirectoryRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(0, allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT);
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(highRewrite)}
      tier={tier}
      metric={`Files ≥${HIGH_REWRITE_THRESHOLD} Rewrite`}
      finding={
        highRewrite > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Top rewrite files
            </div>
            {topFiles.map((f) => (
              <div key={f.file} style={{ lineHeight: 1.5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {fileName(f.file)}
                </span>{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>
                  <span style={{ ...monoBold, color: 'var(--severity-healthy)' }}>
                    +{fmt(f.totalInsertions)}
                  </span>{' '}
                  /{' '}
                  <span style={{ ...monoBold, color: 'var(--severity-critical)' }}>
                    −{fmt(f.totalDeletions)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ) : files.length > 0 ? (
          <>
            No files cross the high-rewrite threshold — code edits skew toward growth or shrink,
            not replace.
          </>
        ) : (
          <>No rewrite signal in the analysis window.</>
        )
      }
      subline={
        files.length > 0 ? (
          <>
            Repo balance:{' '}
            <strong style={{ color: 'var(--severity-healthy)' }}>
              +{fmt(totalInsertions)}
            </strong>{' '}
            /{' '}
            <strong style={{ color: 'var(--severity-critical)' }}>
              −{fmt(totalDeletions)}
            </strong>{' '}
            · net <strong>{signed(totalInsertions - totalDeletions)}</strong> ·{' '}
            <strong>{balancedPct}%</strong> of files balanced (ratio &gt; 0.5).
          </>
        ) : null
      }
      extras={
        directoryRows.length > 0 ? (
          <div>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              Where they live
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {directoryRows.map((row) => (
                <div
                  key={row.directory}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: 11,
                    lineHeight: 1.4,
                  }}
                >
                  <Tooltip
                    content={row.directory || '(root)'}
                    wrapperStyle={{
                      display: 'block',
                      flex: 1,
                      minWidth: 0,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.directory || '(root)'}
                  </Tooltip>
                  <div
                    style={{
                      width: 80,
                      height: 4,
                      background: 'var(--surface-tertiary)',
                      borderRadius: 2,
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: `${(row.count / maxDirCount) * 100}%`,
                        height: '100%',
                        background: 'var(--severity-warning)',
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span style={{ ...monoBold, minWidth: 32, textAlign: 'right' }}>{row.count}</span>
                  <span
                    style={{
                      color: 'var(--text-tertiary)',
                      fontSize: 10,
                      minWidth: 36,
                      textAlign: 'right',
                    }}
                  >
                    {(row.share * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
            {hiddenDirectoryCount > 0 && (
              <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-tertiary)' }}>
                + {hiddenDirectoryCount} more{' '}
                {hiddenDirectoryCount === 1 ? 'directory' : 'directories'}
              </div>
            )}
          </div>
        ) : undefined
      }
      seeAlso={[
        { label: 'Churn', presetId: 'churn' },
        { label: 'Hotspots', presetId: 'hotspots' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
```

Note: `BottomPanel` currently passes `onSelectFile` to the old tab. Check the call site — if `onSelectFile` is still in the props chain, switch it to `onApplyPreset` for this tab. Cross-check by greping the codebase: `grep -n "RewriteRatioTab" apps/web/src/components/layout/BottomPanel.tsx`. If `onSelectFile` is passed, swap to `onApplyPreset` (the same callback BlastRadiusTab and ShameTab consume).

- [ ] **Step 4: Run; expect pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/web test --run RewriteRatioTab
```

Expected: all 7 RewriteRatioTab tests pass.

- [ ] **Step 5: Run full web suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/web test --run
```

Expected: all web tests pass. If `BottomPanel.test.tsx` or another caller fails, the prop swap from `onSelectFile` → `onApplyPreset` may need to propagate — fix the caller, not the tab.

- [ ] **Step 6: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
git add apps/web/src/components/tabs/RewriteRatioTab.tsx \
        apps/web/src/components/tabs/RewriteRatioTab.test.tsx
# also add BottomPanel.tsx if you swapped the prop name
git commit -m "$(cat <<'EOF'
feat(web): RewriteRatioTab narrative-KPI rewrite (RELIC-314)

Replaces the rotated SortableTable with a NarrativeKPI consumer mirroring
ShameTab / BlastRadiusTab. Big number = highRewrite; finding = top 3
high-rewrite files (sliced from threshold-filtered subset); subline =
repo-wide insertions/deletions/net balance + balanced %; extras =
"Where they live" directory rollup; see-also = Churn + Hotspots.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Metrics-strip slot 2 fix

**Files:**
- Modify: `apps/web/src/presets/metrics/rewrite-ratio.ts`
- Modify or create: `apps/web/src/presets/metrics/rewrite-ratio.test.ts`

Spec §D1. Slot 2 currently uses `topRewriters.length` (capped at 10, lies); switch to `report.rewriteRatio.highRewrite`.

- [ ] **Step 1: Write or update failing test**

Check whether `apps/web/src/presets/metrics/rewrite-ratio.test.ts` exists. If not, create it. Either way it should contain:

```ts
import { describe, expect, it } from 'vitest';

import { rewriteRatioMetrics } from './rewrite-ratio';

import type { GitrelicReport } from '@gitrelic/core';

const baseReport = (overrides: Partial<GitrelicReport['rewriteRatio']> = {}): GitrelicReport =>
  ({
    rewriteRatio: {
      files: [],
      topRewriters: [],
      totalInsertions: 0,
      totalDeletions: 0,
      highRewrite: 0,
      summary: '',
      ...overrides,
    },
  }) as unknown as GitrelicReport;

describe('rewriteRatioMetrics', () => {
  it("slot 2 label is 'Files ≥70'", () => {
    const m = rewriteRatioMetrics(baseReport());
    expect(m[1].label).toBe('Files ≥70');
  });

  it('slot 2 value reflects report.rewriteRatio.highRewrite, not topRewriters.length', () => {
    // Construct a report where topRewriters.length differs from highRewrite.
    const filler = Array.from({ length: 10 }, (_, i) => ({
      file: `f${i}.ts`,
      rewriteScore: 50, // sub-threshold but still in topRewriters
      totalInsertions: 100,
      totalDeletions: 50,
      ratio: 0.5,
    }));
    const m = rewriteRatioMetrics(baseReport({ topRewriters: filler, highRewrite: 2 }));
    expect(m[1].value).toBe('2');
  });

  it('slot 2 severity bands at 0 / 1 / 5', () => {
    expect(rewriteRatioMetrics(baseReport({ highRewrite: 0 }))[1].color).toContain('healthy');
    expect(rewriteRatioMetrics(baseReport({ highRewrite: 4 }))[1].color).toContain('warning');
    expect(rewriteRatioMetrics(baseReport({ highRewrite: 5 }))[1].color).toContain('critical');
  });
});
```

- [ ] **Step 2: Run; expect failures**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/web test --run "metrics/rewrite-ratio"
```

Expected: failures (label still says `'High Rewriters'`, value still uses `topRewriters.length`).

- [ ] **Step 3: Update the preset**

In `apps/web/src/presets/metrics/rewrite-ratio.ts`, replace slot 2's object literal with:

```ts
{
  label: 'Files ≥70',
  value: fmt(report.rewriteRatio.highRewrite),
  color:
    report.rewriteRatio.highRewrite >= 5
      ? 'var(--severity-critical)'
      : report.rewriteRatio.highRewrite > 0
        ? 'var(--severity-warning)'
        : 'var(--severity-healthy)',
},
```

Slots 1 (Top Rewriter Score), 3 (Avg Ratio), 4 (Files Analyzed) are unchanged.

- [ ] **Step 4: Run; expect pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm --filter @gitrelic/web test --run "metrics/rewrite-ratio"
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
git add apps/web/src/presets/metrics/rewrite-ratio.ts apps/web/src/presets/metrics/rewrite-ratio.test.ts
git commit -m "$(cat <<'EOF'
fix(web): metrics-strip slot 2 reflects real high-rewrite count (RELIC-314)

Replaces 'High Rewriters' (topRewriters.length, capped at 10) with
'Files ≥70' sourced from report.rewriteRatio.highRewrite. Severity
bands match the panel's tier badge (0 / 1–4 / 5+).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Analyzer docs page

**Files:**
- Create: `apps/docs/analyzers/rewrite-ratio.md`
- Modify: `apps/docs/.vitepress/config.ts` (sidebar entry)

Spec §D4. Follows the per-analyzer docs pattern from `apps/docs/analyzers/churn.md`, `blast-radius.md`, and `shame.md`. Bundles in this PR per the Polish Initiative convention.

- [ ] **Step 1: Read peer pages**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
cat apps/docs/analyzers/blast-radius.md apps/docs/analyzers/shame.md
```

Note structure: H1 title, intro paragraph, "What it measures" section, "Score formula" section, "Hero" section (with screenshots), "Bottom panel" section (with screenshot), "Metrics strip" section, "Cross-references" footer.

- [ ] **Step 2: Capture screenshots**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm build
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

In the browser at `http://localhost:7777`, take three screenshots while viewing the Rewrite Ratio tab against the React repo:

1. **Rewrites hero (default)** — `apps/docs/public/rewrite-ratio-rewrites.png`
2. **Distribution histogram** — `apps/docs/public/rewrite-ratio-histogram.png`
3. **Bottom panel (narrative-KPI with directory rollup)** — `apps/docs/public/rewrite-ratio-panel.png`

Place files in `apps/docs/public/`. Naming follows the existing convention (peer screenshots: `apps/docs/public/blast-radius-*.png`).

- [ ] **Step 3: Write the docs page**

Create `apps/docs/analyzers/rewrite-ratio.md`. Use the peer pages as templates; structure:

```markdown
# Rewrite Ratio

The **Rewrite Ratio** analyzer measures how balanced a file's edits are between insertions and deletions across its history. A high score means the file has been *replaced* repeatedly — code that doesn't stick — rather than steadily growing or shrinking.

## What it measures

Per file:

- `totalInsertions` and `totalDeletions` accumulated across all commits in the analysis window.
- `ratio = min(ins, del) / max(ins, del)` — the raw balance metric (0 = pure growth/shrink, 1 = perfectly balanced).
- `rewriteScore` — a 0–100 score combining the raw ratio with a confidence multiplier so low-volume files don't tie at the top.

Repo-wide:

- `totalInsertions` / `totalDeletions` — overall growth-vs-rewrite balance.
- `highRewrite` — count of files with `rewriteScore ≥ 70`.

## Score formula

\`\`\`
rawScore = min(ins, del) / max(ins, del) × 100
confidence = min(1, min(ins, del) / 30)
rewriteScore = round(rawScore × confidence)
\`\`\`

The smaller side of the diff is the "rewrite signal" — that's what makes a file balanced rather than growing or shrinking — so it's also the confidence basis. A file with `+1/-1` scores 3 (raw 100 × confidence 1/30); a file with `+30/-30` scores 100 (raw 100 × confidence 1); a file with `+800/-50` scores 6 (raw 6 × confidence 50/30 → capped at 1).

## Hero

Two views:

### Rewrites (default)

![Rewrites diverging bar](/rewrite-ratio-rewrites.png)

Top 30 files by rewrite score. Each row shows a horizontal diverging bar — deletions left of center, insertions right — with bar length proportional to absolute volume so visual emphasis tracks real magnitude. Score on the right.

### Distribution

![Distribution histogram](/rewrite-ratio-histogram.png)

Ten-bin histogram of rewrite scores across the whole repo. Bar height = file count, color = tier (low / medium / high / critical). The ≥70 zone is shaded so you can see at a glance how many files are in genuine rewrite territory. Mirrors the Blast Radius distribution layout.

## Bottom panel

![Narrative-KPI bottom panel](/rewrite-ratio-panel.png)

The panel surfaces what the heroes can't:

- **Big number** — count of files with `rewriteScore ≥ 70`. Tier badge: 0 = Healthy · 1–4 = Moderate · 5+ = High Rewrite.
- **Top rewrite files** — the three highest-scoring files with their absolute insertion/deletion volumes.
- **Repo balance** — the unique angle of this analyzer: how much code did the repo write vs. delete in the analysis window, what's the net, what fraction of files have balanced ratios. Answers "is this a growth codebase or a maintenance codebase?".
- **Where they live** — directory rollup of the high-rewrite files, so you can see whether rewrite churn is concentrated in a hot zone or scattered.
- **See also** — Churn (volume cousin in commit count), Hotspots (rewrite × LOC × complexity).

## Metrics strip

| Slot | Source |
|---|---|
| Top Rewriter Score | Top file's `rewriteScore`. Color critical at ≥70, warning at ≥30, healthy below. |
| Files ≥70 | `report.rewriteRatio.highRewrite` — true count of high-rewrite files. |
| Avg Ratio | Mean of all `ratio` values across analyzed files. |
| Files Analyzed | `files.length`. |

## Cross-references

- [Churn](./churn.md) — same shape, different unit (commit count vs. line volume).
- [Hotspots](./hotspots.md) — where rewrite, complexity, and ownership intersect.
- [Cursed Files](./cursed-files.md) — the cross-analyzer risk roll-up.
```

- [ ] **Step 4: Add the docs sidebar entry**

In `apps/docs/.vitepress/config.ts`, find the `analyzers` sidebar block. Add a `{ text: 'Rewrite Ratio', link: '/analyzers/rewrite-ratio' }` entry, matching the alphabetical / categorical placement of peers.

- [ ] **Step 5: Verify the docs build**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm docs:build
```

Expected: VitePress build succeeds. If a screenshot path 404s, check the file is in `apps/docs/public/` and the markdown link starts with `/`.

- [ ] **Step 6: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
git add apps/docs/analyzers/rewrite-ratio.md \
        apps/docs/public/rewrite-ratio-rewrites.png \
        apps/docs/public/rewrite-ratio-histogram.png \
        apps/docs/public/rewrite-ratio-panel.png \
        apps/docs/.vitepress/config.ts
git commit -m "$(cat <<'EOF'
docs(analyzers): rewrite-ratio analyzer page (RELIC-314)

Per-analyzer docs page covering the score formula (post-floor), both
hero views, the narrative-KPI bottom panel, the metrics strip, and
cross-references. Three screenshots captured against the React fixture.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: `polish-pattern.md` update

**Files:**
- Modify: `docs/polish-pattern.md`

Spec build sequence step 5. Move `rewrite-ratio` from the "Pending" table to the "Mapped" section, and add a "shipped — RELIC-314" note documenting the formula-fix scope expansion (mirrors how `blast-radius` and `forensics` are described post-RELIC-315 / RELIC-308).

- [ ] **Step 1: Read the current `Pending` table**

Look near line 153 in `docs/polish-pattern.md`. Find the row for `rewrite-ratio` in the pending table.

- [ ] **Step 2: Remove the pending row**

Delete the `rewrite-ratio` row from the pending markdown table.

- [ ] **Step 3: Add a "Mapped" section after `forensics`**

In the existing `## Mapped so far (Batch 1)` section, after the `### `forensics` (Shame tab)` block (or wherever blast-radius's "shipped" subsection lives), append a new subsection following the same structure as the `### `blast-radius` *(shipped — RELIC-315)*` subsection. Title:

```markdown
### `rewrite-ratio` *(shipped — RELIC-314)*
```

Body should describe what shipped: the confidence-multiplier formula (`min(1, min(ins,del) / 30)`), the three new aggregates on `RewriteRatioReport`, the dropped Scatter/Debt alt-tabs (now `Rewrites · Distribution`), the `RewriteHistogram` (mirrors BlastHistogram), the `<NarrativeKPI>` panel with directory rollup extras, the metric-strip slot 2 fix, and the see-also choices. Keep it factual — match the tone of the blast-radius shipped note.

The "Hero scope creep is OK when warranted" precedent paragraph at line ~97 already references the pattern; mention rewrite-ratio's parallel scope expansion (formula fix, hero audit, metric-strip fix) in a single sentence at the end of that paragraph or in the new shipped subsection itself.

- [ ] **Step 4: Verify build still works**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm docs:build
```

Expected: docs build succeeds (the polish-pattern.md is internal, not part of the published site, but verify the docs build still passes regardless).

- [ ] **Step 5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
git add docs/polish-pattern.md
git commit -m "$(cat <<'EOF'
docs: polish-pattern rewrite-ratio shipped (RELIC-314)

Move rewrite-ratio from Pending to Mapped (Batch 1). Document the
formula-fix and hero-audit scope expansion alongside blast-radius's
prior precedent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Final Task: PR-ready check

**Files:** none (verification only)

- [ ] **Step 1: Full clean test run**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm test
```

Expected: every test passes.

- [ ] **Step 2: Lint + format + build**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
pnpm lint && pnpm format:check && pnpm build && pnpm docs:build
```

Expected: clean across all four.

- [ ] **Step 3: Smoke test against React**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

Open the browser, navigate to **Rewrite Ratio**. Verify visually:

1. The top of the diverging bar is no longer all `+1/-1` files tied at 100. `ReactFiberHooks.js`, `BabelPlugin.ts`, etc. should now sit at the top.
2. Tab labels are **Rewrites · Distribution** (no Scatter, no Debt).
3. Distribution histogram renders with bars + ≥70 shaded zone.
4. Metrics strip shows `Files ≥70` (not `High Rewriters`) with a real count, not 10.
5. Bottom panel: big number reflects `highRewrite`, top-3 files show real volumes, subline reads `Repo balance: +X / −Y · net +Z · N% balanced`, "Where they live" rollup populated.
6. Click a see-also link (e.g., Churn) — preset switch works.
7. HeroCaption visible under the diverging bar.

If anything looks wrong, fix and re-run. Don't open the PR until the visual smoke is clean.

- [ ] **Step 4: Push and open PR**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-314-polish-rewrite-ratio
git push -u origin relic-314-polish-rewrite-ratio
gh pr create --title "feat(web): rewrite-ratio polish — formula + heroes + narrative-KPI (RELIC-314)" --body "$(cat <<'EOF'
## Summary
- Confidence-multiplier formula fix: `score = round(rawScore × min(1, min(ins,del) / 30))`. `+1/-1` files no longer tie with `+116/-116` at 100.
- New aggregates on `RewriteRatioReport`: `totalInsertions`, `totalDeletions`, `highRewrite`.
- Hero audit: dropped `Scatter` (HotspotScatter dup) and `Debt` (Tech Debt's hero) alt-tabs; added `RewriteHistogram` distribution view; backported `HeroCaption` on the diverging bar.
- `RewriteRatioTab` rewritten as a `<NarrativeKPI>` consumer with `rewriteByDirectory.ts` extras rollup, mirroring Shame and Blast Radius.
- Metrics-strip slot 2: `High Rewriters` (capped at 10, lied) → `Files ≥70` (true count).
- New `apps/docs/analyzers/rewrite-ratio.md` analyzer docs page.

Spec: `docs/superpowers/specs/2026-04-30-rewrite-ratio-polish-design.md`.

## Test plan
- [ ] `pnpm test` — full suite passes.
- [ ] `pnpm lint && pnpm format:check && pnpm build && pnpm docs:build` — all clean.
- [ ] Smoke against React repo — diverging bar shows real rewrite-heavy files at top; histogram + panel + metrics strip all correct; HeroCaption renders; see-also links navigate.
- [ ] Snapshot regen reviewed — score shifts limited to low-volume files.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR opens, CI runs. Address any review comments per `reference_pr_claude_review` (the PR Claude bot will likely post a review — plan headroom for 1–2 follow-up commits).

---

## Notes for the implementing agent

- **Subline copy length.** The spec uses `fmt(n)` = `toLocaleString()` which produces `"842,310"`. On large repos the subline may approach the 400px max-width limit of `NarrativeKPI`'s subline slot. If you visually verify and it overflows, swap to a compact form (`842K`) — add a `fmtCompact` helper in `theme.ts` and use it locally. Do NOT introduce the helper unless the smoke test shows a real overflow.
- **Scope discipline.** The spec is exhaustive. If you discover something during implementation that the spec doesn't cover, **update the spec first**, then the code. Don't silently expand scope.
- **Snapshot churn.** Task 1 step 7 regenerates `fixture-regression.test.ts.snap`. Eyeball the diff before accepting — every shift should be a low-volume score going down. If a high-volume file drops, the formula has a bug.
- **Inspector unaffected.** `FileInspector.tsx` reads `rr.ratio` (the raw mathematical ratio, unchanged). No template change is needed there.
- **Cursed Files unaffected.** `cursed-files.ts` does not consume `rewriteScore`. No tests there should regress.
