# Hero Visualization Differentiation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic shared heroes (treemap-by-churn, churn×LOC scatter, risk-heatmap) with analyzer-specific visualizations so each preset's hero tells the right story.

**Architecture:** Distinct `HeroViz` tokens per mode (no `colorBy` prop on `PresetDefinition`). Pass 1 batches three `ChurnTreemap` color modes plus a small `TestCoverageProxyReport` core extension into one PR; Pass 2 ships seven independent bespoke heroes — one per PR.

**Tech Stack:** TypeScript, React 19, Vite, D3 (`d3-hierarchy`, `d3-shape`, `d3-scale`, `d3-array` — already bundled), Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-24-hero-differentiation.md`

**Per-PR recipe reference:** `docs/superpowers/plans/2026-04-22-analyzer-presets.md` §Per-PR template

---

## File Structure

### Core (`packages/core`)
- **Modify** `src/types.ts` — add `TestCoverageFile` interface and `files: TestCoverageFile[]` field on `TestCoverageProxyReport` (PR 1 only).
- **Modify** `src/analyzers/test-coverage.ts` — emit per-file `files[]` array alongside existing directory aggregates (PR 1 only).
- **Modify** `src/analyzers/test-coverage.test.ts` — assert per-file `hasTestSibling` correctness (PR 1 only).
- **Refresh** `src/__snapshots__/fixture-regression.test.ts.snap` — regenerate after `testCoverage.files[]` lands (PR 1 only).

### Web (`apps/web`) — modified across all PRs
- `src/presets/types.ts` — widen `HeroViz` union by 9 entries (one per PR).
- `src/components/layout/Shell.tsx` — `HERO_LABELS` entries + new `selection.activeHeroViz === '...'` branches.
- `src/presets/registry.ts` — rewire affected presets per PR.
- `src/utils/normalizeReport.ts` — extend with `files: []` default for `testCoverage` (PR 1 only).
- `src/utils/normalizeReport.test.ts` — extend (PR 1 only). *(File doesn't exist yet — create alongside.)*

### Web — new components (one per Pass 2 PR)
- `src/components/hero/RewriteDivergingBar.tsx` + `.test.tsx` (PR 4)
- `src/components/hero/StalenessScatter.tsx` + `.test.tsx` (PR 5)
- `src/components/hero/BlastScatter.tsx` + `.test.tsx` (PR 6)
- `src/components/hero/OwnershipBar.tsx` + `.test.tsx` (PR 3)
- `src/components/hero/LanguagesStackedBar.tsx` + `.test.tsx` (PR 7)
- `src/components/hero/TestCoverageByDir.tsx` + `.test.tsx` (PR 8)

### Web — modified (Pass 2)
- `src/components/hero/OwnershipSunburst.tsx` — extend `mode` prop to include `'single-author'` (PR 2).
- `src/components/hero/ChurnTreemap.tsx` — add `colorBy` prop + mode table (PR 1).
- `src/components/hero/ChurnTreemap.test.tsx` — new file, tests color functions (PR 1).

---

## Task 1: PR 1 — Pass 1 (TestCoverage core extension + ChurnTreemap colorBy + 3 preset rewirings)

**Why this PR is special:** It bundles a core analyzer extension with its sole web consumer because shipping them apart would either (a) merge an unused field into core, or (b) ship a treemap-test mode against missing data. Land them atomically.

**Branch suggestion:** `feat/hero-pass1-colorby`

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/analyzers/test-coverage.ts`
- Modify: `packages/core/src/analyzers/test-coverage.test.ts`
- Modify: `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` (snapshot refresh)
- Modify: `apps/web/src/components/hero/ChurnTreemap.tsx`
- Create: `apps/web/src/components/hero/ChurnTreemap.test.tsx`
- Modify: `apps/web/src/utils/normalizeReport.ts`
- Create: `apps/web/src/utils/normalizeReport.test.ts`
- Modify: `apps/web/src/presets/types.ts`
- Modify: `apps/web/src/components/layout/Shell.tsx`
- Modify: `apps/web/src/presets/registry.ts`

### 1A. Extend core types

- [ ] **Step 1: Read current types.ts shape**

Run: `grep -n "TestCoverage\|DirectoryCoverage" packages/core/src/types.ts`

Expected: existing `DirectoryCoverage` and `TestCoverageProxyReport` interfaces around lines 330–343.

- [ ] **Step 2: Add `TestCoverageFile` interface and `files[]` field**

Edit `packages/core/src/types.ts`. Insert above `TestCoverageProxyReport`:

```ts
export interface TestCoverageFile {
  file: string;
  hasTestSibling: boolean;
}
```

Then add `files: TestCoverageFile[];` to `TestCoverageProxyReport`:

```ts
export interface TestCoverageProxyReport {
  directories: DirectoryCoverage[];
  uncoveredDirectories: DirectoryCoverage[];
  files: TestCoverageFile[];           // NEW
  overallRatio: number;
  summary: string;
}
```

### 1B. Update analyzer to emit per-file array (TDD)

- [ ] **Step 3: Write failing test for `hasTestSibling`**

Append to `packages/core/src/analyzers/test-coverage.test.ts`:

```ts
describe('analyzeTestCoverage — files[]', () => {
  it('marks a source file as hasTestSibling when a sibling test exists in the same dir', () => {
    const files = ['src/a.ts', 'src/a.test.ts', 'src/b.ts'];
    const { files: perFile } = analyzeTestCoverage(files);
    const a = perFile.find((f) => f.file === 'src/a.ts')!;
    const b = perFile.find((f) => f.file === 'src/b.ts')!;
    expect(a.hasTestSibling).toBe(true);
    expect(b.hasTestSibling).toBe(false);
  });

  it('detects siblings across .spec naming', () => {
    const files = ['lib/util.ts', 'lib/util.spec.ts'];
    const { files: perFile } = analyzeTestCoverage(files);
    expect(perFile.find((f) => f.file === 'lib/util.ts')!.hasTestSibling).toBe(true);
  });

  it('detects siblings under a __tests__ subdirectory', () => {
    const files = ['src/foo.ts', 'src/__tests__/foo.test.ts'];
    const { files: perFile } = analyzeTestCoverage(files);
    expect(perFile.find((f) => f.file === 'src/foo.ts')!.hasTestSibling).toBe(true);
  });

  it('does not include test files themselves in files[]', () => {
    const files = ['src/a.ts', 'src/a.test.ts'];
    const { files: perFile } = analyzeTestCoverage(files);
    expect(perFile.map((f) => f.file)).toEqual(['src/a.ts']);
  });

  it('does not include non-code files in files[]', () => {
    const files = ['src/a.ts', 'src/readme.md', 'src/style.css'];
    const { files: perFile } = analyzeTestCoverage(files);
    expect(perFile.map((f) => f.file)).toEqual(['src/a.ts']);
  });
});
```

- [ ] **Step 4: Run test, verify it fails**

Run: `pnpm --filter @gitrelic/core exec vitest run src/analyzers/test-coverage.test.ts`

Expected: 5 new failures with `Cannot read properties of undefined (reading 'find')` or similar — `files` is undefined on the returned object.

- [ ] **Step 5: Implement `files[]` emission in analyzer**

Edit `packages/core/src/analyzers/test-coverage.ts`. After the `dirStats` loop, before the `directories` mapping, build a sibling lookup and emit per-file records:

```ts
import type { TestCoverageProxyReport, DirectoryCoverage, TestCoverageFile } from '../types.js';

// ... existing isTestFile, isCodeFile, CODE_EXTENSIONS, signature unchanged ...

export function analyzeTestCoverage(trackedFiles: string[]): TestCoverageProxyReport {
  const dirStats = new Map<string, { source: number; test: number }>();
  const sourceFiles: string[] = [];
  const testFileSet = new Set<string>();

  for (const file of trackedFiles) {
    if (!isCodeFile(file)) continue;
    const dir = path.dirname(file);
    if (!dirStats.has(dir)) dirStats.set(dir, { source: 0, test: 0 });
    const entry = dirStats.get(dir)!;
    if (isTestFile(file)) {
      entry.test++;
      testFileSet.add(file);
    } else {
      entry.source++;
      sourceFiles.push(file);
    }
  }

  // Build per-file hasTestSibling: a source file has a sibling if some test
  // file shares its basename (minus .test/.spec) and lives either in the same
  // directory or a __tests__ subdirectory of it.
  const stem = (file: string): string => {
    const base = path.basename(file);
    return base.replace(/\.(test|spec)\.[^.]+$/, '').replace(/\.[^.]+$/, '');
  };
  const testStemsByDir = new Map<string, Set<string>>();
  for (const t of testFileSet) {
    let dir = path.dirname(t);
    if (path.basename(dir) === '__tests__') dir = path.dirname(dir);
    if (!testStemsByDir.has(dir)) testStemsByDir.set(dir, new Set());
    testStemsByDir.get(dir)!.add(stem(t));
  }

  const files: TestCoverageFile[] = sourceFiles.map((file) => {
    const dir = path.dirname(file);
    const siblings = testStemsByDir.get(dir);
    return {
      file,
      hasTestSibling: siblings ? siblings.has(stem(file)) : false,
    };
  });

  // ... existing directories mapping, uncoveredDirectories, summary unchanged ...

  return { directories, uncoveredDirectories, files, overallRatio, summary };
}
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `pnpm --filter @gitrelic/core exec vitest run src/analyzers/test-coverage.test.ts`

Expected: all tests pass (existing 7 + new 5 = 12 in this file).

### 1C. Refresh fixture regression snapshot

- [ ] **Step 7: Regenerate snapshot**

Run: `pnpm --filter @gitrelic/core exec vitest run src/fixture-regression.test.ts -u`

Expected: 1 snapshot updated. Inspect `git diff packages/core/src/__snapshots__/fixture-regression.test.ts.snap` — only `testCoverage.files: [...]` should appear as new content. If anything else changed, stop and investigate.

### 1D. Extend `normalizeReport` for older reports

- [ ] **Step 8: Update normalizeReport defaults**

Edit `apps/web/src/utils/normalizeReport.ts` — find the `testCoverage` block (≈line 117) and replace it with the spread-with-defaults form below. This handles **both** the missing-entirely case and the present-but-without-`files` case in one shape (an older report that pre-dates this PR will have `testCoverage.directories` etc. but no `files` field):

```ts
testCoverage: {
  directories: raw.testCoverage?.directories ?? [],
  uncoveredDirectories: raw.testCoverage?.uncoveredDirectories ?? [],
  files: raw.testCoverage?.files ?? [],
  overallRatio: raw.testCoverage?.overallRatio ?? 0,
  summary: raw.testCoverage?.summary ?? 'Not available',
},
```

Do **not** keep the old `?? { ... }` fallback alongside this — the spread-form supersedes it.

- [ ] **Step 9: Write normalizeReport test**

Create `apps/web/src/utils/normalizeReport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { normalizeReport } from './normalizeReport';

describe('normalizeReport', () => {
  it('defaults testCoverage.files to empty array when raw report omits it', () => {
    const raw = {
      testCoverage: {
        directories: [],
        uncoveredDirectories: [],
        overallRatio: 0,
        summary: 'old report',
      },
    };
    const out = normalizeReport(raw as any);
    expect(out.testCoverage.files).toEqual([]);
  });

  it('preserves testCoverage.files when present', () => {
    const raw = {
      testCoverage: {
        directories: [],
        uncoveredDirectories: [],
        files: [{ file: 'a.ts', hasTestSibling: true }],
        overallRatio: 0,
        summary: '',
      },
    };
    const out = normalizeReport(raw as any);
    expect(out.testCoverage.files).toHaveLength(1);
    expect(out.testCoverage.files[0].hasTestSibling).toBe(true);
  });

  it('defaults entire testCoverage when missing', () => {
    const out = normalizeReport({} as any);
    expect(out.testCoverage.files).toEqual([]);
    expect(out.testCoverage.directories).toEqual([]);
  });
});
```

- [ ] **Step 10: Run normalizeReport tests, verify pass**

Run: `pnpm --filter @gitrelic/web exec vitest run src/utils/normalizeReport.test.ts`

Expected: 3 passes.

### 1E. Add `colorBy` to `ChurnTreemap` (TDD)

- [ ] **Step 11: Write failing test for color modes**

Create `apps/web/src/components/hero/ChurnTreemap.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';

import { colorByMode } from './ChurnTreemap';

import type { GitrelicReport } from '@gitrelic/core';

function makeReport(overrides: Partial<GitrelicReport> = {}): GitrelicReport {
  return {
    hotspots: { files: [], topHotspots: [], summary: '' },
    ageMap: { files: [], staleFiles: [], ancientFiles: [], medianAgeDays: 0, summary: '' },
    testCoverage: {
      directories: [],
      uncoveredDirectories: [],
      files: [],
      overallRatio: 0,
      summary: '',
    },
    ...overrides,
  } as unknown as GitrelicReport;
}

describe('colorByMode', () => {
  describe('churn', () => {
    it('returns category color from hotspots', () => {
      const report = makeReport({
        hotspots: {
          files: [{ file: 'a.ts', hotspotScore: 90, churnScore: 80, loc: 100, category: 'critical' }],
          topHotspots: [],
          summary: '',
        },
      });
      const fill = colorByMode.churn.fill('a.ts', report);
      expect(fill).toContain('1f'); // red-ish hex
    });

    it('returns "low" color for files missing from hotspots', () => {
      const fill = colorByMode.churn.fill('missing.ts', makeReport());
      expect(fill).toBe(colorByMode.churn.fill('any.ts', makeReport()));
    });
  });

  describe('age', () => {
    it('returns color for FileAge.status', () => {
      const report = makeReport({
        ageMap: {
          files: [{ file: 'a.ts', lastCommitDate: '', ageInDays: 10, status: 'fresh' }],
          staleFiles: [],
          ancientFiles: [],
          medianAgeDays: 0,
          summary: '',
        },
      });
      const fill = colorByMode.age.fill('a.ts', report);
      expect(fill).toBeTruthy();
    });

    it('falls back when file is missing from ageMap', () => {
      const fill = colorByMode.age.fill('missing.ts', makeReport());
      expect(fill).toBeTruthy();
    });
  });

  describe('test-proximity', () => {
    it('returns "tested" color when hasTestSibling=true', () => {
      const report = makeReport({
        testCoverage: {
          directories: [],
          uncoveredDirectories: [],
          files: [{ file: 'a.ts', hasTestSibling: true }],
          overallRatio: 0,
          summary: '',
        },
      });
      const tested = colorByMode['test-proximity'].fill('a.ts', report);
      const untested = colorByMode['test-proximity'].fill('missing.ts', report);
      expect(tested).not.toBe(untested);
    });
  });

  it('exposes a legend definition for each mode', () => {
    expect(colorByMode.churn.legend.length).toBeGreaterThan(0);
    expect(colorByMode.age.legend.length).toBeGreaterThan(0);
    expect(colorByMode['test-proximity'].legend.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 12: Run test, verify it fails**

Run: `pnpm --filter @gitrelic/web exec vitest run src/components/hero/ChurnTreemap.test.tsx`

Expected: import error — `colorByMode` not exported.

- [ ] **Step 13: Implement `colorByMode` and `colorBy` prop**

Edit `apps/web/src/components/hero/ChurnTreemap.tsx`. Add the mode table and prop. The existing `categoryColor` helper is reused for the `churn` mode.

```tsx
import type { GitrelicReport } from '@gitrelic/core';

export type TreemapColorBy = 'churn' | 'age' | 'test-proximity';

interface LegendEntry { label: string; color: string; }
interface ColorMode {
  fill: (filePath: string, report: GitrelicReport) => string;
  legend: LegendEntry[];
}

const AGE_COLORS = {
  fresh:   '#1f4e7a',
  aging:   '#3a6b8c',
  stale:   '#7a4a1f',
  ancient: '#a06222',
} as const;

const TEST_COLORS = {
  tested:   '#2f5a2f',
  untested: '#7a1f1f',
} as const;

export const colorByMode: Record<TreemapColorBy, ColorMode> = {
  churn: {
    fill: (file, report) => {
      const h = report.hotspots.files.find((f) => f.file === file);
      return categoryColor(h?.category ?? 'low', 0.35);
    },
    legend: [
      { label: 'critical',  color: categoryColor('critical', 0.35) },
      { label: 'warning',   color: categoryColor('warning', 0.35) },
      { label: 'moderate',  color: categoryColor('moderate', 0.35) },
      { label: 'low',       color: categoryColor('low', 0.35) },
    ],
  },
  age: {
    fill: (file, report) => {
      const a = report.ageMap.files.find((f) => f.file === file);
      return AGE_COLORS[a?.status ?? 'aging'];
    },
    legend: [
      { label: 'fresh',   color: AGE_COLORS.fresh },
      { label: 'aging',   color: AGE_COLORS.aging },
      { label: 'stale',   color: AGE_COLORS.stale },
      { label: 'ancient', color: AGE_COLORS.ancient },
    ],
  },
  'test-proximity': {
    fill: (file, report) => {
      const t = report.testCoverage.files.find((f) => f.file === file);
      return t?.hasTestSibling ? TEST_COLORS.tested : TEST_COLORS.untested;
    },
    legend: [
      { label: 'tested',   color: TEST_COLORS.tested },
      { label: 'untested', color: TEST_COLORS.untested },
    ],
  },
};

interface ChurnTreemapProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
  colorBy?: TreemapColorBy;
}

export function ChurnTreemap({
  report,
  selectedFile,
  onSelectFile,
  colorBy = 'churn',
}: ChurnTreemapProps) {
  const mode = colorByMode[colorBy];
  // ... existing layout/leaves logic unchanged ...

  // Replace the existing fill={categoryColor(d.category ?? 'low', 0.35)} call:
  // with: fill={mode.fill(d.fullPath!, report)}
  // And the stroke fallback should also use mode.fill (not categoryColor).
  // The existing label logic (showing hotspotScore) stays under the 'churn' mode
  // only — for 'age' and 'test-proximity' it adds visual noise and the cell
  // size already gates labels. Gate with: {showLabel && colorBy === 'churn' && h > 28 && (...)}
}
```

Important details:
- Keep the existing `categoryColor` import; the `churn` mode reuses it.
- The score-text inside cells (`{d.hotspotScore}`) is meaningful only in churn mode — gate with `colorBy === 'churn'`.
- Selection stroke logic (`isSelected ? 'var(--accent-primary)' : ...`) is unchanged. For the non-selected stroke, today's code calls `categoryColor(category, 0.3)` — slightly darker than the fill at 0.35 alpha. Replicate that contrast for the new modes by darkening `mode.fill(...)` for the stroke, e.g.: pass an optional 2nd arg to the color functions or compute a darker variant inline. If complexity isn't worth it, accept the visual collapse (cells rendered without a contrasting border) — it's a minor polish concern, not a correctness one. Verify in Step 20's manual smoke and adjust if cells look mushy.

- [ ] **Step 14: Run tests, verify they pass**

Run: `pnpm --filter @gitrelic/web exec vitest run src/components/hero/ChurnTreemap.test.tsx`

Expected: all colorByMode tests pass.

### 1F. Widen HeroViz union and wire Shell

- [ ] **Step 15: Add new tokens to `HeroViz`**

Edit `apps/web/src/presets/types.ts`. In the `HeroViz` union, after `'treemap'` add:

```ts
| 'treemap-age'
| 'treemap-test'
```

- [ ] **Step 16: Add `HERO_LABELS` entries**

Edit `apps/web/src/components/layout/Shell.tsx`. In the `HERO_LABELS` Record (≈line 87):

```ts
'treemap-age': 'Age',
'treemap-test': 'Coverage',
```

TypeScript will fail to compile if you forget either entry — `Record<HeroViz, string>` enforces it.

- [ ] **Step 17: Add Shell branches for the new tokens**

In Shell.tsx where the existing `treemap` branch lives (≈line 238), add immediately after:

```tsx
{selection.activeHeroViz === 'treemap-age' && (
  <ChurnTreemap
    report={report}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
    colorBy="age"
  />
)}
{selection.activeHeroViz === 'treemap-test' && (
  <ChurnTreemap
    report={report}
    selectedFile={selection.selectedFile}
    onSelectFile={selection.selectFile}
    colorBy="test-proximity"
  />
)}
```

### 1G. Rewire affected presets

- [ ] **Step 18: Update preset registry**

Edit `apps/web/src/presets/registry.ts`:

```ts
'age-map': {
  ...
  hero: {
    defaultViz: 'treemap-age',                  // was 'treemap'
    altTabs: ['treemap-age', 'treemap'],
  },
},
'test-coverage': {
  ...
  hero: {
    defaultViz: 'treemap-test',                 // was 'treemap'
    altTabs: ['treemap-test'],                  // 'test-coverage-by-dir' joins in PR 8
  },
},
'cursed-files': {
  ...
  hero: {
    defaultViz: 'treemap',                      // was 'risk-heatmap'
    altTabs: ['treemap', 'risk-heatmap', 'scatter'],
  },
},
```

### 1H. Verify and commit

- [ ] **Step 19: Run all tests and typecheck**

Run: `pnpm test && pnpm --filter @gitrelic/web exec tsc --noEmit`

Expected: all green. If `tsc` complains about unused imports or unhandled `HeroViz` cases, fix before committing.

- [ ] **Step 20: Manual smoke (recommended)**

Run: `pnpm --filter @gitrelic/web dev` and click through Age Map / Test Coverage / Cursed Files in a real report. Verify the treemap fills change appropriately and the alt-tab buttons appear.

Use `superpowers:verification-before-completion` discipline — do not claim PR-ready until you've actually loaded the dashboard.

- [ ] **Step 21: Commit**

```bash
git add packages/core/src/types.ts \
        packages/core/src/analyzers/test-coverage.ts \
        packages/core/src/analyzers/test-coverage.test.ts \
        packages/core/src/__snapshots__/fixture-regression.test.ts.snap \
        apps/web/src/components/hero/ChurnTreemap.tsx \
        apps/web/src/components/hero/ChurnTreemap.test.tsx \
        apps/web/src/utils/normalizeReport.ts \
        apps/web/src/utils/normalizeReport.test.ts \
        apps/web/src/presets/types.ts \
        apps/web/src/components/layout/Shell.tsx \
        apps/web/src/presets/registry.ts

git commit -m "feat(web): treemap colorBy modes and core test-coverage per-file array"
```

- [ ] **Step 22: Run audit skills before opening PR**

Invoke `audit-core` (for the analyzer + types changes) and `audit-web` (for the treemap + normalizeReport + registry changes). Address any blocker findings before push.

---

## Pattern for Pass 2 PRs (applies to Tasks 2–8)

Each Pass 2 PR follows the same shape. **Only the differences from this template are spelled out per-task.**

1. **Test-first.** Write a failing test for the component's data-prep helper (the pure function, not the SVG). Use the `RenameSankey.test.tsx` pattern: import the helper, build a small synthetic report, assert structure of returned data.
2. **Implement the component.** Export both the React component (default usage) and the data-prep helper (for testing). SVG-only, no new dependencies.
3. **Widen `HeroViz`.** Add the new token to `apps/web/src/presets/types.ts`.
4. **Add `HERO_LABELS`.** Add an entry in `Shell.tsx`. TypeScript will fail compile if missed.
5. **Wire Shell branch.** Add the `selection.activeHeroViz === '<token>' && (<Component .../>)` block.
6. **Update preset registry.** Set `defaultViz` and/or `altTabs` for the owning preset.
7. **Run all tests + typecheck.** `pnpm test && pnpm --filter @gitrelic/web exec tsc --noEmit`.
8. **Manual smoke** — load the affected preset in dev mode and verify the hero renders + click selection works.
9. **Commit.** Format: `feat(web): bespoke hero for <preset>`.
10. **Run `audit-web`** before opening PR.

---

## Task 2: PR 2 — Knowledge Silos (`ownership-sunburst-silos`)

**Branch:** `feat/hero-knowledge-silos`

**Why first in Pass 2:** smallest change. Validates the per-PR recipe still flows post-presets.

**Files:**
- Modify: `apps/web/src/components/hero/OwnershipSunburst.tsx` — extend `mode` prop union
- Modify: `apps/web/src/components/hero/OwnershipSunburst` corresponding test if any (likely add coverage for new mode)
- Modify: `apps/web/src/presets/types.ts` — add `'ownership-sunburst-silos'`
- Modify: `apps/web/src/components/layout/Shell.tsx` — `HERO_LABELS` + branch
- Modify: `apps/web/src/presets/registry.ts` — `knowledge-silos` preset

- [ ] **Step 1: Read OwnershipSunburst current shape**

Run: `grep -n "mode" apps/web/src/components/hero/OwnershipSunburst.tsx`

Confirm: `mode?: 'all' | 'ghost'` at the prop interface and `mode === 'ghost'` filter logic in the data-build effect.

- [ ] **Step 2: Write failing test for `single-author` mode**

Find or create `OwnershipSunburst.test.tsx` and add:

```tsx
it('filters to single-author files when mode="single-author"', () => {
  // Use the exported data-prep helper if one exists, or render the component
  // and inspect filtered output. The expected shape: only files where
  // busFactors.files[].dominantAuthorPercent > 80 appear.
});
```

If no helper exists yet, factor the filter logic into a `prepareSunburstData(report, mode)` helper inside the component, export it, and test.

- [ ] **Step 3: Run test, verify it fails**

Run: `pnpm --filter @gitrelic/web exec vitest run src/components/hero/OwnershipSunburst.test.tsx`

- [ ] **Step 4: Extend the `mode` prop**

Change:

```ts
mode?: 'all' | 'ghost';
```

to:

```ts
mode?: 'all' | 'ghost' | 'single-author';
```

In the data-build effect, alongside the existing `mode === 'ghost'` block, add:

```ts
const siloSet = mode === 'single-author'
  ? new Set(report.busFactors.files.filter((f) => f.dominantAuthorPercent > 80).map((f) => f.file))
  : null;
// then in the filter: if (siloSet && !siloSet.has(file)) continue;
```

Update the heading text too: `mode === 'single-author' ? 'Knowledge Silos' : ...`.

**Note:** Verify the threshold by reading `packages/core/src/analyzers/knowledge-concentration.ts`. The spec assumes `> 80%`. If the analyzer uses `>= 80`, match it here.

- [ ] **Step 5: Run test, verify pass**

- [ ] **Step 6: Add HeroViz token + Shell wiring**

`presets/types.ts`: add `| 'ownership-sunburst-silos'`.

`Shell.tsx` `HERO_LABELS`: add `'ownership-sunburst-silos': 'Silos'`.

`Shell.tsx` branch (after the existing `ownership-sunburst-ghosts` block):

```tsx
{selection.activeHeroViz === 'ownership-sunburst-silos' && (
  <OwnershipSunburst
    report={report}
    selectedFile={selection.selectedFile}
    selectedContributor={selection.selectedContributor}
    onSelectFile={selection.selectFile}
    onSelectContributor={selection.selectContributor}
    mode="single-author"
  />
)}
```

- [ ] **Step 7: Update Knowledge Silos preset**

```ts
'knowledge-silos': {
  ...
  hero: {
    defaultViz: 'ownership-sunburst-silos',     // was 'ownership-sunburst'
    altTabs: ['ownership-sunburst-silos', 'ownership-sunburst', 'ownership'],
  },
},
```

- [ ] **Step 8: Verify, smoke, commit**

```bash
pnpm test && pnpm --filter @gitrelic/web exec tsc --noEmit
git commit -m "feat(web): bespoke hero for knowledge-silos (single-author sunburst mode)"
```

---

## Task 3: PR 3 — Bus Factor (`ownership-bar`)

**Branch:** `feat/hero-bus-factor`

**Files:**
- Create: `apps/web/src/components/hero/OwnershipBar.tsx` + `.test.tsx`
- Modify: `apps/web/src/presets/types.ts`, `Shell.tsx`, `registry.ts`

**Data source:** `report.busFactors.criticalFiles[].{dominantAuthor, dominantAuthorPercent, risk}`.

**Component shape:** horizontal bars, one row per critical file, bar width = `dominantAuthorPercent`, bar color = `risk` tier (`critical | high | medium | low`). Click row → `onSelectFile(file)`.

- [ ] **Step 1: Write failing test for data-prep helper**

```tsx
// OwnershipBar.test.tsx
import { describe, expect, it } from 'vitest';
import { prepareOwnershipBarData } from './OwnershipBar';
import type { GitrelicReport } from '@gitrelic/core';

function makeReport(criticalFiles: any[]): GitrelicReport {
  return {
    busFactors: { files: [], criticalFiles, overallBusFactor: 1, summary: '' },
  } as unknown as GitrelicReport;
}

describe('prepareOwnershipBarData', () => {
  it('sorts rows by dominantAuthorPercent desc', () => {
    const rows = prepareOwnershipBarData(makeReport([
      { file: 'a', dominantAuthor: 'x', dominantAuthorPercent: 60, risk: 'medium', uniqueAuthors: 2, authors: [] },
      { file: 'b', dominantAuthor: 'y', dominantAuthorPercent: 95, risk: 'critical', uniqueAuthors: 1, authors: [] },
    ]));
    expect(rows.map((r) => r.file)).toEqual(['b', 'a']);
  });

  it('caps at 30 rows by default', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      file: `f${i}`, dominantAuthor: 'x', dominantAuthorPercent: 90, risk: 'high', uniqueAuthors: 1, authors: [],
    }));
    const rows = prepareOwnershipBarData(makeReport(many));
    expect(rows).toHaveLength(30);
  });

  it('returns [] when criticalFiles is empty', () => {
    expect(prepareOwnershipBarData(makeReport([]))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test, verify fail**

- [ ] **Step 3: Implement component + helper**

```tsx
// OwnershipBar.tsx
import type { GitrelicReport, FileBusFactor } from '@gitrelic/core';

const RISK_COLORS = { critical: '#7a1f1f', high: '#a04525', medium: '#cfa044', low: '#5e8c45' } as const;

interface OwnershipBarRow {
  file: string;
  dominantAuthor: string;
  dominantAuthorPercent: number;
  risk: FileBusFactor['risk'];
}

export function prepareOwnershipBarData(report: GitrelicReport, topN = 30): OwnershipBarRow[] {
  return [...report.busFactors.criticalFiles]
    .sort((a, b) => b.dominantAuthorPercent - a.dominantAuthorPercent)
    .slice(0, topN)
    .map((f) => ({
      file: f.file,
      dominantAuthor: f.dominantAuthor,
      dominantAuthorPercent: f.dominantAuthorPercent,
      risk: f.risk,
    }));
}

interface OwnershipBarProps {
  report: GitrelicReport;
  selectedFile: string | null;
  onSelectFile: (file: string) => void;
}

export function OwnershipBar({ report, selectedFile, onSelectFile }: OwnershipBarProps) {
  const rows = prepareOwnershipBarData(report);
  // ... ResizeObserver for dimensions, then SVG with one <g> per row:
  //   - left label: row.file (truncate with title= for tooltip)
  //   - background bar (full width, dim)
  //   - foreground bar (width proportional to dominantAuthorPercent), fill = RISK_COLORS[row.risk]
  //   - right label: `${row.dominantAuthor} ${row.dominantAuthorPercent}%`
  //   - onClick on the <g>: onSelectFile(row.file)
  //   - selected file: stroke=var(--accent-primary), strokeWidth=2
}
```

- [ ] **Step 4–8: Token, Shell, registry, verify, commit (per Pass 2 pattern)**

Token: `'ownership-bar'`. Label: `'Bus Bar'` (do **not** reuse `'Ownership'` — that label is already taken by the existing `ownership` bubble token, and both tokens appear in this preset's `altTabs` together, which would render two identical alt-tab buttons).

Registry:

```ts
'bus-factor': {
  ...
  hero: { defaultViz: 'ownership-bar', altTabs: ['ownership-bar', 'risk-heatmap', 'ownership'] },
},
```

Commit: `feat(web): bespoke hero for bus-factor (ownership-bar)`.

---

## Task 4: PR 4 — Rewrite Ratio (`rewrite-diverging-bar`)

**Branch:** `feat/hero-rewrite-ratio`

**Data source:** `report.rewriteRatio.files[].{file, totalInsertions, totalDeletions, ratio, rewriteScore}`.

**Component shape:** horizontal diverging bar. Center axis at x=0; deletions extend left (red), insertions extend right (green). Rows sorted by `rewriteScore` desc. Click row → select file.

**Files:**
- Create: `apps/web/src/components/hero/RewriteDivergingBar.tsx` + `.test.tsx`
- Modify: `presets/types.ts`, `Shell.tsx`, `registry.ts`

- [ ] **Step 1: Write failing test for `prepareRewriteData`**

Build a `report.rewriteRatio.files = [...]` fixture and assert:
1. Rows sorted by `rewriteScore` desc.
2. `maxAbsValue` returned (for axis scaling) is `max(totalInsertions, totalDeletions)` across rendered rows.
3. Top-N cap (e.g., 30) honored.

- [ ] **Steps 2–8: Implement, wire, verify, commit**

```tsx
// RewriteDivergingBar.tsx (sketch)
export function prepareRewriteData(report: GitrelicReport, topN = 30) {
  const rows = [...report.rewriteRatio.files]
    .sort((a, b) => b.rewriteScore - a.rewriteScore)
    .slice(0, topN);
  const maxAbs = Math.max(0, ...rows.flatMap((r) => [r.totalInsertions, r.totalDeletions]));
  return { rows, maxAbs };
}
```

Token: `'rewrite-diverging-bar'`. Label: `'Diverging'` or `'Rewrites'`.

Registry:
```ts
'rewrite-ratio': {
  ...
  hero: { defaultViz: 'rewrite-diverging-bar', altTabs: ['rewrite-diverging-bar', 'scatter', 'debt-scatter'] },
},
```

Commit: `feat(web): bespoke hero for rewrite-ratio (diverging bar)`.

---

## Task 5: PR 5 — Dead Code (`staleness-scatter`)

**Branch:** `feat/hero-dead-code`

**Data source:** `report.deadCode.candidates[].{file, ageInDays, loc, language}`.

**Component shape:** scatter plot. X = `ageInDays`, Y = `loc`. Color = age tier (bucket `ageInDays`: <30 fresh-green, 30–180 yellow, 180–365 orange, >365 red). Optional shaded "dead-code candidate" zone in upper-right corner (>365 days, large LOC).

**Files:**
- Create: `apps/web/src/components/hero/StalenessScatter.tsx` + `.test.tsx`

- [ ] **Step 1: Write failing test**

`prepareStalenessData(report)`: returns `{ points: [{file, x, y, tier}], xMax, yMax }`. Assert tier bucketing and sorting.

- [ ] **Steps 2–8: Implement, wire, commit**

Token: `'staleness-scatter'`. Label: `'Staleness'`.

Registry:
```ts
'dead-code': {
  ...
  hero: { defaultViz: 'staleness-scatter', altTabs: ['staleness-scatter', 'scatter', 'treemap'] },
},
```

Commit: `feat(web): bespoke hero for dead-code (staleness-scatter)`.

---

## Task 6: PR 6 — Blast Radius (`blast-scatter`)

**Branch:** `feat/hero-blast-radius`

**Data source:** `report.blastRadius.files[].{file, blastScore, avgCoChangedFiles, maxCoChangedFiles, totalCommits}`.

**Component shape:** scatter. X = `blastScore`, Y = `avgCoChangedFiles`. Color = severity tier (bucket `blastScore`: <25 green, 25–50 yellow, 50–75 orange, >75 red). Highlight upper-right "cascade risk" zone.

**Files:**
- Create: `apps/web/src/components/hero/BlastScatter.tsx` + `.test.tsx`

- [ ] **Steps 1–8: Same pattern**

Token: `'blast-scatter'`. Label: `'Blast'`.

Registry:
```ts
'blast-radius': {
  ...
  hero: { defaultViz: 'blast-scatter', altTabs: ['blast-scatter', 'scatter', 'coupling'] },
},
```

Commit: `feat(web): bespoke hero for blast-radius (blast-scatter)`.

---

## Task 7: PR 7 — Languages (`languages-stacked`)

**Branch:** `feat/hero-languages`

**Data source:** `report.loc.files[].{file, lines, language}`.

**Component shape:** horizontal stacked bar. Rows = top-level directories (derived by splitting `file` on `/` and taking the first 1–2 segments). Each row's segments = LOC per language, colored by language. Sorted by total row LOC desc.

**Files:**
- Create: `apps/web/src/components/hero/LanguagesStackedBar.tsx` + `.test.tsx`

- [ ] **Step 1: Write failing test for `prepareLanguagesData`**

```tsx
it('groups files by top-level directory', () => {
  const report = makeReport([
    { file: 'apps/web/src/a.ts', lines: 100, language: 'TypeScript' },
    { file: 'apps/web/src/b.tsx', lines: 50, language: 'TypeScript' },
    { file: 'packages/core/x.ts', lines: 200, language: 'TypeScript' },
  ]);
  const { rows } = prepareLanguagesData(report);
  expect(rows.map((r) => r.directory).sort()).toEqual(['apps/web', 'packages/core']);
});

it('aggregates LOC per language within each row', () => {
  // ... assert row.segments has TypeScript=150 for 'apps/web' ...
});
```

- [ ] **Step 2 onward: Implement** (color palette: pull from a stable language→hex map; fall back to a hashed gray for unknown languages).

**Languages preset rewiring:**

```ts
languages: {
  ...
  hero: { defaultViz: 'languages-stacked', altTabs: ['languages-stacked', 'treemap'] },
},
```

Token: `'languages-stacked'`. Label: `'Stacked'`.

Commit: `feat(web): bespoke hero for languages (stacked bar by directory)`.

---

## Task 8: PR 8 — Test Coverage by-dir (`test-coverage-by-dir`)

**Branch:** `feat/hero-test-coverage-by-dir`

**Data source:** `report.testCoverage.directories[].{directory, sourceFiles, testFiles, coverageRatio}`.

**Component shape:** horizontal bars, one per directory, sorted ascending by `coverageRatio` (worst first). Bar width = `coverageRatio * 100%`. Color tier:
- `< 0.25` → red (`#7a1f1f`)
- `< 0.50` → orange (`#a04525`)
- `< 0.80` → yellow (`#cfa044`)
- `≥ 0.80` → green (`#5e8c45`)

Click row → set selected directory or filter Inspector. Skip rows where `sourceFiles === 0`.

**Files:**
- Create: `apps/web/src/components/hero/TestCoverageByDir.tsx` + `.test.tsx`

- [ ] **Step 1: Write failing test**

Assert: rows sorted ascending by `coverageRatio`, rows with `sourceFiles === 0` excluded, tier color matches threshold.

- [ ] **Steps 2–8: Implement, wire, commit**

Token: `'test-coverage-by-dir'`. Label: `'By Dir'`.

**Test Coverage preset rewiring:**

```ts
'test-coverage': {
  ...
  hero: { defaultViz: 'treemap-test', altTabs: ['treemap-test', 'test-coverage-by-dir'] },
},
```

Commit: `feat(web): bespoke hero for test-coverage (by-directory bar)`.

---

## Cross-cutting validation

After each PR (especially PR 1):

1. **Type sanity:** `pnpm --filter @gitrelic/web exec tsc --noEmit` — TypeScript's `Record<HeroViz, string>` enforces `HERO_LABELS` completeness; if you forgot a label, this catches it.
2. **Snapshot drift:** if PR changes default `hero.defaultViz` for any preset, watch for fixture-regression snapshot diffs.
3. **Audit:** run `audit-web` (always) and `audit-core` (PR 1 only). Address blockers before merging.
4. **Smoke against a real report:**
   ```bash
   pnpm --filter @gitrelic/web build
   node apps/cli/dist/index.mjs --path ~/path/to/any-git-repo --web
   ```
   Click through the affected presets in the browser. Verify hero default + alt-tab buttons render correctly.

## Out of plan

These do not appear as tasks because the spec scoped them out:

- Age Map alt viz (histogram) — colored treemap is enough.
- Overview alt-tab additions.
- Tier-1 dashboard mode redesign.
- Tier-3 group-level presets.
- `HeroViz`-reuse contract test.
- `ChurnTreemap` rename.

Add them as separate plans if they come up later.

## Skill references

- @superpowers:test-driven-development — every component has a data-prep helper that tests before implementation.
- @superpowers:verification-before-completion — never claim PR-ready without running `pnpm test && pnpm exec tsc` and a manual browser smoke.
- @audit-web — required before opening any PR that modifies `apps/web/`.
- @audit-core — required for PR 1 (only PR that modifies `packages/core`).
- @monorepo-architect — invoke after PR 1 lands to validate the cross-package change preserves boundary discipline (web imports from core stay `import type` only).
