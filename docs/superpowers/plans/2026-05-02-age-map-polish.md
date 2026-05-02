# Age Map Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Age Map analyzer per RELIC-305 — drop both treemap heroes for a single performance-friendly `AgeHistogram`, replace the generic SortableTable bottom panel with a two-tab structure (narrative-KPI default + per-directory companion table), preserve the metrics strip, and add one additive `thresholds` field to the core `AgeMapReport`.

**Architecture:** Pure additive changes to core (`AgeMapReport.thresholds`). Major rewiring in `apps/web` — new `AgeHistogram` hero, new `AgeMapByDirectoryTab` companion, full rewrite of `AgeMapTab` from SortableTable to `<NarrativeKPI>`. Removes redundant treemap routing for the age-map preset; the `ChurnTreemap.tsx` component stays but loses its `colorBy='age'` mode (still keeps `colorBy='churn'` and `colorBy='test-proximity'` used by other presets).

**Tech Stack:** TypeScript 6, React 19, Vitest, D3 (`d3-scale`), Tailwind v4. pnpm workspaces (`@gitrelic/core` for analyzer, `@gitrelic/web` workspace = `apps/web`). Tests use `@testing-library/react` and Vitest.

**Spec:** `docs/superpowers/specs/2026-05-02-age-map-polish-design.md`. **Read it first** if anything below is unclear.

**Branch:** `relic-305-polish-age-map`. Single PR.

---

## File Map

### Created

- `apps/web/src/components/hero/AgeHistogram.tsx` — distribution histogram hero
- `apps/web/src/components/hero/AgeHistogram.test.tsx`
- `apps/web/src/components/tabs/AgeMapByDirectoryTab.tsx` — per-directory sortable table
- `apps/web/src/components/tabs/AgeMapByDirectoryTab.test.tsx`
- `apps/web/src/components/tabs/AgeMapTab.test.tsx` — new test file (no test today)
- `apps/web/src/utils/ageByDirectory.ts` — aggregator
- `apps/web/src/utils/ageByDirectory.test.ts`

### Modified

| File | Change |
|---|---|
| `packages/core/src/types.ts` | Add `thresholds` to `AgeMapReport` |
| `packages/core/src/analyzers/age-map.ts` | Populate `thresholds`; extract `getAgeThresholds(repoAgeDays)` helper |
| `packages/core/src/analyzers/age-map.test.ts` | Add coverage for `thresholds` field |
| `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` | Auto-regen (additive only) |
| `apps/web/src/components/tabs/AgeMapTab.tsx` | Rewrite as `<NarrativeKPI>` |
| `apps/web/src/components/hero/ChurnTreemap.tsx` | Remove `colorByMode.age`, `AGE_COLORS`, `'age'` colorBy branch |
| `apps/web/src/components/hero/ChurnTreemap.test.tsx` | Drop `colorBy='age'` test cases |
| `apps/web/src/components/layout/Shell.tsx` | Drop `treemap-age` route + label; add `age-histogram` route + label |
| `apps/web/src/components/layout/BottomPanel.tsx` | Add `age-map-by-directory` tab label + switch case |
| `apps/web/src/presets/registry.ts` | Update `'age-map'` preset hero + bottom panel |
| `apps/web/src/presets/types.ts` | `HeroViz`: drop `'treemap-age'`, add `'age-histogram'`. `BottomTab`: add `'age-map-by-directory'`. |
| `apps/web/src/utils/normalizeReport.ts` | Fill `ageMap.thresholds` default |
| `apps/web/src/utils/normalizeReport.test.ts` | Cover threshold fallback |

### Untouched (intentionally)

- `apps/web/src/presets/metrics/age-map.ts` — strip stays as-is per design.
- `apps/web/src/components/inspector/FileInspector.tsx` — Age chip continues to work from `report.ageMap.files`.

---

## Task 1: Backend — Add `thresholds` to `AgeMapReport`

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/analyzers/age-map.ts`
- Modify: `packages/core/src/analyzers/age-map.test.ts`
- Auto-regen: `packages/core/src/__snapshots__/fixture-regression.test.ts.snap`

- [ ] **Step 1.1: Update the `AgeMapReport` interface**

In `packages/core/src/types.ts`, locate the `AgeMapReport` interface (search for `interface AgeMapReport`) and add the `thresholds` field. The full interface block should look like this after the change:

```ts
// ─── Age map ───────────────────────────────────────────────────────────────────

export type AgeStatus = 'fresh' | 'aging' | 'stale' | 'ancient';

export interface FileAge {
  file: string;
  lastCommitDate: string;
  ageInDays: number;
  status: AgeStatus;
}

export interface AgeMapReport {
  files: FileAge[];
  staleFiles: FileAge[];
  ancientFiles: FileAge[];
  medianAgeDays: number;
  thresholds: {
    /** Files at or below `freshLimit` days are tier "fresh". */
    freshLimit: number;
    /** Files at or below `agingLimit` (and above `freshLimit`) are tier "aging". */
    agingLimit: number;
    /** Files at or below `staleLimit` (and above `agingLimit`) are tier "stale". Files above this are "ancient". */
    staleLimit: number;
  };
  summary: string;
}
```

If your editor shows other interfaces nearby (e.g. `ChurnReport`), do not touch them — only `AgeMapReport`.

- [ ] **Step 1.2: Extract the threshold formula into a helper and populate `thresholds`**

Replace the contents of `packages/core/src/analyzers/age-map.ts` with:

```ts
import type { AgeMapReport, AgeStatus, FileAge } from '../types.js';
import type { RawCommit } from '../utils/git.js';

/**
 * Computes repo-age-relative thresholds used to bucket files into the
 * `fresh / aging / stale / ancient` tiers. Pure helper — exported so the
 * web layer can mirror the same boundaries without duplicating the formula.
 */
export function getAgeThresholds(repoAgeDays: number): AgeMapReport['thresholds'] {
  return {
    freshLimit: Math.round(repoAgeDays * 0.08),
    agingLimit: Math.round(repoAgeDays * 0.33),
    staleLimit: Math.round(repoAgeDays * 0.66),
  };
}

/**
 * Analyzes the age of files based on the provided commits, tracked files, and repository age in days.
 * @param commits - The raw commits from the repository.
 * @param trackedFiles - The list of currently tracked files in the repository.
 * @param repoAgeDays - The age of the repository in days.
 * @Returns a report with the top 20 files by age, the number of stale files, and a summary.
 */
export function analyzeAgeMap(
  commits: RawCommit[],
  trackedFiles: string[],
  repoAgeDays: number,
): AgeMapReport {
  const fileLastCommit: Map<string, string> = new Map();
  const trackedSet = new Set(trackedFiles);

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!trackedSet.has(file)) continue;
      const existing = fileLastCommit.get(file);
      if (!existing || commit.date > existing) {
        fileLastCommit.set(file, commit.date);
      }
    }
  }

  const now = Date.now();
  const thresholds = getAgeThresholds(repoAgeDays);

  const files: FileAge[] = Array.from(fileLastCommit.entries())
    .map(([file, lastCommitDate]) => {
      const ageInDays = Math.floor((now - new Date(lastCommitDate).getTime()) / 86_400_000);
      return { file, lastCommitDate, ageInDays, status: getAgeStatus(ageInDays, thresholds) };
    })
    .sort((a, b) => b.ageInDays - a.ageInDays);

  const staleFiles = files.filter((f) => f.status === 'stale');
  const ancientFiles = files.filter((f) => f.status === 'ancient');

  const ages = files.map((f) => f.ageInDays).sort((a, b) => a - b);
  const medianAgeDays = ages[Math.floor(ages.length / 2)] ?? 0;

  const summary =
    ancientFiles.length > 0
      ? `${ancientFiles.length} files haven't been touched in over ${thresholds.staleLimit} days — they may be dead weight or critical infrastructure nobody dares touch`
      : staleFiles.length > 0
        ? `${staleFiles.length} files are going stale (no commits in ${thresholds.agingLimit}+ days)`
        : 'The codebase is actively maintained across most files';

  return { files, staleFiles, ancientFiles, medianAgeDays, thresholds, summary };
}

function getAgeStatus(ageInDays: number, thresholds: AgeMapReport['thresholds']): AgeStatus {
  if (ageInDays <= thresholds.freshLimit) return 'fresh';
  if (ageInDays <= thresholds.agingLimit) return 'aging';
  if (ageInDays <= thresholds.staleLimit) return 'stale';
  return 'ancient';
}
```

Two intentional changes to the analyzer's behaviour beyond the additive `thresholds` field:
- `getAgeStatus` now reads thresholds from the precomputed object rather than recomputing per call. Identical math.
- The `summary` string previously hardcoded `Math.round(repoAgeDays * 0.66)` and `* 0.33` — now reads `thresholds.staleLimit` and `thresholds.agingLimit`. Identical numeric output.

- [ ] **Step 1.3: Add a failing test for `thresholds`**

In `packages/core/src/analyzers/age-map.test.ts`, add the following test case at the bottom of the `describe('analyzeAgeMap', ...)` block (just before the closing `});` of the outer describe):

```ts
  it('exposes the repo-age-relative thresholds on the report', () => {
    const result = analyzeAgeMap([], [], 365);
    expect(result.thresholds).toEqual({
      freshLimit: 29,   // round(365 * 0.08)
      agingLimit: 120,  // round(365 * 0.33)
      staleLimit: 241,  // round(365 * 0.66)
    });
  });

  it('scales thresholds for a 90-day window', () => {
    const result = analyzeAgeMap([], [], 90);
    expect(result.thresholds).toEqual({
      freshLimit: 7,
      agingLimit: 30,
      staleLimit: 59,
    });
  });

  it('returns zero thresholds for an empty (0-day) repo', () => {
    const result = analyzeAgeMap([], [], 0);
    expect(result.thresholds).toEqual({
      freshLimit: 0,
      agingLimit: 0,
      staleLimit: 0,
    });
  });
```

- [ ] **Step 1.4: Run the analyzer tests — expect new tests to fail without the impl, but Step 1.2 already added it, so they should pass**

```bash
pnpm --filter @gitrelic/core test -- age-map.test.ts
```

Expected: all tests in `age-map.test.ts` pass, including the three new ones.

If they fail, double-check Step 1.1 (interface) and Step 1.2 (analyzer return statement includes `thresholds`).

- [ ] **Step 1.5: Regenerate the fixture-regression snapshot**

The `__snapshots__/fixture-regression.test.ts.snap` will fail because the expected report shape no longer matches. Regenerate it:

```bash
pnpm --filter @gitrelic/core test -- fixture-regression --update
```

Expected: snapshot regenerates with the new `thresholds` field added in the `ageMap` block. Diff should be purely additive — no other report fields change. Verify the diff:

```bash
git diff packages/core/src/__snapshots__/fixture-regression.test.ts.snap
```

The only changes you should see are new `thresholds: { freshLimit: ..., agingLimit: ..., staleLimit: ... }` blocks under each `ageMap` snapshot. **Do not commit this step yet** if you see other changes — investigate first.

- [ ] **Step 1.6: Run the full core test suite**

```bash
pnpm --filter @gitrelic/core test
```

Expected: all 231+ tests pass. The new `thresholds` field flows through the existing fixture cleanly.

- [ ] **Step 1.7: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/analyzers/age-map.ts packages/core/src/analyzers/age-map.test.ts packages/core/src/__snapshots__/fixture-regression.test.ts.snap
git commit -m "$(cat <<'EOF'
feat(core): add age-map thresholds to AgeMapReport (RELIC-305)

Surfaces the repo-age-relative tier boundaries (8/33/66% of repoAgeDays)
on the report so the web layer can render histogram zone shading and
narrative-KPI tier badging without duplicating the formula. Purely
additive — analyzer behaviour unchanged. Snapshot regenerates.

Refs RELIC-305.
EOF
)"
```

---

## Task 2: Frontend — `normalizeReport` threshold fallback

The web App boots from `/gitrelic-report.json` produced by some CLI version — possibly older than this PR. Older reports won't have `ageMap.thresholds`. Fill it from `meta.ageInDays`.

**Files:**
- Modify: `apps/web/src/utils/normalizeReport.ts`
- Modify: `apps/web/src/utils/normalizeReport.test.ts`

- [ ] **Step 2.1: Add a failing test for the fallback**

Append the following test to `apps/web/src/utils/normalizeReport.test.ts` — find the existing `describe('normalizeReport', ...)` block and add a new test inside it:

```ts
  it('fills ageMap.thresholds from meta.ageInDays when the field is absent (older report)', () => {
    const result = normalizeReport({
      meta: { ageInDays: 365 } as never,
      ageMap: {
        files: [],
        staleFiles: [],
        ancientFiles: [],
        medianAgeDays: 0,
        summary: '',
      } as never,
    });
    expect(result.ageMap.thresholds).toEqual({
      freshLimit: 29,
      agingLimit: 120,
      staleLimit: 241,
    });
  });

  it('preserves ageMap.thresholds from a fresh report and does not overwrite', () => {
    const result = normalizeReport({
      meta: { ageInDays: 100 } as never,
      ageMap: {
        files: [],
        staleFiles: [],
        ancientFiles: [],
        medianAgeDays: 0,
        thresholds: { freshLimit: 8, agingLimit: 33, staleLimit: 66 },
        summary: '',
      } as never,
    });
    expect(result.ageMap.thresholds).toEqual({
      freshLimit: 8,
      agingLimit: 33,
      staleLimit: 66,
    });
  });
```

- [ ] **Step 2.2: Run — expect failures**

```bash
pnpm --filter @gitrelic/web test -- normalizeReport
```

Expected: the two new tests fail because `normalizeReport` doesn't yet emit `thresholds`. Other tests still pass.

- [ ] **Step 2.3: Update `normalizeReport.ts`**

In `apps/web/src/utils/normalizeReport.ts`, locate the `ageMap` block (currently around line 40-46) and replace it with the following. The change has two parts: (a) extract the existing `ageMap` body so we can compute thresholds, (b) populate the field.

Find:

```ts
    ageMap: raw.ageMap ?? {
      files: [],
      staleFiles: [],
      ancientFiles: [],
      medianAgeDays: 0,
      summary: 'Not available',
    },
```

Replace with:

```ts
    ageMap: {
      files: raw.ageMap?.files ?? [],
      staleFiles: raw.ageMap?.staleFiles ?? [],
      ancientFiles: raw.ageMap?.ancientFiles ?? [],
      medianAgeDays: raw.ageMap?.medianAgeDays ?? 0,
      thresholds:
        raw.ageMap?.thresholds ?? {
          freshLimit: Math.round((raw.meta?.ageInDays ?? 0) * 0.08),
          agingLimit: Math.round((raw.meta?.ageInDays ?? 0) * 0.33),
          staleLimit: Math.round((raw.meta?.ageInDays ?? 0) * 0.66),
        },
      summary: raw.ageMap?.summary ?? 'Not available',
    },
```

The fallback formula matches `getAgeThresholds` in core 1:1. Slight duplication, but `normalizeReport` is on the web side and we deliberately don't want a `value` import from core (per the project's import-type-only rule).

- [ ] **Step 2.4: Run — expect tests pass**

```bash
pnpm --filter @gitrelic/web test -- normalizeReport
```

Expected: all `normalizeReport` tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add apps/web/src/utils/normalizeReport.ts apps/web/src/utils/normalizeReport.test.ts
git commit -m "$(cat <<'EOF'
feat(web): normalize ageMap.thresholds for older reports (RELIC-305)

Reports generated before the core change in this PR don't have
ageMap.thresholds. Derive it from meta.ageInDays in normalizeReport so
the new histogram + narrative-KPI tier rendering doesn't crash on
legacy report.json files.

Refs RELIC-305.
EOF
)"
```

---

## Task 3: Frontend — `ageByDirectory` aggregator

Per-directory rollup utility consumed by both the narrative-KPI's "Where they live" extras and the `By Directory` companion table.

**Files:**
- Create: `apps/web/src/utils/ageByDirectory.ts`
- Create: `apps/web/src/utils/ageByDirectory.test.ts`

- [ ] **Step 3.1: Write the failing test file**

Create `apps/web/src/utils/ageByDirectory.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';

import { aggregateAgeByDirectory } from './ageByDirectory';

import type { FileAge } from '@gitrelic/core';

function f(file: string, ageInDays: number, status: FileAge['status']): FileAge {
  return {
    file,
    lastCommitDate: '2025-01-01',
    ageInDays,
    status,
  };
}

describe('aggregateAgeByDirectory', () => {
  it('returns an empty array for no files', () => {
    expect(aggregateAgeByDirectory([])).toEqual([]);
  });

  it('groups files by their immediate parent directory', () => {
    const rows = aggregateAgeByDirectory([
      f('packages/a/src/x.ts', 100, 'aging'),
      f('packages/a/src/y.ts', 200, 'stale'),
      f('packages/b/src/z.ts', 50, 'fresh'),
    ]);
    const dirs = rows.map((r) => r.directory);
    expect(dirs).toContain('packages/a/src');
    expect(dirs).toContain('packages/b/src');
  });

  it('counts files per tier within each directory', () => {
    const rows = aggregateAgeByDirectory([
      f('a/x.ts', 10, 'fresh'),
      f('a/y.ts', 50, 'aging'),
      f('a/z.ts', 200, 'stale'),
      f('a/w.ts', 400, 'ancient'),
      f('a/v.ts', 410, 'ancient'),
    ]);
    const aRow = rows.find((r) => r.directory === 'a')!;
    expect(aRow.fileCount).toBe(5);
    expect(aRow.freshCount).toBe(1);
    expect(aRow.agingCount).toBe(1);
    expect(aRow.staleCount).toBe(1);
    expect(aRow.ancientCount).toBe(2);
  });

  it('computes per-directory median age', () => {
    const rows = aggregateAgeByDirectory([
      f('a/x.ts', 10, 'fresh'),
      f('a/y.ts', 50, 'aging'),
      f('a/z.ts', 200, 'stale'),
    ]);
    const aRow = rows.find((r) => r.directory === 'a')!;
    expect(aRow.medianAgeDays).toBe(50);
  });

  it('reports the oldest file (full path + age) per directory', () => {
    const rows = aggregateAgeByDirectory([
      f('a/x.ts', 10, 'fresh'),
      f('a/y.ts', 200, 'stale'),
      f('a/z.ts', 400, 'ancient'),
    ]);
    const aRow = rows.find((r) => r.directory === 'a')!;
    expect(aRow.oldestFile).toBe('a/z.ts');
    expect(aRow.oldestFileAgeDays).toBe(400);
  });

  it('sorts rows by median age desc, breaking ties alphabetically by directory', () => {
    const rows = aggregateAgeByDirectory([
      f('zebra/x.ts', 100, 'aging'),
      f('apple/x.ts', 100, 'aging'),
      f('mango/x.ts', 50, 'aging'),
    ]);
    expect(rows.map((r) => r.directory)).toEqual(['apple', 'zebra', 'mango']);
  });

  it('represents the repo root as the empty string', () => {
    const rows = aggregateAgeByDirectory([f('rootfile.ts', 100, 'aging')]);
    expect(rows[0].directory).toBe('');
  });
});
```

- [ ] **Step 3.2: Run — expect compile error / module-not-found**

```bash
pnpm --filter @gitrelic/web test -- ageByDirectory
```

Expected: test file fails because `./ageByDirectory` doesn't exist yet.

- [ ] **Step 3.3: Implement the utility**

Create `apps/web/src/utils/ageByDirectory.ts`:

```ts
import type { FileAge } from '@gitrelic/core';

export interface AgeDirectoryRow {
  directory: string;
  fileCount: number;
  medianAgeDays: number;
  freshCount: number;
  agingCount: number;
  staleCount: number;
  ancientCount: number;
  oldestFile: string;
  oldestFileAgeDays: number;
}

function parentDirectory(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? '' : filePath.slice(0, slash);
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor(sorted.length / 2)];
}

export function aggregateAgeByDirectory(files: ReadonlyArray<FileAge>): AgeDirectoryRow[] {
  if (files.length === 0) return [];

  // Bucket files by parent directory.
  const byDir = new Map<string, FileAge[]>();
  for (const f of files) {
    const dir = parentDirectory(f.file);
    const bucket = byDir.get(dir);
    if (bucket) bucket.push(f);
    else byDir.set(dir, [f]);
  }

  const rows: AgeDirectoryRow[] = [];
  for (const [directory, dirFiles] of byDir) {
    let freshCount = 0;
    let agingCount = 0;
    let staleCount = 0;
    let ancientCount = 0;
    let oldest: FileAge = dirFiles[0];
    const ages: number[] = [];

    for (const f of dirFiles) {
      ages.push(f.ageInDays);
      if (f.ageInDays > oldest.ageInDays) oldest = f;
      switch (f.status) {
        case 'fresh':
          freshCount++;
          break;
        case 'aging':
          agingCount++;
          break;
        case 'stale':
          staleCount++;
          break;
        case 'ancient':
          ancientCount++;
          break;
      }
    }

    ages.sort((a, b) => a - b);
    rows.push({
      directory,
      fileCount: dirFiles.length,
      medianAgeDays: median(ages),
      freshCount,
      agingCount,
      staleCount,
      ancientCount,
      oldestFile: oldest.file,
      oldestFileAgeDays: oldest.ageInDays,
    });
  }

  rows.sort(
    (a, b) => b.medianAgeDays - a.medianAgeDays || a.directory.localeCompare(b.directory),
  );
  return rows;
}
```

- [ ] **Step 3.4: Run — expect tests pass**

```bash
pnpm --filter @gitrelic/web test -- ageByDirectory
```

Expected: all 7 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add apps/web/src/utils/ageByDirectory.ts apps/web/src/utils/ageByDirectory.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add ageByDirectory aggregator (RELIC-305)

Per-directory rollup of FileAge[]: file count, median age, tier-mix
counts (fresh/aging/stale/ancient), and oldest file per directory.
Consumed by the upcoming narrative-KPI extras and the By Directory
companion table.

Refs RELIC-305.
EOF
)"
```

---

## Task 4: Frontend — `AgeHistogram` hero component

**Files:**
- Create: `apps/web/src/components/hero/AgeHistogram.tsx`
- Create: `apps/web/src/components/hero/AgeHistogram.test.tsx`

Mirrors `BusFactorHistogram.tsx` in shape — 30-day bins instead of 10-percent bins, tier-coloring derived from `report.ageMap.thresholds`.

- [ ] **Step 4.1: Write the failing test file**

Create `apps/web/src/components/hero/AgeHistogram.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AgeHistogram, ageTierFor, prepareAgeHistogramData } from './AgeHistogram';

import type { FileAge, GitrelicReport } from '@gitrelic/core';

function f(file: string, ageInDays: number, status: FileAge['status']): FileAge {
  return { file, lastCommitDate: '2025-01-01', ageInDays, status };
}

function makeReport(
  files: FileAge[],
  ageInDays = 365,
  thresholds = { freshLimit: 29, agingLimit: 120, staleLimit: 241 },
): GitrelicReport {
  return {
    meta: { ageInDays } as never,
    ageMap: {
      files,
      staleFiles: files.filter((x) => x.status === 'stale'),
      ancientFiles: files.filter((x) => x.status === 'ancient'),
      medianAgeDays: 0,
      thresholds,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('ageTierFor', () => {
  const t = { freshLimit: 29, agingLimit: 120, staleLimit: 241 };

  it('returns "fresh" up to and including freshLimit', () => {
    expect(ageTierFor(0, t)).toBe('fresh');
    expect(ageTierFor(29, t)).toBe('fresh');
  });

  it('returns "aging" above freshLimit, up to and including agingLimit', () => {
    expect(ageTierFor(30, t)).toBe('aging');
    expect(ageTierFor(120, t)).toBe('aging');
  });

  it('returns "stale" above agingLimit, up to and including staleLimit', () => {
    expect(ageTierFor(121, t)).toBe('stale');
    expect(ageTierFor(241, t)).toBe('stale');
  });

  it('returns "ancient" above staleLimit', () => {
    expect(ageTierFor(242, t)).toBe('ancient');
    expect(ageTierFor(1_000, t)).toBe('ancient');
  });
});

describe('prepareAgeHistogramData', () => {
  it('returns 30-day buckets covering 0 up to repoAgeDays for sub-540 windows', () => {
    const { bins } = prepareAgeHistogramData(makeReport([], 90));
    // 90/30 = 3 bins, no overflow
    expect(bins).toHaveLength(3);
    expect(bins[0]).toMatchObject({ rangeStart: 0, rangeEnd: 29 });
    expect(bins[1]).toMatchObject({ rangeStart: 30, rangeEnd: 59 });
    expect(bins[2]).toMatchObject({ rangeStart: 60, rangeEnd: 89 });
  });

  it('caps at 540 days with an overflow bin when the window is longer', () => {
    const { bins } = prepareAgeHistogramData(makeReport([], 1_000));
    // 540/30 = 18 in-range bins + 1 overflow
    expect(bins).toHaveLength(19);
    expect(bins[17]).toMatchObject({ rangeStart: 510 });
    expect(bins[18].isOverflow).toBe(true);
  });

  it('places each file into the bucket whose range contains its ageInDays', () => {
    // 365-day repo → ceil(365/30) = 13 in-range bins, no overflow.
    // Bin index = Math.floor(ageInDays / 30):
    //   age 5   → bin 0   (range 0-29)
    //   age 35  → bin 1   (range 30-59)
    //   age 200 → bin 6   (range 180-209)
    //   age 350 → bin 11  (range 330-359)
    const { bins } = prepareAgeHistogramData(
      makeReport(
        [
          f('fresh.ts', 5, 'fresh'),
          f('aging.ts', 35, 'aging'),
          f('stale.ts', 200, 'stale'),
          f('ancient.ts', 350, 'ancient'),
        ],
        365,
      ),
    );
    expect(bins[0].count).toBe(1);
    expect(bins[1].count).toBe(1);
    expect(bins[6].count).toBe(1);
    expect(bins[11].count).toBe(1);
  });

  it('puts ages ≥ 540 into the overflow bin when one exists', () => {
    const { bins } = prepareAgeHistogramData(
      makeReport([f('forgotten.ts', 800, 'ancient')], 1_000),
    );
    expect(bins[bins.length - 1].count).toBe(1);
    expect(bins[bins.length - 1].isOverflow).toBe(true);
  });

  it('tier-colors each bin by the analyzer thresholds (bin midpoint)', () => {
    const { bins } = prepareAgeHistogramData(
      makeReport([], 365, { freshLimit: 30, agingLimit: 120, staleLimit: 240 }),
    );
    // Midpoints: 14.5, 44.5, 74.5, 104.5, 134.5, 164.5, 194.5, 224.5, 254.5, 284.5, 314.5, 344.5
    expect(bins[0].tier).toBe('fresh'); // 14.5 ≤ 30
    expect(bins[1].tier).toBe('aging'); // 44.5 ≤ 120
    expect(bins[3].tier).toBe('aging'); // 104.5 ≤ 120
    expect(bins[4].tier).toBe('stale'); // 134.5 ≤ 240
    expect(bins[7].tier).toBe('stale'); // 224.5 ≤ 240
    expect(bins[8].tier).toBe('ancient'); // 254.5 > 240
  });

  it('reports totalFiles, maxCount, and ancientCount correctly', () => {
    const { totalFiles, maxCount, ancientCount } = prepareAgeHistogramData(
      makeReport([
        f('a', 5, 'fresh'),
        f('b', 5, 'fresh'),
        f('c', 35, 'aging'),
        f('d', 250, 'ancient'),
        f('e', 260, 'ancient'),
      ]),
    );
    expect(totalFiles).toBe(5);
    expect(maxCount).toBeGreaterThanOrEqual(2);
    expect(ancientCount).toBe(2);
  });

  it('handles an empty repo (0 ageInDays, no files)', () => {
    const { bins, totalFiles, ancientCount } = prepareAgeHistogramData(
      makeReport([], 0, { freshLimit: 0, agingLimit: 0, staleLimit: 0 }),
    );
    expect(bins).toEqual([]);
    expect(totalFiles).toBe(0);
    expect(ancientCount).toBe(0);
  });
});

describe('AgeHistogram', () => {
  it('renders the hero caption when files exist', () => {
    render(
      <AgeHistogram
        report={makeReport([f('a', 100, 'aging'), f('b', 250, 'ancient')], 365)}
      />,
    );
    expect(screen.getByText(/Distribution of last-commit age/)).toBeTruthy();
  });

  it('renders the hero caption in the empty state', () => {
    render(<AgeHistogram report={makeReport([], 0, { freshLimit: 0, agingLimit: 0, staleLimit: 0 })} />);
    expect(screen.getByText(/Distribution of last-commit age/)).toBeTruthy();
  });

  it('shows the empty-state copy when no files exist', () => {
    render(<AgeHistogram report={makeReport([], 365)} />);
    expect(screen.getByText('No tracked files in the repository.')).toBeTruthy();
  });
});
```

- [ ] **Step 4.2: Run — expect compile error / module-not-found**

```bash
pnpm --filter @gitrelic/web test -- AgeHistogram
```

Expected: test file fails because `./AgeHistogram` doesn't exist.

- [ ] **Step 4.3: Implement `AgeHistogram.tsx`**

Create `apps/web/src/components/hero/AgeHistogram.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';

import { scaleLinear } from 'd3-scale';

import { HeroCaption } from '../shared/HeroCaption';

import type { AgeMapReport, GitrelicReport } from '@gitrelic/core';

export type AgeTier = 'fresh' | 'aging' | 'stale' | 'ancient';

export interface AgeBin {
  rangeStart: number;
  rangeEnd: number; // inclusive; Infinity for the overflow bin
  count: number;
  tier: AgeTier;
  isOverflow: boolean;
}

export interface AgeHistogramData {
  bins: AgeBin[];
  maxCount: number;
  totalFiles: number;
  ancientCount: number;
  staleLimit: number;
}

const BIN_WIDTH = 30;
const MAX_INRANGE_DAYS = 540; // 18 monthly bins
const PADDING = { top: 28, right: 24, bottom: 44, left: 56 };
const BAR_GAP = 4;

export function ageTierFor(ageInDays: number, thresholds: AgeMapReport['thresholds']): AgeTier {
  if (ageInDays <= thresholds.freshLimit) return 'fresh';
  if (ageInDays <= thresholds.agingLimit) return 'aging';
  if (ageInDays <= thresholds.staleLimit) return 'stale';
  return 'ancient';
}

export function prepareAgeHistogramData(report: GitrelicReport): AgeHistogramData {
  const repoAgeDays = report.meta.ageInDays;
  const thresholds = report.ageMap.thresholds;
  const files = report.ageMap.files;

  if (repoAgeDays === 0 || (files.length === 0 && repoAgeDays === 0)) {
    return {
      bins: [],
      maxCount: 0,
      totalFiles: files.length,
      ancientCount: report.ageMap.ancientFiles.length,
      staleLimit: thresholds.staleLimit,
    };
  }

  const inRangeDays = Math.min(repoAgeDays, MAX_INRANGE_DAYS);
  const inRangeBins = Math.max(1, Math.ceil(inRangeDays / BIN_WIDTH));
  const hasOverflow = repoAgeDays > MAX_INRANGE_DAYS;
  const totalBins = inRangeBins + (hasOverflow ? 1 : 0);

  const bins: AgeBin[] = Array.from({ length: totalBins }, (_, i) => {
    const isOverflow = hasOverflow && i === totalBins - 1;
    const rangeStart = i * BIN_WIDTH;
    const rangeEnd = isOverflow ? Infinity : rangeStart + BIN_WIDTH - 1;
    const midpoint = isOverflow ? MAX_INRANGE_DAYS : rangeStart + BIN_WIDTH / 2;
    return {
      rangeStart,
      rangeEnd,
      count: 0,
      tier: ageTierFor(midpoint, thresholds),
      isOverflow,
    };
  });

  for (const file of files) {
    let idx: number;
    if (hasOverflow && file.ageInDays >= MAX_INRANGE_DAYS) {
      idx = totalBins - 1;
    } else {
      idx = Math.min(inRangeBins - 1, Math.floor(file.ageInDays / BIN_WIDTH));
    }
    bins[idx].count++;
  }

  const maxCount = bins.reduce((m, b) => (b.count > m ? b.count : m), 0);
  return {
    bins,
    maxCount,
    totalFiles: files.length,
    ancientCount: report.ageMap.ancientFiles.length,
    staleLimit: thresholds.staleLimit,
  };
}

const TIER_COLORS: Record<AgeTier, string> = {
  fresh: 'var(--severity-healthy)',
  aging: 'var(--accent-primary)',
  stale: 'var(--severity-warning)',
  ancient: 'var(--severity-critical)',
};

interface AgeHistogramProps {
  report: GitrelicReport;
}

export function AgeHistogram({ report }: AgeHistogramProps) {
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

  const { bins, maxCount, totalFiles, ancientCount, staleLimit } = useMemo(
    () => prepareAgeHistogramData(report),
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

  if (totalFiles === 0 || bins.length === 0) {
    return (
      <div ref={containerRef} className="w-full h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
          No tracked files in the repository.
        </div>
        <HeroCaption
          primary="Distribution of last-commit age across all tracked files · 30-day bins · color = tier"
          subtitle="No age signal in the analyzed window."
        />
      </div>
    );
  }

  const barWidth = (plotW - BAR_GAP * (bins.length - 1)) / bins.length;
  // Snap the threshold marker to the bucket boundary that contains staleLimit.
  // Files with ageInDays > staleLimit are "ancient", so the shaded zone starts
  // at the bucket whose rangeStart is the smallest multiple of BIN_WIDTH > staleLimit.
  const thresholdBinIdx = bins.findIndex((b) => b.tier === 'ancient');
  const thresholdX = thresholdBinIdx >= 0 ? thresholdBinIdx * (barWidth + BAR_GAP) : plotW;
  const showThreshold = thresholdBinIdx >= 0 && thresholdBinIdx < bins.length;

  const yTicks = yScale.ticks(4);
  const hover = hoverIdx == null ? null : { idx: hoverIdx, bin: bins[hoverIdx] };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      <div className="flex-1 relative">
        <svg
          width={dims.width}
          height={svgHeight}
          role="img"
          aria-label={`Age distribution histogram across ${totalFiles} files. ${ancientCount} ${ancientCount === 1 ? 'file is' : 'files are'} ancient (>${staleLimit} days since last commit).`}
        >
          <g transform={`translate(${PADDING.left},${PADDING.top})`}>
            {/* "Going cold" threshold zone shading */}
            {showThreshold && (
              <>
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
                  textAnchor="start"
                >
                  ancient (&gt;{staleLimit}d) · {ancientCount}{' '}
                  {ancientCount === 1 ? 'file' : 'files'}
                </text>
              </>
            )}

            {/* Y axis */}
            <line x1={0} y1={0} x2={0} y2={plotH} stroke="var(--border-primary)" />
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
                <line x2={plotW} stroke="var(--border-primary)" strokeOpacity={0.15} />
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

            {/* Bars */}
            {bins.map((b, i) => {
              const x = i * (barWidth + BAR_GAP);
              const y = yScale(b.count);
              const h = plotH - y;
              const isHover = hoverIdx === i;
              const color = TIER_COLORS[b.tier];
              return (
                <g key={`bar-${b.rangeStart}-${b.isOverflow ? 'ovf' : 'in'}`}>
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

            {/* X axis */}
            <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke="var(--border-primary)" />
            {bins.map((b, i) => {
              const x = i * (barWidth + BAR_GAP) + barWidth / 2;
              const label = b.isOverflow ? `${b.rangeStart}+` : `${b.rangeStart}`;
              return (
                <g key={`x-${b.rangeStart}-${b.isOverflow ? 'ovf' : 'in'}`} transform={`translate(${x},${plotH})`}>
                  <line y2={4} stroke="var(--border-primary)" />
                  <text y={14} textAnchor="middle" fontSize={8} fill="var(--text-tertiary)">
                    {label}
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
              Days since last commit
            </text>
          </g>

          {/* Tier legend */}
          {(['fresh', 'aging', 'stale', 'ancient'] as const).map((tier, i) => (
            <g key={tier} transform={`translate(${PADDING.left + i * 70},${PADDING.top - 14})`}>
              <rect width={10} height={8} y={-6} fill={TIER_COLORS[tier]} fillOpacity={0.75} />
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
              left: PADDING.left + hover.idx * (barWidth + BAR_GAP) + barWidth / 2,
              top: PADDING.top + yScale(hover.bin.count) - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="font-semibold">
              {hover.bin.isOverflow
                ? `${hover.bin.rangeStart}+ days`
                : `${hover.bin.rangeStart}–${hover.bin.rangeEnd} days`}
            </div>
            <div className="text-text-secondary">
              {hover.bin.count} {hover.bin.count === 1 ? 'file' : 'files'}
              {totalFiles > 0 && (
                <> · {((hover.bin.count / totalFiles) * 100).toFixed(0)}%</>
              )}
            </div>
            <div className="mt-0.5 capitalize" style={{ color: TIER_COLORS[hover.bin.tier] }}>
              {hover.bin.tier}
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary={`Distribution of last-commit age across all tracked files · 30-day bins · color = tier (fresh/aging/stale/ancient) · zone past ${staleLimit}d = ancient`}
        subtitle="What's the shape of staleness in this codebase? Is it a long tail of forgotten files, a bimodal active-vs-archive split, or a smooth aging plateau?"
      />
    </div>
  );
}
```

- [ ] **Step 4.4: Run — expect tests pass**

```bash
pnpm --filter @gitrelic/web test -- AgeHistogram
```

Expected: all `prepareAgeHistogramData`, `ageTierFor`, and render tests pass.

- [ ] **Step 4.5: Commit**

```bash
git add apps/web/src/components/hero/AgeHistogram.tsx apps/web/src/components/hero/AgeHistogram.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add AgeHistogram hero component (RELIC-305)

Mirrors BusFactorHistogram: 30-day bins, tier-colored bars derived from
report.ageMap.thresholds, ≥staleLimit zone shaded, hero caption with
adaptive copy. Caps at 540 days with an overflow bin on longer
windows. Accessible label includes total + ancient counts.

Refs RELIC-305.
EOF
)"
```

---

## Task 5: Frontend — Rewrite `AgeMapTab` as `<NarrativeKPI>`

**Files:**
- Modify: `apps/web/src/components/tabs/AgeMapTab.tsx`
- Create: `apps/web/src/components/tabs/AgeMapTab.test.tsx`

- [ ] **Step 5.1: Write the failing test file**

Create `apps/web/src/components/tabs/AgeMapTab.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgeMapTab } from './AgeMapTab';

import type { FileAge, GitrelicReport } from '@gitrelic/core';

function f(file: string, ageInDays: number, status: FileAge['status']): FileAge {
  return { file, lastCommitDate: '2025-01-01', ageInDays, status };
}

function makeReport(files: FileAge[]): GitrelicReport {
  return {
    meta: { ageInDays: 365 } as never,
    ageMap: {
      files,
      staleFiles: files.filter((x) => x.status === 'stale'),
      ancientFiles: files.filter((x) => x.status === 'ancient'),
      medianAgeDays: 0,
      thresholds: { freshLimit: 29, agingLimit: 120, staleLimit: 241 },
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('AgeMapTab', () => {
  afterEach(() => cleanup());

  it('renders the % cold big number with Healthy badge when no files are stale or ancient', () => {
    const files = [f('a/x.ts', 5, 'fresh'), f('a/y.ts', 30, 'aging')];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('0%');
    expect(screen.getByText('Healthy')).toBeTruthy();
    expect(screen.getByText('% Cold')).toBeTruthy();
  });

  it('renders Moderate at 25–49% cold', () => {
    const files = [
      f('a.ts', 5, 'fresh'),
      f('b.ts', 5, 'fresh'),
      f('c.ts', 200, 'stale'),
    ];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    // 1 of 3 = 33%
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('33%');
    expect(screen.getByText('Moderate')).toBeTruthy();
  });

  it('renders High at 50–74% cold', () => {
    const files = [
      f('a.ts', 5, 'fresh'),
      f('b.ts', 200, 'stale'),
      f('c.ts', 300, 'ancient'),
    ];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    // 2 of 3 = 67%
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('67%');
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('renders Critical at ≥75% cold', () => {
    const files = [
      f('a.ts', 5, 'fresh'),
      f('b.ts', 200, 'stale'),
      f('c.ts', 300, 'ancient'),
      f('d.ts', 350, 'ancient'),
    ];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    // 3 of 4 = 75%
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('75%');
    expect(screen.getByText('Critical')).toBeTruthy();
  });

  it('renders the tier mix subline', () => {
    const files = [
      f('a.ts', 5, 'fresh'),
      f('b.ts', 50, 'aging'),
      f('c.ts', 200, 'stale'),
      f('d.ts', 300, 'ancient'),
    ];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    const subline = screen.getByText(/Tier mix:/).closest('div')!;
    expect(subline.textContent).toContain('1 fresh');
    expect(subline.textContent).toContain('1 aging');
    expect(subline.textContent).toContain('1 stale');
    expect(subline.textContent).toContain('1 ancient');
  });

  it('renders top-3 directories by median age in the finding', () => {
    const files = [
      f('hot/x.ts', 10, 'fresh'),
      f('hot/y.ts', 20, 'fresh'),
      f('warm/x.ts', 100, 'aging'),
      f('warm/y.ts', 110, 'aging'),
      f('cold/x.ts', 300, 'ancient'),
      f('cold/y.ts', 350, 'ancient'),
    ];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('Top stale directories')).toBeTruthy();
    expect(screen.getByText('cold')).toBeTruthy();
    expect(screen.getByText('warm')).toBeTruthy();
  });

  it('renders the Where they live extras with top-5 directories by ancient count', () => {
    const files = [
      f('compiler/__tests__/fixtures/a.ts', 360, 'ancient'),
      f('compiler/__tests__/fixtures/b.ts', 360, 'ancient'),
      f('compiler/__tests__/fixtures/c.ts', 360, 'ancient'),
      f('src/x.ts', 300, 'ancient'),
      f('src/y.ts', 305, 'ancient'),
      f('scripts/q.ts', 280, 'ancient'),
      f('docs/d.ts', 260, 'ancient'),
      f('build/b.ts', 250, 'ancient'),
      f('hidden/h.ts', 245, 'ancient'),
    ];
    render(<AgeMapTab report={makeReport(files)} onApplyPreset={vi.fn()} />);
    expect(screen.getByText('Where they live')).toBeTruthy();
    expect(screen.getByText('compiler/__tests__/fixtures')).toBeTruthy();
  });

  it('routes Stale Files click to onApplyPreset("dead-code")', () => {
    const onApplyPreset = vi.fn();
    render(
      <AgeMapTab report={makeReport([f('a.ts', 300, 'ancient')])} onApplyPreset={onApplyPreset} />,
    );
    screen.getByText('Stale Files').click();
    expect(onApplyPreset).toHaveBeenCalledWith('dead-code');
  });

  it('routes Cursed Files click to onApplyPreset("cursed-files")', () => {
    const onApplyPreset = vi.fn();
    render(
      <AgeMapTab report={makeReport([f('a.ts', 300, 'ancient')])} onApplyPreset={onApplyPreset} />,
    );
    screen.getByText('Cursed Files').click();
    expect(onApplyPreset).toHaveBeenCalledWith('cursed-files');
  });

  it('renders empty-state copy when no files are tracked', () => {
    render(<AgeMapTab report={makeReport([])} onApplyPreset={vi.fn()} />);
    expect(screen.getByTestId('narrative-kpi-big-number').textContent).toBe('0%');
    expect(screen.getByText('No age signal in the analysis window.')).toBeTruthy();
  });
});
```

- [ ] **Step 5.2: Run — expect failures**

```bash
pnpm --filter @gitrelic/web test -- AgeMapTab
```

Expected: all tests fail because `AgeMapTab` still renders the old SortableTable with `Status / File / Age / Last Commit` columns. The narrative-KPI elements (`narrative-kpi-big-number` testId, `% Cold`, tier badges) won't exist.

- [ ] **Step 5.3: Replace `AgeMapTab.tsx` with the narrative-KPI**

Replace the entire contents of `apps/web/src/components/tabs/AgeMapTab.tsx` with:

```tsx
import { aggregateAgeByDirectory } from '../../utils/ageByDirectory';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import { fmt } from '../theme';

import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface AgeMapTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const TOP_DIRS_FINDING = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

// Cold-share tiering: <25% Healthy · 25-49% Moderate · 50-74% High · ≥75% Critical.
// Anchored on the share of files in stale + ancient tiers — surfaces the
// "going cold" verdict the strip's individual counts can't combine.
function tierBadge(coldShare: number): { variant: BadgeVariant; label: string } {
  if (coldShare < 0.25) return { variant: 'healthy', label: 'Healthy' };
  if (coldShare < 0.5) return { variant: 'warning', label: 'Moderate' };
  if (coldShare < 0.75) return { variant: 'critical', label: 'High' };
  return { variant: 'critical', label: 'Critical' };
}

export function AgeMapTab({ report, onApplyPreset }: AgeMapTabProps) {
  const { files, staleFiles, ancientFiles } = report.ageMap;

  const total = files.length;
  const coldCount = staleFiles.length + ancientFiles.length;
  const coldShare = total === 0 ? 0 : coldCount / total;
  const coldPercent = Math.round(coldShare * 100);
  const tier = tierBadge(coldShare);

  const tierMix = files.reduce(
    (acc, f) => {
      acc[f.status]++;
      return acc;
    },
    { fresh: 0, aging: 0, stale: 0, ancient: 0 } as Record<
      'fresh' | 'aging' | 'stale' | 'ancient',
      number
    >,
  );

  // Aggregator returns directories sorted by median age desc — perfect for the
  // top-3 finding and for picking the "where ancient files live" rollup.
  const allDirectoryRows = aggregateAgeByDirectory(files);
  const topStaleDirs = allDirectoryRows.slice(0, TOP_DIRS_FINDING);

  // For the "Where they live" extras, re-rank by ancient count desc so the
  // rollup answers "which directory has the most dead-weight files?" rather
  // than "which directory has the highest median?". Same shape as Bus Factor /
  // Rewrite Ratio / Blast Radius.
  const ancientDirectoryRows = [...allDirectoryRows].sort(
    (a, b) => b.ancientCount - a.ancientCount || a.directory.localeCompare(b.directory),
  );
  const directoryRows = ancientDirectoryRows
    .filter((r) => r.ancientCount > 0)
    .slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(
    0,
    ancientDirectoryRows.filter((r) => r.ancientCount > 0).length - DIRECTORY_ROLLUP_LIMIT,
  );
  const maxAncientCount = directoryRows[0]?.ancientCount ?? 1;

  return (
    <NarrativeKPI
      bigNumber={`${coldPercent}%`}
      tier={tier}
      metric="% Cold"
      finding={
        topStaleDirs.length > 0 && total > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
              Top stale directories
            </div>
            {topStaleDirs.map((d) => (
              <div key={d.directory} className="leading-[1.5]">
                <span className="font-mono text-text-primary">{d.directory || '(root)'}</span>{' '}
                <span className="text-text-tertiary">
                  — <strong className="text-text-primary">{fmt(d.medianAgeDays)}</strong> days
                  median ·{' '}
                  <strong className="text-severity-critical">{fmt(d.ancientCount)}</strong> ancient
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>No age signal in the analysis window.</>
        )
      }
      subline={
        total > 0 ? (
          <>
            Tier mix: <strong className="text-severity-healthy">{fmt(tierMix.fresh)}</strong>{' '}
            fresh · <strong className="text-text-primary">{fmt(tierMix.aging)}</strong> aging ·{' '}
            <strong className="text-severity-warning">{fmt(tierMix.stale)}</strong> stale ·{' '}
            <strong className="text-severity-critical">{fmt(tierMix.ancient)}</strong> ancient.
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
                      style={{ width: `${(row.ancientCount / maxAncientCount) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-text-primary font-semibold inline-block min-w-8 text-right">
                    {row.ancientCount}
                  </span>
                  <span className="text-text-tertiary text-[10px] inline-block min-w-9 text-right">
                    {((row.ancientCount / Math.max(1, ancientFiles.length)) * 100).toFixed(0)}%
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
        { label: 'Stale Files', presetId: 'dead-code' },
        { label: 'Cursed Files', presetId: 'cursed-files' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
```

Note: the previous `AgeMapTab` exported a different shape (`onSelectFile` instead of `onApplyPreset`). The wiring update in Task 7 will switch the BottomPanel switch case to pass the new prop set.

- [ ] **Step 5.4: Run — expect tests pass**

```bash
pnpm --filter @gitrelic/web test -- AgeMapTab
```

Expected: all 10 tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add apps/web/src/components/tabs/AgeMapTab.tsx apps/web/src/components/tabs/AgeMapTab.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): rewrite AgeMapTab as narrative-KPI (RELIC-305)

Replaces the generic SortableTable with a <NarrativeKPI>:
- Big number = % Cold (stale + ancient share)
- Tier: <25 Healthy · 25-49 Moderate · 50-74 High · ≥75 Critical
- Finding: top-3 directories by median age (fixture-noise dodge)
- Subline: tier mix headline (fresh/aging/stale/ancient counts)
- Extras: top-5 directories by ancient-file count (Where they live)
- See also: Stale Files, Cursed Files

The Inspector + new histogram + strip + Where-they-live triangulate
the questions the old per-file table half-answered.

Refs RELIC-305.
EOF
)"
```

---

## Task 6: Frontend — `AgeMapByDirectoryTab` companion table

**Files:**
- Create: `apps/web/src/components/tabs/AgeMapByDirectoryTab.tsx`
- Create: `apps/web/src/components/tabs/AgeMapByDirectoryTab.test.tsx`

- [ ] **Step 6.1: Write the failing test file**

Create `apps/web/src/components/tabs/AgeMapByDirectoryTab.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgeMapByDirectoryTab } from './AgeMapByDirectoryTab';

import type { FileAge, GitrelicReport } from '@gitrelic/core';

function f(file: string, ageInDays: number, status: FileAge['status']): FileAge {
  return { file, lastCommitDate: '2025-01-01', ageInDays, status };
}

function makeReport(files: FileAge[]): GitrelicReport {
  return {
    meta: { ageInDays: 365 } as never,
    ageMap: {
      files,
      staleFiles: files.filter((x) => x.status === 'stale'),
      ancientFiles: files.filter((x) => x.status === 'ancient'),
      medianAgeDays: 0,
      thresholds: { freshLimit: 29, agingLimit: 120, staleLimit: 241 },
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('AgeMapByDirectoryTab', () => {
  afterEach(() => cleanup());

  it('renders a row per directory with file count, median age, and tier counts', () => {
    const files = [
      f('a/x.ts', 10, 'fresh'),
      f('a/y.ts', 100, 'aging'),
      f('a/z.ts', 250, 'ancient'),
      f('b/x.ts', 50, 'aging'),
    ];
    render(<AgeMapByDirectoryTab report={makeReport(files)} onSelectFile={vi.fn()} />);

    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
    expect(screen.getByText('Median Age')).toBeTruthy();
    expect(screen.getByText('Ancient')).toBeTruthy();
    expect(screen.getByText('Stale')).toBeTruthy();
    expect(screen.getByText('Fresh')).toBeTruthy();
  });

  it('default-sorts by median age desc', () => {
    const files = [
      f('young/x.ts', 5, 'fresh'),
      f('young/y.ts', 10, 'fresh'),
      f('old/x.ts', 300, 'ancient'),
      f('old/y.ts', 320, 'ancient'),
    ];
    const { container } = render(
      <AgeMapByDirectoryTab report={makeReport(files)} onSelectFile={vi.fn()} />,
    );
    // First data row should be the "old" directory.
    const dataRows = container.querySelectorAll('div.flex.items-center.py-1\\.5');
    expect(dataRows.length).toBeGreaterThan(0);
    expect(dataRows[0].textContent).toContain('old');
  });

  it('clicking a row calls onSelectFile with the directory\'s oldest file', () => {
    const onSelectFile = vi.fn();
    const files = [f('a/young.ts', 10, 'fresh'), f('a/old.ts', 350, 'ancient')];
    render(<AgeMapByDirectoryTab report={makeReport(files)} onSelectFile={onSelectFile} />);
    fireEvent.click(screen.getByText('a'));
    expect(onSelectFile).toHaveBeenCalledWith('a/old.ts');
  });

  it('renders empty-state copy when no files are tracked', () => {
    render(<AgeMapByDirectoryTab report={makeReport([])} onSelectFile={vi.fn()} />);
    expect(screen.getByText(/No directories with age data\./)).toBeTruthy();
  });

  it('represents the repo root as "(root)" in the directory cell', () => {
    render(
      <AgeMapByDirectoryTab
        report={makeReport([f('rootfile.ts', 100, 'aging')])}
        onSelectFile={vi.fn()}
      />,
    );
    expect(screen.getByText('(root)')).toBeTruthy();
  });
});
```

- [ ] **Step 6.2: Run — expect compile error**

```bash
pnpm --filter @gitrelic/web test -- AgeMapByDirectoryTab
```

Expected: file not found / compile error.

- [ ] **Step 6.3: Implement `AgeMapByDirectoryTab.tsx`**

Create `apps/web/src/components/tabs/AgeMapByDirectoryTab.tsx`:

```tsx
import { aggregateAgeByDirectory, type AgeDirectoryRow } from '../../utils/ageByDirectory';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fileName, filePath, fmt } from '../theme';

import type { GitrelicReport } from '@gitrelic/core';

interface AgeMapByDirectoryTabProps {
  report: GitrelicReport;
  onSelectFile: (file: string) => void;
}

export function AgeMapByDirectoryTab({ report, onSelectFile }: AgeMapByDirectoryTabProps) {
  const rows = aggregateAgeByDirectory(report.ageMap.files);
  const staleLimit = report.ageMap.thresholds.staleLimit;
  const agingLimit = report.ageMap.thresholds.agingLimit;

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-tertiary text-xs h-full py-6">
        No directories with age data.
      </div>
    );
  }

  const medianTone = (medianAgeDays: number): string => {
    if (medianAgeDays > staleLimit) return 'text-severity-critical';
    if (medianAgeDays > agingLimit) return 'text-severity-warning';
    return 'text-text-secondary';
  };

  const columns: Column<AgeDirectoryRow>[] = [
    {
      key: 'directory',
      label: 'Directory',
      sortValue: (r) => r.directory,
      render: (r) => (
        <span className="font-mono text-text-secondary">{r.directory || '(root)'}</span>
      ),
    },
    {
      key: 'files',
      label: 'Files',
      width: '60px',
      align: 'right',
      sortValue: (r) => r.fileCount,
      render: (r) => (
        <span className="font-mono text-[11px] text-text-secondary">{fmt(r.fileCount)}</span>
      ),
    },
    {
      key: 'median',
      label: 'Median Age',
      width: '90px',
      align: 'right',
      sortValue: (r) => r.medianAgeDays,
      render: (r) => (
        <span className={`font-mono text-[11px] ${medianTone(r.medianAgeDays)}`}>
          {fmt(r.medianAgeDays)}
        </span>
      ),
    },
    {
      key: 'ancient',
      label: 'Ancient',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.ancientCount,
      render: (r) => (
        <span
          className={`font-mono text-[11px] ${r.ancientCount > 0 ? 'text-severity-critical' : 'text-text-tertiary'}`}
        >
          {fmt(r.ancientCount)}
        </span>
      ),
    },
    {
      key: 'stale',
      label: 'Stale',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.staleCount,
      render: (r) => (
        <span
          className={`font-mono text-[11px] ${r.staleCount > 0 ? 'text-severity-warning' : 'text-text-tertiary'}`}
        >
          {fmt(r.staleCount)}
        </span>
      ),
    },
    {
      key: 'fresh',
      label: 'Fresh',
      width: '70px',
      align: 'right',
      sortValue: (r) => r.freshCount,
      render: (r) => (
        <span className="font-mono text-[11px] text-text-secondary">{fmt(r.freshCount)}</span>
      ),
    },
    {
      key: 'oldest',
      label: 'Oldest File',
      sortValue: (r) => r.oldestFileAgeDays,
      render: (r) => (
        <span className="font-mono text-[11px]">
          {fileName(r.oldestFile)}
          <span className="text-text-tertiary ml-1.5 text-[10px]">{filePath(r.oldestFile)}</span>
        </span>
      ),
    },
  ];

  return (
    <SortableTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.directory || '(root)'}
      onRowClick={(r) => onSelectFile(r.oldestFile)}
    />
  );
}
```

The default sort behavior is "median age desc" — `aggregateAgeByDirectory` already returns rows sorted that way, and `SortableTable` doesn't apply a default sort unless the user clicks a header. The test verifies the first row is the highest-median directory.

- [ ] **Step 6.4: Run — expect tests pass**

```bash
pnpm --filter @gitrelic/web test -- AgeMapByDirectoryTab
```

Expected: all 5 tests pass.

- [ ] **Step 6.5: Commit**

```bash
git add apps/web/src/components/tabs/AgeMapByDirectoryTab.tsx apps/web/src/components/tabs/AgeMapByDirectoryTab.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): add AgeMapByDirectoryTab companion table (RELIC-305)

Per-directory rollup table — different unit of analysis from the hero
histogram. Columns: Directory, Files, Median Age (tier-toned), Ancient,
Stale, Fresh, Oldest File. Click row → opens the directory's oldest
file in the Inspector. Default sort: median age desc (already produced
by aggregateAgeByDirectory).

Refs RELIC-305.
EOF
)"
```

---

## Task 7: Frontend — Wiring (types, registry, Shell, BottomPanel)

Wires the new components into the rendered dashboard. Done as one task because the changes are tightly coupled — any subset would leave the app in a broken state.

**Files:**
- Modify: `apps/web/src/presets/types.ts`
- Modify: `apps/web/src/presets/registry.ts`
- Modify: `apps/web/src/components/layout/Shell.tsx`
- Modify: `apps/web/src/components/layout/BottomPanel.tsx`

- [ ] **Step 7.1: Update `presets/types.ts`**

In `apps/web/src/presets/types.ts`, locate the `HeroViz` union (currently around line 12-40). Two changes:
- **Remove** the `'treemap-age'` entry.
- **Add** `'age-histogram'` (alphabetical order: between `'age-map'` and... actually the existing list isn't strictly alphabetical, it's grouped by domain; insert near `'blast-histogram'` for consistency).

The result should look like (only showing the changed lines):

```ts
export type HeroViz =
  | 'treemap'
  | 'treemap-test'
  | 'ownership'
  // ... rest of the union
  | 'staleness-scatter'
  | 'age-histogram'
  | 'blast-histogram'
  | 'bus-factor-histogram'
  | 'rewrite-histogram'
  | 'languages-stacked'
  | 'test-coverage-by-dir';
```

Then update the `BottomTab` union (currently around line 42-66) to add `'age-map-by-directory'`:

```ts
export type BottomTab =
  | 'hotspots'
  | 'churn'
  | 'churn-tests'
  // ... existing entries
  | 'age-map'
  | 'age-map-by-directory'
  | 'dead-code'
  // ... rest unchanged
```

- [ ] **Step 7.2: Update `presets/registry.ts`**

In `apps/web/src/presets/registry.ts`, locate the `'age-map'` preset (around line 254). Replace its entire block with:

```ts
  'age-map': {
    id: 'age-map',
    tier: 'analyzer',
    label: 'Age Map',
    group: 'code-health',
    hero: {
      defaultViz: 'age-histogram',
      altTabs: ['age-histogram'],
    },
    bottomPanel: {
      defaultTab: 'age-map',
      altTabs: ['age-map', 'age-map-by-directory'],
    },
    metrics: ageMapMetrics,
  },
```

- [ ] **Step 7.3: Update `Shell.tsx`**

In `apps/web/src/components/layout/Shell.tsx`:

**Sub-step 7.3.a:** Add the `AgeHistogram` import. Find the existing imports starting around line 8 (the `BlastHistogram`, `BusFactorHistogram`, ... block) and add `import { AgeHistogram } from '../hero/AgeHistogram';` in alphabetical order (it goes first):

```ts
import { AgeHistogram } from '../hero/AgeHistogram';
import { AuthorForceGraph } from '../hero/AuthorForceGraph';
import { BlastHistogram } from '../hero/BlastHistogram';
// ...rest unchanged
```

**Sub-step 7.3.b:** In the `HERO_LABELS` map (currently around line 99), remove the `'treemap-age': 'Age',` line and add `'age-histogram': 'Age',`. After the change, the relevant lines should read:

```ts
export const HERO_LABELS: Record<HeroViz, string> = {
  treemap: 'Treemap',
  'treemap-test': 'Coverage',
  'age-histogram': 'Age',
  ownership: 'Ownership',
  // ... rest unchanged
```

**Sub-step 7.3.c:** Remove the `treemap-age` route in the JSX (around line 233-240). Find:

```tsx
                {selection.activeHeroViz === 'treemap-age' && (
                  <ChurnTreemap
                    report={report}
                    selectedFile={selection.selectedFile}
                    onSelectFile={selection.selectFile}
                    colorBy="age"
                  />
                )}
```

Delete it entirely. (Do **not** touch the `treemap-test` route directly below — that one stays.)

**Sub-step 7.3.d:** Add the `age-histogram` route. After the `bus-factor-histogram` route (around line 399-401), add:

```tsx
                {selection.activeHeroViz === 'age-histogram' && (
                  <AgeHistogram report={report} />
                )}
```

- [ ] **Step 7.4: Update `BottomPanel.tsx`**

In `apps/web/src/components/layout/BottomPanel.tsx`:

**Sub-step 7.4.a:** Add the `AgeMapByDirectoryTab` import. The existing alphabetical import block starts with `import { AgeMapTab } from '../tabs/AgeMapTab';` (line 4). Add `AgeMapByDirectoryTab` directly below:

```ts
import { AgeMapTab } from '../tabs/AgeMapTab';
import { AgeMapByDirectoryTab } from '../tabs/AgeMapByDirectoryTab';
import { BlastRadiusTab } from '../tabs/BlastRadiusTab';
// ... rest unchanged
```

**Sub-step 7.4.b:** Add a `TAB_LABELS` entry for the new tab. In the `TAB_LABELS` map (around line 44-69), add a line for `'age-map-by-directory'`:

```ts
const TAB_LABELS: Record<BottomTab, string> = {
  hotspots: 'Hotspots',
  // ...existing entries
  'age-map': 'Age Map',
  'age-map-by-directory': 'By Directory',
  'dead-code': 'Stale Files',
  // ... rest unchanged
};
```

**Sub-step 7.4.c:** Update the `'age-map'` switch case AND add a new `'age-map-by-directory'` case. Find (around line 105-106):

```tsx
    case 'age-map':
      return <AgeMapTab report={report} onSelectFile={onSelectFile} />;
```

Replace with:

```tsx
    case 'age-map':
      return <AgeMapTab report={report} onApplyPreset={onApplyPreset} />;
    case 'age-map-by-directory':
      return <AgeMapByDirectoryTab report={report} onSelectFile={onSelectFile} />;
```

Note the prop change for `AgeMapTab`: `onSelectFile` → `onApplyPreset`. The new narrative-KPI version doesn't need a per-row click handler.

- [ ] **Step 7.5: Run the web test suite end-to-end**

```bash
pnpm --filter @gitrelic/web test
```

Expected: all tests pass. The earlier per-component tests still pass; the registry tests (`registry.test.ts`) re-validate the updated preset; nothing else should fail. **If anything fails**, the most likely culprits are:
- `presets/types.ts` — leftover `'treemap-age'` reference somewhere (search the codebase).
- `Shell.tsx` — typo in route conditional, missed import.
- `BottomPanel.tsx` — wrong prop name in the switch case.

- [ ] **Step 7.6: Run a typecheck**

```bash
pnpm --filter @gitrelic/web build
```

Expected: clean build. The `HeroViz` enum tightening will surface any stale reference to `'treemap-age'`.

- [ ] **Step 7.7: Commit**

```bash
git add apps/web/src/presets/types.ts apps/web/src/presets/registry.ts apps/web/src/components/layout/Shell.tsx apps/web/src/components/layout/BottomPanel.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire age-histogram + by-directory tab (RELIC-305)

Updates HeroViz/BottomTab unions, registry preset, Shell route, and
BottomPanel switch case so the Age Map preset uses the new
single-histogram hero and the two-tab bottom panel. Drops the
treemap-age + treemap alt routes for this preset (treemap component
itself stays — still used by Hotspots / Cursed Files / Overview /
Test Coverage).

Refs RELIC-305.
EOF
)"
```

---

## Task 8: Frontend — Drop dead code from `ChurnTreemap`

The `colorByMode.age` mode is no longer reachable now that the registry has dropped the `treemap-age` viz id. Cleaning it up keeps `ChurnTreemap.tsx` honest.

**Files:**
- Modify: `apps/web/src/components/hero/ChurnTreemap.tsx`
- Modify: `apps/web/src/components/hero/ChurnTreemap.test.tsx`

- [ ] **Step 8.1: Update `ChurnTreemap.tsx`**

Replace `apps/web/src/components/hero/ChurnTreemap.tsx` with:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';

import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';

import { categoryColor } from '../../utils/colors';

import type { GitrelicReport } from '@gitrelic/core';
import type { HierarchyRectangularNode } from 'd3-hierarchy';

export type TreemapColorBy = 'churn' | 'test-proximity';

interface ColorMode {
  fill: (filePath: string, report: GitrelicReport) => string;
}

const TEST_COLORS = {
  tested: '#2f5a2f',
  untested: '#7a1f1f',
  unknown: '#3a3a3a',
} as const;

function churnFillFor(category: string | undefined): string {
  return categoryColor(category ?? 'low', 0.35);
}

function testFillFor(hasSibling: boolean | undefined): string {
  if (hasSibling === undefined) return TEST_COLORS.unknown;
  return hasSibling ? TEST_COLORS.tested : TEST_COLORS.untested;
}

export const colorByMode: Record<TreemapColorBy, ColorMode> = {
  churn: {
    fill: (file, report) => {
      const h = report.hotspots.files.find((f) => f.file === file);
      return churnFillFor(h?.category);
    },
  },
  'test-proximity': {
    fill: (file, report) => {
      const t = report.testCoverage.files.find((f) => f.file === file);
      return testFillFor(t?.hasTestSibling);
    },
  },
};

interface ChurnTreemapProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  colorBy?: TreemapColorBy;
}

interface TreeNode {
  name: string;
  fullPath?: string;
  value?: number;
  hotspotScore?: number;
  category?: string;
  children?: TreeNode[];
}

function buildTree(report: GitrelicReport): TreeNode {
  const root: TreeNode = { name: 'root', children: [] };
  const dirMap = new Map<string, TreeNode>();

  const fileSet = new Map<string, { value: number; score: number; category: string }>();
  for (const f of report.loc.files) {
    const hotspot = report.hotspots.files.find((h) => h.file === f.file);
    fileSet.set(f.file, {
      value: Math.max(f.lines, 1),
      score: hotspot?.hotspotScore ?? 0,
      category: hotspot?.category ?? 'low',
    });
  }

  for (const [filePath, data] of fileSet) {
    const parts = filePath.split('/');
    const fName = parts.pop()!;
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const key = parts.slice(0, i + 1).join('/');
      if (!dirMap.has(key)) {
        const node: TreeNode = { name: part, children: [] };
        dirMap.set(key, node);
        current.children!.push(node);
      }
      current = dirMap.get(key)!;
    }
    current.children!.push({
      name: fName,
      fullPath: filePath,
      value: data.value,
      hotspotScore: data.score,
      category: data.category,
    });
  }

  return root;
}

export function ChurnTreemap({
  report,
  selectedFile,
  onSelectFile,
  colorBy = 'churn',
}: ChurnTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const leaves = useMemo(() => {
    const tree = buildTree(report);
    const root = hierarchy(tree)
      .sum((d) => d.value ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const layout = treemap<TreeNode>()
      .size([dims.width, dims.height])
      .padding(2)
      .tile(treemapSquarify);

    return layout(root).leaves() as HierarchyRectangularNode<TreeNode>[];
  }, [report, dims.width, dims.height]);

  const testIndex = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const f of report.testCoverage.files) m.set(f.file, f.hasTestSibling);
    return m;
  }, [report.testCoverage.files]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg width={dims.width} height={dims.height}>
        {leaves.map((leaf) => {
          const d = leaf.data;
          if (!d.fullPath) return null;
          const w = leaf.x1 - leaf.x0;
          const h = leaf.y1 - leaf.y0;
          if (w < 2 || h < 2) return null;

          const isSelected = selectedFile === d.fullPath;
          const showLabel = w > 40 && h > 16;
          const fillColor =
            colorBy === 'churn'
              ? churnFillFor(d.category)
              : testFillFor(testIndex.get(d.fullPath));

          return (
            <g
              key={d.fullPath}
              onClick={() => onSelectFile(d.fullPath!)}
              className="cursor-pointer"
            >
              <rect
                x={leaf.x0}
                y={leaf.y0}
                width={w}
                height={h}
                fill={fillColor}
                stroke={isSelected ? 'var(--accent-primary)' : fillColor}
                strokeWidth={isSelected ? 2 : 1}
                rx={2}
              />
              {showLabel && (
                <text
                  x={leaf.x0 + 4}
                  y={leaf.y0 + 12}
                  fontSize={9}
                  fill="rgba(255,255,255,0.7)"
                  className="pointer-events-none"
                >
                  {d.name}
                </text>
              )}
              {showLabel && colorBy === 'churn' && h > 28 && (
                <text
                  x={leaf.x0 + 4}
                  y={leaf.y0 + 23}
                  fontSize={8}
                  fill="rgba(255,255,255,0.4)"
                  className="pointer-events-none"
                >
                  {d.hotspotScore}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

Specific deletions:
- `AgeStatus` import (no longer needed).
- `AGE_COLORS` constant.
- `ageFillFor` function.
- `ageIndex` `useMemo` block.
- The `'age'` entry in the `TreemapColorBy` union.
- The `'age'` entry in `colorByMode`.
- The `colorBy === 'age'` branch in the fill switch.

- [ ] **Step 8.2: Update `ChurnTreemap.test.tsx`**

Open `apps/web/src/components/hero/ChurnTreemap.test.tsx` and remove every test case that references `colorBy="age"` or asserts on `AGE_COLORS`. Other test cases (churn coloring, test-proximity coloring, click-to-select) stay.

If you're not sure what to delete, the safest approach is:
1. Read the file's existing test descriptions.
2. Delete any `it(...)` block whose body uses `colorBy="age"` or `colorByMode.age` or `AGE_COLORS`.
3. Leave `colorBy="churn"` and `colorBy="test-proximity"` tests alone.

- [ ] **Step 8.3: Run — expect tests pass**

```bash
pnpm --filter @gitrelic/web test -- ChurnTreemap
```

Expected: remaining ChurnTreemap tests pass. No surviving test depends on the removed `'age'` mode.

- [ ] **Step 8.4: Run the full web suite**

```bash
pnpm --filter @gitrelic/web test
```

Expected: all tests pass.

- [ ] **Step 8.5: Commit**

```bash
git add apps/web/src/components/hero/ChurnTreemap.tsx apps/web/src/components/hero/ChurnTreemap.test.tsx
git commit -m "$(cat <<'EOF'
chore(web): drop ChurnTreemap age colorBy mode (RELIC-305)

The age-histogram now owns the age view, so the treemap component no
longer needs colorBy='age' / AGE_COLORS / ageFillFor. The churn and
test-proximity modes (used by Hotspots / Cursed Files / Overview /
Test Coverage) are unaffected.

Refs RELIC-305.
EOF
)"
```

---

## Task 9: Final verification + manual QA

- [ ] **Step 9.1: Run the full repo test suite**

```bash
pnpm test
```

Expected: 231+ core tests pass, 29+ web tests pass, plus the new tests added in this PR.

- [ ] **Step 9.2: Run lint + format**

```bash
pnpm lint
pnpm format:check
```

Expected: clean. If `lint` reports anything, fix and re-run. If `format:check` reports anything, run `pnpm format` and re-stage in a follow-up commit.

- [ ] **Step 9.3: Build the published artifacts**

```bash
pnpm build
```

Expected: `apps/cli/dist/index.mjs` produced, `apps/cli/dist/web/` populated by the `copy-web-dist.mjs` post-hook. The build catches any leftover `'treemap-age'` HeroViz reference at the type level.

- [ ] **Step 9.4: Manual QA against the React repo**

```bash
node apps/cli/dist/index.mjs --path ~/path/to/react --web
```

Open the dashboard at the printed URL. Click into the Age Map tab in the sidebar. Verify:

- [ ] The hero is a histogram (not a treemap). Bars are tier-colored. Past `staleLimit` is shaded with a dashed threshold line.
- [ ] The page renders quickly — noticeably faster than before on large repos.
- [ ] The metrics strip is unchanged (Median Age · Ancient · Stale · Fresh).
- [ ] The bottom panel has two tabs: `Age Map` (default) and `By Directory`.
- [ ] The `Age Map` tab shows `% Cold` as the big number with a tier badge that matches the share. On the React repo, expect `~80% Critical`.
- [ ] The "Top stale directories" finding lists 3 directories.
- [ ] The tier mix subline reads `X fresh · Y aging · Z stale · W ancient`.
- [ ] The "Where they live" extras show 5 directories with proportional bars.
- [ ] The "See also" footer at the bottom of the panel has `Stale Files` and `Cursed Files` links — clicking them navigates to those presets.
- [ ] The `By Directory` tab shows a sortable table with columns `Directory · Files · Median Age · Ancient · Stale · Fresh · Oldest File`. First row has the highest median age. Clicking a row opens that directory's oldest file in the Inspector.
- [ ] No JS errors in the browser console.

- [ ] **Step 9.5: Commit any leftover formatting fixes (if any)**

If `pnpm format` modified files in Step 9.2, commit:

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: format changes (RELIC-305)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If formatting was clean, skip this step.

- [ ] **Step 9.6: Push the branch and open a PR**

```bash
git push -u origin relic-305-polish-age-map
gh pr create --title "feat(web): age-map polish (RELIC-305)" --body "$(cat <<'EOF'
## Summary

- Drops both treemap heroes (`treemap-age` + `treemap` alt) on the Age Map preset, replaces with a single `AgeHistogram` for ~50× perf win on large repos.
- Replaces the per-file `SortableTable` bottom panel with a two-tab structure: narrative-KPI default + per-directory companion table.
- Strip stays untouched.
- Adds one additive `thresholds` field to `AgeMapReport` so the histogram and panel can render tier zones from the analyzer's repo-scaled thresholds.

Spec: [docs/superpowers/specs/2026-05-02-age-map-polish-design.md](https://github.com/nebulord-dev/gitrelic/blob/main/docs/superpowers/specs/2026-05-02-age-map-polish-design.md)
Plan: [docs/superpowers/plans/2026-05-02-age-map-polish.md](https://github.com/nebulord-dev/gitrelic/blob/main/docs/superpowers/plans/2026-05-02-age-map-polish.md)

## Test plan

- [x] All core tests pass (incl. new `thresholds` cases, snapshot regen)
- [x] All web tests pass (incl. new histogram, by-directory, narrative-KPI tests)
- [x] `pnpm lint` clean
- [x] `pnpm build` clean — type narrowing of `HeroViz` catches any stale `'treemap-age'` reference
- [x] Manual QA against the React repo: histogram renders quickly, tier coloring matches, narrative-KPI shows ~80% Critical, By Directory tab fixture-collapse insight visible

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review checklist (run before handing off)

This was completed when the plan was written. The reviewer agent or human should re-verify:

1. **Spec coverage — every spec section maps to a task:**
   - Hero: `AgeHistogram` (Task 4), wired via Shell (Task 7), legend baked into the component
   - Bottom panel Tab 1 (narrative-KPI): Task 5
   - Bottom panel Tab 2 (By Directory): Task 6
   - Strip: untouched — explicitly verified in Task 9 manual QA
   - Backend `thresholds`: Task 1
   - `normalizeReport` fallback: Task 2
   - `ageByDirectory` util: Task 3
   - Cuts (treemap routes, colorByMode.age, AGE_COLORS, treemap-age in HeroViz): Tasks 7 + 8
   - See-also: Stale Files, Cursed Files — Task 5 (`AgeMapTab`)
   - Hero caption: Task 4 (`<HeroCaption>` integration)
   - Tests: every task includes failing-then-passing test cycle
   - Lint/format/build: Task 9
   - Manual QA checklist: Task 9

2. **Placeholder scan:** None of "TBD", "TODO", "implement later", "similar to Task N", "add appropriate error handling" appear in the plan body. Code blocks are complete.

3. **Type / API consistency:**
   - `AgeMapReport.thresholds` is `{ freshLimit, agingLimit, staleLimit }` everywhere it's referenced (Tasks 1, 2, 4, 5, 6, 8).
   - `AgeDirectoryRow` shape is consistent across Tasks 3, 5, 6.
   - `ageTierFor(ageInDays, thresholds)` signature stable across Task 4 component + tests.
   - `AgeMapTab` prop change `onSelectFile` → `onApplyPreset` is reflected in the BottomPanel switch case (Task 7.4.c).
   - `'age-histogram'` and `'age-map-by-directory'` enum values are added in Task 7 and consumed in Tasks 4 (component name), 6 (component name), 7 (registry).

4. **Scope:** Single PR worth of work, ~1500 line plan, ~170 net code line change after deletions. Reasonable for a polish ticket.

No issues found. Plan is ready.
