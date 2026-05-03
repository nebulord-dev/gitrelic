# Ghost Files Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the GitRelic web dashboard's Ghost Files analyzer per the approved spec — fix the analyzer's gate (use `isGhost`, not `!isActive`), bump ownership threshold to 80%, drop two redundant hero alts, replace the bottom-panel `SortableTable` with a people-first narrative-KPI panel, retune the metrics strip, polish the shared `OwnershipSunburst` (display names + caption), and ship the analyzer's docs page.

**Architecture:** Three new aggregates (`ghostOwners`, `ghostLoc`, `tierMix`) flow from `analyzeGhostFiles` through the metrics composer to a 5-slot strip and through the rewritten `GhostFilesTab` into a `<NarrativeKPI>` consumer with extras-slot directory rollup. The shared `OwnershipSunburst` component (also consumed by Knowledge Silos) gains a `caption?` prop and switches author labels from `email.split('@')[0]` to a contributors-map name lookup that prefers full `First Last` over emails. Web wiring drops two preset altTabs and sets `docsPath` to render the right-anchored `Docs ↗` link in the bottom-panel tab bar.

**Tech Stack:** TypeScript 6, pnpm workspaces + Turbo, Vite + React 19 + Tailwind v4 (web), tsdown (core), Vitest, oxlint + oxfmt. D3 in heroes. `<NarrativeKPI>` shared component with `extras?` slot. `<HeroCaption>` shared primitive.

**Spec:** [`docs/superpowers/specs/2026-05-03-ghost-files-polish-design.md`](../specs/2026-05-03-ghost-files-polish-design.md)

**Linear:** [RELIC-318](https://linear.app/nebulord/issue/RELIC-318)

**Branch:** `relic-318-polish-ghost-files`

**Worktree note:** Memory tag `feedback_subagent_cwd_discipline.md` — when executing this plan via `subagent-driven-development`, force every bash command to start with `cd <worktree>` or commits drift to main. Memory tag `feedback_worktree_absolute_path_footgun.md` — use absolute paths that include `.worktrees/relic-318-polish-ghost-files/` and verify with `git status` before committing.

**Top-N discipline:** Memory tag `feedback_topn_under_threshold.md` — for the panel's top-3 ghost-owners finding, slice from the threshold-filtered ghost-files set (`report.ghostFiles.files`), not from any whole-repo set. The analyzer already pre-filters to ghost files, so reading `report.ghostFiles.files` directly satisfies this rule.

---

## Task 0: Worktree setup

**Files:** none yet — branch + worktree only.

- [ ] **Step 0.1: From the main repo, create the worktree branch**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic
git worktree add .worktrees/relic-318-polish-ghost-files -b relic-318-polish-ghost-files main
```

Expected: `.worktrees/relic-318-polish-ghost-files/` directory created, branch `relic-318-polish-ghost-files` checked out there.

- [ ] **Step 0.2: Install dependencies in the worktree**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm install
```

Expected: lockfile already satisfied; pnpm symlinks `node_modules`. No version drift.

- [ ] **Step 0.3: Verify clean baseline**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
git status
pnpm build
pnpm test
```

Expected: `git status` clean; `pnpm build` and `pnpm test` both green from `main`.

---

## Task 1: Backend formula fix + new aggregates

**Files:**
- Modify: `packages/core/src/types.ts` — extend `GhostFilesReport` interface with 3 new fields
- Modify: `packages/core/src/analyzers/ghost-files.ts` — bump threshold, swap gate, compute aggregates
- Modify: `packages/core/src/analyzers/ghost-files.test.ts` — update `makeContributors` helper, update existing cases for new gate/threshold, add cases for the 3 new aggregates

- [ ] **Step 1.1: Update the `makeContributors` test helper to include `isGhost`**

The existing helper at `packages/core/src/analyzers/ghost-files.test.ts:32` builds contributors without an `isGhost` field — needs it because the analyzer's new gate reads `author.isGhost`. Edit the helper:

```ts
function makeContributors(
  authors: { email: string; name: string; isActive: boolean; isGhost?: boolean }[],
): ContributorReport {
  return {
    contributors: authors.map((a) => ({
      email: a.email,
      name: a.name,
      isActive: a.isActive,
      isGhost: a.isGhost ?? !a.isActive,  // default: anyone inactive is also ghost in tests
      commitCount: 10,
      firstCommit: '2024-01-01',
      lastCommit: '2024-06-01',
      filesOwned: 5,
      linesChanged: 100,
      activeDays: 10,
      focusAreas: [],
    })),
    activeContributors: authors
      .filter((a) => a.isActive)
      .map((a) => ({
        email: a.email,
        name: a.name,
        isActive: a.isActive,
        isGhost: a.isGhost ?? !a.isActive,
        commitCount: 10,
        firstCommit: '2024-01-01',
        lastCommit: '2024-06-01',
        filesOwned: 5,
        linesChanged: 100,
        activeDays: 10,
        focusAreas: [],
      })),
    ghostContributors: [],
    topContributor: {
      email: '',
      name: '',
      isActive: true,
      isGhost: false,
      commitCount: 0,
      firstCommit: '',
      lastCommit: '',
      filesOwned: 0,
      linesChanged: 0,
      activeDays: 0,
      focusAreas: [],
    },
    summary: '',
  };
}
```

The `isGhost?: boolean` parameter defaults to `!isActive`, preserving the spirit of the old tests (inactive authors are also ghost) so existing assertions hold post-fix.

- [ ] **Step 1.2: Update existing tests for the 80% threshold**

The third existing test asserts that an author with `dominantAuthorPercent: 50` is excluded "because ownership is below 70%." That assertion still holds at 80% (50 < 80). Verify by reading the current test text — only the comment/description needs updating if it references the old number explicitly. Update test descriptions if they say "70%" to say "80%". Same for any other test that explicitly references the threshold value.

Search for the literal string `70` inside `packages/core/src/analyzers/ghost-files.test.ts` and update any that refer to the threshold. Do NOT change ownership percent test fixtures (e.g., 75 → leave as-is; the test that uses 75 should now expect EXCLUSION rather than inclusion since 75 < 80 — update those assertions accordingly).

Specifically: the existing case `'sorts by ownership percent descending'` uses `dominantAuthorPercent: 75` — update to `82` so the file still qualifies as ghost-owned post-bump.

- [ ] **Step 1.3: Write failing tests for `ghostOwners` aggregate**

Append a new `describe` block to `packages/core/src/analyzers/ghost-files.test.ts`:

```ts
  describe('ghostOwners', () => {
    it('is 0 on empty input', () => {
      const result = analyzeGhostFiles(
        makeBusReport([]),
        makeContributors([]),
        makeLocReport([]),
      );
      expect(result.ghostOwners).toBe(0);
    });

    it('counts distinct dominant authors', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g1@co.com', dominantAuthorPercent: 90 },
        { file: 'b.ts', dominantAuthor: 'g1@co.com', dominantAuthorPercent: 85 },
        { file: 'c.ts', dominantAuthor: 'g2@co.com', dominantAuthorPercent: 92 },
      ]);
      const contribs = makeContributors([
        { email: 'g1@co.com', name: 'G1', isActive: false, isGhost: true },
        { email: 'g2@co.com', name: 'G2', isActive: false, isGhost: true },
      ]);
      const loc = makeLocReport([
        { file: 'a.ts', lines: 100 },
        { file: 'b.ts', lines: 200 },
        { file: 'c.ts', lines: 50 },
      ]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.files).toHaveLength(3);
      expect(result.ghostOwners).toBe(2);
    });
  });
```

- [ ] **Step 1.4: Write failing tests for `tierMix` aggregate**

Append:

```ts
  describe('tierMix', () => {
    function ghostContrib(email: string, lastCommitDaysAgo: number) {
      const ts = Date.now() - lastCommitDaysAgo * 86_400_000;
      return {
        email,
        name: email.split('@')[0],
        isActive: false,
        isGhost: true,
        lastCommit: new Date(ts).toISOString(),
      };
    }

    it('classifies authorInactiveDays >= 365 as trueGhost', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 90 },
      ]);
      // Override lastCommit so authorInactiveDays computes to 400
      const contribs = makeContributors([
        { email: 'g@co.com', name: 'G', isActive: false, isGhost: true },
      ]);
      contribs.contributors[0].lastCommit = new Date(
        Date.now() - 400 * 86_400_000,
      ).toISOString();
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.tierMix.trueGhost).toBe(1);
      expect(result.tierMix.fading).toBe(0);
    });

    it('classifies 180 <= authorInactiveDays < 365 as fading', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 90 },
      ]);
      const contribs = makeContributors([
        { email: 'g@co.com', name: 'G', isActive: false, isGhost: true },
      ]);
      contribs.contributors[0].lastCommit = new Date(
        Date.now() - 200 * 86_400_000,
      ).toISOString();
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.tierMix.trueGhost).toBe(0);
      expect(result.tierMix.fading).toBe(1);
    });

    it('365 days exactly is trueGhost (boundary inclusive)', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 90 },
      ]);
      const contribs = makeContributors([
        { email: 'g@co.com', name: 'G', isActive: false, isGhost: true },
      ]);
      contribs.contributors[0].lastCommit = new Date(
        Date.now() - 365 * 86_400_000,
      ).toISOString();
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.tierMix.trueGhost).toBe(1);
      expect(result.tierMix.fading).toBe(0);
    });

    it('tier mix sums to totalGhostFiles (invariant)', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g1@co.com', dominantAuthorPercent: 90 },
        { file: 'b.ts', dominantAuthor: 'g2@co.com', dominantAuthorPercent: 85 },
      ]);
      const contribs = makeContributors([
        { email: 'g1@co.com', name: 'G1', isActive: false, isGhost: true },
        { email: 'g2@co.com', name: 'G2', isActive: false, isGhost: true },
      ]);
      contribs.contributors[0].lastCommit = new Date(
        Date.now() - 400 * 86_400_000,
      ).toISOString();
      contribs.contributors[1].lastCommit = new Date(
        Date.now() - 200 * 86_400_000,
      ).toISOString();
      const loc = makeLocReport([
        { file: 'a.ts', lines: 100 },
        { file: 'b.ts', lines: 50 },
      ]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.tierMix.trueGhost + result.tierMix.fading).toBe(
        result.totalGhostFiles,
      );
    });
  });
```

- [ ] **Step 1.5: Write failing tests for `ghostLoc` aggregate**

Append:

```ts
  describe('ghostLoc', () => {
    it('is 0 on empty input', () => {
      const result = analyzeGhostFiles(
        makeBusReport([]),
        makeContributors([]),
        makeLocReport([]),
      );
      expect(result.ghostLoc).toBe(0);
    });

    it('sums LOC across all ghost files', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 90 },
        { file: 'b.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 85 },
      ]);
      const contribs = makeContributors([
        { email: 'g@co.com', name: 'G', isActive: false, isGhost: true },
      ]);
      const loc = makeLocReport([
        { file: 'a.ts', lines: 100 },
        { file: 'b.ts', lines: 250 },
      ]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.ghostLoc).toBe(350);
    });

    it('treats missing LOC entries as 0', () => {
      const bus = makeBusReport([
        { file: 'a.ts', dominantAuthor: 'g@co.com', dominantAuthorPercent: 90 },
      ]);
      const contribs = makeContributors([
        { email: 'g@co.com', name: 'G', isActive: false, isGhost: true },
      ]);
      const loc = makeLocReport([]); // no LOC data
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.ghostLoc).toBe(0);
    });
  });
```

- [ ] **Step 1.6: Write failing test for the `isGhost` gate change**

Append:

```ts
  describe('isGhost gate (formula fix)', () => {
    it('excludes intermediate-zone authors (isActive=false but isGhost=false)', () => {
      const bus = makeBusReport([
        {
          file: 'a.ts',
          dominantAuthor: 'mid@co.com',
          dominantAuthorPercent: 90,
        },
      ]);
      const contribs = makeContributors([
        // intermediate: not active, not ghost (between cutoffs)
        { email: 'mid@co.com', name: 'M', isActive: false, isGhost: false },
      ]);
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.files).toHaveLength(0);
    });

    it('excludes files where the dominant author owns 79% (below 80% threshold)', () => {
      const bus = makeBusReport([
        {
          file: 'a.ts',
          dominantAuthor: 'g@co.com',
          dominantAuthorPercent: 79,
        },
      ]);
      const contribs = makeContributors([
        { email: 'g@co.com', name: 'G', isActive: false, isGhost: true },
      ]);
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.files).toHaveLength(0);
    });

    it('includes files where the dominant author owns exactly 80%', () => {
      const bus = makeBusReport([
        {
          file: 'a.ts',
          dominantAuthor: 'g@co.com',
          dominantAuthorPercent: 80,
        },
      ]);
      const contribs = makeContributors([
        { email: 'g@co.com', name: 'G', isActive: false, isGhost: true },
      ]);
      const loc = makeLocReport([{ file: 'a.ts', lines: 100 }]);
      const result = analyzeGhostFiles(bus, contribs, loc);
      expect(result.files).toHaveLength(1);
    });
  });
```

- [ ] **Step 1.7: Run new tests; verify they fail**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/core test -- ghost-files.test.ts
```

Expected: failures inside the four new `describe` blocks (`Property 'ghostOwners' does not exist`, `Property 'tierMix' does not exist`, `Property 'ghostLoc' does not exist`, and `expect(result.files).toHaveLength(0)` failing because the old gate accepts the intermediate-zone case). Some pre-existing tests may also fail because `makeContributors` now includes `isGhost` — that's expected; the helper change forces all paths through the new gate.

- [ ] **Step 1.8: Extend `GhostFilesReport` in `types.ts`**

Edit `packages/core/src/types.ts:395`:

```ts
export interface GhostFilesReport {
  files: GhostFile[];
  totalGhostFiles: number;
  ghostOwners: number; // distinct dominant-author count
  ghostLoc: number; // total LOC across ghost files
  tierMix: {
    trueGhost: number; // authorInactiveDays >= 365
    fading: number; // 180 <= authorInactiveDays < 365
  };
  summary: string;
}
```

- [ ] **Step 1.9: Bump threshold + swap gate + compute aggregates in `analyzers/ghost-files.ts`**

Edit `packages/core/src/analyzers/ghost-files.ts`:

```ts
import type {
  BusFactorReport,
  ContributorReport,
  LocReport,
  GhostFilesReport,
  GhostFile,
} from '../types.js';

const GHOST_OWNERSHIP_THRESHOLD = 80;

export function analyzeGhostFiles(
  busFactorReport: BusFactorReport,
  contributorReport: ContributorReport,
  locReport: LocReport,
): GhostFilesReport {
  const contributorMap = new Map(
    contributorReport.contributors.map((c) => [c.email, c]),
  );
  const locMap = new Map(locReport.files.map((f) => [f.file, f.lines]));

  const files: GhostFile[] = [];

  for (const fileBus of busFactorReport.files) {
    if (fileBus.dominantAuthorPercent < GHOST_OWNERSHIP_THRESHOLD) continue;

    const author = contributorMap.get(fileBus.dominantAuthor);
    if (!author || !author.isGhost) continue;

    files.push({
      file: fileBus.file,
      dominantAuthor: fileBus.dominantAuthor,
      dominantAuthorPercent: fileBus.dominantAuthorPercent,
      lastAuthorCommitDate: author.lastCommit,
      authorInactiveDays: Math.floor(
        (Date.now() - new Date(author.lastCommit).getTime()) / 86_400_000,
      ),
      loc: locMap.get(fileBus.file) ?? 0,
    });
  }

  files.sort((a, b) => b.dominantAuthorPercent - a.dominantAuthorPercent);

  const totalGhostFiles = files.length;
  const ghostOwners = new Set(files.map((f) => f.dominantAuthor)).size;
  const ghostLoc = files.reduce((sum, f) => sum + f.loc, 0);
  const tierMix = {
    trueGhost: files.filter((f) => f.authorInactiveDays >= 365).length,
    fading: files.filter(
      (f) => f.authorInactiveDays >= 180 && f.authorInactiveDays < 365,
    ).length,
  };

  const summary =
    totalGhostFiles > 0
      ? `${totalGhostFiles} file${totalGhostFiles !== 1 ? 's' : ''} owned by inactive contributors — knowledge may be lost`
      : 'No ghost files detected';

  return {
    files,
    totalGhostFiles,
    ghostOwners,
    ghostLoc,
    tierMix,
    summary,
  };
}
```

The two precise changes vs. the original: `THRESHOLD = 80` (was `70`) and `if (!author || !author.isGhost)` (was `!author.isActive`). The three aggregate computations and the return-shape additions are pure-additive.

- [ ] **Step 1.10: Run ghost-files tests; verify pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/core test -- ghost-files.test.ts
```

Expected: all `analyzeGhostFiles` tests pass (existing 6 + ~11 new across the four describe blocks).

- [ ] **Step 1.11: Run full core suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/core test
```

Expected: most tests pass; `fixture-regression.test.ts` will fail because the snapshot no longer matches (ghost-files slice changed shape; cursed-files curse-scores may shift). Note the failing snapshot — fix in Task 2.

- [ ] **Step 1.12: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
git add packages/core/src/types.ts \
        packages/core/src/analyzers/ghost-files.ts \
        packages/core/src/analyzers/ghost-files.test.ts
git commit -m "feat(core): tighten ghost-files gate to isGhost + 80% ownership; add ghostOwners/ghostLoc/tierMix aggregates (RELIC-318)"
```

Verify with `git status` that no other paths were staged.

---

## Task 2: Snapshot diff verification

**Files:**
- Modify (auto): `packages/core/src/__snapshots__/fixture-regression.test.ts.snap`

- [ ] **Step 2.1: Regenerate the snapshot**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/core test -u -- fixture-regression
```

Expected: snapshot regenerates. Diff should contain:
- **Ghost-files slice:** `files[]` array shrinks (any test-fixture entry with dominant author at 70-79% or with intermediate-zone owner drops out); three new fields added (`ghostOwners`, `ghostLoc`, `tierMix`).
- **Cursed-files slice:** per-file curse scores may shift downward where the file's ghost-files contribution shrank or zeroed out. Reasons-array entries containing a ghost reference may also disappear for sub-threshold files.

- [ ] **Step 2.2: Inspect the diff**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
git diff packages/core/src/__snapshots__/fixture-regression.test.ts.snap | head -200
```

Expected: pure-shrink + addition pattern in ghost-files; curse-score shifts in cursed-files. **No changes outside those two slices.** If anything else mutates (e.g. churn slice, contributors slice), STOP and investigate — likely indicates the gate-change broke an unintended cross-analyzer assumption.

- [ ] **Step 2.3: Run full core suite to confirm green**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/core test
```

Expected: all green.

- [ ] **Step 2.4: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
git add packages/core/src/__snapshots__/fixture-regression.test.ts.snap
git commit -m "chore(core): regenerate fixture-regression snapshot for ghost-files formula fix (RELIC-318)"
```

---

## Task 3: Frontend aggregator utilities

**Files:**
- Create: `apps/web/src/utils/ghostOwners.ts`
- Create: `apps/web/src/utils/ghostOwners.test.ts`
- Create: `apps/web/src/utils/ghostFilesByDirectory.ts`
- Create: `apps/web/src/utils/ghostFilesByDirectory.test.ts`

> Naming note: the exported aggregator function is `aggregateGhostFilesByDirectory` (mirrors `aggregateBlastByDirectory` from `apps/web/src/utils/blastByDirectory.ts`). The spec's pseudo-snippet referenced a bare `ghostFilesByDirectory()` — typo; this plan uses the consistent `aggregate*` prefix.

- [ ] **Step 3.1: Write failing test for `ghostOwners.ts`**

Create `apps/web/src/utils/ghostOwners.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { topGhostOwners } from './ghostOwners';
import type { Contributor, GhostFile } from '@gitrelic/core';

function makeFile(file: string, dominantAuthor: string, loc = 100): GhostFile {
  return {
    file,
    dominantAuthor,
    dominantAuthorPercent: 90,
    lastAuthorCommitDate: '2024-01-01',
    authorInactiveDays: 200,
    loc,
  };
}

function makeContrib(email: string, name: string): Contributor {
  return {
    email,
    name,
    commitCount: 1,
    firstCommit: '',
    lastCommit: '',
    filesOwned: 0,
    linesChanged: 0,
    activeDays: 0,
    focusAreas: [],
    isActive: false,
    isGhost: true,
  };
}

describe('topGhostOwners', () => {
  it('returns [] for empty input', () => {
    expect(topGhostOwners([], [], 3)).toEqual([]);
  });

  it('groups files by dominantAuthor and sums LOC', () => {
    const files = [
      makeFile('a.ts', 'g1@x.com', 100),
      makeFile('b.ts', 'g1@x.com', 50),
      makeFile('c.ts', 'g2@x.com', 200),
    ];
    const contribs = [
      makeContrib('g1@x.com', 'Ghost One'),
      makeContrib('g2@x.com', 'Ghost Two'),
    ];
    const result = topGhostOwners(files, contribs, 3);
    expect(result).toEqual([
      { email: 'g1@x.com', name: 'Ghost One', fileCount: 2, ghostLoc: 150 },
      { email: 'g2@x.com', name: 'Ghost Two', fileCount: 1, ghostLoc: 200 },
    ]);
  });

  it('ranks by file count descending', () => {
    const files = [
      makeFile('a.ts', 'g1@x.com', 1000),
      makeFile('b.ts', 'g2@x.com', 50),
      makeFile('c.ts', 'g2@x.com', 50),
      makeFile('d.ts', 'g2@x.com', 50),
    ];
    const contribs = [
      makeContrib('g1@x.com', 'G1'),
      makeContrib('g2@x.com', 'G2'),
    ];
    const result = topGhostOwners(files, contribs, 3);
    // g2 wins despite g1 having higher LOC — primary sort is fileCount
    expect(result[0].email).toBe('g2@x.com');
    expect(result[0].fileCount).toBe(3);
    expect(result[1].email).toBe('g1@x.com');
  });

  it('breaks ties by alphabetical email', () => {
    const files = [
      makeFile('a.ts', 'b@x.com', 100),
      makeFile('b.ts', 'a@x.com', 100),
    ];
    const contribs = [makeContrib('a@x.com', 'A'), makeContrib('b@x.com', 'B')];
    const result = topGhostOwners(files, contribs, 3);
    expect(result[0].email).toBe('a@x.com');
    expect(result[1].email).toBe('b@x.com');
  });

  it('respects topN cap', () => {
    const files = [
      makeFile('a.ts', 'g1@x.com'),
      makeFile('b.ts', 'g2@x.com'),
      makeFile('c.ts', 'g3@x.com'),
      makeFile('d.ts', 'g4@x.com'),
    ];
    const contribs = [
      makeContrib('g1@x.com', 'G1'),
      makeContrib('g2@x.com', 'G2'),
      makeContrib('g3@x.com', 'G3'),
      makeContrib('g4@x.com', 'G4'),
    ];
    expect(topGhostOwners(files, contribs, 3)).toHaveLength(3);
  });

  it('falls back to email when contributor name is empty', () => {
    const files = [makeFile('a.ts', 'unknown@x.com')];
    const contribs = [makeContrib('unknown@x.com', '')];
    const result = topGhostOwners(files, contribs, 3);
    expect(result[0].name).toBe('unknown@x.com');
  });

  it('falls back to email when contributor is not in the contributors map', () => {
    const files = [makeFile('a.ts', 'orphan@x.com')];
    const result = topGhostOwners(files, [], 3);
    expect(result[0].name).toBe('orphan@x.com');
  });
});
```

- [ ] **Step 3.2: Run; verify it fails**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test -- ghostOwners
```

Expected: cannot find module `./ghostOwners`.

- [ ] **Step 3.3: Implement `ghostOwners.ts`**

Create `apps/web/src/utils/ghostOwners.ts`:

```ts
import type { Contributor, GhostFile } from '@gitrelic/core';

export interface TopGhostOwner {
  email: string;
  name: string;
  fileCount: number;
  ghostLoc: number;
}

export function topGhostOwners(
  files: ReadonlyArray<GhostFile>,
  contributors: ReadonlyArray<Contributor>,
  topN: number,
): TopGhostOwner[] {
  if (files.length === 0) return [];

  const nameByEmail = new Map(contributors.map((c) => [c.email, c.name]));

  const aggregates = new Map<string, { fileCount: number; ghostLoc: number }>();
  for (const f of files) {
    const entry = aggregates.get(f.dominantAuthor) ?? {
      fileCount: 0,
      ghostLoc: 0,
    };
    entry.fileCount += 1;
    entry.ghostLoc += f.loc;
    aggregates.set(f.dominantAuthor, entry);
  }

  const rows: TopGhostOwner[] = [];
  for (const [email, agg] of aggregates) {
    const candidateName = nameByEmail.get(email);
    rows.push({
      email,
      name: candidateName && candidateName.length > 0 ? candidateName : email,
      fileCount: agg.fileCount,
      ghostLoc: agg.ghostLoc,
    });
  }

  rows.sort(
    (a, b) => b.fileCount - a.fileCount || a.email.localeCompare(b.email),
  );

  return rows.slice(0, topN);
}
```

- [ ] **Step 3.4: Run; verify pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test -- ghostOwners
```

Expected: all 7 tests pass.

- [ ] **Step 3.5: Write failing test for `ghostFilesByDirectory.ts`**

Create `apps/web/src/utils/ghostFilesByDirectory.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { aggregateGhostFilesByDirectory } from './ghostFilesByDirectory';
import type { GhostFile } from '@gitrelic/core';

function makeFile(file: string): GhostFile {
  return {
    file,
    dominantAuthor: 'g@x.com',
    dominantAuthorPercent: 90,
    lastAuthorCommitDate: '2024-01-01',
    authorInactiveDays: 200,
    loc: 1,
  };
}

describe('aggregateGhostFilesByDirectory', () => {
  it('returns [] for empty input', () => {
    expect(aggregateGhostFilesByDirectory([])).toEqual([]);
  });

  it('groups by parent directory', () => {
    const rows = aggregateGhostFilesByDirectory([
      makeFile('src/a.ts'),
      makeFile('src/b.ts'),
      makeFile('lib/c.ts'),
    ]);
    expect(rows).toEqual([
      { directory: 'src', count: 2, share: 2 / 3 },
      { directory: 'lib', count: 1, share: 1 / 3 },
    ]);
  });

  it('treats root-level files with empty directory string', () => {
    const rows = aggregateGhostFilesByDirectory([makeFile('README.md')]);
    expect(rows[0].directory).toBe('');
  });

  it('sorts ties by directory name alphabetical', () => {
    const rows = aggregateGhostFilesByDirectory([
      makeFile('z/a.ts'),
      makeFile('a/b.ts'),
    ]);
    expect(rows[0].directory).toBe('a');
    expect(rows[1].directory).toBe('z');
  });
});
```

- [ ] **Step 3.6: Run; verify it fails**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test -- ghostFilesByDirectory
```

Expected: cannot find module.

- [ ] **Step 3.7: Implement `ghostFilesByDirectory.ts`**

Create `apps/web/src/utils/ghostFilesByDirectory.ts` (mirrors `blastByDirectory.ts` pattern — top-N is applied at the consumer, not the aggregator):

```ts
import type { GhostFile } from '@gitrelic/core';

export interface GhostDirectoryRow {
  directory: string;
  count: number;
  share: number;
}

function parentDirectory(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? '' : filePath.slice(0, slash);
}

export function aggregateGhostFilesByDirectory(
  files: ReadonlyArray<GhostFile>,
): GhostDirectoryRow[] {
  if (files.length === 0) return [];

  const counts = new Map<string, number>();
  for (const f of files) {
    const dir = parentDirectory(f.file);
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }

  const total = files.length;
  const rows: GhostDirectoryRow[] = [];
  for (const [directory, count] of counts) {
    rows.push({ directory, count, share: count / total });
  }

  rows.sort(
    (a, b) => b.count - a.count || a.directory.localeCompare(b.directory),
  );

  return rows;
}
```

- [ ] **Step 3.8: Run; verify pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test -- ghostFilesByDirectory
```

Expected: all 4 tests pass.

- [ ] **Step 3.9: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
git add apps/web/src/utils/ghostOwners.ts \
        apps/web/src/utils/ghostOwners.test.ts \
        apps/web/src/utils/ghostFilesByDirectory.ts \
        apps/web/src/utils/ghostFilesByDirectory.test.ts
git commit -m "feat(web): add ghostOwners + ghostFilesByDirectory aggregators (RELIC-318)"
```

---

## Task 4: Metrics composer rewrite

**Files:**
- Modify: `apps/web/src/presets/metrics/ghost-files.ts` — rewrite for 5 health-tiered slots
- Create: `apps/web/src/presets/metrics/ghost-files.test.ts`

- [ ] **Step 4.1: Write failing tests for the rewritten composer**

Create `apps/web/src/presets/metrics/ghost-files.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { ghostFilesMetrics } from './ghost-files';
import type {
  GhostFile,
  GhostFilesReport,
  GitrelicReport,
} from '@gitrelic/core';

function makeGhostFile(authorInactiveDays: number, loc = 100): GhostFile {
  return {
    file: `f${authorInactiveDays}.ts`,
    dominantAuthor: `g${authorInactiveDays}@x.com`,
    dominantAuthorPercent: 90,
    lastAuthorCommitDate: '2024-01-01',
    authorInactiveDays,
    loc,
  };
}

function makeReport(
  ghost: Partial<GhostFilesReport> = {},
  totalLines = 100_000,
): GitrelicReport {
  return {
    ghostFiles: {
      files: ghost.files ?? [],
      totalGhostFiles: ghost.totalGhostFiles ?? 0,
      ghostOwners: ghost.ghostOwners ?? 0,
      ghostLoc: ghost.ghostLoc ?? 0,
      tierMix: ghost.tierMix ?? { trueGhost: 0, fading: 0 },
      summary: '',
    },
    loc: { totalLines } as GitrelicReport['loc'],
  } as unknown as GitrelicReport;
}

describe('ghostFilesMetrics', () => {
  it('returns exactly 5 slots in canonical order', () => {
    const m = ghostFilesMetrics(makeReport());
    expect(m).toHaveLength(5);
    expect(m.map((s) => s.label)).toEqual([
      'Ghost Files',
      'Ghost Owners',
      'True Ghosts (≥365d)',
      'Fading (180–364d)',
      'Ghost LOC',
    ]);
  });

  describe('slot 1 — Ghost Files', () => {
    it('healthy at 0', () => {
      expect(ghostFilesMetrics(makeReport({ totalGhostFiles: 0 }))[0].color).toBe(
        'var(--severity-healthy)',
      );
    });
    it('warning at 1..9', () => {
      expect(ghostFilesMetrics(makeReport({ totalGhostFiles: 5 }))[0].color).toBe(
        'var(--severity-warning)',
      );
    });
    it('critical at 10+', () => {
      expect(ghostFilesMetrics(makeReport({ totalGhostFiles: 10 }))[0].color).toBe(
        'var(--severity-critical)',
      );
    });
  });

  describe('slot 2 — Ghost Owners', () => {
    it('healthy at 0', () => {
      expect(ghostFilesMetrics(makeReport({ ghostOwners: 0 }))[1].color).toBe(
        'var(--severity-healthy)',
      );
    });
    it('warning at 1..2', () => {
      expect(ghostFilesMetrics(makeReport({ ghostOwners: 2 }))[1].color).toBe(
        'var(--severity-warning)',
      );
    });
    it('critical at 3+', () => {
      expect(ghostFilesMetrics(makeReport({ ghostOwners: 3 }))[1].color).toBe(
        'var(--severity-critical)',
      );
    });
  });

  describe('slot 3 — True Ghosts', () => {
    it('healthy at 0', () => {
      expect(
        ghostFilesMetrics(makeReport({ tierMix: { trueGhost: 0, fading: 0 } }))[2].color,
      ).toBe('var(--severity-healthy)');
    });
    it('critical at 1+', () => {
      expect(
        ghostFilesMetrics(makeReport({ tierMix: { trueGhost: 1, fading: 0 } }))[2].color,
      ).toBe('var(--severity-critical)');
    });
  });

  describe('slot 4 — Fading', () => {
    it('healthy at 0', () => {
      expect(
        ghostFilesMetrics(makeReport({ tierMix: { trueGhost: 0, fading: 0 } }))[3].color,
      ).toBe('var(--severity-healthy)');
    });
    it('warning at 1..9', () => {
      expect(
        ghostFilesMetrics(makeReport({ tierMix: { trueGhost: 0, fading: 5 } }))[3].color,
      ).toBe('var(--severity-warning)');
    });
    it('critical at 10+', () => {
      expect(
        ghostFilesMetrics(makeReport({ tierMix: { trueGhost: 0, fading: 10 } }))[3].color,
      ).toBe('var(--severity-critical)');
    });
  });

  describe('slot 5 — Ghost LOC', () => {
    it('value renders absolute LOC formatted', () => {
      expect(ghostFilesMetrics(makeReport({ ghostLoc: 12_345 }, 100_000))[4].value).toBe(
        '12,345',
      );
    });
    it('healthy when ghostLoc < 2% of totalLines', () => {
      expect(
        ghostFilesMetrics(makeReport({ ghostLoc: 1_900 }, 100_000))[4].color,
      ).toBe('var(--severity-healthy)');
    });
    it('warning when ghostLoc is 2..9% of totalLines', () => {
      expect(
        ghostFilesMetrics(makeReport({ ghostLoc: 5_000 }, 100_000))[4].color,
      ).toBe('var(--severity-warning)');
    });
    it('critical when ghostLoc >= 10% of totalLines', () => {
      expect(
        ghostFilesMetrics(makeReport({ ghostLoc: 10_000 }, 100_000))[4].color,
      ).toBe('var(--severity-critical)');
    });
    it('healthy when totalLines is 0 (empty repo)', () => {
      expect(ghostFilesMetrics(makeReport({ ghostLoc: 0 }, 0))[4].color).toBe(
        'var(--severity-healthy)',
      );
    });
  });
});
```

- [ ] **Step 4.2: Run; verify it fails**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test -- 'metrics/ghost-files'
```

Expected: failures across slot label assertions and severity bands (current composer ships different labels and bands).

- [ ] **Step 4.3: Rewrite `ghost-files.ts` composer**

Replace the entire body of `apps/web/src/presets/metrics/ghost-files.ts`:

```ts
import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function ghostFilesMetrics(report: GitrelicReport): Metric[] {
  const gf = report.ghostFiles;
  const totalLines = report.loc.totalLines;
  const ghostLocPercent =
    totalLines > 0 ? (gf.ghostLoc / totalLines) * 100 : 0;

  return [
    {
      label: 'Ghost Files',
      value: String(gf.totalGhostFiles),
      color:
        gf.totalGhostFiles === 0
          ? 'var(--severity-healthy)'
          : gf.totalGhostFiles < 10
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
    {
      label: 'Ghost Owners',
      value: String(gf.ghostOwners),
      color:
        gf.ghostOwners === 0
          ? 'var(--severity-healthy)'
          : gf.ghostOwners < 3
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
    {
      label: 'True Ghosts (≥365d)',
      value: String(gf.tierMix.trueGhost),
      color:
        gf.tierMix.trueGhost === 0
          ? 'var(--severity-healthy)'
          : 'var(--severity-critical)',
    },
    {
      label: 'Fading (180–364d)',
      value: String(gf.tierMix.fading),
      color:
        gf.tierMix.fading === 0
          ? 'var(--severity-healthy)'
          : gf.tierMix.fading < 10
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
    {
      label: 'Ghost LOC',
      value: fmt(gf.ghostLoc),
      color:
        ghostLocPercent < 2
          ? 'var(--severity-healthy)'
          : ghostLocPercent < 10
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
  ];
}
```

- [ ] **Step 4.4: Run composer test; verify pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test -- 'metrics/ghost-files'
```

Expected: all composer tests pass.

- [ ] **Step 4.5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
git add apps/web/src/presets/metrics/ghost-files.ts \
        apps/web/src/presets/metrics/ghost-files.test.ts
git commit -m "feat(web): retune ghost-files metrics strip to 5 health-tiered slots (RELIC-318)"
```

---

## Task 5: Hero polish — `OwnershipSunburst` (display names + caption + legend cap)

**Files:**
- Modify: `apps/web/src/components/hero/OwnershipSunburst.tsx`

This component is shared with Knowledge Silos (`mode='single-author'`) — changes here ripple to both consumers. Run KS-related tests after the edit as a hard gate.

- [ ] **Step 5.1: Survey existing OwnershipSunburst-related tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
grep -l -r "OwnershipSunburst\|KnowledgeSilos\|ownership-sunburst" apps/web/src --include='*.test.*'
```

Expected output: at minimum `apps/web/src/components/layout/Shell.test.tsx` (since it likely renders some presets) — note the file list. These are the hard-gate tests for Task 5.

- [ ] **Step 5.2: Add `caption?` prop + display-name lookup**

Edit `apps/web/src/components/hero/OwnershipSunburst.tsx`. Three precise changes:

**Change A — props interface and helper, top of file:**

Replace:

```ts
interface OwnershipSunburstProps {
  report: GitrelicReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  onSelectFile: (file: string) => void;
  onSelectContributor: (email: string) => void;
  mode?: SunburstMode;
}
```

With:

```ts
interface OwnershipSunburstProps {
  report: GitrelicReport;
  selectedFile: string | null;
  selectedContributor: string | null;
  onSelectFile: (file: string) => void;
  onSelectContributor: (email: string) => void;
  mode?: SunburstMode;
  caption?: string;
}

function displayName(
  email: string,
  nameByEmail: Map<string, string>,
): string {
  const candidate = nameByEmail.get(email);
  return candidate && candidate.length > 0 ? candidate : email;
}
```

**Change B — `prepareSunburstData` author label:**

The existing `prepareSunburstData` function sets `name: email.split('@')[0]` at line 80. Replace with a contributors-aware lookup. Update the function signature and call sites:

```ts
export function prepareSunburstData(
  report: GitrelicReport,
  mode: SunburstMode,
): SunburstNode {
  const locMap = new Map<string, number>();
  for (const f of report.loc.files) {
    locMap.set(f.file, f.lines);
  }

  const nameByEmail = new Map(
    report.contributors.contributors.map((c) => [c.email, c.name]),
  );

  const filterSet = filterSetForMode(report, mode);

  const authorMap = new Map<
    string,
    { files: Array<{ file: string; risk: string; loc: number }> }
  >();

  for (const f of report.busFactors.files) {
    if (filterSet && !filterSet.has(f.file)) continue;
    const author = f.dominantAuthor;
    if (!authorMap.has(author)) {
      authorMap.set(author, { files: [] });
    }
    authorMap.get(author)!.files.push({
      file: f.file,
      risk: f.risk,
      loc: locMap.get(f.file) ?? 1,
    });
  }

  const authorNodes: SunburstNode[] = [];
  for (const [email, data] of authorMap) {
    authorNodes.push({
      name: displayName(email, nameByEmail),
      email,
      children: data.files.map((f) => ({
        name: f.file.split('/').pop() ?? f.file,
        file: f.file,
        risk: f.risk,
        value: Math.max(f.loc, 1),
      })),
    });
  }

  return { name: 'root', children: authorNodes };
}
```

**Change C — author legend (line ~316) + `caption` prop wiring:**

Inside the component, build the same `nameByEmail` map for legend rendering and tooltip rendering. Update the author legend cap from `8` to `6`. Wrap the existing SVG in `<div className="w-full h-full flex flex-col">` with `<HeroCaption>` beneath.

Add the import at the top:

```ts
import { HeroCaption } from '../shared/HeroCaption';
```

Add `caption` to the destructured props in `OwnershipSunburst`:

```ts
export function OwnershipSunburst({
  report,
  selectedFile,
  selectedContributor,
  onSelectFile,
  onSelectContributor,
  mode = 'all',
  caption,
}: OwnershipSunburstProps) {
```

Compute `nameByEmail` once with `useMemo`:

```ts
  const nameByEmail = useMemo(
    () =>
      new Map(report.contributors.contributors.map((c) => [c.email, c.name])),
    [report.contributors.contributors],
  );
```

Replace the legend block (`{authorNames.slice(0, 8).map(…)}`):

```tsx
        {/* Author legend */}
        {authorNames.slice(0, 6).map((email, i) => (
          <g
            key={email}
            transform={`translate(${dims.width - 110}, ${dims.height - Math.min(authorNames.length, 6) * 16 + i * 16})`}
          >
            <circle
              cx={5}
              cy={4}
              r={5}
              fill={authorColor(email)}
              fillOpacity={0.85}
            />
            <text x={14} y={8} fontSize={9} fill="var(--text-secondary)">
              {displayName(email, nameByEmail)}
            </text>
          </g>
        ))}
```

Replace the tooltip author block to render full display name:

```tsx
          {tooltip.kind === 'author' ? (
            <>
              <div className="font-semibold mb-0.5">{displayName(tooltip.email, nameByEmail)}</div>
              <div className="text-text-secondary">{tooltip.email}</div>
              <div className="text-text-secondary mt-0.5">
                {tooltip.fileCount} file{tooltip.fileCount !== 1 ? 's' : ''}{' '}
                owned
              </div>
            </>
```

Wrap the existing JSX `<div ref={containerRef} …>` in a `flex flex-col` outer with `<HeroCaption>` sibling:

```tsx
  return (
    <div className="w-full h-full flex flex-col">
      <div ref={containerRef} className="flex-1 w-full relative">
        <svg width={dims.width} height={dims.height}>
          {/* … existing nodes / center label / legends … */}
        </svg>

        {tooltip && (/* … existing tooltip … */)}
      </div>
      {caption != null && <HeroCaption primary={caption} />}
    </div>
  );
```

**Important:** the existing `containerRef` `<div>` was using `className="w-full h-full relative"`. Inside the new `flex flex-col` outer, change to `flex-1 w-full relative` so the inner div takes remaining space minus the caption strip.

Note: `tooltip.name` becomes unused after switching to `displayName(tooltip.email, ...)`. Leave the field on the discriminated union for now — the type still matches and a future cleanup can drop it.

- [ ] **Step 5.3: Build to verify type-correctness**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web build
```

Expected: clean build. Type errors here are typically a missing import, mistyped prop, or stale destructure.

- [ ] **Step 5.4: Run KS regression hard gate**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test
```

Expected: all web tests pass. **Specifically** `KnowledgeSilosTab.test.tsx` and any `Shell.test.tsx` cases that mount Knowledge Silos. If anything regresses, investigate before continuing — most likely the legend or tooltip changes broke a test selector.

- [ ] **Step 5.5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
git add apps/web/src/components/hero/OwnershipSunburst.tsx
git commit -m "feat(web): OwnershipSunburst display-name labels + optional caption + legend cap 6 (RELIC-318)"
```

---

## Task 6: Tab rewrite, BottomPanel wiring, normalizeReport defaults

**Files:**
- Modify (full rewrite): `apps/web/src/components/tabs/GhostFilesTab.tsx`
- Create: `apps/web/src/components/tabs/GhostFilesTab.test.tsx`
- Modify: `apps/web/src/components/layout/BottomPanel.tsx` — wire `onApplyPreset` to `GhostFilesTab`
- Modify: `apps/web/src/utils/normalizeReport.ts` — per-field defaults for 3 new fields

- [ ] **Step 6.1: Add per-field defaults to `normalizeReport.ts`**

Edit `apps/web/src/utils/normalizeReport.ts` — replace the existing `ghostFiles` block (around line 144) with a per-field merge:

```ts
    ghostFiles: {
      files: raw.ghostFiles?.files ?? [],
      totalGhostFiles: raw.ghostFiles?.totalGhostFiles ?? 0,
      ghostOwners: raw.ghostFiles?.ghostOwners ?? 0,
      ghostLoc: raw.ghostFiles?.ghostLoc ?? 0,
      tierMix: raw.ghostFiles?.tierMix ?? { trueGhost: 0, fading: 0 },
      summary: raw.ghostFiles?.summary ?? 'Not available',
    },
```

(Mirrors the contributors / commitTiming pattern: fall back per-field rather than object-level so old report JSONs without the new aggregates default to 0 instead of `undefined`.)

- [ ] **Step 6.2: Write failing tab test**

Create `apps/web/src/components/tabs/GhostFilesTab.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GhostFilesTab } from './GhostFilesTab';
import type {
  Contributor,
  GhostFile,
  GitrelicReport,
} from '@gitrelic/core';

function makeFile(
  file: string,
  dominantAuthor: string,
  authorInactiveDays: number,
  loc = 100,
): GhostFile {
  return {
    file,
    dominantAuthor,
    dominantAuthorPercent: 90,
    lastAuthorCommitDate: '2024-01-01',
    authorInactiveDays,
    loc,
  };
}

function makeContrib(email: string, name: string): Contributor {
  return {
    email,
    name,
    commitCount: 1,
    firstCommit: '',
    lastCommit: '',
    filesOwned: 0,
    linesChanged: 0,
    activeDays: 0,
    focusAreas: [],
    isActive: false,
    isGhost: true,
  };
}

function makeReport(overrides: {
  files?: GhostFile[];
  ghostOwners?: number;
  totalGhostFiles?: number;
  ghostLoc?: number;
  tierMix?: { trueGhost: number; fading: number };
  contributors?: Contributor[];
} = {}): GitrelicReport {
  const files = overrides.files ?? [];
  return {
    ghostFiles: {
      files,
      totalGhostFiles: overrides.totalGhostFiles ?? files.length,
      ghostOwners:
        overrides.ghostOwners ??
        new Set(files.map((f) => f.dominantAuthor)).size,
      ghostLoc: overrides.ghostLoc ?? files.reduce((s, f) => s + f.loc, 0),
      tierMix: overrides.tierMix ?? { trueGhost: 0, fading: 0 },
      summary: '',
    },
    contributors: {
      contributors: overrides.contributors ?? [],
    },
  } as unknown as GitrelicReport;
}

describe('GhostFilesTab', () => {
  it('renders the ghost-owner count as the big number', () => {
    const onApplyPreset = vi.fn();
    render(
      <GhostFilesTab
        report={makeReport({
          files: [
            makeFile('a.ts', 'g1@x.com', 200),
            makeFile('b.ts', 'g2@x.com', 200),
          ],
          contributors: [makeContrib('g1@x.com', 'G1'), makeContrib('g2@x.com', 'G2')],
        })}
        onApplyPreset={onApplyPreset}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number')).toHaveTextContent(
      '2',
    );
  });

  it('renders Healthy tier badge at 0 owners', () => {
    render(
      <GhostFilesTab
        report={makeReport({ ghostOwners: 0 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });

  it('renders Moderate tier badge at 1..2 owners', () => {
    render(
      <GhostFilesTab
        report={makeReport({ ghostOwners: 2 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Moderate')).toBeInTheDocument();
  });

  it('renders High Risk tier badge at 3+ owners', () => {
    render(
      <GhostFilesTab
        report={makeReport({ ghostOwners: 3 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('High Risk')).toBeInTheDocument();
  });

  it('renders top-3 ghost owner display names (not emails)', () => {
    render(
      <GhostFilesTab
        report={makeReport({
          files: [
            makeFile('a.ts', 'sebastian@calyptus.eu', 200),
            makeFile('b.ts', 'sebastian@calyptus.eu', 200),
            makeFile('c.ts', 'jkassens@meta.com', 200),
          ],
          contributors: [
            makeContrib('sebastian@calyptus.eu', 'Sebastian Markbåge'),
            makeContrib('jkassens@meta.com', 'Jan Kassens'),
          ],
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/Sebastian Markbåge/)).toBeInTheDocument();
    expect(screen.getByText(/Jan Kassens/)).toBeInTheDocument();
    expect(screen.queryByText('sebastian@calyptus.eu')).not.toBeInTheDocument();
  });

  it('renders subline with ghost-files / tier-mix / ghost-LOC counts', () => {
    render(
      <GhostFilesTab
        report={makeReport({
          totalGhostFiles: 25,
          tierMix: { trueGhost: 2, fading: 23 },
          ghostLoc: 4_500,
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/25/)).toBeInTheDocument();
    expect(screen.getByText(/true ghost/)).toBeInTheDocument();
    expect(screen.getByText(/fading/)).toBeInTheDocument();
    expect(screen.getByText(/dormant/)).toBeInTheDocument();
  });

  it('fires onApplyPreset with bus-factor when first see-also link clicks', () => {
    const onApplyPreset = vi.fn();
    render(
      <GhostFilesTab
        report={makeReport({ ghostOwners: 0 })}
        onApplyPreset={onApplyPreset}
      />,
    );
    fireEvent.click(screen.getByText('Bus Factor'));
    expect(onApplyPreset).toHaveBeenCalledWith('bus-factor');
  });

  it('fires onApplyPreset with knowledge-silos when second see-also link clicks', () => {
    const onApplyPreset = vi.fn();
    render(
      <GhostFilesTab
        report={makeReport({ ghostOwners: 0 })}
        onApplyPreset={onApplyPreset}
      />,
    );
    fireEvent.click(screen.getByText('Knowledge Silos'));
    expect(onApplyPreset).toHaveBeenCalledWith('knowledge-silos');
  });

  it('renders directory rollup in extras slot when files exist', () => {
    render(
      <GhostFilesTab
        report={makeReport({
          files: [
            makeFile('src/auth/login.ts', 'g@x', 200),
            makeFile('src/auth/session.ts', 'g@x', 200),
            makeFile('docs/api.md', 'g@x', 200),
          ],
          contributors: [makeContrib('g@x', 'Ghost')],
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/Where they live/i)).toBeInTheDocument();
    expect(screen.getByText('src/auth')).toBeInTheDocument();
    expect(screen.getByText('docs')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.3: Run tab test; verify it fails**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test -- GhostFilesTab
```

Expected: test fails because the existing tab component still renders the SortableTable (no `narrative-kpi-big-number` testid, no see-also footer).

- [ ] **Step 6.4: Rewrite `GhostFilesTab.tsx`**

Replace the entire content of `apps/web/src/components/tabs/GhostFilesTab.tsx`:

```tsx
import { topGhostOwners, type TopGhostOwner } from '../../utils/ghostOwners';
import {
  aggregateGhostFilesByDirectory,
  type GhostDirectoryRow,
} from '../../utils/ghostFilesByDirectory';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import { fmt } from '../theme';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface GhostFilesTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const TOP_OWNERS_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;

function ghostOwnerTier(count: number): {
  variant: BadgeVariant;
  label: string;
} {
  if (count === 0) return { variant: 'healthy', label: 'Healthy' };
  if (count <= 2) return { variant: 'warning', label: 'Moderate' };
  return { variant: 'critical', label: 'High Risk' };
}

function TopGhostOwnersList({ owners }: { owners: TopGhostOwner[] }) {
  if (owners.length === 0) {
    return <>No ghost owners — every dominant author is still active.</>;
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
        Top ghost owners
      </div>
      {owners.map((o) => (
        <div key={o.email} className="leading-[1.5]">
          <span className="text-text-primary font-semibold">{o.name}</span>{' '}
          <span className="text-text-tertiary">
            <span className="font-mono text-text-primary">{o.fileCount}</span>{' '}
            file{o.fileCount === 1 ? '' : 's'} ·{' '}
            <span className="font-mono text-text-primary">
              {fmt(o.ghostLoc)}
            </span>{' '}
            LOC
          </span>
        </div>
      ))}
    </div>
  );
}

function GhostDirectoryRollup({ rows }: { rows: GhostDirectoryRow[] }) {
  if (rows.length === 0) return null;
  const maxCount = rows[0].count;
  return (
    <div>
      <div className="text-[9px] text-text-tertiary uppercase tracking-[1px] mb-2">
        Where they live
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((row) => (
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
                style={{ width: `${(row.count / maxCount) * 100}%` }}
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
    </div>
  );
}

export function GhostFilesTab({ report, onApplyPreset }: GhostFilesTabProps) {
  const gf = report.ghostFiles;
  const tier = ghostOwnerTier(gf.ghostOwners);
  const topOwners = topGhostOwners(
    gf.files,
    report.contributors.contributors,
    TOP_OWNERS_COUNT,
  );
  const dirRollup = aggregateGhostFilesByDirectory(gf.files).slice(
    0,
    DIRECTORY_ROLLUP_LIMIT,
  );

  return (
    <NarrativeKPI
      bigNumber={String(gf.ghostOwners)}
      tier={tier}
      metric="GHOST OWNERS"
      finding={<TopGhostOwnersList owners={topOwners} />}
      subline={
        gf.totalGhostFiles > 0 ? (
          <>
            <span className="font-mono text-text-primary font-semibold">
              {gf.totalGhostFiles}
            </span>{' '}
            ghost files —{' '}
            <span className="font-mono">{gf.tierMix.trueGhost}</span> true
            ghost ·{' '}
            <span className="font-mono">{gf.tierMix.fading}</span> fading ·{' '}
            <span className="font-mono">{fmt(gf.ghostLoc)}</span> LOC dormant
          </>
        ) : (
          <>0 ghost files — knowledge transfer is intact.</>
        )
      }
      extras={dirRollup.length > 0 ? <GhostDirectoryRollup rows={dirRollup} /> : undefined}
      seeAlso={[
        { label: 'Bus Factor', presetId: 'bus-factor' },
        { label: 'Knowledge Silos', presetId: 'knowledge-silos' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
```

- [ ] **Step 6.5: Wire `onApplyPreset` through `BottomPanel.tsx`**

First confirm the current `GhostFilesTab` mount shape:

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
grep -n "GhostFilesTab" apps/web/src/components/layout/BottomPanel.tsx
```

Open `apps/web/src/components/layout/BottomPanel.tsx`. Find the case that mounts `GhostFilesTab` and update it to pass `onApplyPreset`. Mirror how `KnowledgeSilosTab` / `ChurnTab` / `BlastRadiusTab` receive it.

If the existing `GhostFilesTab` invocation is `<GhostFilesTab report={report} onSelectFile={onSelectFile} />`, change to `<GhostFilesTab report={report} onApplyPreset={onApplyPreset} />`. The `onSelectFile` callback is no longer needed because the new tab doesn't render a clickable file list.

If `BottomPanel.tsx` doesn't yet receive `onApplyPreset` as a prop, propagate it: add to its `BottomPanelProps`, update its callsite in `Shell.tsx` to pass through, and ensure the `Shell` already exposes it (it does, since other tabs already use it).

- [ ] **Step 6.6: Run tab test; verify pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test -- GhostFilesTab
```

Expected: all 9 tab tests pass.

- [ ] **Step 6.7: Run full web suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test
```

Expected: all green.

- [ ] **Step 6.8: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
git add apps/web/src/components/tabs/GhostFilesTab.tsx \
        apps/web/src/components/tabs/GhostFilesTab.test.tsx \
        apps/web/src/components/layout/BottomPanel.tsx \
        apps/web/src/utils/normalizeReport.ts
git commit -m "feat(web): rewrite GhostFilesTab as people-first NarrativeKPI panel (RELIC-318)"
```

---

## Task 7: Docs page

**Files:**
- Create: `apps/docs/analyzers/ghost-files.md`
- Modify: `apps/docs/.vitepress/config.ts` — sidebar entry + ignoreDeadLinks cleanup

- [ ] **Step 7.1: Author the docs page**

Create `apps/docs/analyzers/ghost-files.md` following the structure of `apps/docs/analyzers/parallel-dev.md` and `apps/docs/analyzers/contributors.md`. Skeleton (fill prose to match those existing pages):

```md
---
title: Ghost Files
description: Files where the dominant author has gone silent — concrete knowledge-loss risk, not theoretical bus factor.
---

# Ghost Files

Ghost Files surfaces the **materialized knowledge-loss risk** in your repo: files where one author wrote essentially the whole thing AND that author has gone silent. Unlike Bus Factor (which models *theoretical* collapse risk regardless of activity), Ghost Files only flags risk that has *already* happened — you just haven't paid the bill yet.

The story it tells: *"knowledge has left even though work continues."*

::: tip Screenshot
TODO: drop screenshot of the polished Ghost Files tab here.
:::

## Quick read

- **Metrics strip (5 slots):** Ghost Files · Ghost Owners · True Ghosts (≥365d) · Fading (180–364d) · Ghost LOC.
- **Hero (sunburst):** Inner ring = ghost author identity. Outer ring = files owned by that author, sized by LOC, color-coded by inactivity tier.
- **Bottom-panel KPI:** Big number is **distinct ghost owners** (the people whose knowledge is at risk). Top-3 finding lists the highest-impact ghost owners. "Where they live" extras shows directory rollup.
- **Inspector:** Click any file in the sunburst to see per-file detail (author, last commit date, days inactive, LOC).

## How ghost files are detected

Ghost files are at the intersection of two predicates:

\`\`\`mermaid
graph LR
  A[Bus Factor: file] -->|dominantAuthorPercent &ge; 80| B{Concentrated?}
  C[Contributors: dominant author] -->|isGhost = true| D{Owner gone?}
  B -->|yes| E[Ghost File]
  D -->|yes| E
\`\`\`

Both must be true. If either fails, the file is not a ghost.

**Concentration** uses an 80% ownership floor: at 80%+ of commits to a file, the dominant author *wrote* the file. At lower percentages, you still have enough distributed knowledge that someone else can plausibly carry the file forward.

**Owner silence** uses the contributors-analyzer `isGhost` flag, defined as `lastCommit < ghostCutoff` where `ghostCutoff = max(180 days, repoAgeDays * 0.5)`. The window scales with the analysis range — a 6-month window catches more "ghosts" than a 5-year window because the relative cutoff is tighter.

## The metrics strip

| Slot | Source | Severity bands |
|---|---|---|
| **Ghost Files** | total count | 0 healthy · 1–9 warning · 10+ critical |
| **Ghost Owners** | distinct dominant authors | 0 healthy · 1–2 warning · 3+ critical |
| **True Ghosts (≥365d)** | files with author silent over a year | 0 healthy · 1+ critical |
| **Fading (180–364d)** | files with author silent 6mo–1yr | 0 healthy · 1–9 warning · 10+ critical |
| **Ghost LOC** | total LOC across ghost files | <2% / 2–9% / 10%+ of repo total |

## Reading the surfaces

1. **Metrics strip** for the high-level health snapshot.
2. **Sunburst hero** for the directory-and-author view — slice by author cluster to see whose code is orphaned where.
3. **Narrative-KPI panel** for the actionable summary — top-3 ghost owners by impact and where their files cluster.
4. **Inspector** for per-file detail — click any file in the sunburst.

## What action it suggests

- **High ghost-owner count** → triage by author cluster (sunburst slice). Each ghost owner is a knowledge-transfer initiative.
- **High true-ghost count** → urgent code archaeology; the original authors have been silent over a year.
- **High ghost LOC %** → consider a formal knowledge-transfer push; the dormant code is a meaningful share of the codebase.

## The triangle: Ghost Files vs Bus Factor vs Knowledge Silos

| Analyzer | Concentration check | Activity check | Tells you |
|---|---|---|---|
| Knowledge Silos | yes (any concentration) | no | "concentration shape" |
| Bus Factor | yes (per file) | no | "potential collapse risk" |
| Ghost Files | yes (≥80%) | yes (`isGhost`) | "materialized knowledge gap" |

Ghost Files is the materialization of risk that the other two model abstractly.

## Ghost Files vs Stale Files

These analyzers operate on **disjoint file sets** — they cannot overlap.

- **Stale Files** flags files with **zero commits** in the analysis window (file is abandoned in code).
- **Ghost Files** flags files whose **dominant owner is silent**, regardless of whether *others* are still touching the file (file is abandoned in *knowledge*).

The most pernicious ghost files are exactly the ones that *aren't* stale — they look healthy on the surface (commits keep flowing from peripheral contributors), but the substance has rotted because the deep knowledge left.

## Limitations

- **Heuristic activity cutoff.** People on long leave look identical to people who left.
- **80% ownership may miss meaningfully-distributed files** where two or three authors share equal knowledge of a now-orphaned area.
- **Sliding window scales the cutoff.** A 6-month `--since` flag catches more "ghosts" than a 5-year analysis.
- **Renames are not followed.** A file moved post-departure shows as a fresh file with no ghost owner.
- **Bot accounts can show as ghosts** when CI/release bots roll over to new identities.

## Related analyzers

- [Bus Factor](./bus-factor.md) — theoretical concentration risk
- [Knowledge Silos](./knowledge-silos.md) — concentration shape
- [Contributors](./contributors.md) — who's active, who's gone
- [Cursed Files](./cursed-files.md) — multi-dimensional risk scoring (consumes ghost-files signal)
```

- [ ] **Step 7.2: Add the Analyzers sidebar entry**

Edit `apps/docs/.vitepress/config.ts`. Find the Analyzers sidebar block and add:

```ts
{ text: 'Ghost Files', link: '/analyzers/ghost-files' },
```

Position alphabetically — between `Contributors` and the next entry alphabetically (likely `Knowledge Silos` or `Languages`).

- [ ] **Step 7.3: Remove `/analyzers/ghost-files` from `ignoreDeadLinks` if present**

Search the same `config.ts` for `ignoreDeadLinks` and remove `/analyzers/ghost-files` from the array if it's listed there. (Recently shipped polish PRs follow this pattern — the entry exists to suppress the dead-link error pre-page-creation.)

- [ ] **Step 7.4: Build the docs site to verify**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm docs:build
```

Expected: clean build, no dead-link errors, no missing-frontmatter errors. If any links from `ghost-files.md` to other analyzer pages 404, leave them unresolved (e.g. `./knowledge-silos.md` won't resolve until KS gets its docs page) — those are expected and `ignoreDeadLinks` should cover them. If new dead-link errors fire, add them to `ignoreDeadLinks` only as a last resort.

- [ ] **Step 7.5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
git add apps/docs/analyzers/ghost-files.md \
        apps/docs/.vitepress/config.ts
git commit -m "docs: ghost files analyzer page (RELIC-318)"
```

---

## Task 8: Registry update — drop alts, set caption, set docsPath

**Files:**
- Modify: `apps/web/src/presets/registry.ts` — `ghost-files` entry

**Gating:** Task 7 must be complete first. `registry.test.ts` fails CI if `docsPath` is set without a corresponding docs file on disk.

- [ ] **Step 8.1: Update the `ghost-files` preset entry**

Edit `apps/web/src/presets/registry.ts`. Find the `'ghost-files'` entry (around line 347) and replace with:

```ts
'ghost-files': {
  id: 'ghost-files',
  tier: 'analyzer',
  label: 'Ghost Files',
  group: 'ownership-risk',
  hero: {
    defaultViz: 'ownership-sunburst-ghosts',
    altTabs: ['ownership-sunburst-ghosts'],
  },
  bottomPanel: {
    defaultTab: 'ghost-files',
    altTabs: ['ghost-files'],
  },
  metrics: ghostFilesMetrics,
  docsPath: 'analyzers/ghost-files',
},
```

Three changes vs. the existing entry: `altTabs` collapses from 3 entries to 1, and `docsPath` is added.

- [ ] **Step 8.2: Wire the Ghost Files caption to the sunburst**

Find where the `'ownership-sunburst-ghosts'` viz id is wired to the `OwnershipSunburst` component. (Likely in `apps/web/src/components/layout/Shell.tsx` or similar — search: `grep -rn "ownership-sunburst-ghosts" apps/web/src`.) When mounting in ghost-files context, pass:

```tsx
<OwnershipSunburst
  report={report}
  selectedFile={selectedFile}
  selectedContributor={selectedContributor}
  onSelectFile={onSelectFile}
  onSelectContributor={onSelectContributor}
  mode="ghost"
  caption="inner ring = ghost author · outer ring = orphaned files (size = LOC, color = inactivity tier) · click to drill in"
/>
```

For other consumers (`'ownership-sunburst'` mode='all', `'ownership-sunburst-silos'` for Knowledge Silos — confirm exact viz id with `grep -n "ownership-sunburst" apps/web/src/components/layout/Shell.tsx`), supply a sensible default caption per consumer. Don't leave `caption` undefined for KS in this PR — give it a placeholder caption like `"inner ring = author · outer ring = silo'd files (size = LOC, color = risk tier) · click to drill in"`. Knowledge Silos can refine its caption text in its own polish ticket.

- [ ] **Step 8.3: Run registry test (DoD enforcement)**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test -- registry
```

Expected: passes — the docs file exists from Task 7, so the DoD assertion is satisfied.

- [ ] **Step 8.4: Run full web suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm --filter @gitrelic/web test
```

Expected: all green.

- [ ] **Step 8.5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
git add apps/web/src/presets/registry.ts apps/web/src/components/layout/Shell.tsx
# (and any other files touched in step 8.2)
git commit -m "feat(web): drop redundant ghost-files altTabs, wire caption + docsPath (RELIC-318)"
```

Verify `git status` is clean.

---

## Task 9: Lint, format, full-stack rebuild + final smoke

**Files:** none (verification only).

- [ ] **Step 9.1: Lint and format**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm lint
pnpm format
git diff --stat  # review any oxfmt-applied changes
```

Expected: clean lint; oxfmt may apply trivial formatting changes — review with `git diff` and commit as a `chore: format` if any.

If oxfmt applies changes:

```bash
git add -A
git commit -m "chore: oxfmt apply (RELIC-318)"
```

- [ ] **Step 9.2: Full-repo build**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm build
```

Expected: clean build across core, cli, web. The CLI smoke import won't change — core bundle just ships smaller ghost-files set + new aggregates.

- [ ] **Step 9.3: Full test suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
pnpm test
```

Expected: 231 core + 29 web tests + new tests added in this plan = all green.

- [ ] **Step 9.4: Run a fresh report against React, smoke the dashboard**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

In the browser, navigate to **Ghost Files** in the sidebar. Verify:

- [ ] **Metrics strip:** 5 slots in order — Ghost Files · Ghost Owners · True Ghosts (≥365d) · Fading (180–364d) · Ghost LOC. No `Max Inactive Days`. The Ghost Files count is small (~tens, not 562 — confirms the formula fix).
- [ ] **Hero (sunburst):** Single hero, no alt tabs at the top. Ghost sunburst renders. Hover an inner-ring author segment — tooltip shows full display name (e.g. `Sebastian Markbåge`) NOT email-prefix (`sebastian`). Bottom-right legend shows up to 6 entries with display names.
- [ ] **Caption strip:** Below the sunburst, `<HeroCaption>` shows: *"inner ring = ghost author · outer ring = orphaned files (size = LOC, color = inactivity tier) · click to drill in"*.
- [ ] **Bottom panel:** Narrative-KPI shape — left side "X GHOST OWNERS" big number + tier badge (Healthy / Moderate / High Risk) + `GHOST OWNERS` label. Right side "Top ghost owners" list with full display names + N files + K LOC. Subline shows total ghost files + tier mix + ghost LOC. Extras slot shows "Where they live" directory rollup with proportional bars.
- [ ] **Sticky see-also footer:** "See also: Bus Factor · Knowledge Silos". Click each to confirm preset switches.
- [ ] **Docs link:** Right-anchored `Docs ↗` link in the bottom-panel tab bar. Click → opens the deployed Ghost Files docs page (or local docs site if running `pnpm docs:dev`).
- [ ] **Cross-analyzer alignment:** Navigate to **Contributors**. The swimlane that previously labeled `nathanmarks` (or any 90–180d author) as "ghost" should NO LONGER show that label — those authors are now in the intermediate zone. Authors who ARE truly `isGhost` (>180d-silent) still get the label. Same author identity in both surfaces now agrees.

- [ ] **Step 9.5: If any smoke step fails, debug and patch**

Most-likely failure modes and fixes:
- **Display names not rendering** → check that `nameByEmail` Map is built from `report.contributors.contributors` not a stale slice; that `displayName()` uses the Map; that the legend uses `displayName()` not the old `email.split('@')[0]`.
- **Caption strip missing** → confirm `caption` prop wired in Shell/BottomPanel for `ownership-sunburst-ghosts` mode. Confirm `<HeroCaption>` is imported in `OwnershipSunburst.tsx`.
- **Docs ↗ link missing** → confirm `docsPath` set on registry entry AND the docs file exists on disk.
- **See-also fires the wrong preset** → check the `seeAlso` tuple order in `GhostFilesTab.tsx`.
- **Subline numbers off** → check `report.ghostFiles.tierMix.trueGhost + .fading === totalGhostFiles` invariant; if violated, the analyzer's `tierMix` computation has a boundary bug (re-check the 180/365 day filters).

Commit any patches as their own focused commits referencing the failed smoke step.

---

## Task 10: Open the PR

- [ ] **Step 10.1: Push branch**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
git push -u origin relic-318-polish-ghost-files
```

- [ ] **Step 10.2: Open PR via gh CLI**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-318-polish-ghost-files
gh pr create --title "feat(web): ghost files analyzer polish (RELIC-318)" --body "$(cat <<'EOF'
## Summary

Polish the Ghost Files analyzer per [the spec](https://github.com/nebulord-dev/gitrelic/blob/main/docs/superpowers/specs/2026-05-03-ghost-files-polish-design.md):

- **Backend formula fix:** gate on `isGhost` (>180d, scaled) instead of `!isActive` (>90d) and bump the ownership threshold from 70% to 80%. The analyzer now correctly tells the "materialized knowledge-loss risk" story it claims; on React the ghost-files set drops from 562 (broken) to ~80 (honest).
- **Hero slate:** single-hero (`OwnershipSunburst mode='ghost'`); drop `ownership-sunburst` (mode='all', a worse Knowledge Silos) and `ownership` (OwnershipBubble — exact dupe of the Contributors hero).
- **Bottom panel:** replace the SortableTable with a people-first narrative-KPI headlined by distinct ghost-owner count, top-3 ghost owners, tier mix, ghost LOC, and a "where they live" directory rollup.
- **Metrics strip retune:** 5 health-tiered slots (Ghost Files · Ghost Owners · True Ghosts ≥365d · Fading 180–364d · Ghost LOC); drop the `Max Inactive Days` trivia slot.
- **Display-name presentation:** `OwnershipSunburst` (shared with Knowledge Silos) labels render full `First Last` from contributor records, fall back to email when missing.
- **Docs:** new `apps/docs/analyzers/ghost-files.md` page; registry `docsPath` wired so the `Docs ↗` link renders in the tab bar.
- **Cross-analyzer alignment:** `ContributorSwimlanes` ghost-row label silently corrects post-fix — both surfaces now use the same `isGhost` definition.

## Test plan

- [ ] `pnpm test` (231 core + 29 web baseline plus new tests)
- [ ] `pnpm build` and `pnpm docs:build` clean
- [ ] Smoke against React: 5-slot KPI strip, single sunburst with display-name labels and caption, narrative-KPI panel with top-3 ghost owners, sticky see-also fires Bus Factor / Knowledge Silos, `Docs ↗` link renders right-anchored in tab bar.
- [ ] Contributors swimlanes — confirm 90–180d authors no longer carry "ghost" label.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 10.3: Update Linear**

Move RELIC-318 to In Review. Drop the PR URL into the ticket.

---

## Cleanup (after PR merges)

- [ ] **Remove worktree**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic
git worktree remove .worktrees/relic-318-polish-ghost-files
git branch -D relic-318-polish-ghost-files
```

- [ ] **Update `docs/polish-pattern.md`** — move Ghost Files entry from "Pending (Batches 2–N)" to a "Mapped" / "Shipped" section. (Optionally bundled into the polish-pattern doc's living-doc maintenance, not necessarily this PR.)
