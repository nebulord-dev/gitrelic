# Contributors Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the GitRelic web dashboard's Contributors analyzer per the approved spec — flip default hero to Swimlanes, drop Sunburst, retune metrics strip with team-health KPIs, polish the bottom-panel SortableTable, and ship the analyzer's docs page.

**Architecture:** Two backend aggregates (`top3CommitShare`, `newcomers90d`) flow from `analyzeContributors` through the metrics composer to a 4-slot strip. The web layer flips the registry hero scope, replaces the existing tab JSX with a polished 6-column table + sticky see-also footer, and adds a HeroCaption strip to both heroes. Display-name presentation (`Sebastian Markbåge` not `sebastian@calyptus.eu`) lands in the table, swimlanes lane labels (already correct via `contrib.name`), and bubble bubble labels (new — currently shows email).

**Tech Stack:** TypeScript, pnpm workspaces + Turbo, Vite + React 19 + Tailwind v4 (web), tsdown (core), Vitest, oxlint + oxfmt. D3 in heroes. SortableTable shared component. NarrativeKPI **not** used (this analyzer keeps a pure table).

**Spec:** [`docs/superpowers/specs/2026-05-03-contributors-polish-design.md`](../specs/2026-05-03-contributors-polish-design.md)

**Linear:** [RELIC-306](https://linear.app/nebulord/issue/RELIC-306)

**Worktree note:** Memory tag `feedback_subagent_cwd_discipline.md` — when executing this plan via `subagent-driven-development`, force every bash command to start with `cd <worktree>` or commits drift to main. Verify via `git status` between steps.

---

## Task 1: Backend aggregates (`top3CommitShare`, `newcomers90d`)

**Files:**
- Modify: `packages/core/src/types.ts` — extend `ContributorReport` interface
- Modify: `packages/core/src/analyzers/contributors.ts` — compute the two aggregates
- Modify: `packages/core/src/analyzers/contributors.test.ts` — add cases for both aggregates
- Modify (auto): `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` — flips when tests run

- [ ] **Step 1.1: Write failing tests for `top3CommitShare`**

Append to `packages/core/src/analyzers/contributors.test.ts` inside the existing `describe('analyzeContributors', () => {…})` block:

```ts
  describe('top3CommitShare', () => {
    it('is 0 on empty commit list', () => {
      const result = analyzeContributors([], 365);
      expect(result.top3CommitShare).toBe(0);
    });

    it('is 100 with a single contributor', () => {
      const commits = Array.from({ length: 5 }, (_, i) =>
        makeCommit({ hash: String(i), date: daysAgo(10 + i), files: ['a.ts'] }),
      );
      const result = analyzeContributors(commits, 365);
      expect(result.top3CommitShare).toBe(100);
    });

    it('is 100 with exactly 3 contributors', () => {
      const commits = [
        makeCommit({ hash: '1', authorEmail: 'a@x', authorName: 'A', date: daysAgo(5), files: ['a.ts'] }),
        makeCommit({ hash: '2', authorEmail: 'b@x', authorName: 'B', date: daysAgo(4), files: ['b.ts'] }),
        makeCommit({ hash: '3', authorEmail: 'c@x', authorName: 'C', date: daysAgo(3), files: ['c.ts'] }),
      ];
      const result = analyzeContributors(commits, 365);
      expect(result.top3CommitShare).toBe(100);
    });

    it('computes share as percent of total commits when 4+ contributors', () => {
      // 4 contributors: A=5, B=3, C=2, D=2 → top3=10/12=83.33%
      const commits = [
        ...Array.from({ length: 5 }, (_, i) =>
          makeCommit({ hash: `a${i}`, authorEmail: 'a@x', authorName: 'A', date: daysAgo(20 - i), files: ['a.ts'] }),
        ),
        ...Array.from({ length: 3 }, (_, i) =>
          makeCommit({ hash: `b${i}`, authorEmail: 'b@x', authorName: 'B', date: daysAgo(15 - i), files: ['b.ts'] }),
        ),
        ...Array.from({ length: 2 }, (_, i) =>
          makeCommit({ hash: `c${i}`, authorEmail: 'c@x', authorName: 'C', date: daysAgo(10 - i), files: ['c.ts'] }),
        ),
        ...Array.from({ length: 2 }, (_, i) =>
          makeCommit({ hash: `d${i}`, authorEmail: 'd@x', authorName: 'D', date: daysAgo(5 - i), files: ['d.ts'] }),
        ),
      ];
      const result = analyzeContributors(commits, 365);
      expect(result.top3CommitShare).toBeCloseTo((10 / 12) * 100, 5);
    });
  });
```

- [ ] **Step 1.2: Write failing tests for `newcomers90d`**

Append to the same `describe` block:

```ts
  describe('newcomers90d', () => {
    it('is 0 on empty commit list', () => {
      const result = analyzeContributors([], 365);
      expect(result.newcomers90d).toBe(0);
    });

    it('counts a contributor whose first commit is 89 days ago', () => {
      const commits = [makeCommit({ hash: '1', date: daysAgo(89), files: ['a.ts'] })];
      const result = analyzeContributors(commits, 365);
      expect(result.newcomers90d).toBe(1);
    });

    it('counts a contributor whose first commit is exactly 90 days ago', () => {
      const commits = [makeCommit({ hash: '1', date: daysAgo(90), files: ['a.ts'] })];
      const result = analyzeContributors(commits, 365);
      expect(result.newcomers90d).toBe(1);
    });

    it('does not count a contributor whose first commit is 91 days ago', () => {
      const commits = [makeCommit({ hash: '1', date: daysAgo(91), files: ['a.ts'] })];
      const result = analyzeContributors(commits, 365);
      expect(result.newcomers90d).toBe(0);
    });

    it('uses firstCommit, not lastCommit', () => {
      // Author started 200 days ago, last commit 10 days ago → not a newcomer
      const commits = [
        makeCommit({ hash: '1', date: daysAgo(200), files: ['a.ts'] }),
        makeCommit({ hash: '2', date: daysAgo(10), files: ['a.ts'] }),
      ];
      const result = analyzeContributors(commits, 365);
      expect(result.newcomers90d).toBe(0);
    });
  });
```

- [ ] **Step 1.3: Run the new tests; verify they fail**

Run:
```bash
pnpm --filter @gitrelic/core test -- contributors.test.ts
```
Expected: failures inside the two new `describe` blocks ("Property 'top3CommitShare' does not exist on type 'ContributorReport'" or runtime `undefined`).

- [ ] **Step 1.4: Extend `ContributorReport` in `types.ts`**

Edit `packages/core/src/types.ts`:

```ts
export interface ContributorReport {
  contributors: Contributor[];
  activeContributors: Contributor[];
  ghostContributors: Contributor[];
  topContributor: Contributor;
  summary: string;
  top3CommitShare: number; // % (0-100), top-3 commit-count concentration
  newcomers90d: number; // count of contributors whose firstCommit is ≤ 90d ago
}
```

- [ ] **Step 1.5: Compute the aggregates in `analyzers/contributors.ts`**

Edit `packages/core/src/analyzers/contributors.ts`. After the `contributors` array is built and sorted, before the `return`, add:

```ts
  const totalCommits = contributors.reduce((sum, c) => sum + c.commitCount, 0);
  const top3Sum = contributors
    .slice(0, 3)
    .reduce((sum, c) => sum + c.commitCount, 0);
  const top3CommitShare =
    totalCommits === 0 ? 0 : (top3Sum / totalCommits) * 100;

  const newcomerCutoff = now - 90 * 86_400_000;
  const newcomers90d = contributors.filter(
    (c) => new Date(c.firstCommit).getTime() >= newcomerCutoff,
  ).length;
```

Then add both fields to the return object:

```ts
  return {
    contributors,
    activeContributors,
    ghostContributors,
    topContributor,
    summary,
    top3CommitShare,
    newcomers90d,
  };
```

- [ ] **Step 1.6: Run tests, verify pass**

Run:
```bash
pnpm --filter @gitrelic/core test -- contributors.test.ts
```
Expected: all `analyzeContributors` tests pass (existing + 9 new).

- [ ] **Step 1.7: Regenerate the fixture-regression snapshot**

Run:
```bash
pnpm --filter @gitrelic/core test -u -- fixture-regression
```
Expected: snapshot updates with two new fields (`top3CommitShare`, `newcomers90d`) on the contributors slice. No existing values change.

Inspect the diff:
```bash
git diff packages/core/src/__snapshots__/fixture-regression.test.ts.snap
```
Expected: pure addition of `"top3CommitShare": <number>` and `"newcomers90d": <number>` lines. If anything else changes, stop and investigate.

- [ ] **Step 1.8: Run full core suite to confirm no other breakage**

Run:
```bash
pnpm --filter @gitrelic/core test
```
Expected: all green.

- [ ] **Step 1.9: Commit**

```bash
git add packages/core/src/types.ts \
        packages/core/src/analyzers/contributors.ts \
        packages/core/src/analyzers/contributors.test.ts \
        packages/core/src/__snapshots__/fixture-regression.test.ts.snap
git commit -m "feat(core): add top3CommitShare + newcomers90d aggregates to ContributorReport (RELIC-306)"
```

---

## Task 2: Frontend metrics composer rewrite

**Files:**
- Modify: `apps/web/src/presets/metrics/contributors.ts` — rewrite the 4-slot composer
- Create: `apps/web/src/presets/metrics/contributors.test.ts` — new composer test
- Modify: `apps/web/src/presets/registry.test.ts` — extend the mock report fixture with the contributors slice (currently absent)

- [ ] **Step 2.1: Write failing composer tests**

Create `apps/web/src/presets/metrics/contributors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { contributorsMetrics } from './contributors';
import type {
  Contributor,
  ContributorReport,
  GitrelicReport,
} from '@gitrelic/core';

function makeContributor(overrides: Partial<Contributor> = {}): Contributor {
  return {
    email: 'a@x',
    name: 'A',
    commitCount: 1,
    firstCommit: '2025-01-01T00:00:00Z',
    lastCommit: '2025-01-01T00:00:00Z',
    filesOwned: 0,
    linesChanged: 0,
    activeDays: 1,
    focusAreas: [],
    isActive: true,
    ...overrides,
  };
}

function makeReport(
  contributors: Partial<ContributorReport> = {},
): GitrelicReport {
  return {
    contributors: {
      contributors: contributors.contributors ?? [],
      activeContributors: contributors.activeContributors ?? [],
      ghostContributors: contributors.ghostContributors ?? [],
      topContributor: contributors.topContributor ?? makeContributor(),
      summary: '',
      top3CommitShare: contributors.top3CommitShare ?? 0,
      newcomers90d: contributors.newcomers90d ?? 0,
    },
  } as unknown as GitrelicReport;
}

describe('contributorsMetrics', () => {
  it('returns exactly 4 slots in the canonical order', () => {
    const m = contributorsMetrics(makeReport());
    expect(m).toHaveLength(4);
    expect(m.map((s) => s.label)).toEqual([
      'Active Contributors',
      'Top-3 Share',
      'Ghost Authors',
      'Newcomers (90d)',
    ]);
  });

  describe('slot 1 — Active Contributors', () => {
    it('is critical at 1 active', () => {
      const m = contributorsMetrics(
        makeReport({ activeContributors: [makeContributor()] }),
      );
      expect(m[0].value).toBe('1');
      expect(m[0].color).toBe('var(--severity-critical)');
    });

    it('is warning at 2..5 active', () => {
      const five = Array.from({ length: 5 }, (_, i) =>
        makeContributor({ email: `a${i}@x` }),
      );
      const m = contributorsMetrics(makeReport({ activeContributors: five }));
      expect(m[0].value).toBe('5');
      expect(m[0].color).toBe('var(--severity-warning)');
    });

    it('is healthy at 6+ active', () => {
      const six = Array.from({ length: 6 }, (_, i) =>
        makeContributor({ email: `a${i}@x` }),
      );
      const m = contributorsMetrics(makeReport({ activeContributors: six }));
      expect(m[0].color).toBe('var(--severity-healthy)');
    });
  });

  describe('slot 2 — Top-3 Share', () => {
    it('renders the percent with no decimal', () => {
      const m = contributorsMetrics(makeReport({ top3CommitShare: 65.7 }));
      expect(m[1].value).toBe('66%');
    });

    it('is healthy below 40%', () => {
      const m = contributorsMetrics(makeReport({ top3CommitShare: 39.9 }));
      expect(m[1].color).toBe('var(--severity-healthy)');
    });

    it('is warning between 40% and 69%', () => {
      const m = contributorsMetrics(makeReport({ top3CommitShare: 60 }));
      expect(m[1].color).toBe('var(--severity-warning)');
    });

    it('is critical at 70%+', () => {
      const m = contributorsMetrics(makeReport({ top3CommitShare: 70 }));
      expect(m[1].color).toBe('var(--severity-critical)');
    });
  });

  describe('slot 3 — Ghost Authors', () => {
    it('is healthy at 0 ghosts', () => {
      const m = contributorsMetrics(makeReport());
      expect(m[2].value).toBe('0');
      expect(m[2].color).toBe('var(--severity-healthy)');
    });

    it('is warning when ghost ratio < 30%', () => {
      // 2 ghosts out of 10 contributors = 20% ratio
      const all = Array.from({ length: 10 }, (_, i) =>
        makeContributor({ email: `a${i}@x` }),
      );
      const ghosts = all.slice(0, 2);
      const m = contributorsMetrics(
        makeReport({ contributors: all, ghostContributors: ghosts }),
      );
      expect(m[2].value).toBe('2');
      expect(m[2].color).toBe('var(--severity-warning)');
    });

    it('is critical when ghost ratio >= 30%', () => {
      // 3 ghosts out of 10 = 30% ratio
      const all = Array.from({ length: 10 }, (_, i) =>
        makeContributor({ email: `a${i}@x` }),
      );
      const ghosts = all.slice(0, 3);
      const m = contributorsMetrics(
        makeReport({ contributors: all, ghostContributors: ghosts }),
      );
      expect(m[2].color).toBe('var(--severity-critical)');
    });
  });

  describe('slot 4 — Newcomers (90d)', () => {
    it('is stale (neutral) at 0 newcomers', () => {
      const m = contributorsMetrics(makeReport());
      expect(m[3].value).toBe('0');
      expect(m[3].color).toBe('var(--text-tertiary)');
    });

    it('is healthy with 1+ newcomers', () => {
      const m = contributorsMetrics(makeReport({ newcomers90d: 3 }));
      expect(m[3].value).toBe('3');
      expect(m[3].color).toBe('var(--severity-healthy)');
    });
  });

  it('does not render the deprecated "Total Commits" label', () => {
    const m = contributorsMetrics(makeReport());
    expect(m.find((s) => s.label === 'Total Commits')).toBeUndefined();
  });
});
```

- [ ] **Step 2.2: Run tests; verify they fail**

Run:
```bash
pnpm --filter @gitrelic/web test -- contributors.test.ts
```
Expected: every assertion fails because the current composer returns 3 different slots.

- [ ] **Step 2.3: Rewrite the metrics composer**

Replace `apps/web/src/presets/metrics/contributors.ts` entirely:

```ts
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

export function contributorsMetrics(report: GitrelicReport): Metric[] {
  const { activeContributors, ghostContributors, contributors, top3CommitShare, newcomers90d } =
    report.contributors;

  // Slot 1 — Active Contributors (1 critical / 2-5 warning / 6+ healthy)
  const activeCount = activeContributors.length;
  const activeColor =
    activeCount <= 1
      ? 'var(--severity-critical)'
      : activeCount <= 5
        ? 'var(--severity-warning)'
        : 'var(--severity-healthy)';

  // Slot 2 — Top-3 Share (<40% healthy / 40-69% warning / 70%+ critical)
  const sharePercent = Math.round(top3CommitShare);
  const shareColor =
    top3CommitShare < 40
      ? 'var(--severity-healthy)'
      : top3CommitShare < 70
        ? 'var(--severity-warning)'
        : 'var(--severity-critical)';

  // Slot 3 — Ghost Authors (0 healthy / <30% ratio warning / ≥30% ratio critical)
  const ghostCount = ghostContributors.length;
  const totalCount = contributors.length;
  const ghostRatio = totalCount === 0 ? 0 : ghostCount / totalCount;
  const ghostColor =
    ghostCount === 0
      ? 'var(--severity-healthy)'
      : ghostRatio < 0.3
        ? 'var(--severity-warning)'
        : 'var(--severity-critical)';

  // Slot 4 — Newcomers (90d) (0 neutral via stale token / 1+ healthy)
  const newcomerColor =
    newcomers90d === 0
      ? 'var(--text-tertiary)'
      : 'var(--severity-healthy)';

  return [
    {
      label: 'Active Contributors',
      value: String(activeCount),
      color: activeColor,
    },
    {
      label: 'Top-3 Share',
      value: `${sharePercent}%`,
      color: shareColor,
    },
    {
      label: 'Ghost Authors',
      value: String(ghostCount),
      color: ghostColor,
    },
    {
      label: 'Newcomers (90d)',
      value: String(newcomers90d),
      color: newcomerColor,
    },
  ];
}
```

- [ ] **Step 2.4: Extend the registry test mock with the contributors slice**

Edit `apps/web/src/presets/registry.test.ts`. Inside `makeReport()`'s returned object literal, add (alphabetically positioned next to the other slices):

```ts
    contributors: {
      contributors: [],
      activeContributors: [],
      ghostContributors: [],
      topContributor: {
        email: '',
        name: '',
        commitCount: 0,
        firstCommit: '',
        lastCommit: '',
        filesOwned: 0,
        linesChanged: 0,
        activeDays: 0,
        focusAreas: [],
        isActive: false,
      },
      summary: '',
      top3CommitShare: 0,
      newcomers90d: 0,
    },
```

This satisfies `it.each(DEFINED_PRESETS)('$id: metrics returns 1 to 5 entries')` for the contributors preset now that the composer reads from `report.contributors`.

- [ ] **Step 2.5: Run web tests, verify pass**

Run:
```bash
pnpm --filter @gitrelic/web test -- contributors.test.ts registry.test.ts
```
Expected: both files pass.

- [ ] **Step 2.6: Commit**

```bash
git add apps/web/src/presets/metrics/contributors.ts \
        apps/web/src/presets/metrics/contributors.test.ts \
        apps/web/src/presets/registry.test.ts
git commit -m "feat(web): retune contributors metrics strip with team-health KPIs (RELIC-306)"
```

---

## Task 3: Hero polish — display names + HeroCaption strips

**Files:**
- Modify: `apps/web/src/components/hero/OwnershipBubble.tsx` — look up display name from `report.contributors.contributors`; replace inline footer with `<HeroCaption>`
- Modify: `apps/web/src/components/hero/ContributorSwimlanes.tsx` — add `<HeroCaption>` strip

`ContributorSwimlanes` already labels lanes with `contrib.name` (the display name) — no display-name change needed there.

- [ ] **Step 3.1: Add display-name lookup to `buildDirectoryBubbles`**

Edit `apps/web/src/components/hero/OwnershipBubble.tsx`. Extend `DirBubble`:

```ts
export interface DirBubble {
  name: string;
  dirPath: string;
  totalLoc: number;
  dominantAuthor: string; // email — kept for authorColor() and tooltip
  dominantAuthorName: string; // NEW — display name for label
  dominantPercent: number;
  fileCount: number;
}
```

In `buildDirectoryBubbles`, after computing `dominantAuthor`, build an email→name map from `report.contributors.contributors` and look up `dominantAuthorName`. Falls back to email when the name is empty (preserves current behavior for unattributed authors):

```ts
export function buildDirectoryBubbles(report: GitrelicReport): DirBubble[] {
  // … existing busFactorMap construction …

  // NEW: email → display name lookup. Falls back to email when name is empty.
  const nameByEmail = new Map<string, string>();
  for (const c of report.contributors.contributors) {
    nameByEmail.set(c.email, c.name && c.name.length > 0 ? c.name : c.email);
  }

  // … existing dirStats aggregation …

  // In the bubble construction loop, after determining dominantAuthor:
  bubbles.push({
    name: dirPath,
    dirPath,
    totalLoc: stats.loc,
    dominantAuthor,
    dominantAuthorName:
      dominantAuthor === UNKNOWN_AUTHOR
        ? UNKNOWN_AUTHOR
        : (nameByEmail.get(dominantAuthor) ?? dominantAuthor),
    dominantPercent,
    fileCount: stats.fileCount,
  });
}
```

- [ ] **Step 3.2: Use display name in label rendering**

In the `OwnershipBubble` JSX render block, change the `fittedSub` derivation:

```ts
const fittedSub = isUnknown
  ? fitLabel('no commit data', leaf.r, subFontSize)
  : fitSubLabel(d.dominantAuthorName, d.dominantPercent, leaf.r, subFontSize);
```

(The legend section, which renders `legendAuthors` from `dominantAuthor` directly, can keep the email — it's already small, monospaced, and grouped under an "Authors" header. Updating the legend to display names is a nice-to-have but not required for this polish; if needed, do it inline using the same `nameByEmail` map.)

For the tooltip, swap the email for the display name:

```tsx
<div className="text-text-secondary mt-0.5">
  {tooltip.dir.dominantAuthor === UNKNOWN_AUTHOR
    ? 'No commit data for this directory'
    : `Owner: ${tooltip.dir.dominantAuthorName} (${tooltip.dir.dominantPercent}%)`}
</div>
```

- [ ] **Step 3.3: Replace inline footer with `<HeroCaption>` in OwnershipBubble**

Replace this block:

```tsx
<div className="shrink-0 px-4 py-2.5 border-t border-border-primary bg-surface-primary">
  <div className="text-xs text-text-secondary">
    One bubble per directory (2 levels deep) · size = total LOC · color =
    dominant author · click to drill in
  </div>
</div>
```

with:

```tsx
import { HeroCaption } from '../shared/HeroCaption';
// …
<HeroCaption primary="One bubble per directory (2 levels deep) · size = total LOC · color = dominant author · click to drill in" />
```

(Keep the import at the top of the file alongside the other component imports.)

- [ ] **Step 3.4: Add `<HeroCaption>` to ContributorSwimlanes**

Edit `apps/web/src/components/hero/ContributorSwimlanes.tsx`. The current root is `<div ref={containerRef} className="w-full h-full overflow-auto relative">` — wrap in a flex column so the caption can sit at the bottom:

```tsx
import { HeroCaption } from '../shared/HeroCaption';
// …

return (
  <div className="w-full h-full flex flex-col">
    <div ref={containerRef} className="flex-1 overflow-auto relative">
      {/* existing time axis + lanes JSX, unchanged */}
    </div>
    <HeroCaption primary="x = time · row = author · color intensity = commits per week · ghost rows show inactive cutoff" />
  </div>
);
```

The tooltip's `position: fixed` continues to work because the overflow scroll container only controls inner scroll; the tooltip portals up.

- [ ] **Step 3.5: Visual smoke against React repo**

Memory tag `reference_smoke_target_react.md` — `~/Desktop/react` is the standard hero/dashboard smoke target.

Run:
```bash
pnpm --filter @gitrelic/web build
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

Open the URL the CLI prints. In the sidebar click **Contributors**. Verify:

- Swimlanes is the default (covered in Task 4 — confirm again post-merge)
- Caption strip below Swimlanes reads correctly
- Switch to Bubble alt → caption strip below it; tooltip and labels show display names (`Sebastian Markbåge`, not `sebastian@calyptus.eu`)
- No console errors

(If swimlanes is not yet the default at this point, that's fine — Task 4 flips it. Confirm both heroes render and labels are correct.)

- [ ] **Step 3.6: Commit**

```bash
git add apps/web/src/components/hero/OwnershipBubble.tsx \
        apps/web/src/components/hero/ContributorSwimlanes.tsx
git commit -m "feat(web): hero captions + display-name labeling on contributors heroes (RELIC-306)"
```

---

## Task 4: Registry hero scope flip

**Files:**
- Modify: `apps/web/src/presets/registry.ts` — flip default to swimlanes, drop sunburst from altTabs

Note: `docsPath` is **not** added in this task — it lands in Task 6 with the docs page itself, otherwise `registry.test.ts` will fail (the existing `'every docsPath value resolves to a real docs file'` assertion). Do them together.

- [ ] **Step 4.1: Flip the contributors preset hero scope**

Edit `apps/web/src/presets/registry.ts`. Change the `contributors` block:

```ts
contributors: {
  id: 'contributors',
  tier: 'analyzer',
  label: 'Contributors',
  group: 'team-activity',
  hero: {
    defaultViz: 'swimlanes',              // was 'ownership'
    altTabs: ['swimlanes', 'ownership'],  // was ['ownership', 'swimlanes', 'ownership-sunburst']
  },
  bottomPanel: {
    defaultTab: 'contributors',
    altTabs: ['contributors'],
  },
  metrics: contributorsMetrics,
},
```

- [ ] **Step 4.2: Run web tests**

```bash
pnpm --filter @gitrelic/web test -- registry.test.ts
```
Expected: pass — defaultViz still in altTabs, contract holds.

- [ ] **Step 4.3: Commit**

```bash
git add apps/web/src/presets/registry.ts
git commit -m "feat(web): flip contributors default hero to swimlanes + drop sunburst alt (RELIC-306)"
```

---

## Task 5: Tab rewrite + BottomPanel wiring

**Files:**
- Modify: `apps/web/src/components/tabs/ContributorsTab.tsx` — full rewrite (6 columns + sticky see-also footer)
- Create: `apps/web/src/components/tabs/ContributorsTab.test.tsx`
- Modify: `apps/web/src/components/layout/BottomPanel.tsx` — pass `onApplyPreset` to `<ContributorsTab>`

- [ ] **Step 5.1: Write failing tab tests**

Create `apps/web/src/components/tabs/ContributorsTab.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ContributorsTab } from './ContributorsTab';
import type { Contributor, GitrelicReport } from '@gitrelic/core';

function makeContributor(overrides: Partial<Contributor> = {}): Contributor {
  return {
    email: 'sebastian@calyptus.eu',
    name: 'Sebastian Markbåge',
    commitCount: 334,
    firstCommit: '2024-09-15T00:00:00Z',
    lastCommit: '2026-04-20T00:00:00Z',
    filesOwned: 316,
    linesChanged: 12000,
    activeDays: 180,
    focusAreas: [
      'packages/react-devtools-shared',
      'packages/react-server',
      'packages/react-dom',
    ],
    isActive: true,
    ...overrides,
  };
}

function makeReport(contributors: Contributor[] = []): GitrelicReport {
  return {
    contributors: {
      contributors,
      activeContributors: contributors.filter((c) => c.isActive),
      ghostContributors: contributors.filter((c) => !c.isActive),
      topContributor: contributors[0] ?? makeContributor(),
      summary: '',
      top3CommitShare: 0,
      newcomers90d: 0,
    },
  } as unknown as GitrelicReport;
}

describe('ContributorsTab', () => {
  afterEach(() => cleanup());

  it('renders the 6 column headers', () => {
    render(
      <ContributorsTab
        report={makeReport([makeContributor()])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Contributor')).toBeTruthy();
    expect(screen.getByText('Commits')).toBeTruthy();
    expect(screen.getByText('Files')).toBeTruthy();
    expect(screen.getByText('Lines')).toBeTruthy();
    expect(screen.getByText('Last Active')).toBeTruthy();
    expect(screen.getByText('Focus Areas')).toBeTruthy();
  });

  it('renders the display name as primary text and email lighter below', () => {
    render(
      <ContributorsTab
        report={makeReport([makeContributor()])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('Sebastian Markbåge')).toBeTruthy();
    expect(screen.getByText('sebastian@calyptus.eu')).toBeTruthy();
  });

  it('renders the ghost badge inline with the contributor cell when isActive=false', () => {
    render(
      <ContributorsTab
        report={makeReport([
          makeContributor({
            email: 'gone@x',
            name: 'Gone Author',
            isActive: false,
          }),
        ])}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText('ghost')).toBeTruthy();
  });

  it('renders top-3 focus areas (not top-2)', () => {
    render(
      <ContributorsTab
        report={makeReport([makeContributor()])}
        onApplyPreset={vi.fn()}
      />,
    );
    // All three focus areas should appear in the rendered text
    const focus = screen.getByText(/packages\/react-devtools-shared/);
    expect(focus.textContent).toContain('packages/react-devtools-shared');
    expect(focus.textContent).toContain('packages/react-server');
    expect(focus.textContent).toContain('packages/react-dom');
  });

  it('renders an empty-state message when the contributor list is empty', () => {
    render(<ContributorsTab report={makeReport([])} onApplyPreset={vi.fn()} />);
    expect(screen.getByText(/No contributors found/)).toBeTruthy();
  });

  describe('see-also footer', () => {
    it('routes a Bus Factor click to onApplyPreset', () => {
      const onApplyPreset = vi.fn();
      render(
        <ContributorsTab
          report={makeReport([makeContributor()])}
          onApplyPreset={onApplyPreset}
        />,
      );
      screen.getByText('Bus Factor').click();
      expect(onApplyPreset).toHaveBeenCalledWith('bus-factor');
    });

    it('routes a Ghost Files click to onApplyPreset', () => {
      const onApplyPreset = vi.fn();
      render(
        <ContributorsTab
          report={makeReport([makeContributor()])}
          onApplyPreset={onApplyPreset}
        />,
      );
      screen.getByText('Ghost Files').click();
      expect(onApplyPreset).toHaveBeenCalledWith('ghost-files');
    });
  });
});
```

- [ ] **Step 5.2: Run tests, verify they fail**

```bash
pnpm --filter @gitrelic/web test -- ContributorsTab.test.tsx
```
Expected: failures (current tab has different columns, no `onApplyPreset` prop, no see-also).

- [ ] **Step 5.3: Rewrite the tab**

Replace `apps/web/src/components/tabs/ContributorsTab.tsx` entirely:

```tsx
import Badge from '../shared/Badge';
import { type Column, SortableTable } from '../shared/SortableTable';
import { fmt } from '../theme';
import { formatRelative } from '../../utils/relativeTime';
import type { PresetId } from '../../presets/types';
import type { Contributor, GitrelicReport } from '@gitrelic/core';

interface ContributorsTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

function daysSince(iso: string): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return ms / 86_400_000;
}

export function ContributorsTab({
  report,
  onApplyPreset,
}: ContributorsTabProps) {
  const contributors = report.contributors.contributors;

  const columns: Column<Contributor>[] = [
    {
      key: 'name',
      label: 'Contributor',
      render: (c) => (
        <div className="flex items-center gap-2">
          <div className="w-[22px] h-[22px] rounded-full bg-surface-tertiary flex items-center justify-center text-[9px] text-text-secondary shrink-0">
            {(c.name || c.email).slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-text-primary flex items-center gap-1.5">
              <span
                className={
                  c.isActive
                    ? 'w-1.5 h-1.5 rounded-full bg-severity-healthy shrink-0'
                    : 'w-1.5 h-1.5 rounded-full bg-text-tertiary shrink-0'
                }
              />
              <span className="truncate">{c.name || c.email}</span>
              {!c.isActive && <Badge variant="stale">ghost</Badge>}
            </div>
            <div className="text-[9px] text-text-tertiary truncate">
              {c.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'commits',
      label: 'Commits',
      width: '80px',
      align: 'right',
      sortValue: (c) => c.commitCount,
      render: (c) => (
        <span className="font-mono text-[11px] text-text-primary font-semibold">
          {fmt(c.commitCount)}
        </span>
      ),
    },
    {
      key: 'files',
      label: 'Files',
      width: '70px',
      align: 'right',
      sortValue: (c) => c.filesOwned,
      render: (c) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(c.filesOwned)}
        </span>
      ),
    },
    {
      key: 'lines',
      label: 'Lines',
      width: '90px',
      align: 'right',
      sortValue: (c) => c.linesChanged,
      render: (c) => (
        <span className="font-mono text-[11px] text-text-secondary">
          {fmt(c.linesChanged)}
        </span>
      ),
    },
    {
      key: 'lastActive',
      label: 'Last Active',
      width: '100px',
      align: 'right',
      sortValue: (c) => -1 * (new Date(c.lastCommit).getTime() || 0),
      render: (c) => (
        <span className="font-mono text-[10px] text-text-tertiary">
          {formatRelative(daysSince(c.lastCommit))}
        </span>
      ),
    },
    {
      key: 'focus',
      label: 'Focus Areas',
      width: '260px',
      render: (c) => (
        <span className="text-[10px] text-text-tertiary truncate block">
          {c.focusAreas.slice(0, 3).join(', ')}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1">
        {contributors.length === 0 ? (
          <div className="py-6 px-3 text-[11px] text-text-tertiary text-center">
            No contributors found in the analysis window.
          </div>
        ) : (
          <SortableTable
            data={contributors}
            columns={columns}
            rowKey={(c) => c.email}
          />
        )}
      </div>
      <div className="sticky bottom-0 mt-auto bg-surface-primary border-t border-border-primary py-1.5 px-1 text-[10px] text-text-tertiary flex gap-2 items-center">
        See also:{' '}
        <button
          onClick={() => onApplyPreset('bus-factor')}
          className="bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline"
        >
          Bus Factor
        </button>
        ·
        <button
          onClick={() => onApplyPreset('ghost-files')}
          className="bg-transparent border-none text-accent-primary text-[10px] cursor-pointer p-0 underline"
        >
          Ghost Files
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5.4: Wire `onApplyPreset` through BottomPanel**

Edit `apps/web/src/components/layout/BottomPanel.tsx`. Find the `case 'contributors':` branch (currently `<ContributorsTab report={report} />`) and update:

```tsx
case 'contributors':
  return <ContributorsTab report={report} onApplyPreset={onApplyPreset} />;
```

- [ ] **Step 5.5: Run tests, verify pass**

```bash
pnpm --filter @gitrelic/web test -- ContributorsTab.test.tsx
```
Expected: all green.

Also run the full web suite to catch any cross-test regressions:
```bash
pnpm --filter @gitrelic/web test
```
Expected: all green.

- [ ] **Step 5.6: Commit**

```bash
git add apps/web/src/components/tabs/ContributorsTab.tsx \
        apps/web/src/components/tabs/ContributorsTab.test.tsx \
        apps/web/src/components/layout/BottomPanel.tsx
git commit -m "feat(web): polished ContributorsTab — 6 cols + sticky see-also footer (RELIC-306)"
```

---

## Task 6: Docs page + sidebar wiring + docsPath

**Files:**
- Create: `apps/docs/analyzers/contributors.md`
- Modify: `apps/docs/.vitepress/config.ts` — add sidebar entry, remove from `ignoreDeadLinks`
- Modify: `apps/web/src/presets/registry.ts` — set `docsPath: 'analyzers/contributors'`

The `registry.test.ts` `'every analyzer-tier preset whose <id>.md exists must set docsPath'` assertion fires the moment the docs file lands on disk — so the docs file and the `docsPath` setting must be staged and committed in the same change to keep the test green between commits.

- [ ] **Step 6.1: Author the docs page**

Create `apps/docs/analyzers/contributors.md`. Mirror the structure of `apps/docs/analyzers/parallel-dev.md` (read it for reference). Sections:

1. **Frontmatter** — `title: Contributors`, `description: …` (one-line social-collaboration framing).
2. **Intro paragraph** — what the analyzer measures (per-author commit aggregation), what questions it answers (who's on the team, who's active when, who works on what).
3. **`::: tip Screenshot`** — placeholder TODO callout (mirror the parallel-dev pattern; do not capture screenshots in this PR).
4. **`## Quick read`** — 10-second summary of metrics strip → Swimlanes hero (default) → Bubble alt → bottom-panel table → Inspector.
5. **`## How contributors are measured`** — mermaid pipeline diagram + explanation:
   ```mermaid
   flowchart LR
       G[("git log")] --> A[analyzeContributors]
       A --> R[("ContributorReport.contributors[]<br/>+ activeContributors<br/>+ ghostContributors<br/>+ top3CommitShare<br/>+ newcomers90d")]
       R --> M["Metrics strip<br/>4 health KPIs"]
       R --> H1["Swimlanes hero<br/>per-author timeline"]
       R --> H2["Bubble alt hero<br/>per-directory ownership"]
       R --> B["Bottom panel<br/>roster table"]
       R --> I["Inspector<br/>per-file detail"]
   ```
   - **Identity:** keyed by `commit.authorEmail`. No name-collision dedup at this layer.
   - **Active vs ghost cutoffs:** `MIN_ACTIVE_DAYS = 90`, `MIN_GHOST_DAYS = 180`, scaled to `repoAgeDays * 0.25` and `repoAgeDays * 0.5` respectively (whichever is larger). On a 1-year repo, active = last 91 days, ghost = past 183 days.
   - **Focus areas:** top-3 directories by per-author commit count; depth = 2 (e.g. `packages/react-dom`, not just `packages/`).
6. **`## The metrics strip`** — formulas + tier thresholds for the 4 slots, with worked examples:
   - **Active Contributors:** `1 = critical` / `2-5 = warning` / `6+ = healthy`. Single-author project flagged because the bus is one bus.
   - **Top-3 Share:** `(top3 commitCount sum) / (total commitCount) × 100`. `<40% = healthy` / `40-69% = warning` / `70%+ = critical`. Velocity-concentration risk distinct from per-file Bus Factor.
   - **Ghost Authors:** count + ratio against total contributors. `0 = healthy` / `<30% = warning` / `≥30% = critical`. Healthy turnover vs. abandonment signal.
   - **Newcomers (90d):** count of contributors whose `firstCommit ≤ 90d ago`. `0 = stale` (neutral grey, no warning) / `1+ = healthy`. Team renewal signal.
7. **`## Reading the surfaces`** — Swimlanes hero, Bubble alt hero, bottom-panel table, Inspector. Three ~150-word paragraphs with the per-surface "what question does this answer" framing.
8. **`## What action it suggests`** — concentration patterns (high top-3 + 0 newcomers = stagnant), ghost cleanup (high ghost ratio = dormant ownership), focus-area collisions (multiple authors heavy in same dir → coordination opportunity).
9. **`## Limitations`** — email-keyed identity (no dedup), 2-deep focus areas, heuristic active/ghost thresholds, renames not followed, `--since` window sensitivity, pre-1.0.
10. **`## Related analyzers`** — Bus Factor, Knowledge Silos, Ghost Files, Co-Authors. Brief explanations of how each triangulates from a different vertex.

- [ ] **Step 6.2: Update vitepress config**

Edit `apps/docs/.vitepress/config.ts`:

1. In the Analyzers sidebar `items` array, add (alphabetical between Commit Timing and Parallel Dev):
   ```ts
   { text: 'Contributors', link: '/analyzers/contributors' },
   ```

2. In `ignoreDeadLinks`, remove the `/analyzers/contributors` entry.

- [ ] **Step 6.3: Set `docsPath` on the contributors preset**

Edit `apps/web/src/presets/registry.ts`. In the `contributors` block, add:

```ts
contributors: {
  // … existing fields …
  metrics: contributorsMetrics,
  docsPath: 'analyzers/contributors',  // NEW
},
```

- [ ] **Step 6.4: Run web tests, verify pass**

```bash
pnpm --filter @gitrelic/web test -- registry.test.ts
```
Expected: pass — `docsPath` resolves to a real file (the new `contributors.md`) and the analyzer-with-disk-doc-must-set-docsPath assertion holds.

- [ ] **Step 6.5: Build the docs site to verify VitePress accepts the page**

```bash
pnpm docs:build
```
Expected: build completes without dead-link errors. If it complains about a sibling page link (e.g. unwritten `/analyzers/co-authors`), that's an unrelated pre-existing issue — leave it.

- [ ] **Step 6.6: Commit**

```bash
git add apps/docs/analyzers/contributors.md \
        apps/docs/.vitepress/config.ts \
        apps/web/src/presets/registry.ts
git commit -m "docs(analyzers): contributors analyzer docs page + dashboard wiring (RELIC-306)"
```

---

## Task 7: Pattern doc update + final verification

**Files:**
- Modify: `docs/polish-pattern.md` — move `contributors` from "Pending" to a new "Mapped" entry

- [ ] **Step 7.1: Move `contributors` from "Pending" to a "Mapped" section**

Edit `docs/polish-pattern.md`:

1. Remove the `contributors` row from the "Pending (Batches 2–N)" table (the row reading `| contributors | 3 | Sunburst is one of three views. Bottom table earns space (per-contributor vs hero per-directory). |`).

2. Add a new mapped entry after `bus-factor` (or in chronological-ship order — match the existing convention by placing it after the most recently shipped entry):

   ````markdown
   ### `contributors` *(shipped — RELIC-306)*

   - **Bottom panel:** Polished `SortableTable` (kept the table form). Six columns: Contributor (name + email + status dot + ghost badge inline) · Commits (default sort desc) · Files · Lines · Last Active · Focus Areas (top 3). Removed the standalone Status column (consolidated into Contributor cell). Display-name presentation throughout (`Sebastian Markbåge` not `sebastian@calyptus.eu`). The doc's original Batch-3 reasoning ("table earns space because hero is per-directory") was based on Bubble being default; once Swimlanes became default, both surfaces are per-author, but the table still earns space because it's a different *density* — full sortable list of N vs. ~10 visible swimlane rows.
   - **Hero (default):** `ContributorSwimlanes` (was alt; promoted). Per-author rows × time × commit-intensity. Answers "who is active when, and how intensely?" — the lead question for a contributors analyzer.
   - **Hero (alt):** `OwnershipBubble` (was default; demoted). Per-directory bubble pack sized by LOC, colored by dominant author. Answers "who works on which parts of the codebase?". Cleaned up: display-name labels (was email-prefix), `<HeroCaption>` strip (was inline div), tooltip uses display name.
   - **Hero captions:** added to both via shared `<HeroCaption>` component.
   - **Removed heroes:** `ownership-sunburst` (component itself stays — Knowledge Silos and Ghost Files still consume it). Same "redundant alts" pathology that Bus Factor and Rewrite Ratio fixed: sunburst is the *lead* hero in both Knowledge Silos and Ghost Files, where the file-tree-by-risk framing fits; on Contributors it answered a worse version of those analyzers' questions.
   - **Decision: no Timeline rehoming.** Considered as a third hero alt (the homeless stacked-area-by-author from RELIC-323). Rejected because (a) Timeline still lives in Overview's altTabs — it isn't actually homeless, and (b) it partially overlaps Swimlanes (both temporal-by-author, just different aggregation density). Two-tab pattern is cleaner. Can revisit if there's pull later.
   - **Metrics strip retune:** Slot 1 `Active Contributors` (existing — now severity-banded `1 critical / 2–5 warning / 6+ healthy`). Slot 2 `Top-3 Share %` (NEW — velocity concentration not on screen anywhere). Slot 3 `Ghost Authors` (existing — moved from slot 2, severity-banded by ghost ratio: `0 healthy / <30% warning / ≥30% critical`). Slot 4 `Newcomers (90d)` (NEW — team-renewal signal). Dropped: `Total Commits` (meta-stat, no team-health signal). Mirrors Rewrite Ratio / Parallel Dev / Commit Timing precedent of replacing shape-of-data counts with health-tiered counts.
   - **See also:** Bus Factor, Ghost Files. Sticky to the bottom of the panel. Completes the ownership-risk triangle from the contributor vertex (per-file concentration + dormant-file ownership).
   - **Backend changes:**
     - Add `top3CommitShare: number` (0-100, %) to `ContributorReport`. Sum of top-3 commitCount divided by total commits × 100. Empty-repo guard returns 0.
     - Add `newcomers90d: number` to `ContributorReport`. Count of contributors with `firstCommit ≤ 90d ago` from `now`.
     - No score-formula changes (Contributors has no per-file score).
   - **Removes:** `ContributorsTab`'s standalone `Status` column (~10 lines, consolidated into Contributor cell). `'ownership-sunburst'` from contributors preset altTabs. `Total Commits` slot from metrics strip.
   ````

- [ ] **Step 7.2: Run full repo test suite**

```bash
pnpm test
```
Expected: all green (231 core + ≥30 web tests, give-or-take with the new contributors test files).

- [ ] **Step 7.3: Lint and format**

```bash
pnpm lint
pnpm format
```
Expected: clean. The pre-commit hook also runs these on staged files; this is a pre-flight.

- [ ] **Step 7.4: Final visual smoke against the React repo**

```bash
pnpm build
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

In the browser, click **Contributors** in the sidebar. Verify:

- **Default hero is Swimlanes.** Caption strip below it.
- **Bubble alt tab** shows display names (`Sebastian Markbåge`), not email-prefixes.
- **Sunburst tab is gone.**
- **Metrics strip has 4 slots:** Active Contributors / Top-3 Share / Ghost Authors / Newcomers (90d). Severity colors apply (e.g. `Top-3 Share` should be warning or critical on React).
- **Bottom-panel table has 6 columns** with display name primary + email small below.
- **Sticky see-also footer** at bottom routes to Bus Factor / Ghost Files when clicked.
- **Docs ↗ link** in the bottom-panel tab bar goes to `https://nebulord-dev.github.io/gitrelic/analyzers/contributors` (404 expected until docs deploy hits prod, that's fine).
- **No console errors.**

- [ ] **Step 7.5: Commit pattern-doc update**

```bash
git add docs/polish-pattern.md
git commit -m "docs: move contributors to Mapped in polish-pattern.md (RELIC-306)"
```

---

## Done — checklist

- [ ] `top3CommitShare` and `newcomers90d` aggregates on `ContributorReport`
- [ ] `analyzeContributors` computes both, with full unit-test coverage
- [ ] `fixture-regression.test.ts.snap` reflects the pure-addition diff
- [ ] Frontend metrics composer outputs the 4 health-tiered slots
- [ ] Registry default flipped to `swimlanes`; sunburst removed from contributors altTabs
- [ ] `OwnershipBubble` labels and tooltip use display names; both heroes have `<HeroCaption>`
- [ ] `ContributorsTab` rewritten with 6-column table + sticky see-also footer wired through `BottomPanel`
- [ ] Tab + composer test files exist and are green
- [ ] `apps/docs/analyzers/contributors.md` exists and `docsPath` set on the preset
- [ ] VitePress sidebar shows `Contributors`; `ignoreDeadLinks` cleaned
- [ ] `docs/polish-pattern.md` has a Mapped entry for contributors
- [ ] `pnpm test` and `pnpm lint` green; `pnpm format` clean
- [ ] Visual smoke against React repo passes the verification list above

Open a PR titled `feat(web): contributors polish (RELIC-306)` linking to the Linear issue and the spec.
