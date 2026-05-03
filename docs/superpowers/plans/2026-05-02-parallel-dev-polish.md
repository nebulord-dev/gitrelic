# Parallel Dev Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the RELIC-309 polish for the `parallel-dev` analyzer — strip the two repo-wide firehose heroes (`swimlanes` / `timeline`) that encode nothing about `parallelScore`, replace them with a domain-specific distribution histogram (default) and a parallel-events monthly bar chart (alt), expose three new aggregates (`highParallel`, `tierMix`, `byMonth`) on `ParallelDevReport`, replace the per-file `SortableTable` with a `<NarrativeKPI>` consumer that mirrors Blast Radius / Rewrite Ratio (extras-slot directory rollup, sticky see-also footer), and fix the misleading `Hot Files` metrics tile.

**Architecture:** Three layers move independently. (1) `packages/core/src/analyzers/parallel-dev.ts` + `types.ts` gain three aggregates without touching the existing scoring formula. (2) `apps/web/src/components/hero/` gets two new components: `ParallelScoreHistogram` (pixel-mirror of `BlastHistogram`) and `ParallelTimeline` (NEW pattern — monthly aggregate bars colored by avg-author tint). (3) `apps/web/src/components/tabs/ParallelDevTab.tsx` is rewritten end-to-end as a `<NarrativeKPI>` consumer, with a new `parallelDevByDirectory.ts` aggregator feeding the `extras` slot. Cross-cutting registry / Shell / metrics-strip tweaks pin the wiring. **No score-formula changes** — current `MIN_ACTIVE_WEEKS = 3` and `MIN_PARALLEL_SCORE = 20` already guard noise.

**Tech Stack:** TypeScript 6, Vitest, React 19, D3-less SVG (existing histogram convention), `@testing-library/react` for hero / tab / util tests. No new runtime deps in `packages/core` — bundled-deps-mirror invariant unchanged.

**Worktree:** `/Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev` on branch `relic-309-polish-parallel-dev`. Spec lives in `docs/polish-pattern.md` (`parallel-dev` section, lines 158–177) and ticket [RELIC-309](https://linear.app/nebulord/issue/RELIC-309/polish-parallel-dev). Doc wins over ticket per polish-pattern.md preamble.

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

- Every Bash command in this plan starts with `cd <worktree>` — without it, commits drift to `main`.
- Tab tests use `getByTestId('narrative-kpi-big-number')`, NOT `getByText`.
- Style assertions against happy-dom serialization use `flex-grow: 1`, NOT `flex: 1`.
- Top-N file lists in tabs slice from the **threshold-filtered subset** (`files.filter(f => f.parallelScore >= 70)`), not from `hotFiles` (which is whole-repo top-10 and may include sub-threshold files).
- Bare-ternary for single conditional `className`, not `cn()`. Use `cn()` only for multi-condition spread/merge.

---

## Setup Task: Worktree baseline

**Files:** none (toolchain only)

- [ ] **Step 1: Create worktree from `main`**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic
git worktree add .worktrees/relic-309-polish-parallel-dev -b relic-309-polish-parallel-dev
```

Expected: a new worktree at `.worktrees/relic-309-polish-parallel-dev` on a fresh branch tracking `main`. From now on every command starts with `cd .worktrees/relic-309-polish-parallel-dev`.

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm install
```

Expected: pnpm resolves and links the workspace. Warnings are acceptable; errors are not.

- [ ] **Step 3: Run baseline tests**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm test
```

Expected: all pre-existing tests pass (231 core + 29 web). Anything failing on the clean baseline indicates environment drift — **stop and investigate before proceeding.**

- [ ] **Step 4: Confirm dev tools work**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm lint && pnpm format:check && pnpm build
```

Expected: clean lint, clean format, full build succeeds. Don't proceed if any fail.

---

## Task 1: Backend — three new aggregates on `ParallelDevReport`

**Files:**
- Modify: `packages/core/src/types.ts` (add three fields to `ParallelDevReport`)
- Modify: `packages/core/src/analyzers/parallel-dev.ts` (compute + emit new aggregates, no score change)
- Modify: `packages/core/src/analyzers/parallel-dev.test.ts` (add tests for the three aggregates)
- Update: `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` (regen — additive only, no value drift)

This is the single backend commit. Spec → polish-pattern.md `parallel-dev` § "Backend changes".

- [ ] **Step 1: Add three fields to `ParallelDevReport`**

In `packages/core/src/types.ts`, replace the `ParallelDevReport` interface body with:

```ts
export interface ParallelDevTierMix {
  low: number;      // parallelScore 0–24
  medium: number;   // parallelScore 25–49
  high: number;     // parallelScore 50–74
  critical: number; // parallelScore 75+
}

export interface ParallelDevByMonth {
  month: string;          // ISO YYYY-MM
  parallelEvents: number; // count of distinct (file, weekKey) where bucket.authors.size >= 2
  uniqueFiles: number;    // count of distinct files contributing to parallel events that month
  avgAuthors: number;     // mean author count across all parallel events that month
}

export interface ParallelDevReport {
  files: FileParallelDev[];
  hotFiles: FileParallelDev[]; // top 10 by parallelScore (preserved for back-compat)
  totalParallelFiles: number;
  highParallel: number; // count of files with parallelScore >= 70
  tierMix: ParallelDevTierMix;
  byMonth: ParallelDevByMonth[];
  summary: string;
}
```

Leave `FileParallelDev` and `ParallelWindow` unchanged. Place the two new helper interfaces directly above `ParallelDevReport` in the same `// ─── Parallel development` section.

- [ ] **Step 2: Write failing tests for the three aggregates**

In `packages/core/src/analyzers/parallel-dev.test.ts`, append these describe blocks at the bottom:

```ts
describe('highParallel aggregate', () => {
  it('counts files with parallelScore >= 70', () => {
    // 4 weeks, 4 authors per week → score 100 (high)
    const high = Array.from({ length: 4 }, (_, week) =>
      ['alice', 'bob', 'charlie', 'dave'].map((name, i) =>
        makeCommit({
          hash: `h${week}${i}`,
          authorEmail: `${name}@x.com`,
          date: weekDate(week),
          files: ['hot.ts'],
        }),
      ),
    ).flat();
    // 4 weeks, 1 parallel week with 2 authors → low score
    const low = [
      ...Array.from({ length: 4 }, (_, week) =>
        makeCommit({
          hash: `l${week}`,
          authorEmail: 'alice@x.com',
          date: weekDate(week),
          files: ['cool.ts'],
        }),
      ),
      makeCommit({
        hash: 'lb0',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['cool.ts'],
      }),
    ];
    const result = analyzeParallelDev(
      [...high, ...low],
      ['hot.ts', 'cool.ts'],
    );
    expect(result.highParallel).toBe(1);
  });

  it('returns 0 highParallel when no files cross the threshold', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.highParallel).toBe(0);
  });
});

describe('tierMix aggregate', () => {
  it('places each scored file into exactly one tier band', () => {
    // 4 weeks 4 authors → score 100 (critical)
    const critical = Array.from({ length: 4 }, (_, week) =>
      ['alice', 'bob', 'charlie', 'dave'].map((name, i) =>
        makeCommit({
          hash: `c${week}${i}`,
          authorEmail: `${name}@x.com`,
          date: weekDate(week),
          files: ['c.ts'],
        }),
      ),
    ).flat();
    const result = analyzeParallelDev(critical, ['c.ts']);
    const total =
      result.tierMix.low +
      result.tierMix.medium +
      result.tierMix.high +
      result.tierMix.critical;
    expect(total).toBe(result.files.length);
  });

  it('returns all-zero tierMix when no files are scored', () => {
    const result = analyzeParallelDev([], []);
    expect(result.tierMix).toEqual({
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    });
  });
});

describe('byMonth aggregate', () => {
  it('counts parallel events bucketed by ISO month of weekStart', () => {
    // Two parallel weeks in 2025-06 (one with 2 authors, one with 3)
    const commits = [
      // Week 0 (2025-06-02 Monday): 2 authors
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      // Week 1 (2025-06-09): 3 authors
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '4',
        authorEmail: 'bob@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '5',
        authorEmail: 'charlie@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      // Week 2 (2025-06-16): single-author, not a parallel event
      makeCommit({
        hash: '6',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.byMonth).toHaveLength(1);
    expect(result.byMonth[0].month).toBe('2025-06');
    expect(result.byMonth[0].parallelEvents).toBe(2);
    expect(result.byMonth[0].uniqueFiles).toBe(1);
    // avg authors across the two parallel events: (2 + 3) / 2 = 2.5
    expect(result.byMonth[0].avgAuthors).toBeCloseTo(2.5);
  });

  it('returns empty byMonth array when there are no parallel events', () => {
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    expect(result.byMonth).toEqual([]);
  });

  it('sorts byMonth ascending by ISO month string', () => {
    // Months: 2025-06 (1 event) and 2025-07 (1 event)
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0), // 2025-06-02
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(4), // 2025-06-30 still
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '4',
        authorEmail: 'bob@x.com',
        date: weekDate(5), // crosses into 2025-07-07
        files: ['a.ts'],
      }),
      makeCommit({
        hash: '5',
        authorEmail: 'alice@x.com',
        date: weekDate(5),
        files: ['a.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts']);
    const months = result.byMonth.map((b) => b.month);
    const sorted = [...months].sort();
    expect(months).toEqual(sorted);
  });

  it('counts uniqueFiles distinctly per month', () => {
    // Week 0: parallel on a.ts AND b.ts → 2 unique files, 2 events
    const commits = [
      makeCommit({
        hash: '1',
        authorEmail: 'alice@x.com',
        date: weekDate(0),
        files: ['a.ts', 'b.ts'],
      }),
      makeCommit({
        hash: '2',
        authorEmail: 'bob@x.com',
        date: weekDate(0),
        files: ['a.ts', 'b.ts'],
      }),
      // Pad each file to 3 active weeks so they survive MIN_ACTIVE_WEEKS
      makeCommit({
        hash: '3',
        authorEmail: 'alice@x.com',
        date: weekDate(1),
        files: ['a.ts', 'b.ts'],
      }),
      makeCommit({
        hash: '4',
        authorEmail: 'alice@x.com',
        date: weekDate(2),
        files: ['a.ts', 'b.ts'],
      }),
    ];
    const result = analyzeParallelDev(commits, ['a.ts', 'b.ts']);
    expect(result.byMonth[0].parallelEvents).toBe(2);
    expect(result.byMonth[0].uniqueFiles).toBe(2);
  });
});
```

- [ ] **Step 3: Run the new tests to confirm they fail**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/core test --run -t 'highParallel aggregate'
pnpm --filter @gitrelic/core test --run -t 'tierMix aggregate'
pnpm --filter @gitrelic/core test --run -t 'byMonth aggregate'
```

Expected: each test fails because `result.highParallel`, `result.tierMix`, and `result.byMonth` are `undefined` on `ParallelDevReport` until Step 4.

- [ ] **Step 4: Implement the three aggregates in the analyzer**

In `packages/core/src/analyzers/parallel-dev.ts`, replace the `analyzeParallelDev` function body with this version. The change adds an aggregation pass over the existing `WeekMatrix` (no second commit pass) and computes the three new fields:

```ts
const HIGH_PARALLEL_THRESHOLD = 70;

function tierFor(score: number): keyof ParallelDevTierMix {
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 75) return 'high';
  return 'critical';
}

export function analyzeParallelDev(
  commits: RawCommit[],
  trackedFiles: string[],
): ParallelDevReport {
  const trackedSet = new Set(trackedFiles);
  const matrix = buildWeekMatrix(commits, trackedSet);

  const files: FileParallelDev[] = [];

  for (const [file, weeks] of matrix) {
    const scored = scoreFile(file, weeks);
    if (scored) files.push(scored);
  }

  files.sort((a, b) => b.parallelScore - a.parallelScore);
  const hotFiles = files.slice(0, 10);
  const totalParallelFiles = files.length;

  // Tier mix — uses 0–24 / 25–49 / 50–74 / 75+ to match Bus Factor's tier-mix
  // shape. Display layer collapses critical+high under one "high" label.
  const tierMix: ParallelDevTierMix = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  let highParallel = 0;
  for (const f of files) {
    tierMix[tierFor(f.parallelScore)]++;
    if (f.parallelScore >= HIGH_PARALLEL_THRESHOLD) highParallel++;
  }

  // Monthly aggregate of parallel events ((file, weekKey) where authors >= 2).
  // Single pass over the matrix — same data we already iterated for scoring.
  type MonthAccum = {
    parallelEvents: number;
    fileSet: Set<string>;
    authorTotal: number;
  };
  const monthAccum = new Map<string, MonthAccum>();
  for (const [file, weeks] of matrix) {
    for (const [weekKey, bucket] of weeks) {
      if (bucket.authors.size < 2) continue;
      const month = weekKey.slice(0, 7); // ISO YYYY-MM
      let entry = monthAccum.get(month);
      if (!entry) {
        entry = {
          parallelEvents: 0,
          fileSet: new Set(),
          authorTotal: 0,
        };
        monthAccum.set(month, entry);
      }
      entry.parallelEvents++;
      entry.fileSet.add(file);
      entry.authorTotal += bucket.authors.size;
    }
  }
  const byMonth: ParallelDevByMonth[] = [];
  for (const [month, entry] of monthAccum) {
    byMonth.push({
      month,
      parallelEvents: entry.parallelEvents,
      uniqueFiles: entry.fileSet.size,
      avgAuthors: entry.authorTotal / entry.parallelEvents,
    });
  }
  byMonth.sort((a, b) => a.month.localeCompare(b.month));

  const summary =
    hotFiles.length === 0
      ? 'No significant parallel development detected.'
      : `${totalParallelFiles} file${totalParallelFiles === 1 ? '' : 's'} show${totalParallelFiles === 1 ? 's' : ''} signs of parallel development. ${hotFiles[0].file} is the most contested.`;

  return {
    files,
    hotFiles,
    totalParallelFiles,
    highParallel,
    tierMix,
    byMonth,
    summary,
  };
}
```

Also update the imports at the top of the file to pull in the two new types:

```ts
import type {
  ParallelDevReport,
  ParallelDevTierMix,
  ParallelDevByMonth,
  FileParallelDev,
  ParallelWindow,
} from '../types.js';
```

- [ ] **Step 5: Re-run the new tests to confirm they pass**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/core test --run -t 'highParallel aggregate'
pnpm --filter @gitrelic/core test --run -t 'tierMix aggregate'
pnpm --filter @gitrelic/core test --run -t 'byMonth aggregate'
```

Expected: all 8 new tests pass.

- [ ] **Step 6: Run the full core suite**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/core test --run
```

Expected: all pre-existing tests still pass. The fixture-regression snapshot test will fail — that's the next step.

- [ ] **Step 7: Regenerate the fixture-regression snapshot**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/core test --run -u
```

Expected: snapshot updates with three new fields under `parallelDev` (`highParallel`, `tierMix`, `byMonth`). Verify by inspecting the diff:

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
git diff packages/core/src/__snapshots__/fixture-regression.test.ts.snap
```

The diff should be **additive only** — no existing parallelDev field values change. If you see existing values change, the score formula was accidentally touched — revert and investigate.

- [ ] **Step 8: Run all core tests to confirm clean state**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/core test --run
```

Expected: full green.

- [ ] **Step 9: Lint + format + commit**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm lint && pnpm format
git add packages/core/src/types.ts packages/core/src/analyzers/parallel-dev.ts packages/core/src/analyzers/parallel-dev.test.ts packages/core/src/__snapshots__/fixture-regression.test.ts.snap
git commit -m "$(cat <<'EOF'
feat(core): expose highParallel, tierMix, byMonth on ParallelDevReport (RELIC-309)

Three additive aggregates derived from the existing WeekMatrix — no second
pass over commits, no scoring-formula changes:

- highParallel: count of files with parallelScore >= 70 (drives the panel
  big-number and the metrics-strip "High Parallel" tile).
- tierMix: file-score band counts (0–24 / 25–49 / 50–74 / 75+), matching
  Bus Factor's tier-mix shape so the panel subline can render without
  per-tab derivation.
- byMonth: monthly aggregate of (file, week) parallel events — the data
  source for the new ParallelTimeline alt hero.

Snapshot regen is additive — no existing parallelDev values change.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit lands cleanly, pre-commit hook passes.

---

## Task 2: Web — `parallelDevByDirectory.ts` aggregator + test

**Files:**
- Create: `apps/web/src/utils/parallelDevByDirectory.ts`
- Create: `apps/web/src/utils/parallelDevByDirectory.test.ts`

Mirror `blastByDirectory.ts` shape exactly. Different threshold (≥70), same group-by-parent-dir + sort-by-count-desc + share-vs-total semantics.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/utils/parallelDevByDirectory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { aggregateParallelDevByDirectory } from './parallelDevByDirectory';
import type { FileParallelDev } from '@gitrelic/core';

function f(path: string): FileParallelDev {
  return {
    file: path,
    parallelScore: 80,
    totalActiveWeeks: 10,
    parallelWeeks: 5,
    peakAuthors: 3,
    peakWindow: { weekStart: '2025-06-02T00:00:00.000Z', authors: [], commitCount: 0 },
    topWindows: [],
    narrative: '',
  };
}

describe('aggregateParallelDevByDirectory', () => {
  it('returns an empty array for no files', () => {
    expect(aggregateParallelDevByDirectory([])).toEqual([]);
  });

  it('groups files by their immediate parent directory', () => {
    const rows = aggregateParallelDevByDirectory([
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
    const rows = aggregateParallelDevByDirectory([
      f('zebra/x.ts'),
      f('apple/x.ts'),
      f('apple/y.ts'),
      f('mango/x.ts'),
      f('mango/y.ts'),
    ]);
    expect(rows.map((r) => r.directory)).toEqual(['apple', 'mango', 'zebra']);
  });

  it('returns one row per distinct parent directory (no internal cap)', () => {
    const files: FileParallelDev[] = [];
    for (let i = 0; i < 8; i++) files.push(f(`dir${i}/file.ts`));
    expect(aggregateParallelDevByDirectory(files)).toHaveLength(8);
  });

  it('represents the repo root as the empty string', () => {
    const rows = aggregateParallelDevByDirectory([f('rootfile.ts')]);
    expect(rows[0].directory).toBe('');
  });

  it('computes share against the total file count, not the limited slice', () => {
    const files: FileParallelDev[] = [];
    files.push(f('big/a.ts'), f('big/b.ts'), f('big/c.ts'));
    for (let i = 0; i < 6; i++) files.push(f(`dir${i}/x.ts`));
    const rows = aggregateParallelDevByDirectory(files);
    const big = rows.find((r) => r.directory === 'big')!;
    expect(big.share).toBeCloseTo(3 / 9);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run apps/web/src/utils/parallelDevByDirectory.test.ts
```

Expected: fails with "Cannot find module './parallelDevByDirectory'".

- [ ] **Step 3: Implement the aggregator**

Create `apps/web/src/utils/parallelDevByDirectory.ts`:

```ts
import type { FileParallelDev } from '@gitrelic/core';

export interface ParallelDevDirectoryRow {
  directory: string;
  count: number;
  share: number;
}

function parentDirectory(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? '' : filePath.slice(0, slash);
}

export function aggregateParallelDevByDirectory(
  files: ReadonlyArray<FileParallelDev>,
): ParallelDevDirectoryRow[] {
  if (files.length === 0) return [];

  const counts = new Map<string, number>();
  for (const f of files) {
    const dir = parentDirectory(f.file);
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }

  const total = files.length;
  const rows: ParallelDevDirectoryRow[] = [];
  for (const [directory, count] of counts) {
    rows.push({ directory, count, share: count / total });
  }

  rows.sort(
    (a, b) => b.count - a.count || a.directory.localeCompare(b.directory),
  );
  return rows;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run apps/web/src/utils/parallelDevByDirectory.test.ts
```

Expected: all 6 tests pass.

- [ ] **Step 5: Lint + commit**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm lint && pnpm format
git add apps/web/src/utils/parallelDevByDirectory.ts apps/web/src/utils/parallelDevByDirectory.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add parallelDevByDirectory aggregator (RELIC-309)

Mirrors blastByDirectory.ts / rewriteByDirectory.ts. Used by ParallelDevTab's
NarrativeKPI extras slot to render a top-N parent-directory rollup of files
above the high-parallel threshold.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Web — `ParallelScoreHistogram` hero (default)

**Files:**
- Create: `apps/web/src/components/hero/ParallelScoreHistogram.tsx`
- Create: `apps/web/src/components/hero/ParallelScoreHistogram.test.tsx`

Pixel-mirrors `BlastHistogram`. Same 10×10 bucket layout, same threshold-zone shading, same `<HeroCaption>` strip.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/hero/ParallelScoreHistogram.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  HIGH_PARALLEL_THRESHOLD,
  ParallelScoreHistogram,
  parallelTierFor,
  prepareParallelHistogramData,
} from './ParallelScoreHistogram';
import type { GitrelicReport } from '@gitrelic/core';

interface ParallelFixture {
  file: string;
  parallelScore: number;
}

function makeReport(files: ParallelFixture[]): GitrelicReport {
  return {
    parallelDev: {
      files: files.map((f) => ({
        file: f.file,
        parallelScore: f.parallelScore,
        totalActiveWeeks: 10,
        parallelWeeks: 5,
        peakAuthors: 3,
        peakWindow: {
          weekStart: '2025-06-02T00:00:00.000Z',
          authors: [],
          commitCount: 0,
        },
        topWindows: [],
        narrative: '',
      })),
      hotFiles: [],
      totalParallelFiles: files.length,
      highParallel: files.filter((f) => f.parallelScore >= HIGH_PARALLEL_THRESHOLD).length,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth: [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('parallelTierFor', () => {
  it('returns "low" below 25', () => {
    expect(parallelTierFor(0)).toBe('low');
    expect(parallelTierFor(24)).toBe('low');
  });

  it('returns "medium" from 25 up to (but not including) 50', () => {
    expect(parallelTierFor(25)).toBe('medium');
    expect(parallelTierFor(49)).toBe('medium');
  });

  it('returns "high" from 50 up to and including 75', () => {
    expect(parallelTierFor(50)).toBe('high');
    expect(parallelTierFor(75)).toBe('high');
  });

  it('returns "critical" above 75', () => {
    expect(parallelTierFor(76)).toBe('critical');
    expect(parallelTierFor(100)).toBe('critical');
  });
});

describe('prepareParallelHistogramData', () => {
  it('returns 10 buckets covering 0..100, with the last bucket inclusive of 100', () => {
    const { buckets } = prepareParallelHistogramData(makeReport([]));
    expect(buckets).toHaveLength(10);
    expect(buckets[0]).toMatchObject({ rangeStart: 0, rangeEnd: 9 });
    expect(buckets[9]).toMatchObject({ rangeStart: 90, rangeEnd: 100 });
  });

  it('places each file into the bucket whose range contains its parallelScore', () => {
    const { buckets } = prepareParallelHistogramData(
      makeReport([
        { file: 'a', parallelScore: 0 },
        { file: 'b', parallelScore: 9 },
        { file: 'c', parallelScore: 35 },
        { file: 'd', parallelScore: 70 },
        { file: 'e', parallelScore: 100 },
      ]),
    );
    expect(buckets[0].count).toBe(2);
    expect(buckets[3].count).toBe(1);
    expect(buckets[7].count).toBe(1);
    expect(buckets[9].count).toBe(1);
  });

  it('counts files with parallelScore >= HIGH_PARALLEL_THRESHOLD as highParallelCount', () => {
    const { highParallelCount } = prepareParallelHistogramData(
      makeReport([
        { file: 'a', parallelScore: 30 },
        { file: 'b', parallelScore: HIGH_PARALLEL_THRESHOLD },
        { file: 'c', parallelScore: HIGH_PARALLEL_THRESHOLD - 1 },
        { file: 'd', parallelScore: 95 },
      ]),
    );
    expect(highParallelCount).toBe(2);
  });

  it('reports totalFiles and maxCount correctly', () => {
    const { totalFiles, maxCount } = prepareParallelHistogramData(
      makeReport([
        { file: 'a', parallelScore: 5 },
        { file: 'b', parallelScore: 5 },
        { file: 'c', parallelScore: 5 },
        { file: 'd', parallelScore: 80 },
      ]),
    );
    expect(totalFiles).toBe(4);
    expect(maxCount).toBe(3);
  });

  it('handles an empty file list', () => {
    const { buckets, maxCount, totalFiles, highParallelCount } =
      prepareParallelHistogramData(makeReport([]));
    expect(buckets.every((b) => b.count === 0)).toBe(true);
    expect(maxCount).toBe(0);
    expect(totalFiles).toBe(0);
    expect(highParallelCount).toBe(0);
  });
});

describe('ParallelScoreHistogram', () => {
  it('renders the hero caption', () => {
    const report = makeReport([
      { file: 'a', parallelScore: 10 },
      { file: 'b', parallelScore: 80 },
    ]);
    render(<ParallelScoreHistogram report={report} />);
    expect(screen.getByText(/10-bin histogram/)).toBeTruthy();
  });

  it('renders the hero caption in the empty state', () => {
    render(<ParallelScoreHistogram report={makeReport([])} />);
    expect(screen.getByText(/10-bin histogram/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run apps/web/src/components/hero/ParallelScoreHistogram.test.tsx
```

Expected: fails with "Cannot find module './ParallelScoreHistogram'".

- [ ] **Step 3: Implement `ParallelScoreHistogram`**

Create `apps/web/src/components/hero/ParallelScoreHistogram.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';

import { HeroCaption } from '../shared/HeroCaption';
import type { GitrelicReport } from '@gitrelic/core';

export type ParallelTier = 'low' | 'medium' | 'high' | 'critical';

export interface ParallelBucket {
  rangeStart: number;
  rangeEnd: number;
  count: number;
  tier: ParallelTier;
}

export interface ParallelHistogramData {
  buckets: ParallelBucket[];
  maxCount: number;
  totalFiles: number;
  highParallelCount: number;
}

export const HIGH_PARALLEL_THRESHOLD = 70;
const BUCKET_WIDTH = 10;
const BUCKET_COUNT = 10;

export function parallelTierFor(parallelScore: number): ParallelTier {
  if (parallelScore < 25) return 'low';
  if (parallelScore < 50) return 'medium';
  if (parallelScore <= 75) return 'high';
  return 'critical';
}

export function prepareParallelHistogramData(
  report: GitrelicReport,
): ParallelHistogramData {
  const buckets: ParallelBucket[] = Array.from(
    { length: BUCKET_COUNT },
    (_, i) => {
      const rangeStart = i * BUCKET_WIDTH;
      const rangeEnd =
        i === BUCKET_COUNT - 1 ? 100 : rangeStart + BUCKET_WIDTH - 1;
      return {
        rangeStart,
        rangeEnd,
        count: 0,
        tier: parallelTierFor(rangeStart + BUCKET_WIDTH / 2),
      };
    },
  );

  let highParallelCount = 0;
  for (const f of report.parallelDev.files) {
    const idx = Math.min(
      BUCKET_COUNT - 1,
      Math.max(0, Math.floor(f.parallelScore / BUCKET_WIDTH)),
    );
    buckets[idx].count++;
    if (f.parallelScore >= HIGH_PARALLEL_THRESHOLD) highParallelCount++;
  }

  const maxCount = buckets.reduce((m, b) => (b.count > m ? b.count : m), 0);
  return {
    buckets,
    maxCount,
    totalFiles: report.parallelDev.files.length,
    highParallelCount,
  };
}

const TIER_COLORS: Record<ParallelTier, string> = {
  low: 'var(--severity-healthy)',
  medium: 'var(--severity-warning)',
  high: '#d27b22',
  critical: 'var(--severity-critical)',
};

interface ParallelScoreHistogramProps {
  report: GitrelicReport;
}

const PADDING = { top: 28, right: 24, bottom: 44, left: 56 };
const BAR_GAP = 4;

export function ParallelScoreHistogram({
  report,
}: ParallelScoreHistogramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const { buckets, maxCount, totalFiles, highParallelCount } = useMemo(
    () => prepareParallelHistogramData(report),
    [report],
  );

  const svgHeight = Math.max(120, dims.height - 56);
  const plotW = Math.max(40, dims.width - PADDING.left - PADDING.right);
  const plotH = Math.max(40, svgHeight - PADDING.top - PADDING.bottom);

  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain([0, Math.max(maxCount, 1)])
        .range([plotH, 0])
        .nice(4),
    [maxCount, plotH],
  );

  const barWidth = (plotW - BAR_GAP * (buckets.length - 1)) / buckets.length;
  const thresholdBucketIdx = Math.floor(HIGH_PARALLEL_THRESHOLD / BUCKET_WIDTH);
  const thresholdX = thresholdBucketIdx * (barWidth + BAR_GAP);

  if (totalFiles === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
          No parallel-dev data available.
        </div>
        <HeroCaption
          primary="10-bin histogram · bar height = file count · color = parallel-dev tier (low/medium/high/critical)"
          subtitle="No concurrency signal in this repo. Either every file is owned by a single author week-to-week, or the analyzer hasn't run yet."
        />
      </div>
    );
  }

  const yTicks = yScale.ticks(4);
  const hover =
    hoverIdx == null ? null : { idx: hoverIdx, bucket: buckets[hoverIdx] };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <svg
          width={dims.width}
          height={svgHeight}
          role="img"
          aria-label={`Parallel-score distribution histogram across ${totalFiles} files. ${highParallelCount} ${highParallelCount === 1 ? 'file is' : 'files are'} at or above the high-parallel threshold of ${HIGH_PARALLEL_THRESHOLD}.`}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            <rect
              x={thresholdX}
              y={0}
              width={Math.max(0, plotW - thresholdX)}
              height={plotH}
              fill="var(--severity-critical)"
              fillOpacity={0.06}
            />
            <line
              x1={thresholdX}
              y1={0}
              x2={thresholdX}
              y2={plotH}
              stroke="var(--severity-critical)"
              strokeOpacity={0.5}
              strokeDasharray="3 3"
            />
            <text
              x={thresholdX + 6}
              y={12}
              fontSize={9}
              fill="var(--severity-critical)"
              fillOpacity={0.8}
            >
              high parallel (≥{HIGH_PARALLEL_THRESHOLD}) · {highParallelCount}{' '}
              {highParallelCount === 1 ? 'file' : 'files'}
            </text>

            <line
              x1={0}
              y1={0}
              x2={0}
              y2={plotH}
              stroke="var(--border-primary)"
            />
            <text
              transform={`translate(-40,${plotH / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-tertiary)"
            >
              Files
            </text>
            {yTicks.map((tick) => (
              <g key={`y-${tick}`} transform={`translate(0,${yScale(tick)})`}>
                <line x2={-4} stroke="var(--border-primary)" />
                <line
                  x2={plotW}
                  stroke="var(--border-primary)"
                  strokeOpacity={0.15}
                />
                <text
                  x={-8}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={8}
                  fill="var(--text-tertiary)"
                >
                  {tick}
                </text>
              </g>
            ))}

            {buckets.map((b, i) => {
              const x = i * (barWidth + BAR_GAP);
              const y = yScale(b.count);
              const h = plotH - y;
              const isHover = hoverIdx === i;
              const color = TIER_COLORS[b.tier];
              return (
                <g key={`bar-${b.rangeStart}`}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    fill={color}
                    fillOpacity={isHover ? 0.95 : 0.75}
                    stroke={color}
                    strokeOpacity={isHover ? 1 : 0}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    className="cursor-default"
                  />
                  {b.count > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={y - 4}
                      textAnchor="middle"
                      fontSize={9}
                      fill="var(--text-secondary)"
                    >
                      {b.count}
                    </text>
                  )}
                </g>
              );
            })}

            <line
              x1={0}
              y1={plotH}
              x2={plotW}
              y2={plotH}
              stroke="var(--border-primary)"
            />
            {buckets.map((b, i) => {
              const x = i * (barWidth + BAR_GAP) + barWidth / 2;
              return (
                <g
                  key={`x-${b.rangeStart}`}
                  transform={`translate(${x},${plotH})`}
                >
                  <line y2={4} stroke="var(--border-primary)" />
                  <text
                    y={14}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--text-tertiary)"
                  >
                    {b.rangeStart}
                  </text>
                </g>
              );
            })}
            <text
              x={plotW / 2}
              y={plotH + 32}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-tertiary)"
            >
              Parallel score
            </text>
          </g>

          {(['low', 'medium', 'high', 'critical'] as const).map((tier, i) => (
            <g
              key={tier}
              transform={`translate(${PADDING.left + i * 80},${PADDING.top - 14})`}
            >
              <rect
                width={10}
                height={8}
                y={-6}
                fill={TIER_COLORS[tier]}
                fillOpacity={0.75}
              />
              <text x={14} y={2} fontSize={9} fill="var(--text-tertiary)">
                {tier}
              </text>
            </g>
          ))}
        </svg>
        {hover && (
          <div
            className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20 whitespace-nowrap"
            style={{
              left:
                PADDING.left + hover.idx * (barWidth + BAR_GAP) + barWidth / 2,
              top: PADDING.top + yScale(hover.bucket.count) - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-semibold">
              Parallel {hover.bucket.rangeStart}–{hover.bucket.rangeEnd}
            </div>
            <div className="text-text-secondary">
              {hover.bucket.count}{' '}
              {hover.bucket.count === 1 ? 'file' : 'files'}
            </div>
            <div
              className="mt-0.5 capitalize"
              style={{ color: TIER_COLORS[hover.bucket.tier] }}
            >
              {hover.bucket.tier}
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary="10-bin histogram · bar height = file count · color = parallel-dev tier (low/medium/high/critical)"
        subtitle="What's the shape of concurrency risk across the repo? Which files cross the high-parallel threshold?"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run apps/web/src/components/hero/ParallelScoreHistogram.test.tsx
```

Expected: all 13 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm lint && pnpm format
git add apps/web/src/components/hero/ParallelScoreHistogram.tsx apps/web/src/components/hero/ParallelScoreHistogram.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): ParallelScoreHistogram hero — distribution shape (RELIC-309)

Pixel-mirrors BlastHistogram / RewriteHistogram / BusFactorHistogram. 10
bins of width 10, ≥70 zone shaded, color-by-tier of bucket midpoint.
Replaces the firehose Swimlanes default — answers "what's the shape of
concurrency risk?" rather than "who committed when across the whole repo?"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Web — `ParallelTimeline` hero (alt)

**Files:**
- Create: `apps/web/src/components/hero/ParallelTimeline.tsx`
- Create: `apps/web/src/components/hero/ParallelTimeline.test.tsx`

NEW pattern: monthly aggregate bar chart sourced from `report.parallelDev.byMonth`. Bars colored by avg-author tint (more authors → warmer color). Smaller / simpler than the histogram — single SVG, no scale tuning beyond linear.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/hero/ParallelTimeline.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ParallelTimeline } from './ParallelTimeline';
import type { GitrelicReport, ParallelDevByMonth } from '@gitrelic/core';

function makeReport(byMonth: ParallelDevByMonth[]): GitrelicReport {
  return {
    parallelDev: {
      files: [],
      hotFiles: [],
      totalParallelFiles: 0,
      highParallel: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('ParallelTimeline', () => {
  it('renders the empty-state caption when byMonth is empty', () => {
    render(<ParallelTimeline report={makeReport([])} />);
    expect(screen.getByText(/Monthly bar chart/)).toBeTruthy();
  });

  it('renders the caption when byMonth has entries', () => {
    render(
      <ParallelTimeline
        report={makeReport([
          {
            month: '2025-06',
            parallelEvents: 5,
            uniqueFiles: 3,
            avgAuthors: 2.4,
          },
          {
            month: '2025-07',
            parallelEvents: 8,
            uniqueFiles: 5,
            avgAuthors: 3.0,
          },
        ])}
      />,
    );
    expect(screen.getByText(/Monthly bar chart/)).toBeTruthy();
  });

  it('renders one bar per month', () => {
    const { container } = render(
      <ParallelTimeline
        report={makeReport([
          {
            month: '2025-06',
            parallelEvents: 5,
            uniqueFiles: 3,
            avgAuthors: 2.4,
          },
          {
            month: '2025-07',
            parallelEvents: 8,
            uniqueFiles: 5,
            avgAuthors: 3.0,
          },
          {
            month: '2025-08',
            parallelEvents: 2,
            uniqueFiles: 2,
            avgAuthors: 2.0,
          },
        ])}
      />,
    );
    expect(container.querySelectorAll('rect.parallel-timeline-bar')).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run apps/web/src/components/hero/ParallelTimeline.test.tsx
```

Expected: fails with "Cannot find module './ParallelTimeline'".

- [ ] **Step 3: Implement `ParallelTimeline`**

Create `apps/web/src/components/hero/ParallelTimeline.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';

import { HeroCaption } from '../shared/HeroCaption';
import type { GitrelicReport } from '@gitrelic/core';

interface ParallelTimelineProps {
  report: GitrelicReport;
}

const PADDING = { top: 28, right: 24, bottom: 44, left: 56 };
const BAR_GAP = 4;

// Color tint scale: more authors per parallel event → warmer color.
// 2 authors (the floor) starts at the healthy/warning boundary; 5+ saturates
// at critical. Pure interpolation between three CSS variables.
const TINT_STOPS = [
  { authors: 2.0, color: 'var(--severity-healthy)' },
  { authors: 3.0, color: 'var(--severity-warning)' },
  { authors: 5.0, color: 'var(--severity-critical)' },
];

function tintFor(avgAuthors: number): string {
  if (avgAuthors <= TINT_STOPS[0].authors) return TINT_STOPS[0].color;
  if (avgAuthors >= TINT_STOPS[TINT_STOPS.length - 1].authors)
    return TINT_STOPS[TINT_STOPS.length - 1].color;
  for (let i = 0; i < TINT_STOPS.length - 1; i++) {
    const a = TINT_STOPS[i];
    const b = TINT_STOPS[i + 1];
    if (avgAuthors >= a.authors && avgAuthors < b.authors) {
      // Fall back to the upper-bound color when in-between — the var()
      // tokens can't be linearly interpolated client-side without a paint
      // proxy, so we round to the nearest higher stop. Three-stop palette
      // keeps the resulting bar set visually distinct.
      return b.color;
    }
  }
  return TINT_STOPS[TINT_STOPS.length - 1].color;
}

export function ParallelTimeline({ report }: ParallelTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const months = report.parallelDev.byMonth;
  const maxEvents = useMemo(
    () => months.reduce((m, b) => (b.parallelEvents > m ? b.parallelEvents : m), 0),
    [months],
  );

  const svgHeight = Math.max(120, dims.height - 56);
  const plotW = Math.max(40, dims.width - PADDING.left - PADDING.right);
  const plotH = Math.max(40, svgHeight - PADDING.top - PADDING.bottom);

  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain([0, Math.max(maxEvents, 1)])
        .range([plotH, 0])
        .nice(4),
    [maxEvents, plotH],
  );

  const barWidth =
    months.length === 0
      ? 0
      : (plotW - BAR_GAP * Math.max(0, months.length - 1)) / months.length;

  if (months.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
          No parallel-dev events in the analyzed window.
        </div>
        <HeroCaption
          primary="Monthly bar chart · bar height = parallel events · color tint = avg author count"
          subtitle="No (file, week) pairs with 2+ distinct authors yet — every concurrent edit happens in disjoint weeks."
        />
      </div>
    );
  }

  const yTicks = yScale.ticks(4);
  const hover =
    hoverIdx == null ? null : { idx: hoverIdx, bucket: months[hoverIdx] };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <svg
          width={dims.width}
          height={svgHeight}
          role="img"
          aria-label={`Parallel-events monthly timeline across ${months.length} months. Bar height = parallel events that month, color tint = average authors per event.`}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={plotH}
              stroke="var(--border-primary)"
            />
            <text
              transform={`translate(-40,${plotH / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-tertiary)"
            >
              Events
            </text>
            {yTicks.map((tick) => (
              <g key={`y-${tick}`} transform={`translate(0,${yScale(tick)})`}>
                <line x2={-4} stroke="var(--border-primary)" />
                <line
                  x2={plotW}
                  stroke="var(--border-primary)"
                  strokeOpacity={0.15}
                />
                <text
                  x={-8}
                  textAnchor="end"
                  dominantBaseline="central"
                  fontSize={8}
                  fill="var(--text-tertiary)"
                >
                  {tick}
                </text>
              </g>
            ))}

            {months.map((b, i) => {
              const x = i * (barWidth + BAR_GAP);
              const y = yScale(b.parallelEvents);
              const h = plotH - y;
              const isHover = hoverIdx === i;
              const color = tintFor(b.avgAuthors);
              return (
                <g key={`bar-${b.month}`}>
                  <rect
                    className="parallel-timeline-bar cursor-default"
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    fill={color}
                    fillOpacity={isHover ? 0.95 : 0.75}
                    stroke={color}
                    strokeOpacity={isHover ? 1 : 0}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  />
                </g>
              );
            })}

            <line
              x1={0}
              y1={plotH}
              x2={plotW}
              y2={plotH}
              stroke="var(--border-primary)"
            />
            {months.map((b, i) => {
              const x = i * (barWidth + BAR_GAP) + barWidth / 2;
              // Show every Nth label when there are too many months
              const labelEvery =
                months.length > 24 ? Math.ceil(months.length / 12) : 1;
              if (i % labelEvery !== 0) return null;
              return (
                <g
                  key={`x-${b.month}`}
                  transform={`translate(${x},${plotH})`}
                >
                  <line y2={4} stroke="var(--border-primary)" />
                  <text
                    y={14}
                    textAnchor="middle"
                    fontSize={8}
                    fill="var(--text-tertiary)"
                  >
                    {b.month}
                  </text>
                </g>
              );
            })}
            <text
              x={plotW / 2}
              y={plotH + 32}
              textAnchor="middle"
              fontSize={10}
              fill="var(--text-tertiary)"
            >
              Month
            </text>
          </g>
        </svg>
        {hover && (
          <div
            className="absolute bg-tooltip-bg border border-border-primary rounded px-2.5 py-1.5 text-[10px] text-tooltip-text pointer-events-none z-20 whitespace-nowrap"
            style={{
              left:
                PADDING.left + hover.idx * (barWidth + BAR_GAP) + barWidth / 2,
              top: PADDING.top + yScale(hover.bucket.parallelEvents) - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-semibold">{hover.bucket.month}</div>
            <div className="text-text-secondary">
              {hover.bucket.parallelEvents}{' '}
              {hover.bucket.parallelEvents === 1 ? 'event' : 'events'} ·{' '}
              {hover.bucket.uniqueFiles}{' '}
              {hover.bucket.uniqueFiles === 1 ? 'file' : 'files'}
            </div>
            <div className="text-text-tertiary mt-0.5">
              {hover.bucket.avgAuthors.toFixed(1)} avg authors / event
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary="Monthly bar chart · bar height = parallel events · color tint = avg author count"
        subtitle="Is parallel-development pressure trending up or down? Are concurrent-edit weeks getting more crowded?"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run apps/web/src/components/hero/ParallelTimeline.test.tsx
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm lint && pnpm format
git add apps/web/src/components/hero/ParallelTimeline.tsx apps/web/src/components/hero/ParallelTimeline.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): ParallelTimeline hero — monthly parallel-event trend (RELIC-309)

Monthly aggregate bar chart of (file, week) parallel events, colored by
avg author count. Distinct from the firehose Timeline (which stacks
per-author commit volume) — answers the temporal question the histogram
alone can't: "is parallel-development pressure trending up or down?"

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Web — register new heroes in `presets/types.ts` + Shell

**Files:**
- Modify: `apps/web/src/presets/types.ts` (extend `HeroViz` union)
- Modify: `apps/web/src/components/layout/Shell.tsx` (imports + HERO_LABELS + render switch)

- [ ] **Step 1: Extend `HeroViz` union**

In `apps/web/src/presets/types.ts`, add two entries to the `HeroViz` union:

```ts
export type HeroViz =
  | 'treemap'
  | 'treemap-test'
  | 'ownership'
  | 'ownership-bar'
  | 'churn-bar'
  | 'coupling'
  | 'commit-graph'
  | 'scatter'
  | 'timeline'
  | 'swimlanes'
  | 'risk-heatmap'
  | 'ownership-sunburst'
  | 'ownership-sunburst-ghosts'
  | 'ownership-sunburst-silos'
  | 'author-force-graph'
  | 'shame-leaderboard'
  | 'shame-trend'
  | 'rename-sankey'
  | 'growth-timeline'
  | 'debt-scatter'
  | 'rewrite-diverging-bar'
  | 'staleness-scatter'
  | 'age-histogram'
  | 'blast-histogram'
  | 'bus-factor-histogram'
  | 'rewrite-histogram'
  | 'parallel-score-histogram'
  | 'parallel-timeline'
  | 'languages-stacked'
  | 'test-coverage-by-dir';
```

- [ ] **Step 2: Add hero labels in Shell**

In `apps/web/src/components/layout/Shell.tsx`, extend the `HERO_LABELS` map with:

```ts
'parallel-score-histogram': 'Distribution',
'parallel-timeline': 'Trend',
```

Add them after the `'rewrite-histogram': 'Distribution',` entry to keep the histograms grouped together.

- [ ] **Step 3: Add the hero imports in Shell**

In the imports at the top of `apps/web/src/components/layout/Shell.tsx`, add (alphabetical with other hero imports):

```ts
import { ParallelScoreHistogram } from '../hero/ParallelScoreHistogram';
import { ParallelTimeline } from '../hero/ParallelTimeline';
```

- [ ] **Step 4: Wire the hero render cases**

In `apps/web/src/components/layout/Shell.tsx`, add two new render branches inside the hero `<div>` switch (after `'rewrite-histogram'` for visual grouping):

```tsx
{selection.activeHeroViz === 'parallel-score-histogram' && (
  <ParallelScoreHistogram report={report} />
)}
{selection.activeHeroViz === 'parallel-timeline' && (
  <ParallelTimeline report={report} />
)}
```

- [ ] **Step 5: Type-check + run web tests**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run
```

Expected: all web tests still green. Type check should pass — the union extension is backward-compatible.

- [ ] **Step 6: Commit**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm lint && pnpm format
git add apps/web/src/presets/types.ts apps/web/src/components/layout/Shell.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire ParallelScoreHistogram + ParallelTimeline into Shell (RELIC-309)

Adds parallel-score-histogram and parallel-timeline to the HeroViz union
and to Shell's render switch + HERO_LABELS map. Heroes still unreachable
until the preset registry switch in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Web — rewrite `ParallelDevTab.tsx` as a `<NarrativeKPI>` consumer

**Files:**
- Replace contents: `apps/web/src/components/tabs/ParallelDevTab.tsx`
- Create: `apps/web/src/components/tabs/ParallelDevTab.test.tsx`

The big visual change. Drops the 75-line `SortableTable`. Mirrors `RewriteRatioTab.tsx` structure.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/tabs/ParallelDevTab.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ParallelDevTab } from './ParallelDevTab';
import type { GitrelicReport, FileParallelDev } from '@gitrelic/core';

function f(
  path: string,
  parallelScore: number,
  overrides: Partial<FileParallelDev> = {},
): FileParallelDev {
  return {
    file: path,
    parallelScore,
    totalActiveWeeks: 10,
    parallelWeeks: 5,
    peakAuthors: 3,
    peakWindow: {
      weekStart: '2025-06-02T00:00:00.000Z',
      authors: ['a@x.com', 'b@x.com'],
      commitCount: 2,
    },
    topWindows: [],
    narrative: '',
    ...overrides,
  };
}

function makeReport(files: FileParallelDev[]): GitrelicReport {
  const high = files.filter((file) => file.parallelScore >= 70).length;
  return {
    parallelDev: {
      files,
      hotFiles: files.slice(0, 10),
      totalParallelFiles: files.length,
      highParallel: high,
      tierMix: {
        low: files.filter((file) => file.parallelScore < 25).length,
        medium: files.filter(
          (file) => file.parallelScore >= 25 && file.parallelScore < 50,
        ).length,
        high: files.filter(
          (file) => file.parallelScore >= 50 && file.parallelScore < 75,
        ).length,
        critical: files.filter((file) => file.parallelScore >= 75).length,
      },
      byMonth: [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('ParallelDevTab', () => {
  it('renders the highParallel count as the big number', () => {
    render(
      <ParallelDevTab
        report={makeReport([f('a.ts', 80), f('b.ts', 75), f('c.ts', 30)])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('2');
  });

  it('renders 0 with the Healthy tier when no files cross the threshold', () => {
    render(
      <ParallelDevTab
        report={makeReport([f('a.ts', 30)])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('0');
    expect(screen.getByText('Healthy')).toBeTruthy();
  });

  it('shows top-3 high-parallel files in the finding section', () => {
    render(
      <ParallelDevTab
        report={makeReport([
          f('top.ts', 90),
          f('mid.ts', 80),
          f('low.ts', 75),
          f('extra.ts', 71), // 4th file — should NOT appear
        ])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('top.ts')).toBeTruthy();
    expect(screen.getByText('mid.ts')).toBeTruthy();
    expect(screen.getByText('low.ts')).toBeTruthy();
    expect(screen.queryByText('extra.ts')).toBeNull();
  });

  it('does NOT include sub-threshold files in the top-3 even if hotFiles does', () => {
    // Single file above threshold; the other 2 are sub-threshold but in hotFiles
    // (because hotFiles is whole-repo top-10, regardless of threshold)
    render(
      <ParallelDevTab
        report={makeReport([
          f('only-high.ts', 80),
          f('mid.ts', 60),
          f('low.ts', 40),
        ])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('only-high.ts')).toBeTruthy();
    // Sub-threshold files must not appear under "Top parallel files"
    expect(screen.queryByText('mid.ts')).toBeNull();
    expect(screen.queryByText('low.ts')).toBeNull();
  });

  it('renders the 3-tier subline collapse (low / moderate / high)', () => {
    render(
      <ParallelDevTab
        report={makeReport([
          f('a.ts', 10), // low
          f('b.ts', 30), // medium → moderate
          f('c.ts', 60), // high → high
          f('d.ts', 80), // critical → high
        ])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/low/)).toBeTruthy();
    expect(screen.getByText(/moderate/)).toBeTruthy();
    expect(screen.getByText(/high/)).toBeTruthy();
  });

  it('wires the see-also footer to Co-Authors and Coupling', () => {
    const onApplyPreset = vi.fn();
    render(
      <ParallelDevTab
        report={makeReport([f('a.ts', 80)])}
        onApplyPreset={onApplyPreset}
      />,
    );
    screen.getByRole('button', { name: 'Co-Authors' }).click();
    expect(onApplyPreset).toHaveBeenCalledWith('co-authors');
    screen.getByRole('button', { name: 'Coupling' }).click();
    expect(onApplyPreset).toHaveBeenCalledWith('coupling');
  });

  it('renders the directory rollup in the extras slot when there are high-parallel files', () => {
    render(
      <ParallelDevTab
        report={makeReport([
          f('packages/a/src/x.ts', 80),
          f('packages/a/src/y.ts', 80),
          f('packages/b/src/z.ts', 75),
        ])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Where they live')).toBeTruthy();
    expect(screen.getByText('packages/a/src')).toBeTruthy();
    expect(screen.getByText('packages/b/src')).toBeTruthy();
  });

  it('hides the extras slot when no files cross the threshold', () => {
    render(
      <ParallelDevTab
        report={makeReport([f('a.ts', 30)])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.queryByText('Where they live')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run apps/web/src/components/tabs/ParallelDevTab.test.tsx
```

Expected: tests fail because the current `ParallelDevTab` is a `SortableTable`, not a `NarrativeKPI`.

- [ ] **Step 3: Replace the tab implementation**

Replace the entire contents of `apps/web/src/components/tabs/ParallelDevTab.tsx` with:

```tsx
import { aggregateParallelDevByDirectory } from '../../utils/parallelDevByDirectory';
import { HIGH_PARALLEL_THRESHOLD } from '../hero/ParallelScoreHistogram';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import { fileName } from '../theme';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface ParallelDevTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

// Headcount tiering: 0 = Healthy, 1..MODERATE_THRESHOLD-1 = Moderate, ≥MODERATE_THRESHOLD = High Concurrency.
// Same shape as Rewrite Ratio's panel — concurrent-work files are uncommon at any repo size.
export const MODERATE_THRESHOLD = 5;

function tierBadge(highParallelCount: number): {
  variant: BadgeVariant;
  label: string;
} {
  if (highParallelCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highParallelCount < MODERATE_THRESHOLD)
    return { variant: 'warning', label: 'Moderate' };
  return { variant: 'critical', label: 'High Concurrency' };
}

export function ParallelDevTab({ report, onApplyPreset }: ParallelDevTabProps) {
  const { files, highParallel, tierMix } = report.parallelDev;
  // Slice top files from the threshold-filtered subset (per RELIC-315 lesson).
  const highParallelFiles = files.filter(
    (f) => f.parallelScore >= HIGH_PARALLEL_THRESHOLD,
  );
  const tier = tierBadge(highParallel);
  const topFiles = highParallelFiles.slice(0, TOP_FILES_COUNT);

  // Subline collapses tierMix's 4 storage buckets into 3 display labels per
  // polish-pattern.md: low (0–24), moderate (25–49), high+critical (50+).
  // Bus Factor / Blast Radius display 4 separately; this analyzer's spec
  // calls for 3 because "critical" doesn't add forensic information for
  // concurrency risk over "high" (the tier where defect-correlation kicks in).
  const sublineHigh = tierMix.high + tierMix.critical;

  const allDirectoryRows = aggregateParallelDevByDirectory(highParallelFiles);
  const directoryRows = allDirectoryRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(
    0,
    allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT,
  );
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(highParallel)}
      tier={tier}
      metric={`Files ≥${HIGH_PARALLEL_THRESHOLD} Parallel`}
      finding={
        highParallel > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
              Top parallel files
            </div>
            {topFiles.map((f) => (
              <div key={f.file} className="leading-[1.5]">
                <span className="font-mono text-text-primary">
                  {fileName(f.file)}
                </span>{' '}
                <span className="text-text-tertiary">
                  <span className="font-mono text-text-primary font-semibold">
                    {f.parallelWeeks}
                  </span>{' '}
                  parallel weeks ·{' '}
                  <span className="font-mono text-text-primary font-semibold">
                    {f.peakAuthors}
                  </span>{' '}
                  peak authors
                </span>
              </div>
            ))}
          </div>
        ) : files.length > 0 ? (
          <>
            No files cross the high-parallel threshold — concurrent edits are
            spread across distinct weeks.
          </>
        ) : (
          <>No parallel-development signal in the analyzed window.</>
        )
      }
      subline={
        files.length > 0 ? (
          <>
            Tier mix: <strong>{sublineHigh.toLocaleString()}</strong> high ·{' '}
            <strong>{tierMix.medium.toLocaleString()}</strong> moderate ·{' '}
            <strong>{tierMix.low.toLocaleString()}</strong> low
          </>
        ) : null
      }
      extras={
        directoryRows.length > 0 ? (
          <div>
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px] mb-2">
              Where they live
            </div>
            <div className="flex flex-col gap-1">
              {directoryRows.map((row) => (
                <div
                  key={row.directory}
                  className="flex items-center gap-3 text-[11px] leading-[1.4]"
                >
                  <Tooltip
                    content={row.directory || '(root)'}
                    wrapperClassName="block flex-1 min-w-0 font-mono text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap"
                  >
                    {row.directory || '(root)'}
                  </Tooltip>
                  <div className="w-20 h-1 bg-surface-tertiary rounded-xs overflow-hidden shrink-0">
                    <div
                      className="h-full bg-severity-critical opacity-70"
                      style={{ width: `${(row.count / maxDirCount) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-text-primary font-semibold inline-block min-w-8 text-right">
                    {row.count}
                  </span>
                  <span className="text-text-tertiary text-[10px] inline-block min-w-9 text-right">
                    {(row.share * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
            {hiddenDirectoryCount > 0 && (
              <div className="mt-1.5 text-[10px] text-text-tertiary">
                + {hiddenDirectoryCount} more{' '}
                {hiddenDirectoryCount === 1 ? 'directory' : 'directories'}
              </div>
            )}
          </div>
        ) : undefined
      }
      seeAlso={[
        { label: 'Co-Authors', presetId: 'co-authors' },
        { label: 'Coupling', presetId: 'coupling' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
```

- [ ] **Step 4: Update `BottomPanel.tsx` to pass `onApplyPreset` if not already**

Search `apps/web/src/components/layout/BottomPanel.tsx` for the existing `ParallelDevTab` invocation. The previous `ParallelDevTab` took `onSelectFile`; the new one takes `onApplyPreset`. Verify by running:

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
grep -n 'ParallelDevTab' apps/web/src/components/layout/BottomPanel.tsx
```

Inspect the result. If the call site reads `<ParallelDevTab report={report} onSelectFile={...} />`, replace it with `<ParallelDevTab report={report} onApplyPreset={onApplyPreset} />`. (RewriteRatioTab and BlastRadiusTab already use `onApplyPreset`, so this prop should already be available in BottomPanel's scope.)

- [ ] **Step 5: Run the tab test to confirm it passes**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run apps/web/src/components/tabs/ParallelDevTab.test.tsx
```

Expected: all 8 tests pass.

- [ ] **Step 6: Run the full web suite**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run
```

Expected: all tests pass. Type-check should be clean.

- [ ] **Step 7: Commit**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm lint && pnpm format
git add apps/web/src/components/tabs/ParallelDevTab.tsx apps/web/src/components/tabs/ParallelDevTab.test.tsx apps/web/src/components/layout/BottomPanel.tsx
git commit -m "$(cat <<'EOF'
feat(web): rewrite ParallelDevTab as NarrativeKPI consumer (RELIC-309)

Drops the 75-line per-file SortableTable that was a rotated copy of the
hero. New layout mirrors RewriteRatioTab / BlastRadiusTab:

- Big number: highParallel (count of files ≥70).
- Tier badge: 0=Healthy, 1–4=Moderate, 5+=High Concurrency.
- Finding: top-3 from the threshold-filtered subset (basename · N parallel
  weeks · K peak authors).
- Subline: 3-tier mix (low / moderate / high+critical).
- Extras slot: top-5 parent-directory rollup of high-parallel files.
- See-also: Co-Authors + Coupling, sticky to the panel bottom.

Per-file detail still surfaces via the right-side Inspector and the new
ParallelScoreHistogram on hover.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Web — preset registry + metrics-strip wiring

**Files:**
- Modify: `apps/web/src/presets/registry.ts` (parallel-dev preset hero swap)
- Modify: `apps/web/src/presets/metrics/parallel-dev.ts` (metrics-strip slot 2 fix)
- Modify: `apps/web/src/presets/metrics/parallel-dev.test.ts` (if present — otherwise skip update)

- [ ] **Step 1: Swap the parallel-dev preset hero config**

In `apps/web/src/presets/registry.ts`, find the `'parallel-dev'` block and replace it with:

```ts
'parallel-dev': {
  id: 'parallel-dev',
  tier: 'analyzer',
  label: 'Parallel Dev',
  group: 'team-activity',
  hero: {
    defaultViz: 'parallel-score-histogram',
    altTabs: ['parallel-score-histogram', 'parallel-timeline'],
  },
  bottomPanel: {
    defaultTab: 'parallel-dev',
    altTabs: ['parallel-dev'],
  },
  metrics: parallelDevMetrics,
},
```

- [ ] **Step 2: Replace the `parallelDevMetrics` slot 2**

In `apps/web/src/presets/metrics/parallel-dev.ts`, replace the file contents with:

```ts
import { fmt } from '../../components/theme';
import { MODERATE_THRESHOLD } from '../../components/tabs/ParallelDevTab';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function parallelDevMetrics(report: GitrelicReport): Metric[] {
  const { hotFiles, totalParallelFiles, highParallel, files } =
    report.parallelDev;
  const topFile = hotFiles[0];
  const topScore = topFile?.parallelScore ?? 0;
  const peakAuthors = files.reduce(
    (max, f) => (f.peakAuthors > max ? f.peakAuthors : max),
    0,
  );

  return [
    {
      label: 'Parallel Files',
      value: fmt(totalParallelFiles),
      color:
        totalParallelFiles > 0
          ? 'var(--severity-warning)'
          : 'var(--severity-healthy)',
    },
    {
      label: 'High Parallel',
      value: fmt(highParallel),
      color:
        highParallel === 0
          ? 'var(--severity-healthy)'
          : highParallel < MODERATE_THRESHOLD
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
    {
      label: 'Top Score',
      value: topFile ? String(Math.round(topScore)) : '—',
      color: !topFile
        ? 'var(--severity-healthy)'
        : topScore >= 70
          ? 'var(--severity-critical)'
          : 'var(--severity-warning)',
    },
    {
      label: 'Peak Authors',
      value: peakAuthors > 0 ? String(peakAuthors) : '—',
      color:
        peakAuthors >= 4 ? 'var(--severity-warning)' : 'var(--accent-primary)',
    },
  ];
}
```

- [ ] **Step 3: Update or create the metrics test**

Check whether the metrics file has a test:

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
ls apps/web/src/presets/metrics/parallel-dev.test.ts
```

If it exists, open and update the existing test to assert the new `High Parallel` slot and severity bands. If it does not exist, create `apps/web/src/presets/metrics/parallel-dev.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';

import { parallelDevMetrics } from './parallel-dev';
import { MODERATE_THRESHOLD } from '../../components/tabs/ParallelDevTab';
import type { GitrelicReport, FileParallelDev } from '@gitrelic/core';

function f(parallelScore: number, peakAuthors = 2): FileParallelDev {
  return {
    file: 'a.ts',
    parallelScore,
    totalActiveWeeks: 10,
    parallelWeeks: 5,
    peakAuthors,
    peakWindow: {
      weekStart: '2025-06-02T00:00:00.000Z',
      authors: [],
      commitCount: 0,
    },
    topWindows: [],
    narrative: '',
  };
}

function makeReport(
  files: FileParallelDev[],
  highParallel: number,
): GitrelicReport {
  return {
    parallelDev: {
      files,
      hotFiles: files.slice(0, 10),
      totalParallelFiles: files.length,
      highParallel,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth: [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('parallelDevMetrics — High Parallel slot', () => {
  it('renders 0 with healthy color when no files cross the threshold', () => {
    const metrics = parallelDevMetrics(makeReport([], 0));
    const slot = metrics.find((m) => m.label === 'High Parallel');
    expect(slot?.value).toBe('0');
    expect(slot?.color).toBe('var(--severity-healthy)');
  });

  it('uses warning color when 1..MODERATE_THRESHOLD-1 files cross', () => {
    const metrics = parallelDevMetrics(
      makeReport([f(80), f(75)], 2),
    );
    const slot = metrics.find((m) => m.label === 'High Parallel');
    expect(slot?.value).toBe('2');
    expect(slot?.color).toBe('var(--severity-warning)');
  });

  it('uses critical color at MODERATE_THRESHOLD or above', () => {
    const files = Array.from({ length: MODERATE_THRESHOLD }, () => f(80));
    const metrics = parallelDevMetrics(
      makeReport(files, MODERATE_THRESHOLD),
    );
    const slot = metrics.find((m) => m.label === 'High Parallel');
    expect(slot?.color).toBe('var(--severity-critical)');
  });

  it('does not render the deprecated "Hot Files" label', () => {
    const metrics = parallelDevMetrics(makeReport([], 0));
    expect(metrics.find((m) => m.label === 'Hot Files')).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run the metrics test to confirm it passes**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run apps/web/src/presets/metrics/parallel-dev.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run the full web suite + build**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm --filter @gitrelic/web test --run
pnpm build
```

Expected: all tests pass; full build succeeds (CLI build will pick up the regenerated core bundle).

- [ ] **Step 6: Commit**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm lint && pnpm format
git add apps/web/src/presets/registry.ts apps/web/src/presets/metrics/parallel-dev.ts apps/web/src/presets/metrics/parallel-dev.test.ts
git commit -m "$(cat <<'EOF'
feat(web): wire parallel-dev preset to new heroes + High Parallel metric (RELIC-309)

- Preset: defaultViz=parallel-score-histogram, altTabs=[histogram, timeline].
  Drop swimlanes/timeline (still alive in Contributors/Overview presets).
- Metrics slot 2: replace misleading "Hot Files" (capped at hotFiles.length≤10)
  with "High Parallel" sourced from the new highParallel aggregate.
  Severity bands (0 / 1–4 / 5+) match the panel tier badge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verify rendered dashboard against React + GitRelic

**Files:** none (manual verification step)

The polish-pattern.md DoD requires confirming empty / small-repo / huge-repo states. The CLAUDE.md "Doing tasks" section explicitly says: *"For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete."*

- [ ] **Step 1: Build and run against React (huge-repo)**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm build
node apps/cli/dist/index.mjs --path ~/Desktop/nebulord/external/react --web
```

Open the printed URL in a browser. Navigate to **Parallel Dev** in the sidebar. Verify:
- Default hero is `Distribution` (the histogram), not `Swimlanes`.
- Bar shading at the ≥70 threshold is visible.
- Hovering bars shows tooltip with bucket range + count + tier.
- Alt-tab pill bar shows two options: **Distribution** and **Trend**.
- Switching to **Trend** shows the monthly bar chart with months ascending L→R.
- Bottom panel shows the big-number `<NarrativeKPI>` with directory rollup in extras.
- See-also footer at the bottom links to Co-Authors / Coupling.
- Metrics strip shows `High Parallel` slot 2 (not `Hot Files`).

- [ ] **Step 2: Build and run against gitrelic itself (small-repo)**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
node apps/cli/dist/index.mjs --path /Users/danteel/Desktop/nebulord/gitrelic --web
```

Verify:
- Histogram renders even when most bars are at low/medium tiers.
- If `highParallel === 0`, the panel shows `Healthy` tier badge.
- The directory rollup (`extras` slot) is hidden when there are no high-parallel files.
- The `Trend` alt hero gracefully handles a sparse `byMonth` (1–2 months only).

- [ ] **Step 3: Verify empty-state path manually**

If a small-repo run gives 0 parallel files, confirm:
- Histogram empty-state caption renders.
- `Trend` empty-state caption renders.
- Tab shows the "No files cross the high-parallel threshold" finding line and no extras section.

If unable to reproduce naturally, this can be tested by temporarily setting `MIN_PARALLEL_SCORE = 999` in the analyzer (and reverting before commit).

---

## Task 9: Final cleanup + PR

**Files:** none (process step)

- [ ] **Step 1: Final test pass**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
pnpm test
pnpm lint && pnpm format:check && pnpm build
```

Expected: all green.

- [ ] **Step 2: Inspect commit history**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
git log --oneline main..HEAD
```

Expected: 7 commits — backend aggregates, directory util, histogram, timeline, types/Shell wiring, tab rewrite, registry+metrics. (Verification step is not committed.)

- [ ] **Step 3: Push + open PR**

```bash
cd /Users/danteel/Desktop/nebulord/gitrelic/.worktrees/relic-309-polish-parallel-dev
git push -u origin relic-309-polish-parallel-dev
gh pr create --title "feat(web): parallel-dev polish (RELIC-309)" --body "$(cat <<'EOF'
## Summary

- Strips the firehose `Swimlanes` / `Timeline` heroes (still alive in Contributors/Overview) — they encoded zero `parallelScore` signal.
- Adds **`ParallelScoreHistogram`** (default) + **`ParallelTimeline`** (alt) — two analyzer-specific heroes that finally answer "what's the shape of concurrency risk?" and "is parallel pressure trending?"
- Replaces the 75-line per-file `SortableTable` with a `<NarrativeKPI>` mirroring Blast Radius / Rewrite Ratio: big-number `highParallel`, top-3 finding, 3-tier subline, directory rollup in extras.
- Backend: three additive aggregates on `ParallelDevReport` (`highParallel`, `tierMix`, `byMonth`) — no scoring-formula change, snapshot regen is additive only.
- Metrics-strip slot 2 fix: misleading "Hot Files" (capped at 10) → "High Parallel" (severity 0 / 1–4 / 5+, matching the panel tier badge).

Spec: [polish-pattern.md](https://github.com/nebulord-dev/gitrelic/blob/main/docs/polish-pattern.md#parallel-dev-spec--relic-309) → `parallel-dev`. Closes RELIC-309.

## Test plan

- [ ] `pnpm test` — full suite green (231+8 core, 29+24 web)
- [ ] `pnpm build` — full bundle succeeds
- [ ] Run `--web` against React: histogram default + Trend alt + narrative-KPI panel + High Parallel metric
- [ ] Run `--web` against gitrelic: small-repo empty-extras path, sparse byMonth chart
- [ ] Verify see-also footer links to Co-Authors / Coupling

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR opens; CI runs the standard test + install-smoke + bundled-deps mirror checks.

- [ ] **Step 4: Update polish-pattern.md status**

After merge, edit `docs/polish-pattern.md` to flip the `parallel-dev` heading from `*(spec — RELIC-309)*` to `*(shipped — RELIC-309)*` and move it from "Pending (Batches 2–N)" considerations to the Mapped section. Keep all the spec content — just retag the status. (Same edit pattern used for `churn`, `forensics`, `blast-radius`, `rewrite-ratio` after their PRs merged.)

---

## Self-review checklist

Run through these once before handing off to execution:

- **Spec coverage:** Big number ✓, tier thresholds ✓, top-3 finding ✓, subline tier mix ✓ (collapsed to 3 per spec text), extras directory rollup ✓, see-also Co-Authors+Coupling ✓, default histogram ✓, alt timeline ✓, both heroes get `<HeroCaption>` ✓, swimlanes/timeline removed from preset ✓, metrics slot 2 swap ✓, three backend aggregates ✓ (no formula change), tests ✓, snapshot regen ✓, empty/small/huge-repo verification ✓.
- **Type consistency:** `HIGH_PARALLEL_THRESHOLD` is exported from `ParallelScoreHistogram.tsx` and consumed by `ParallelDevTab.tsx` (Task 6 imports from `'../hero/ParallelScoreHistogram'`). `MODERATE_THRESHOLD` is exported from `ParallelDevTab.tsx` and consumed by `parallel-dev.ts` metrics (Task 7). `ParallelDevTierMix` and `ParallelDevByMonth` are exported from core's `types.ts` (Task 1) and re-exported from core's `index.ts` automatically via the existing `export * from './types'` (verify in Task 1 step 1).
- **No placeholders:** Every code block contains real code; no "TBD"; no "similar to Task N"; every command has expected output.
- **DRY/YAGNI:** Reuses `BlastHistogram` / `RewriteRatioTab` / `blastByDirectory` patterns. No new shared abstractions invented. Score formula deliberately untouched.
- **TDD:** Every implementation step is preceded by a failing test step. The fixture-regression snapshot is regenerated with `-u` only after the analyzer impl lands.
