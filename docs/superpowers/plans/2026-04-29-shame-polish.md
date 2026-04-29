# Shame (forensics) Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the RELIC-308 polish for the Shame (forensics) analyzer — fix the score formula so it stops tying at 100, add temporal/tier aggregates, replace the rotated-table bottom panel with a `<NarrativeKPI>`, add a Trend hero, and document the analyzer.

**Architecture:** Three layers move in lockstep. (1) `packages/core/src/analyzers/forensics.ts` gains a confidence-multiplier formula and two new aggregates (`keywordTiers`, `byMonth`); (2) `apps/web/src/components/hero/` gains a new `ShameTrend` component and a revised `ShameLeaderboard`, both wearing `<HeroCaption>`; (3) `apps/web/src/components/tabs/ShameTab.tsx` is rewritten end-to-end as a `<NarrativeKPI>` consumer mirroring the post-RELIC-315 `BlastRadiusTab.tsx`. A small util (`shameByDirectory.ts`) feeds the KPI's "extras" slot.

**Tech Stack:** TypeScript 6, Vitest, React 19, D3-less SVG (existing convention in the hero/ folder), `@testing-library/react` for tab/hero render tests.

**Worktree:** `/Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics` on branch `relic-308-polish-forensics`. Spec at `docs/superpowers/specs/2026-04-29-shame-polish-design.md` (already committed).

**Test commands (one-shot, agent-friendly):**

```bash
# Core (backend, snapshot)
pnpm --filter @gitrelic/core test --run

# Web (heroes, tabs, utils)
pnpm --filter @gitrelic/web test --run

# Both
pnpm test
```

---

## Setup Task: Worktree baseline

**Files:** none (toolchain only)

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm install
```

Expected: pnpm resolves and links workspace packages. Some warnings are acceptable; errors are not.

- [ ] **Step 2: Run baseline tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm test
```

Expected: all pre-existing tests pass (231 core + 29 web at the time of writing). If anything fails on the worktree baseline, **stop and investigate before proceeding** — broken tests on a clean branch indicate environment drift, not a feature issue.

- [ ] **Step 3: Confirm dev tools work**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm lint
pnpm format:check
pnpm build
```

Expected: clean lint, clean format, full build succeeds. Don't proceed if any fail.

---

## Task 1: Tier A1 — Confidence-multiplier formula + leaderboard redefinition

**Files:**
- Modify: `packages/core/src/analyzers/forensics.ts`
- Modify: `packages/core/src/analyzers/forensics.test.ts`
- Update: `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` (regenerate)
- Possibly modify: `packages/core/src/analyzers/cursed-files.test.ts` (only if assertions break)

The single backend commit covers (a) the formula change and (b) redefining `shameLeaderboard` to come from the floor-passing subset. Snapshot regeneration lands in the same commit.

- [ ] **Step 1: Add failing tests for the new formula behavior**

At the top of `packages/core/src/analyzers/forensics.test.ts`, ensure the import line includes `CONFIDENCE_FLOOR`:

```ts
import { analyzeForensics, CONFIDENCE_FLOOR } from './forensics.js';
```

Then append to the test file:

```ts
describe('confidence multiplier', () => {
  it('dampens scores for files below the confidence floor', () => {
    const commits = [makeCommit({ message: 'fix typo', files: ['a.ts'] })];
    const result = analyzeForensics(commits, ['a.ts']);
    // 1 commit, 1 mild keyword (1pt) → raw 100, confidence 1/5, dampened to 20
    expect(result.files[0].shameScore).toBe(20);
  });

  it('reaches full confidence at and beyond the floor', () => {
    const commits = Array.from({ length: 5 }, (_, i) =>
      makeCommit({ message: 'fix bug', files: ['a.ts'], hash: `h${i}` }),
    );
    const result = analyzeForensics(commits, ['a.ts']);
    // 5 commits × 2pts ("fix" 1 + "bug" 1) = 10 raw points / 5 commits = 200% raw → capped at 100, confidence 1
    expect(result.files[0].shameScore).toBe(100);
  });

  it('exposes the CONFIDENCE_FLOOR constant for downstream consumers', () => {
    // Use ESM import; see top of forensics.test.ts for the import line.
    expect(CONFIDENCE_FLOOR).toBe(5);
  });
});

describe('shameLeaderboard redefinition (floor-passing only)', () => {
  it('excludes sub-floor files from the leaderboard but keeps them in files[]', () => {
    const commits = [
      makeCommit({ message: 'revert broken thing', files: ['lone.yml'] }), // 1 commit, sub-floor
      ...Array.from({ length: 6 }, (_, i) =>
        makeCommit({ message: 'fix', files: ['solid.ts'], hash: `s${i}` }),
      ),
    ];
    const result = analyzeForensics(commits, ['lone.yml', 'solid.ts']);

    expect(result.files.map((f) => f.file)).toContain('lone.yml');
    expect(result.shameLeaderboard.map((f) => f.file)).not.toContain('lone.yml');
    expect(result.shameLeaderboard.map((f) => f.file)).toContain('solid.ts');
  });
});
```

If `makeCommit` helper isn't already in this file, copy the existing pattern from earlier in the test (look for inline commit construction; lift it to a tiny helper at the top of the file).

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run forensics.test.ts
```

Expected: the three new tests fail (FAIL on the score expectations, FAIL on `CONFIDENCE_FLOOR` import — currently undefined).

- [ ] **Step 3: Implement the formula change in `forensics.ts`**

In `packages/core/src/analyzers/forensics.ts`:

a) Export `CONFIDENCE_FLOOR` near the top of the file:

```ts
/**
 * Below this many commits, a file's shame score is dampened proportionally.
 * Prevents single-commit files (e.g. a YAML whose only commit message says "fix")
 * from tying at 100 with files that have a sustained pattern of shame.
 */
export const CONFIDENCE_FLOOR = 5;
```

b) Replace the existing `shameScore` computation (currently at line 115):

```ts
const rawScore = (rawShamePoints / fileCommitList.length) * 100;
const confidence = Math.min(1, fileCommitList.length / CONFIDENCE_FLOOR);
const shameScore = Math.min(Math.round(rawScore * confidence), 100);
```

c) Update the JSDoc block at the top of the file (lines 1–22) to describe the multiplier — mention that 1-commit files with mild keywords no longer reach 100, and reference `CONFIDENCE_FLOOR`.

d) Replace the existing `shameLeaderboard` slice (currently `files.slice(0, 10)`):

```ts
files.sort((a, b) => b.shameScore - a.shameScore);
const shameLeaderboard = files
  .filter((f) => fileCommits.get(f.file)!.length >= CONFIDENCE_FLOOR)
  .slice(0, 10);
```

(Files in `files[]` keep their dampened scores so cursed-files.ts continues to reference them.)

- [ ] **Step 4: Run the unit tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run forensics.test.ts
```

Expected: forensics tests pass.

- [ ] **Step 5: Run the snapshot test and inspect the diff**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run fixture-regression
```

Expected: snapshot test FAILS with several `shameScore` mismatches in the diff. Read the diff carefully — every mismatch should be a *reduction* (e.g., 100 → 20, 100 → 60). If any score went UP, the formula is wrong; debug.

- [ ] **Step 6: Regenerate the snapshot**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run fixture-regression -u
```

Expected: snapshot updated; test passes.

- [ ] **Step 7: Run the full core suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run
```

Expected: all core tests pass. If `cursed-files.test.ts` has any failures, inspect — direct mocks (lines 249, 286, 292) won't break, but a fixture-derived case might. Adjust expectations conservatively (only loosen what genuinely shifts due to the formula; don't rewrite test intent).

- [ ] **Step 8: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git add packages/core/src/analyzers/forensics.ts packages/core/src/analyzers/forensics.test.ts packages/core/src/__snapshots__/fixture-regression.test.ts.snap
# Conditionally:
git add packages/core/src/analyzers/cursed-files.test.ts  # only if you modified it
git commit -m "$(cat <<'EOF'
feat(core): confidence-multiplier shame score + floor-passing leaderboard (RELIC-308)

Single-commit files with mild keywords no longer tie at score 100.
shameScore = round((rawShamePoints / totalCommits) * 100 * min(1, totalCommits / 5))

shameLeaderboard now seeds only from files passing the floor; files[] keeps
dampened scores so cursed-files.ts continues to reference them.

Snapshot regenerated; affected test fixtures audited.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tier A2 — `keywordTiers` aggregate

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/analyzers/forensics.ts`
- Modify: `packages/core/src/analyzers/forensics.test.ts`

- [ ] **Step 1: Extend `ForensicsReport` in `types.ts`**

Locate the existing `ForensicsReport` interface (around line 161). Add the new field:

```ts
export interface ForensicsReport {
  files: FileForensics[];
  shameLeaderboard: FileForensics[];
  totalShameCommits: number;
  keywordTiers: { critical: number; moderate: number; mild: number };
  summary: string;
}
```

- [ ] **Step 2: Add failing test for `keywordTiers`**

Append to `forensics.test.ts`:

```ts
describe('keywordTiers aggregate', () => {
  it('counts unique commits at the highest matched tier', () => {
    const commits = [
      makeCommit({ message: 'revert broken refactor', files: ['a.ts'], hash: 'c1' }), // critical
      makeCommit({ message: 'temporary hack to ship', files: ['a.ts'], hash: 'c2' }), // moderate
      makeCommit({ message: 'fix typo', files: ['a.ts'], hash: 'c3' }), // mild
      makeCommit({ message: 'revert and fix', files: ['a.ts'], hash: 'c4' }), // critical (top-tier wins)
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.keywordTiers).toEqual({ critical: 2, moderate: 1, mild: 1 });
  });

  it('returns all-zeros when no shame commits', () => {
    const commits = [makeCommit({ message: 'add feature', files: ['a.ts'] })];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.keywordTiers).toEqual({ critical: 0, moderate: 0, mild: 0 });
  });
});
```

- [ ] **Step 3: Run test to verify failure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run forensics.test.ts
```

Expected: FAIL — `keywordTiers` not on the result.

- [ ] **Step 4: Implement aggregation in `forensics.ts`**

a) Add a helper at the top (just below `SHAME_KEYWORDS`):

```ts
type ShameTier = 'critical' | 'moderate' | 'mild';
const TIER_BY_WEIGHT: Record<number, ShameTier> = { 3: 'critical', 2: 'moderate', 1: 'mild' };

function tierForCommit(message: string): ShameTier | null {
  const lower = message.toLowerCase();
  for (const { weight, entries } of SHAME_KEYWORDS) {
    if (entries.some(({ re }) => re.test(lower))) return TIER_BY_WEIGHT[weight];
  }
  return null;
}
```

b) In `analyzeForensics`, compute the tier per unique shame commit. The existing `allShameHashes` Set already de-duplicates; iterate `commits` once more with that filter:

```ts
const keywordTiers = { critical: 0, moderate: 0, mild: 0 };
const seenHashes = new Set<string>();
for (const commit of commits) {
  if (seenHashes.has(commit.hash) || !allShameHashes.has(commit.hash)) continue;
  seenHashes.add(commit.hash);
  const tier = tierForCommit(commit.message);
  if (tier !== null) keywordTiers[tier]++;
}
```

c) Add `keywordTiers` to the return object:

```ts
return { files, shameLeaderboard, totalShameCommits: allShameHashes.size, keywordTiers, summary };
```

- [ ] **Step 5: Run tests to verify pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run forensics.test.ts
```

Expected: pass.

- [ ] **Step 6: Run the snapshot test**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run fixture-regression
```

Expected: snapshot test FAILS — the snapshot now lacks the new `keywordTiers` field. Inspect the diff (counts should match the fixture's commit messages); regenerate:

```bash
pnpm --filter @gitrelic/core test --run fixture-regression -u
```

- [ ] **Step 7: Run full core suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git add packages/core/src/types.ts packages/core/src/analyzers/forensics.ts packages/core/src/analyzers/forensics.test.ts packages/core/src/__snapshots__/fixture-regression.test.ts.snap
git commit -m "$(cat <<'EOF'
feat(core): keywordTiers aggregate on ForensicsReport (RELIC-308)

Counts unique shame commits by their highest matched keyword tier
(critical / moderate / mild). Surfaces the analyzer's unique angle —
the keyword-weighting system — to the frontend KPI subline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Tier A3 — `byMonth` aggregate

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/analyzers/forensics.ts`
- Modify: `packages/core/src/analyzers/forensics.test.ts`

- [ ] **Step 1: Add `ShameByMonth` type and field in `types.ts`**

```ts
export interface ShameByMonth {
  month: string; // ISO YYYY-MM (e.g. "2026-04")
  critical: number;
  moderate: number;
  mild: number;
}

export interface ForensicsReport {
  files: FileForensics[];
  shameLeaderboard: FileForensics[];
  totalShameCommits: number;
  keywordTiers: { critical: number; moderate: number; mild: number };
  byMonth: ShameByMonth[];
  summary: string;
}
```

- [ ] **Step 2: Add failing test**

Append to `forensics.test.ts`:

```ts
describe('byMonth aggregate', () => {
  it('buckets shame commits by YYYY-MM with contiguous empty months', () => {
    const commits = [
      makeCommit({ message: 'revert', files: ['a.ts'], date: '2026-01-15T10:00:00Z' }),
      makeCommit({ message: 'fix', files: ['a.ts'], date: '2026-03-04T10:00:00Z' }),
    ];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.byMonth).toEqual([
      { month: '2026-01', critical: 1, moderate: 0, mild: 0 },
      { month: '2026-02', critical: 0, moderate: 0, mild: 0 },
      { month: '2026-03', critical: 0, moderate: 0, mild: 1 },
    ]);
  });

  it('returns empty array when no shame commits', () => {
    const commits = [makeCommit({ message: 'add feature', files: ['a.ts'] })];
    const result = analyzeForensics(commits, ['a.ts']);
    expect(result.byMonth).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to confirm failure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run forensics.test.ts
```

Expected: FAIL — no `byMonth`.

- [ ] **Step 4: Implement bucketing in `forensics.ts`**

A given commit can touch multiple files and therefore appear multiple times during this iteration. Dedupe with a `seenForBucket` Set to count each commit once. Add this after the `keywordTiers` computation:

```ts
const monthBuckets = new Map<string, { critical: number; moderate: number; mild: number }>();
const seenForBucket = new Set<string>();
for (const commit of commits) {
  if (seenForBucket.has(commit.hash) || !allShameHashes.has(commit.hash)) continue;
  seenForBucket.add(commit.hash);
  const tier = tierForCommit(commit.message);
  if (tier === null) continue;
  const month = commit.date.slice(0, 7);
  const bucket = monthBuckets.get(month) ?? { critical: 0, moderate: 0, mild: 0 };
  bucket[tier]++;
  monthBuckets.set(month, bucket);
}

let byMonth: ShameByMonth[] = [];
if (monthBuckets.size > 0) {
  const sortedKeys = [...monthBuckets.keys()].sort();
  const [firstYear, firstMonth] = sortedKeys[0].split('-').map(Number);
  const [lastYear, lastMonth] = sortedKeys[sortedKeys.length - 1].split('-').map(Number);
  let y = firstYear;
  let m = firstMonth;
  while (y < lastYear || (y === lastYear && m <= lastMonth)) {
    const key = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
    const bucket = monthBuckets.get(key) ?? { critical: 0, moderate: 0, mild: 0 };
    byMonth.push({ month: key, ...bucket });
    m++;
    if (m > 12) { m = 1; y++; }
  }
}
```

Add `byMonth` to the return:

```ts
return {
  files, shameLeaderboard, totalShameCommits: allShameHashes.size,
  keywordTiers, byMonth, summary,
};
```

Add `ShameByMonth` to the type imports at the top of the file.

- [ ] **Step 5: Run tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run forensics.test.ts
```

Expected: pass. Watch for off-by-one on month rollover (December → January).

- [ ] **Step 6: Snapshot regenerate + full core suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/core test --run fixture-regression -u
pnpm --filter @gitrelic/core test --run
```

- [ ] **Step 7: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git add packages/core/src/types.ts packages/core/src/analyzers/forensics.ts packages/core/src/analyzers/forensics.test.ts packages/core/src/__snapshots__/fixture-regression.test.ts.snap
git commit -m "$(cat <<'EOF'
feat(core): byMonth aggregate on ForensicsReport (RELIC-308)

Buckets shame commits by YYYY-MM with contiguous fill so the upcoming
ShameTrend hero can render gap-free month-over-month tier mix.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `normalizeReport` defaults for the new aggregates

**Files:**
- Modify: `apps/web/src/utils/normalizeReport.ts`
- Modify: `apps/web/src/utils/normalizeReport.test.ts`

- [ ] **Step 1: Locate the `forensics:` block in `normalizeReport.ts`** (search for `forensics:` to find it; it currently has `files: [], shameLeaderboard: [], totalShameCommits: 0, summary: ''`).

- [ ] **Step 2: Add a failing test in `normalizeReport.test.ts`**

```ts
it('fills empty defaults for new forensics aggregates on older reports', () => {
  const result = normalizeReport({});
  expect(result.forensics.keywordTiers).toEqual({ critical: 0, moderate: 0, mild: 0 });
  expect(result.forensics.byMonth).toEqual([]);
});
```

- [ ] **Step 3: Run to confirm failure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run normalizeReport.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Update `normalizeReport.ts` defaults**

```ts
forensics: raw.forensics ?? {
  files: [],
  shameLeaderboard: [],
  totalShameCommits: 0,
  keywordTiers: { critical: 0, moderate: 0, mild: 0 },
  byMonth: [],
  summary: 'Not available',
},
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run normalizeReport.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git add apps/web/src/utils/normalizeReport.ts apps/web/src/utils/normalizeReport.test.ts
git commit -m "$(cat <<'EOF'
feat(web): normalize forensics keywordTiers/byMonth defaults (RELIC-308)

Older CLI reports predate the new aggregates. Without these defaults
the Shame tab would crash on field access.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Tier B1 — `ShameTrend` hero

**Files:**
- Create: `apps/web/src/components/hero/ShameTrend.tsx`
- Create: `apps/web/src/components/hero/ShameTrend.test.tsx`

- [ ] **Step 1: Reference patterns**

Read `apps/web/src/components/hero/BlastHistogram.tsx` for resize-observer + SVG layout pattern, and `apps/web/src/components/hero/ChurnBar.tsx` for the `<HeroCaption>` integration pattern. Mirror those conventions.

- [ ] **Step 2: Write failing test in `ShameTrend.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ShameTrend } from './ShameTrend';

import type { GitrelicReport } from '@gitrelic/core';

const baseReport = {
  forensics: {
    byMonth: [
      { month: '2026-01', critical: 1, moderate: 2, mild: 5 },
      { month: '2026-02', critical: 0, moderate: 1, mild: 3 },
    ],
    files: [],
    shameLeaderboard: [],
    totalShameCommits: 12,
    keywordTiers: { critical: 1, moderate: 3, mild: 8 },
    summary: '',
  },
} as unknown as GitrelicReport;

describe('ShameTrend', () => {
  it('renders one bar per month', () => {
    const { container } = render(<ShameTrend report={baseReport} />);
    const bars = container.querySelectorAll('rect[data-tier]');
    // 2 months × 3 tier rects = 6
    expect(bars.length).toBe(6);
  });

  it('renders the hero caption', () => {
    render(<ShameTrend report={baseReport} />);
    expect(screen.getByText(/One bar per month/)).toBeInTheDocument();
  });

  it('renders empty state when byMonth is empty', () => {
    const empty = {
      ...baseReport,
      forensics: { ...baseReport.forensics, byMonth: [] },
    } as GitrelicReport;
    render(<ShameTrend report={empty} />);
    expect(screen.getByText(/No shame commits in the analysis window/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to confirm failure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run ShameTrend.test.tsx
```

Expected: FAIL — component doesn't exist.

- [ ] **Step 4: Implement `ShameTrend.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';

import { HeroCaption } from '../shared/HeroCaption';

import type { GitrelicReport, ShameByMonth } from '@gitrelic/core';

const TIER_COLORS = {
  critical: 'var(--severity-critical)',
  moderate: 'var(--severity-warning)',
  mild: '#9b8b3e', // muted yellow — distinct from --severity-healthy (green)
} as const;

interface ShameTrendProps {
  report: GitrelicReport;
}

export function ShameTrend({ report }: ShameTrendProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 300 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const months = report.forensics.byMonth;

  if (months.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 12,
          }}
        >
          No shame commits in the analysis window.
        </div>
        <HeroCaption
          primary="One bar per month · stack = commit count by tier · color = severity"
          subtitle="Try a longer commit history or a different branch."
        />
      </div>
    );
  }

  const padding = { top: 16, right: 24, bottom: 28, left: 32 };
  const chartHeight = Math.max(160, dims.height - padding.top - padding.bottom - 56);
  const chartWidth = Math.max(120, dims.width - padding.left - padding.right);
  const barGap = 6;
  const barWidth = Math.max(8, (chartWidth - barGap * (months.length - 1)) / months.length);

  const maxTotal = Math.max(1, ...months.map((m) => m.critical + m.moderate + m.mild));

  const barFor = (m: ShameByMonth, i: number) => {
    const x = padding.left + i * (barWidth + barGap);
    const total = m.critical + m.moderate + m.mild;
    const totalH = (total / maxTotal) * chartHeight;
    const mildH = (m.mild / maxTotal) * chartHeight;
    const moderateH = (m.moderate / maxTotal) * chartHeight;
    const criticalH = (m.critical / maxTotal) * chartHeight;
    const baseY = padding.top + chartHeight;

    return (
      <g key={m.month}>
        <rect
          data-tier="mild"
          x={x}
          y={baseY - mildH}
          width={barWidth}
          height={mildH}
          fill={TIER_COLORS.mild}
          opacity={0.85}
        />
        <rect
          data-tier="moderate"
          x={x}
          y={baseY - mildH - moderateH}
          width={barWidth}
          height={moderateH}
          fill={TIER_COLORS.moderate}
          opacity={0.85}
        />
        <rect
          data-tier="critical"
          x={x}
          y={baseY - totalH}
          width={barWidth}
          height={criticalH}
          fill={TIER_COLORS.critical}
          opacity={0.95}
        />
        <title>
          {m.month}: critical {m.critical} · moderate {m.moderate} · mild {m.mild} · total {total}
        </title>
      </g>
    );
  };

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div style={{ flex: 1, position: 'relative' }}>
        <svg width={dims.width} height={dims.height - 56}>
          {months.map(barFor)}
          {/* axis labels: first and last month */}
          {months.length > 0 && (
            <>
              <text
                x={padding.left}
                y={padding.top + chartHeight + 16}
                fontSize={10}
                fill="var(--text-tertiary)"
                fontFamily="var(--font-mono)"
              >
                {months[0].month}
              </text>
              <text
                x={padding.left + (months.length - 1) * (barWidth + barGap) + barWidth}
                y={padding.top + chartHeight + 16}
                fontSize={10}
                fill="var(--text-tertiary)"
                fontFamily="var(--font-mono)"
                textAnchor="end"
              >
                {months[months.length - 1].month}
              </text>
            </>
          )}
        </svg>
      </div>
      <HeroCaption
        primary="One bar per month · stack = commit count by tier · color = severity"
        subtitle="Is shame trending up — and is the severity mix shifting toward worse tiers?"
      />
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run ShameTrend.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git add apps/web/src/components/hero/ShameTrend.tsx apps/web/src/components/hero/ShameTrend.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): ShameTrend hero — tier-by-month stacked bars (RELIC-308)

New default hero for the Shame analyzer. Surfaces the temporal
dimension nothing else on the screen does, with tier-color encoding
the analyzer's unique angle.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Tier B2 + B4 — Revised `ShameLeaderboard` (tier-color + HeroCaption)

**Files:**
- Modify: `apps/web/src/components/hero/ShameLeaderboard.tsx`
- Create: `apps/web/src/components/hero/ShameLeaderboard.test.tsx`

The component already filters via `report.forensics.shameLeaderboard` (now floor-passing post-Task 1). What changes here: bar color shifts from severity-by-score to dominant-keyword-tier, and `<HeroCaption>` is wired in.

- [ ] **Step 1: Write a render test in a new `ShameLeaderboard.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ShameLeaderboard } from './ShameLeaderboard';

import type { GitrelicReport, FileForensics } from '@gitrelic/core';

const makeFile = (overrides: Partial<FileForensics> = {}): FileForensics => ({
  file: overrides.file ?? 'a.ts',
  shameScore: overrides.shameScore ?? 80,
  rawShamePoints: 16,
  shameCommitCount: 8,
  topShameCommits: [],
  dominantKeywords: overrides.dominantKeywords ?? ['fix'],
});

const makeReport = (leaderboard: FileForensics[]): GitrelicReport =>
  ({
    forensics: {
      files: leaderboard,
      shameLeaderboard: leaderboard,
      totalShameCommits: leaderboard.reduce((s, f) => s + f.shameCommitCount, 0),
      keywordTiers: { critical: 0, moderate: 0, mild: 0 },
      byMonth: [],
      summary: '',
    },
  }) as unknown as GitrelicReport;

describe('ShameLeaderboard', () => {
  it('renders the hero caption', () => {
    const onSelect = vi.fn();
    render(
      <ShameLeaderboard
        report={makeReport([makeFile()])}
        selectedFile={null}
        onSelectFile={onSelect}
      />,
    );
    expect(screen.getByText(/One row per file/)).toBeInTheDocument();
  });

  it('renders an empty state when the leaderboard is empty', () => {
    const onSelect = vi.fn();
    render(
      <ShameLeaderboard
        report={makeReport([])}
        selectedFile={null}
        onSelectFile={onSelect}
      />,
    );
    expect(screen.getByText(/No shame signals/i)).toBeInTheDocument();
  });

  it('encodes dominant-keyword tier in bar fill', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ShameLeaderboard
        report={makeReport([
          makeFile({ file: 'a.ts', dominantKeywords: ['revert'] }), // critical
          makeFile({ file: 'b.ts', dominantKeywords: ['hack'] }),   // moderate
          makeFile({ file: 'c.ts', dominantKeywords: ['fix'] }),    // mild
        ])}
        selectedFile={null}
        onSelectFile={onSelect}
      />,
    );
    const bars = container.querySelectorAll('rect[data-tier]');
    const tiers = Array.from(bars).map((b) => b.getAttribute('data-tier'));
    expect(tiers).toEqual(['critical', 'moderate', 'mild']);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run ShameLeaderboard.test.tsx
```

Expected: FAIL on caption, tier-color, and empty-state text wording.

- [ ] **Step 3: Update `ShameLeaderboard.tsx`**

Three changes:

a) Add a tier classifier near the top.

**Drift risk:** these keyword sets duplicate `SHAME_KEYWORDS` in `packages/core/src/analyzers/forensics.ts`. If core's keyword tiers change, the leaderboard's bar colors will silently mismatch the analyzer's actual classifications until this file is updated. Mirror any future change in core to this file in the same PR. (A follow-up could expose `tierForKeyword` from core via a `type`-only re-export, but that's out of scope here.)

```tsx
type ShameTier = 'critical' | 'moderate' | 'mild';

const TIER_KEYWORDS: Record<ShameTier, ReadonlySet<string>> = {
  critical: new Set(['revert', 'hotfix', 'oops', 'fixup', 'broke']),
  moderate: new Set(['hack', 'workaround', 'temporary', 'temp', 'kludge', 'band-aid']),
  mild: new Set(['fix', 'bug', 'wrong', 'mistake', 'typo', 'cleanup']),
};

const TIER_COLORS: Record<ShameTier, string> = {
  critical: 'var(--severity-critical)',
  moderate: 'var(--severity-warning)',
  mild: '#9b8b3e',
};

function classifyTier(dominantKeyword: string | null): ShameTier {
  if (!dominantKeyword) return 'mild';
  if (TIER_KEYWORDS.critical.has(dominantKeyword)) return 'critical';
  if (TIER_KEYWORDS.moderate.has(dominantKeyword)) return 'moderate';
  return 'mild';
}
```

b) Replace the existing `severity` field on `ShameBarEntry` with a tier:

```tsx
export interface ShameBarEntry {
  file: string;
  name: string;
  score: number;
  shameCommitCount: number;
  topKeyword: string | null;
  tier: ShameTier;
}

export function prepareShameData(report: GitrelicReport): ShameBarEntry[] {
  return report.forensics.shameLeaderboard.map((f) => {
    const basename = f.file.split('/').pop();
    return {
      file: f.file,
      name: basename && basename.length > 0 ? basename : f.file,
      score: f.shameScore,
      shameCommitCount: f.shameCommitCount,
      topKeyword: f.dominantKeywords[0] ?? null,
      tier: classifyTier(f.dominantKeywords[0] ?? null),
    };
  });
}
```

(Drop the old `severityColor` helper — replaced by `TIER_COLORS[entry.tier]`. Remove the old `ShameSeverity` type export if nothing else consumes it; otherwise leave it for back-compat but stop emitting it.)

c) In the `<rect>` for each bar, set `data-tier={e.tier}` and `fill={TIER_COLORS[e.tier]}`. Also update the score-trailing-text fill to `TIER_COLORS[e.tier]`.

d) Wrap the existing svg in a vertical flex column and append `<HeroCaption>` after the svg block:

```tsx
return (
  <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ flex: 1, position: 'relative' }}>
      <svg width={dims.width} height={dims.height - 56}>
        {/* existing bars */}
      </svg>
      {tooltip && (/* existing tooltip */)}
    </div>
    <HeroCaption
      primary={`One row per file · bar = shame score · color = dominant tier · files with ≥${CONFIDENCE_FLOOR} commits`}
      subtitle="Which files actually carry sustained shame, ranked by severity-weighted commit messages?"
    />
  </div>
);
```

For the `CONFIDENCE_FLOOR` import: `import { CONFIDENCE_FLOOR } from '@gitrelic/core';` — but this is a *value* import which violates the web's `import type` discipline (it would bundle the analyzer module). Two safer routes:

- **Preferred:** Re-declare the constant locally with a comment pointing to `forensics.ts`:

```tsx
// Mirrors CONFIDENCE_FLOOR in packages/core/src/analyzers/forensics.ts.
const CONFIDENCE_FLOOR = 5;
```

- Alternative: hard-code the literal `5` in the caption template (less ideal — drifts silently if core changes).

e) Empty-state branch: keep the existing centered "No shame signals detected." but also append `<HeroCaption>` below it (the empty branch should still be wrapped in the same flex column).

- [ ] **Step 4: Run tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run ShameLeaderboard.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git add apps/web/src/components/hero/ShameLeaderboard.tsx apps/web/src/components/hero/ShameLeaderboard.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): ShameLeaderboard tier-color bars + HeroCaption (RELIC-308)

Bar fill now encodes the file's dominant-keyword tier (critical / moderate
/ mild), making Shame's unique angle visible in the hero. HeroCaption
strip wired in matching the Churn / Bus Factor pattern.

Floor-passing already enforced by core (Task 1) — component just renders.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Tier B3 — Hero tab switcher (preset + Shell wiring)

**Files:**
- Modify: `apps/web/src/presets/types.ts`
- Modify: `apps/web/src/presets/registry.ts`
- Modify: `apps/web/src/components/layout/Shell.tsx`

- [ ] **Step 1: Spike — does Churn's preset have `heroLabel`?**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
grep -n "heroLabel" apps/web/src/presets/registry.ts apps/web/src/presets/types.ts
```

If `heroLabel` is set on the Churn preset entry, plan to set one on Shame too. If only the field exists in `PresetDefinition` but no preset uses it, defer adding `heroLabel` to Shame (keep this task scoped to the dispatch wiring).

- [ ] **Step 2: Add `'shame-trend'` to the `HeroViz` union in `types.ts`**

Locate the `HeroViz` union (around line 12). Add `'shame-trend'` adjacent to `'shame-leaderboard'`.

- [ ] **Step 3: Update Shame preset in `registry.ts`**

```ts
shame: {
  // ...
  hero: {
    defaultViz: 'shame-trend',
    altTabs: ['shame-trend', 'shame-leaderboard'],
  },
  // (keep heroLabel in lockstep with Churn — set if applicable, defer otherwise per Step 1)
  // ...
}
```

- [ ] **Step 4: Wire `Shell.tsx`**

a) `HERO_LABELS` (line 95):

```ts
'shame-trend': 'Trend',
'shame-leaderboard': 'Leaderboard', // was 'Shame'
```

b) Add a dispatch block adjacent to the existing `'shame-leaderboard'` block (line 380):

```tsx
{selection.activeHeroViz === 'shame-trend' && (
  <ShameTrend report={report} />
)}
```

c) Add the import for `ShameTrend` at the top of `Shell.tsx`:

```tsx
import { ShameTrend } from '../hero/ShameTrend';
```

- [ ] **Step 5: Run web tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run
```

Expected: all pass. If `Shell.test.tsx` asserts on `HERO_LABELS['shame-leaderboard'] === 'Shame'` or on the Shame preset's `defaultViz`, update it to match.

- [ ] **Step 6: Build to verify the bundle compiles**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web build
```

Expected: clean build.

- [ ] **Step 7: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git add apps/web/src/presets/types.ts apps/web/src/presets/registry.ts apps/web/src/components/layout/Shell.tsx
# Conditionally:
git add apps/web/src/components/layout/Shell.test.tsx  # if updated
git commit -m "$(cat <<'EOF'
feat(web): wire shame-trend hero into preset registry + Shell (RELIC-308)

Shame preset now defaults to Trend, with Leaderboard as the alt tab.
HERO_LABELS renamed shame-leaderboard from 'Shame' to 'Leaderboard'
since the preset name already says 'Shame'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Tier C2 — `shameByDirectory` aggregator

**Files:**
- Create: `apps/web/src/utils/shameByDirectory.ts`
- Create: `apps/web/src/utils/shameByDirectory.test.ts`

Mirror `apps/web/src/utils/blastByDirectory.ts` exactly.

- [ ] **Step 1: Write the failing test in `shameByDirectory.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

import { aggregateShameByDirectory } from './shameByDirectory';

import type { FileForensics } from '@gitrelic/core';

const makeFile = (file: string): FileForensics => ({
  file,
  shameScore: 80,
  rawShamePoints: 8,
  shameCommitCount: 4,
  topShameCommits: [],
  dominantKeywords: ['fix'],
});

describe('aggregateShameByDirectory', () => {
  it('returns empty array on empty input', () => {
    expect(aggregateShameByDirectory([])).toEqual([]);
  });

  it('groups files by parent directory', () => {
    const files = [
      makeFile('packages/core/foo.ts'),
      makeFile('packages/core/bar.ts'),
      makeFile('packages/web/baz.ts'),
    ];
    const rows = aggregateShameByDirectory(files);
    expect(rows[0]).toMatchObject({ directory: 'packages/core', count: 2 });
    expect(rows[1]).toMatchObject({ directory: 'packages/web', count: 1 });
  });

  it('computes share as fraction of total', () => {
    const files = [
      makeFile('a/x.ts'),
      makeFile('a/y.ts'),
      makeFile('a/z.ts'),
      makeFile('b/q.ts'),
    ];
    const rows = aggregateShameByDirectory(files);
    expect(rows[0].share).toBeCloseTo(0.75);
    expect(rows[1].share).toBeCloseTo(0.25);
  });

  it('sorts by count desc with secondary alpha', () => {
    const files = [
      makeFile('z/1.ts'),
      makeFile('a/1.ts'),
      makeFile('a/2.ts'),
      makeFile('z/2.ts'),
    ];
    const rows = aggregateShameByDirectory(files);
    // both directories tied at count=2 → alpha
    expect(rows.map((r) => r.directory)).toEqual(['a', 'z']);
  });

  it('handles root files (no slash)', () => {
    const rows = aggregateShameByDirectory([makeFile('README.md')]);
    expect(rows[0].directory).toBe('');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run shameByDirectory.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `shameByDirectory.ts`**

```ts
import type { FileForensics } from '@gitrelic/core';

export interface ShameDirectoryRow {
  directory: string;
  count: number;
  share: number;
}

function parentDirectory(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? '' : filePath.slice(0, slash);
}

export function aggregateShameByDirectory(
  files: ReadonlyArray<FileForensics>,
): ShameDirectoryRow[] {
  if (files.length === 0) return [];

  const counts = new Map<string, number>();
  for (const f of files) {
    const dir = parentDirectory(f.file);
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }

  const total = files.length;
  const rows: ShameDirectoryRow[] = [];
  for (const [directory, count] of counts) {
    rows.push({ directory, count, share: count / total });
  }

  rows.sort((a, b) => b.count - a.count || a.directory.localeCompare(b.directory));
  return rows;
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run shameByDirectory.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git add apps/web/src/utils/shameByDirectory.ts apps/web/src/utils/shameByDirectory.test.ts
git commit -m "$(cat <<'EOF'
feat(web): shameByDirectory util for KPI extras rollup (RELIC-308)

Aggregates high-shame files by their immediate parent directory,
mirroring blastByDirectory's shape. Powers the 'where they live'
extras slot in the upcoming ShameTab NarrativeKPI.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Tier C1 — `ShameTab` rewrite as `<NarrativeKPI>` consumer

**Files:**
- Modify: `apps/web/src/components/tabs/ShameTab.tsx`

- [ ] **Step 1: Reference the canonical pattern**

Read `apps/web/src/components/tabs/BlastRadiusTab.tsx` end-to-end. The Shame rewrite should mirror its structure (constants → tierBadge helper → JSX composition).

- [ ] **Step 2: Replace the file contents of `ShameTab.tsx`**

```tsx
import { aggregateShameByDirectory } from '../../utils/shameByDirectory';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { fileName } from '../theme';

import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface ShameTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const HIGH_SHAME_THRESHOLD = 70;
const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

// Mirrors CONFIDENCE_FLOOR in packages/core/src/analyzers/forensics.ts.
const CONFIDENCE_FLOOR = 5;

function tierBadge(highShameCount: number): { variant: BadgeVariant; label: string } {
  if (highShameCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highShameCount < 10) return { variant: 'warning', label: 'Moderate Shame' };
  return { variant: 'critical', label: 'High Shame' };
}

const monoBold = {
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-primary)',
  fontWeight: 600,
} as const;

export function ShameTab({ report, onApplyPreset }: ShameTabProps) {
  const { files, totalShameCommits, keywordTiers } = report.forensics;
  const highShameFiles = files.filter((f) => f.shameScore >= HIGH_SHAME_THRESHOLD);
  const tier = tierBadge(highShameFiles.length);
  // Slice from the threshold-filtered subset, not from the whole-repo list,
  // so the "Top files" header never includes sub-threshold rows. (Lesson from RELIC-315.)
  const topFiles = highShameFiles.slice(0, TOP_FILES_COUNT);
  const allDirectoryRows = aggregateShameByDirectory(highShameFiles);
  const directoryRows = allDirectoryRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(0, allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT);
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(highShameFiles.length)}
      tier={tier}
      metric={`Files ≥${HIGH_SHAME_THRESHOLD} Shame`}
      finding={
        highShameFiles.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Top shame files
            </div>
            {topFiles.map((f) => (
              <div key={f.file} style={{ lineHeight: 1.5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {fileName(f.file)}
                </span>{' '}
                <span style={{ color: 'var(--text-tertiary)' }}>
                  <span style={monoBold}>{f.shameScore}</span> ·{' '}
                  <span style={monoBold}>{f.shameCommitCount}</span> shame commit
                  {f.shameCommitCount === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
        ) : files.length > 0 ? (
          <>No files cross the high-shame threshold — commit-message hygiene is healthy.</>
        ) : (
          <>No shame signals detected in the analysis window.</>
        )
      }
      subline={
        totalShameCommits > 0 ? (
          <>
            <strong>{totalShameCommits.toLocaleString()}</strong> shame commits ·{' '}
            <strong style={{ color: 'var(--severity-critical)' }}>{keywordTiers.critical}</strong>{' '}
            critical (revert/hotfix/oops) ·{' '}
            <strong style={{ color: 'var(--severity-warning)' }}>{keywordTiers.moderate}</strong>{' '}
            moderate (hack/workaround) ·{' '}
            <strong style={{ color: '#9b8b3e' }}>{keywordTiers.mild}</strong> mild (fix/bug)
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-tertiary)' }}>
              Across <strong style={{ color: 'var(--text-secondary)' }}>{files.length}</strong>{' '}
              files (after min-commit-confidence floor of {CONFIDENCE_FLOOR}).
            </div>
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
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={row.directory || '(root)'}
                  >
                    {row.directory || '(root)'}
                  </div>
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
                        background: 'var(--severity-critical)',
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
        { label: 'Cursed Files', presetId: 'cursed-files' },
        { label: 'Bus Factor', presetId: 'bus-factor' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
```

- [ ] **Step 3: Update the `ShameTab` consumer if its prop shape changed**

Find where `ShameTab` is rendered (likely `apps/web/src/components/layout/BottomPanel.tsx`). The old `ShameTab` took `onSelectFile`; the new one takes `onApplyPreset`. Adjust the call site:

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
grep -n "ShameTab" apps/web/src/components/layout/BottomPanel.tsx
```

Update the prop pass-through to match `BlastRadiusTab`'s pattern (other narrative-KPI tabs already receive `onApplyPreset`).

- [ ] **Step 4: Add a smoke test**

If `ShameTab.test.tsx` doesn't exist, create one mirroring `BlastRadiusTab.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ShameTab } from './ShameTab';

import type { GitrelicReport } from '@gitrelic/core';

const makeReport = (
  overrides: Partial<GitrelicReport['forensics']> = {},
): GitrelicReport =>
  ({
    forensics: {
      files: [],
      shameLeaderboard: [],
      totalShameCommits: 0,
      keywordTiers: { critical: 0, moderate: 0, mild: 0 },
      byMonth: [],
      summary: '',
      ...overrides,
    },
  }) as unknown as GitrelicReport;

describe('ShameTab', () => {
  it('renders Healthy state when no high-shame files', () => {
    render(<ShameTab report={makeReport()} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/Healthy/)).toBeInTheDocument();
  });

  it('renders High Shame badge with file count when ≥10 files cross threshold', () => {
    const files = Array.from({ length: 12 }, (_, i) => ({
      file: `f${i}.ts`,
      shameScore: 75,
      rawShamePoints: 15,
      shameCommitCount: 5,
      topShameCommits: [],
      dominantKeywords: ['revert'],
    }));
    render(
      <ShameTab
        report={makeReport({ files, totalShameCommits: 60 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('High Shame')).toBeInTheDocument();
  });

  it('fires onApplyPreset when see-also link is clicked', async () => {
    const onApplyPreset = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(<ShameTab report={makeReport()} onApplyPreset={onApplyPreset} />);
    await user.click(screen.getByText('Cursed Files'));
    expect(onApplyPreset).toHaveBeenCalledWith('cursed-files');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run ShameTab.test.tsx
```

Expected: pass. If `BottomPanel.test.tsx` exists and asserts on the old `onSelectFile` prop, update.

- [ ] **Step 6: Build to ensure compile**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web build
```

- [ ] **Step 7: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git add apps/web/src/components/tabs/ShameTab.tsx apps/web/src/components/tabs/ShameTab.test.tsx
git add apps/web/src/components/layout/BottomPanel.tsx  # only if updated
git commit -m "$(cat <<'EOF'
feat(web): ShameTab as NarrativeKPI consumer (RELIC-308)

Replaces the SortableTable bottom panel with a NarrativeKPI mirroring
BlastRadiusTab. Headline: count of files ≥70 shame. Subline: tier
breakdown (the analyzer's unique angle). Extras: directory rollup of
high-shame files. See-also: Cursed Files, Bus Factor.

Removes ~95 lines of per-file table that duplicated the Inspector.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Tier D1 — `HeroCaption` backport to `BlastHistogram`

**Files:**
- Modify: `apps/web/src/components/hero/BlastHistogram.tsx`
- Modify: `apps/web/src/components/hero/BlastHistogram.test.tsx`

- [ ] **Step 1: Add a failing test**

In `BlastHistogram.test.tsx`, add:

```tsx
it('renders the hero caption', () => {
  render(<BlastHistogram report={someReport} />);
  expect(screen.getByText(/10-bin histogram/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run BlastHistogram.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Wire `<HeroCaption>` into `BlastHistogram.tsx`**

Add the import:

```tsx
import { HeroCaption } from '../shared/HeroCaption';
```

Wrap the component's return in a vertical flex column and append `<HeroCaption>`:

```tsx
return (
  <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
    <div style={{ flex: 1, position: 'relative' }}>
      {/* existing svg + tooltip */}
    </div>
    <HeroCaption
      primary="10-bin histogram · bar height = file count · color = blast tier (low/medium/high/critical)"
      subtitle="What's the shape of blast risk across the repo? How many files actually carry architectural coupling?"
    />
  </div>
);
```

Adjust the empty-state branch the same way.

- [ ] **Step 4: Run tests + build**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm --filter @gitrelic/web test --run BlastHistogram.test.tsx
pnpm --filter @gitrelic/web build
```

- [ ] **Step 5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git add apps/web/src/components/hero/BlastHistogram.tsx apps/web/src/components/hero/BlastHistogram.test.tsx
git commit -m "$(cat <<'EOF'
chore(web): HeroCaption backport to BlastHistogram (RELIC-308 / RELIC-315 follow-up)

BlastHistogram shipped without a HeroCaption — regression against
ChurnBar / OwnershipBar's pattern. Add it now alongside the Shame
heroes so the convention stays uniform.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Tier D2 — `apps/docs/analyzers/shame.md`

**Files:**
- Create: `apps/docs/analyzers/shame.md`
- Modify: `apps/docs/.vitepress/config.ts`

- [ ] **Step 1: Reference templates**

Read `apps/docs/analyzers/blast-radius.md` and `apps/docs/analyzers/churn.md` for the section structure (What it measures · How to read · What action it suggests · Limitations · Cross-links).

- [ ] **Step 2: Write `shame.md`**

Cover:

- **What it measures** — three keyword tiers with explicit weights, confidence multiplier formula, why the formula behaves as it does (single-commit YAMLs no longer dominate).
- **How to read the dashboard** — annotated descriptions of:
  - Trend hero (default): tier-by-month stacked bars, what each color means, what trends to watch for.
  - Leaderboard hero (alt): bar color = dominant tier, score = severity-weighted shame, files limited to floor-passers.
  - NarrativeKPI panel: big-number meaning, tier breakdown subline, "where they live" rollup.
- **What action it suggests** — escalation: Critical-tier files → review for refactor candidates; rising trend → retro on commit-message hygiene; concentrated directory → consider splitting ownership.
- **Limitations** — heuristic keyword matching (false positives in branch refs, etc.); confidence floor delays signal for new files; tier weights are not user-configurable in v1.
- **Cross-links** — Cursed Files, Bus Factor, Web Dashboard.

Follow Markdown style of existing analyzer pages exactly. If they include screenshots, leave a `<!-- TODO: screenshot -->` placeholder; capture screenshots from the React fixture once Tasks 1–10 land.

- [ ] **Step 3: Add sidebar entry in `apps/docs/.vitepress/config.ts`**

Locate the analyzers sidebar block (search for `'/analyzers/'`). Add Shame alphabetically:

```ts
{ text: 'Shame', link: '/analyzers/shame' },
```

(Or update the existing pattern; mirror Blast Radius / Churn entries for casing.)

- [ ] **Step 4: Build the docs site**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm docs:build
```

Expected: clean build. If VitePress complains about dead links, fix.

- [ ] **Step 5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git add apps/docs/analyzers/shame.md apps/docs/.vitepress/config.ts
git commit -m "$(cat <<'EOF'
docs: shame analyzer page + sidebar entry (RELIC-308)

Mirrors the Churn / Blast-Radius docs structure. Covers the keyword
tier system, the confidence-multiplier formula, dashboard reading
guide, and cross-links.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Smoke pass + final lint/format/build/test

**Files:** none (validation only)

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm test
```

Expected: all pass, including the new tests.

- [ ] **Step 2: Lint + format check**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm lint
pnpm format:check
```

Fix any failures with `pnpm lint:fix` and `pnpm format` if needed.

- [ ] **Step 3: Full build**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
pnpm build
```

Expected: clean.

- [ ] **Step 4: Live smoke against React fixture**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

Open the dashboard. Click the Shame tab. Verify:

- Trend hero (default tab) shows tier-stacked bars across the analysis window. Hover tooltips show tier counts.
- Leaderboard tab (alt) shows files filtered to ≥5 commits, with bar color = dominant tier (red/orange/yellow).
- Bottom panel shows the new NarrativeKPI: big number = files ≥70 shame, subline = tier breakdown, extras = directory rollup, sticky see-also footer.
- HeroCaption strips visible on Trend, Leaderboard, AND Blast Radius (regression-fix).
- No console errors.
- **Metrics-strip "Top Score" tile reads sensibly** (no longer a stuck-at-100). If it still feels misleading on this fixture (e.g., shows a single-digit number that looks broken), file a follow-up to swap to `Critical (≥70)` per the spec's "Other locked decisions" defer-if-needed condition. Do not address in this PR; flag it.

- [ ] **Step 5: Live smoke against gitrelic itself**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
node apps/cli/dist/index.mjs --path /Users/tracericochet/Desktop/nebulord/gitrelic --web
```

Smaller history; verify:

- Trend may show 1–2 months — empty bars look reasonable, not broken.
- Leaderboard may be empty if no files have ≥5 shame-commit history — empty state should render with a HeroCaption.
- KPI shows "Healthy" if no high-shame files.

- [ ] **Step 6: Final commit (smoke notes)**

If anything was tweaked during smoke (copy adjustments, color tweaks), commit with a short follow-up:

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-308-polish-forensics
git commit -m "polish: smoke-pass tweaks (RELIC-308)" -m "..."
```

Otherwise nothing to commit; the branch is ready to push and open a PR.

---

## After completion

- Push the branch: `git push -u origin relic-308-polish-forensics`
- Open a PR titled `feat(web): shame polish — trend hero + narrative-KPI panel + formula fix + docs (RELIC-308)`
- Body should reference the spec at `docs/superpowers/specs/2026-04-29-shame-polish-design.md`
- Move the Linear ticket RELIC-308 to In Review

When the PR merges, semantic-release will cut a minor version bump (per pre-1.0 rule that reclassifies breakings to minor). Verify the released version installs cleanly: `npm install gitrelic@<new-version>` and run `gitrelic --path ~/Desktop/react --web` from a clean tmp dir.

Polish-pattern.md update for the Shame section was committed alongside the spec — when the PR merges it'll land in main and become the canonical reference for any future Shame revisions.
