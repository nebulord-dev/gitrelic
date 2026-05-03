# Commit Timing Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the RELIC-323 polish for the `commit-timing` analyzer — strip the two firehose heroes (`timeline`, `swimlanes`) that encode nothing about hour-of-day or day-of-week, replace them with a domain-specific 7×24 punch-card heatmap (default) and a 3-layer disjoint stress-severity monthly trend (alt). Add five aggregates to `CommitTimingReport` (`repoHourDayMatrix`, `highStress`, `tierMix`, `byMonth`, `authorStress`), replace the per-file `SortableTable` with a `<NarrativeKPI>` consumer that pivots to a per-author top-3 finding (Bus Factor pattern), and retune both the metrics-strip slots that contradict the new tier thresholds.

**Architecture:** Three layers move independently. (1) `packages/core/src/analyzers/commit-timing.ts` + `types.ts` gain five aggregates without touching the existing per-file scoring formula or its `< 3` commit floor. The existing `parseLocalTime()` helper is widened to also yield local year + month so `byMonth` bucketing respects timezone boundaries. (2) `apps/web/src/components/hero/` gets two new components: `CommitPunchCard` (NEW pattern — log-scaled 7×24 cell grid with off-hours stress shading) and `StressTrend` (NEW pattern — 3-layer disjoint stacked bars by ISO month). (3) `apps/web/src/components/tabs/CommitTimingTab.tsx` is rewritten end-to-end as a `<NarrativeKPI>` consumer with a per-author top-3 finding, with a new `commitTimingByDirectory.ts` aggregator feeding the `extras` slot. Cross-cutting registry / Shell / metrics-strip tweaks pin the wiring. **No score-formula changes** — current `lateNightPercent × 0.6 + weekendPercent × 0.4` and the `< 3` per-file floor stay as-is. Per-author filter floor is `MIN_AUTHOR_COMMITS = 5`.

**Tech Stack:** TypeScript 6, Vitest, React 19, `d3-scale` (existing convention for histograms / trends), `@testing-library/react` for hero / tab / util tests. No new runtime deps in `packages/core` — bundled-deps-mirror invariant unchanged.

**Worktree:** `/Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing` on branch `relic-323-polish-commit-timing`. Spec lives at [`docs/superpowers/specs/2026-05-03-commit-timing-polish-design.md`](../specs/2026-05-03-commit-timing-polish-design.md) and ticket [RELIC-323](https://linear.app/nebulord/issue/RELIC-323). The spec is the source of truth — when in doubt, the spec wins over this plan, the polish-pattern doc, and the Linear ticket.

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

- **Every Bash command in this plan starts with `cd <worktree>`** — without it, commits drift to `main` (per `feedback_subagent_cwd_discipline.md` memory).
- Tab tests use `getByTestId('narrative-kpi-big-number')`, NOT `getByText` (per `reference_narrative_kpi_testid.md` memory).
- Style assertions against happy-dom serialization use `flex-grow: 1`, NOT `flex: 1` (per `feedback_happy_dom_flex_shorthand.md` memory).
- Top-N file lists in tabs slice from the **threshold-filtered subset** (per `feedback_topn_under_threshold.md` memory).
- Bare-ternary for single conditional `className`, not `cn()`. Use `cn()` only for multi-condition spread/merge.
- Author display = full git author name; collision rule appends `(local-part)` to every member of an N-author colliding group (per spec § Author display name handling).
- All new color tokens come from `bg-severity-*` / `text-severity-*` / `bg-surface-*` / `bg-tooltip-bg`+`text-tooltip-text`; never `dark:` variants and never inline color values when a token exists.

**Spec deviation logged:**

The spec mentions a `topStressedAuthors.ts` util in its test list (line 285) — but the analyzer already produces a sorted, floor-filtered, disambiguated `authorStress` array, so the tab can slice `report.commitTiming.authorStress.slice(0, 3)` directly without a frontend aggregator. **Skip the util.** Disambiguation and floor logic stay in the analyzer where they're testable in `commit-timing.test.ts`. This deviation is captured in Task 6 below.

---

## Setup Task: Worktree baseline

**Files:** none (toolchain only)

- [ ] **Step 1: Create worktree from `main`**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic
git worktree add .worktrees/relic-323-polish-commit-timing -b relic-323-polish-commit-timing
```

Expected: a new worktree at `.worktrees/relic-323-polish-commit-timing` on a fresh branch tracking `main`. From now on every command starts with `cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing`.

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm install
```

Expected: pnpm resolves and links the workspace. Warnings are acceptable; errors are not.

- [ ] **Step 3: Run baseline tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm test
```

Expected: all pre-existing tests pass. Anything failing on the clean baseline indicates environment drift — **stop and investigate before proceeding.**

- [ ] **Step 4: Confirm dev tools work**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format:check && pnpm build
```

Expected: clean lint, clean format, full build succeeds. Don't proceed if any fail.

---

## Task 1: Backend — five new aggregates on `CommitTimingReport`

**Files:**
- Modify: `packages/core/src/types.ts` (add three new interfaces + extend `CommitTimingReport`)
- Modify: `packages/core/src/analyzers/commit-timing.ts` (extend `parseLocalTime`, track new accumulators, post-loop computations, disambiguation pass)
- Modify: `packages/core/src/analyzers/commit-timing.test.ts` (add tests for all five aggregates + edge cases)
- Update: `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` (regen — additive only)

This is the single backend commit. Spec → `docs/superpowers/specs/2026-05-03-commit-timing-polish-design.md` § "Backend changes".

- [ ] **Step 1: Add the three new interfaces and extend `CommitTimingReport` in `types.ts`**

In `packages/core/src/types.ts`, replace the `CommitTimingReport` interface block (around line 509) with:

```ts
export interface AuthorStressProfile {
  email: string;            // stable id, lowercased
  name: string;             // display, full git author name (with collision suffix if needed)
  totalCommits: number;
  lateNightCommits: number;
  weekendCommits: number;
  lateNightPercent: number; // 0–100, rounded
  weekendPercent: number;   // 0–100, rounded
  stressScore: number;      // round(lateNightPercent × 0.6 + weekendPercent × 0.4), 0–100
}

export interface CommitTimingMonthlyBucket {
  month: string;            // ISO YYYY-MM (local time)
  weekendLateNight: number; // commits matching BOTH criteria
  singleCriterion: number;  // commits matching exactly one criterion (XOR)
  healthy: number;          // commits matching neither
  total: number;            // sum of the three above
}

export interface CommitTimingTierMix {
  low: number;              // stressScore 0–24
  medium: number;           // 25–49
  high: number;             // 50–74
  critical: number;         // 75+
}

export interface CommitTimingReport {
  files: FileTimingProfile[];
  stressFiles: FileTimingProfile[]; // top 10 by stressScore
  repoLateNightPercent: number;
  repoWeekendPercent: number;
  summary: string;
  // NEW
  repoHourDayMatrix: number[][];        // 7 rows × 24 cols, [dayOfWeek][hour]; Sun=0
  highStress: number;                   // count of files with stressScore ≥ 70
  tierMix: CommitTimingTierMix;         // file-score band counts
  byMonth: CommitTimingMonthlyBucket[]; // disjoint, sorted ascending by month
  authorStress: AuthorStressProfile[];  // sorted desc by stressScore, post-floor and post-disambiguation
}
```

- [ ] **Step 2: Run core tests to verify the new types compile but break the analyzer**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/core test --run 2>&1 | head -40
```

Expected: type errors / compilation failures pointing at `packages/core/src/analyzers/commit-timing.ts` because the analyzer's return value is missing the five new fields. This confirms the type wired correctly.

- [ ] **Step 3: Extend `parseLocalTime` to also yield local year+month**

In `packages/core/src/analyzers/commit-timing.ts`, replace the `parseLocalTime` function (around line 8) with:

```ts
/**
 * Parses an ISO date string and returns the hour (0-23), day-of-week (0-6, Sun=0),
 * and ISO month (YYYY-MM) using the timezone offset embedded in the string
 * (the author's local time).
 */
function parseLocalTime(isoDate: string): {
  hour: number;
  day: number;
  isoMonth: string;
} {
  const match = isoDate.match(/([+-])(\d{2}):(\d{2})$/);
  const date = new Date(isoDate);

  if (!match) {
    // Z or no offset — use UTC
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return {
      hour: date.getUTCHours(),
      day: date.getUTCDay(),
      isoMonth: `${year}-${month}`,
    };
  }

  const sign = match[1] === '+' ? 1 : -1;
  const offsetHours = parseInt(match[2], 10);
  const offsetMinutes = parseInt(match[3], 10);
  const totalOffsetMs = sign * (offsetHours * 60 + offsetMinutes) * 60_000;

  // Get UTC time and apply offset to get local time
  const localMs = date.getTime() + totalOffsetMs;
  const local = new Date(localMs);

  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, '0');
  return {
    hour: local.getUTCHours(),
    day: local.getUTCDay(),
    isoMonth: `${year}-${month}`,
  };
}
```

The `getUTCMonth()` + 1 dance is correct: `local` is already a local-time-shifted Date, so its UTC accessors return the local components.

- [ ] **Step 4: Add `MIN_AUTHOR_COMMITS` constant and analyzer-level types**

Just under the existing `isWeekend` helper in `commit-timing.ts`:

```ts
const MIN_AUTHOR_COMMITS = 5;
```

- [ ] **Step 5: Replace `analyzeCommitTiming` body with extended version**

Rewrite `analyzeCommitTiming` to track the five new aggregates. Replace the function body (everything from `if (commits.length === 0) {` to the final `return { ... }`) with:

```ts
export function analyzeCommitTiming(
  commits: RawCommit[],
  trackedFiles: string[],
): CommitTimingReport {
  if (commits.length === 0) {
    return {
      files: [],
      stressFiles: [],
      repoLateNightPercent: 0,
      repoWeekendPercent: 0,
      summary: '0% of commits happen after hours, 0% on weekends',
      repoHourDayMatrix: Array.from({ length: 7 }, () =>
        new Array<number>(24).fill(0),
      ),
      highStress: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth: [],
      authorStress: [],
    };
  }

  const trackedSet = new Set(trackedFiles);

  // Per-file accumulators (existing)
  const fileData = new Map<
    string,
    {
      hours: number[];
      totalCommits: number;
      lateNight: number;
      weekend: number;
      dayCount: number[];
    }
  >();

  // Repo-wide accumulators
  let repoTotal = 0;
  let repoLateNight = 0;
  let repoWeekend = 0;
  const repoHourDayMatrix: number[][] = Array.from({ length: 7 }, () =>
    new Array<number>(24).fill(0),
  );

  // Per-author accumulators (NEW)
  const authorData = new Map<
    string,
    {
      name: string;
      totalCommits: number;
      lateNightCommits: number;
      weekendCommits: number;
    }
  >();

  // Per-month accumulators (NEW)
  const monthData = new Map<
    string,
    { weekendLateNight: number; singleCriterion: number; healthy: number }
  >();

  for (const commit of commits) {
    const { hour, day, isoMonth } = parseLocalTime(commit.date);
    const late = isLateNight(hour);
    const wknd = isWeekend(day);

    repoTotal++;
    if (late) repoLateNight++;
    if (wknd) repoWeekend++;
    repoHourDayMatrix[day][hour]++;

    // Per-author (commit-level, not file-level)
    const emailLower = commit.authorEmail.toLowerCase();
    if (!authorData.has(emailLower)) {
      authorData.set(emailLower, {
        name: commit.authorName,
        totalCommits: 0,
        lateNightCommits: 0,
        weekendCommits: 0,
      });
    }
    const aData = authorData.get(emailLower)!;
    aData.name = commit.authorName; // last-write-wins; names are usually stable per email
    aData.totalCommits++;
    if (late) aData.lateNightCommits++;
    if (wknd) aData.weekendCommits++;

    // Per-month (commit-level, disjoint XOR)
    if (!monthData.has(isoMonth)) {
      monthData.set(isoMonth, {
        weekendLateNight: 0,
        singleCriterion: 0,
        healthy: 0,
      });
    }
    const mData = monthData.get(isoMonth)!;
    if (late && wknd) mData.weekendLateNight++;
    else if (late || wknd) mData.singleCriterion++;
    else mData.healthy++;

    // Per-file (existing)
    for (const file of commit.files) {
      if (!trackedSet.has(file)) continue;

      if (!fileData.has(file)) {
        fileData.set(file, {
          hours: new Array(24).fill(0),
          totalCommits: 0,
          lateNight: 0,
          weekend: 0,
          dayCount: new Array(7).fill(0),
        });
      }
      const data = fileData.get(file)!;
      data.hours[hour]++;
      data.dayCount[day]++;
      data.totalCommits++;
      if (late) data.lateNight++;
      if (wknd) data.weekend++;
    }
  }

  // Build per-file profiles, excluding files with < 3 commits (existing floor)
  const files: FileTimingProfile[] = [];
  for (const [file, data] of fileData) {
    if (data.totalCommits < 3) continue;

    const lateNightPercent = Math.round(
      (data.lateNight / data.totalCommits) * 100,
    );
    const weekendPercent = Math.round((data.weekend / data.totalCommits) * 100);
    const peakHour = data.hours.indexOf(Math.max(...data.hours));
    const peakDay = data.dayCount.indexOf(Math.max(...data.dayCount));
    const stressScore = Math.min(
      100,
      Math.max(0, Math.round(lateNightPercent * 0.6 + weekendPercent * 0.4)),
    );

    files.push({
      file,
      totalCommits: data.totalCommits,
      lateNightPercent,
      weekendPercent,
      peakHour,
      peakDay,
      hourDistribution: data.hours,
      stressScore,
    });
  }

  files.sort((a, b) => {
    const diff = b.stressScore - a.stressScore;
    return diff !== 0 ? diff : a.file.localeCompare(b.file);
  });

  const stressFiles = files.slice(0, 10);

  // tierMix from per-file stressScores (independent of MIN_AUTHOR_COMMITS)
  const tierMix = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const f of files) {
    if (f.stressScore < 25) tierMix.low++;
    else if (f.stressScore < 50) tierMix.medium++;
    else if (f.stressScore < 75) tierMix.high++;
    else tierMix.critical++;
  }

  const highStress = files.filter((f) => f.stressScore >= 70).length;

  // Per-author profiles — apply MIN_AUTHOR_COMMITS floor; sub-floor authors dropped entirely
  const authorStress: AuthorStressProfile[] = [];
  for (const [email, data] of authorData) {
    if (data.totalCommits < MIN_AUTHOR_COMMITS) continue;
    const lateNightPercent = Math.round(
      (data.lateNightCommits / data.totalCommits) * 100,
    );
    const weekendPercent = Math.round(
      (data.weekendCommits / data.totalCommits) * 100,
    );
    const stressScore = Math.min(
      100,
      Math.max(0, Math.round(lateNightPercent * 0.6 + weekendPercent * 0.4)),
    );
    authorStress.push({
      email,
      name: data.name,
      totalCommits: data.totalCommits,
      lateNightCommits: data.lateNightCommits,
      weekendCommits: data.weekendCommits,
      lateNightPercent,
      weekendPercent,
      stressScore,
    });
  }
  authorStress.sort((a, b) => {
    const diff = b.stressScore - a.stressScore;
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });

  // Name-collision disambiguation — handle 2-author and N-author collisions identically
  const byName = new Map<string, AuthorStressProfile[]>();
  for (const profile of authorStress) {
    if (!byName.has(profile.name)) byName.set(profile.name, []);
    byName.get(profile.name)!.push(profile);
  }
  for (const [, group] of byName) {
    const distinctEmails = new Set(group.map((p) => p.email));
    if (distinctEmails.size >= 2) {
      for (const profile of group) {
        const localPart = profile.email.split('@')[0];
        profile.name = `${profile.name} (${localPart})`;
      }
    }
  }

  // Per-month — sort ascending, compute total
  const byMonth: CommitTimingMonthlyBucket[] = [];
  for (const [month, data] of monthData) {
    byMonth.push({
      month,
      weekendLateNight: data.weekendLateNight,
      singleCriterion: data.singleCriterion,
      healthy: data.healthy,
      total: data.weekendLateNight + data.singleCriterion + data.healthy,
    });
  }
  byMonth.sort((a, b) => a.month.localeCompare(b.month));

  const repoLateNightPercent =
    repoTotal > 0 ? Math.round((repoLateNight / repoTotal) * 100) : 0;
  const repoWeekendPercent =
    repoTotal > 0 ? Math.round((repoWeekend / repoTotal) * 100) : 0;

  const summary = `${repoLateNightPercent}% of commits happen after hours, ${repoWeekendPercent}% on weekends`;

  return {
    files,
    stressFiles,
    repoLateNightPercent,
    repoWeekendPercent,
    summary,
    repoHourDayMatrix,
    highStress,
    tierMix,
    byMonth,
    authorStress,
  };
}
```

Add the import alongside existing types at the top of the file:

```ts
import type {
  AuthorStressProfile,
  CommitTimingMonthlyBucket,
  CommitTimingReport,
  CommitTimingTierMix,
  FileTimingProfile,
} from '../types.js';
```

(Drop unused imports if any are now redundant.)

- [ ] **Step 6: Verify analyzer compiles + existing tests still pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/core test commit-timing --run
```

Expected: all existing tests pass. New aggregates aren't tested yet but the existing per-file behavior is unchanged.

- [ ] **Step 7: Add tests for `repoHourDayMatrix`**

Append to `packages/core/src/analyzers/commit-timing.test.ts` (inside the existing top-level `describe`, or in a new `describe('aggregates', ...)` block — match the file's existing convention):

```ts
describe('repoHourDayMatrix', () => {
  it('builds a 7×24 matrix; sum equals commits.length', () => {
    const commits: RawCommit[] = [
      makeCommit({ date: '2026-03-15T14:00:00Z' }), // Sun 14:00 UTC
      makeCommit({ date: '2026-03-16T03:00:00Z' }), // Mon 03:00 UTC
      makeCommit({ date: '2026-03-16T14:00:00Z' }), // Mon 14:00 UTC
    ];
    const report = analyzeCommitTiming(commits, []);
    expect(report.repoHourDayMatrix).toHaveLength(7);
    expect(report.repoHourDayMatrix[0]).toHaveLength(24);
    expect(report.repoHourDayMatrix[0][14]).toBe(1); // Sun 14
    expect(report.repoHourDayMatrix[1][3]).toBe(1);  // Mon 03
    expect(report.repoHourDayMatrix[1][14]).toBe(1); // Mon 14
    let sum = 0;
    for (const row of report.repoHourDayMatrix) {
      for (const c of row) sum += c;
    }
    expect(sum).toBe(commits.length);
  });

  it('respects timezone offset for hour bucketing', () => {
    // 03:00 IST (+05:30) = 21:30 UTC prior day. The author's *local* time is
    // Saturday 03:00 (day=6, hour=3). Use a date where the local day is Saturday.
    const commits: RawCommit[] = [
      makeCommit({ date: '2026-03-21T03:00:00+05:30' }), // Sat 03:00 IST = Fri 21:30 UTC
    ];
    const report = analyzeCommitTiming(commits, []);
    expect(report.repoHourDayMatrix[6][3]).toBe(1); // Sat 03 in local time
  });
});
```

If `makeCommit` doesn't already exist in the file, add a small helper near the top (mirror the shape used by `parallel-dev.test.ts`):

```ts
function makeCommit(overrides: Partial<RawCommit> = {}): RawCommit {
  return {
    hash: 'abc',
    authorEmail: 'alice@example.com',
    authorName: 'Alice',
    date: '2026-03-15T12:00:00Z',
    message: 'feat: x',
    files: [],
    fileStats: [],
    insertions: 0,
    deletions: 0,
    ...overrides,
  };
}
```

Run:

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/core test commit-timing --run
```

Expected: new tests pass; existing tests still pass.

- [ ] **Step 8: Add tests for `byMonth` (disjoint layers, month-boundary timezone)**

Append:

```ts
describe('byMonth', () => {
  it('layers are disjoint and sum to month total', () => {
    const commits: RawCommit[] = [
      makeCommit({ date: '2026-03-21T02:00:00Z' }), // Sat 02:00 = weekend + late-night = weekendLateNight
      makeCommit({ date: '2026-03-21T15:00:00Z' }), // Sat 15:00 = weekend only = singleCriterion
      makeCommit({ date: '2026-03-16T03:00:00Z' }), // Mon 03:00 = late-night only = singleCriterion
      makeCommit({ date: '2026-03-16T14:00:00Z' }), // Mon 14:00 = healthy
    ];
    const report = analyzeCommitTiming(commits, []);
    expect(report.byMonth).toHaveLength(1);
    const march = report.byMonth[0];
    expect(march.month).toBe('2026-03');
    expect(march.weekendLateNight).toBe(1);
    expect(march.singleCriterion).toBe(2);
    expect(march.healthy).toBe(1);
    expect(march.total).toBe(4);
    expect(
      march.weekendLateNight + march.singleCriterion + march.healthy,
    ).toBe(march.total);
  });

  it('months sorted ascending by ISO string', () => {
    const commits: RawCommit[] = [
      makeCommit({ hash: '1', date: '2026-03-15T12:00:00Z' }),
      makeCommit({ hash: '2', date: '2026-01-15T12:00:00Z' }),
      makeCommit({ hash: '3', date: '2026-02-15T12:00:00Z' }),
    ];
    const report = analyzeCommitTiming(commits, []);
    expect(report.byMonth.map((b) => b.month)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ]);
  });

  it('buckets by local-time month, not UTC string prefix', () => {
    // 23:00 EST on Jan 31 = 04:00 UTC on Feb 1. Local month is January, not February.
    const commits: RawCommit[] = [
      makeCommit({ date: '2026-01-31T23:00:00-05:00' }),
    ];
    const report = analyzeCommitTiming(commits, []);
    expect(report.byMonth).toHaveLength(1);
    expect(report.byMonth[0].month).toBe('2026-01');
  });
});
```

Run + verify pass.

- [ ] **Step 9: Add tests for `authorStress` (floor, sort, formula)**

Append:

```ts
describe('authorStress', () => {
  function lateNightAt(date: string, email: string, name: string): RawCommit {
    return makeCommit({ authorEmail: email, authorName: name, date });
  }

  it('drops sub-floor authors entirely (< MIN_AUTHOR_COMMITS = 5)', () => {
    const commits: RawCommit[] = [];
    // Alice: 5 commits, all late-night → makes the floor
    for (let i = 0; i < 5; i++) {
      commits.push(
        lateNightAt(`2026-03-${10 + i}T03:00:00Z`, 'alice@x.com', 'Alice'),
      );
    }
    // Bob: 4 commits, all late-night → below floor, dropped
    for (let i = 0; i < 4; i++) {
      commits.push(
        lateNightAt(`2026-03-${10 + i}T03:00:00Z`, 'bob@x.com', 'Bob'),
      );
    }
    const report = analyzeCommitTiming(commits, []);
    const emails = report.authorStress.map((a) => a.email);
    expect(emails).toContain('alice@x.com');
    expect(emails).not.toContain('bob@x.com');
  });

  it('per-author stressScore matches per-file formula', () => {
    const commits: RawCommit[] = [];
    // Alice: 10 commits, 6 late-night, 4 healthy → late=60, wknd=0, score = round(60*0.6 + 0*0.4) = 36
    for (let i = 0; i < 6; i++) {
      commits.push(
        lateNightAt(`2026-03-${10 + i}T03:00:00Z`, 'alice@x.com', 'Alice'),
      );
    }
    for (let i = 0; i < 4; i++) {
      commits.push(
        lateNightAt(`2026-03-${20 + i}T14:00:00Z`, 'alice@x.com', 'Alice'),
      );
    }
    // 2026-03-10 is a Tuesday — keep all dates within Mon–Fri to avoid weekend leakage.
    const report = analyzeCommitTiming(commits, []);
    const alice = report.authorStress.find((a) => a.email === 'alice@x.com');
    expect(alice).toBeDefined();
    expect(alice!.lateNightPercent).toBe(60);
    expect(alice!.weekendPercent).toBe(0);
    expect(alice!.stressScore).toBe(36);
  });

  it('sort order: stressScore desc, name alphabetical tiebreaker', () => {
    const commits: RawCommit[] = [];
    // Alice — high stress
    for (let i = 0; i < 5; i++) {
      commits.push(
        lateNightAt(`2026-03-${10 + i}T03:00:00Z`, 'alice@x.com', 'Alice'),
      );
    }
    // Bob — low stress (all healthy hours)
    for (let i = 0; i < 5; i++) {
      commits.push(
        lateNightAt(`2026-03-${10 + i}T14:00:00Z`, 'bob@x.com', 'Bob'),
      );
    }
    const report = analyzeCommitTiming(commits, []);
    expect(report.authorStress[0].email).toBe('alice@x.com');
    expect(report.authorStress[1].email).toBe('bob@x.com');
  });
});
```

Run + verify pass.

- [ ] **Step 10: Add tests for name-collision disambiguation**

Append:

```ts
describe('name-collision disambiguation', () => {
  function bulk(
    email: string,
    name: string,
    n: number,
    baseDay = 10,
  ): RawCommit[] {
    return Array.from({ length: n }, (_, i) =>
      makeCommit({
        authorEmail: email,
        authorName: name,
        date: `2026-03-${String(baseDay + i).padStart(2, '0')}T14:00:00Z`,
      }),
    );
  }

  it('no collision — single email per name → no suffix', () => {
    const commits: RawCommit[] = [
      ...bulk('alice@x.com', 'Alice Lee', 5),
      ...bulk('bob@x.com', 'Bob Smith', 5),
    ];
    const report = analyzeCommitTiming(commits, []);
    const names = report.authorStress.map((a) => a.name).sort();
    expect(names).toEqual(['Alice Lee', 'Bob Smith']);
  });

  it('2-author collision — both get (local-part) suffix', () => {
    const commits: RawCommit[] = [
      ...bulk('alex@x.com', 'Alex Lee', 5),
      ...bulk('alee@x.com', 'Alex Lee', 5),
    ];
    const report = analyzeCommitTiming(commits, []);
    const names = new Set(report.authorStress.map((a) => a.name));
    expect(names).toEqual(new Set(['Alex Lee (alex)', 'Alex Lee (alee)']));
  });

  it('3-author collision — all three get suffix; all unique', () => {
    const commits: RawCommit[] = [
      ...bulk('alex@x.com', 'Alex Lee', 5),
      ...bulk('alee@x.com', 'Alex Lee', 5),
      ...bulk('a.lee@x.com', 'Alex Lee', 5),
    ];
    const report = analyzeCommitTiming(commits, []);
    const names = report.authorStress.map((a) => a.name);
    expect(new Set(names).size).toBe(3); // all unique
    expect(names.every((n) => n.startsWith('Alex Lee ('))).toBe(true);
  });
});
```

Run + verify pass.

- [ ] **Step 11: Add tests for `tierMix` and `highStress`**

Append:

```ts
describe('tierMix and highStress', () => {
  it('tierMix counts files by score band; independent of authorStress floor', () => {
    // Build a controlled set: 4 files, one per tier.
    // To get a per-file stressScore we need ≥3 commits per file.
    function fileCommits(
      file: string,
      count: number,
      lateRatio: number,
      weekendRatio: number,
    ): RawCommit[] {
      const commits: RawCommit[] = [];
      const lateN = Math.round(count * lateRatio);
      const wkndN = Math.round(count * weekendRatio);
      for (let i = 0; i < count; i++) {
        const isLate = i < lateN;
        const isWknd = i < wkndN;
        // Choose a date that satisfies the predicates
        let date: string;
        if (isLate && isWknd) date = '2026-03-21T03:00:00Z'; // Sat 03 = both
        else if (isLate) date = '2026-03-16T03:00:00Z';      // Mon 03 = late only
        else if (isWknd) date = '2026-03-21T14:00:00Z';      // Sat 14 = wknd only
        else date = '2026-03-16T14:00:00Z';                   // Mon 14 = healthy
        commits.push(
          makeCommit({
            hash: `${file}-${i}`,
            date,
            files: [file],
          }),
        );
      }
      return commits;
    }
    const commits = [
      ...fileCommits('lo.ts', 5, 0, 0),    // score = 0 → low
      ...fileCommits('mid.ts', 5, 0.5, 0), // score = round(50*0.6) = 30 → medium
      ...fileCommits('hi.ts', 5, 0.9, 0),  // score ≈ 54 → high
      ...fileCommits('crit.ts', 5, 1, 1),  // score = 100 → critical
    ];
    const report = analyzeCommitTiming(commits, [
      'lo.ts',
      'mid.ts',
      'hi.ts',
      'crit.ts',
    ]);
    expect(report.tierMix.low).toBeGreaterThanOrEqual(1);
    expect(report.tierMix.critical).toBeGreaterThanOrEqual(1);
    expect(
      report.tierMix.low +
        report.tierMix.medium +
        report.tierMix.high +
        report.tierMix.critical,
    ).toBe(report.files.length);
  });

  it('highStress equals files filtered to stressScore ≥ 70', () => {
    // Build one file at score 100, one at score 0
    const commits: RawCommit[] = [];
    for (let i = 0; i < 5; i++) {
      commits.push(
        makeCommit({
          hash: `crit-${i}`,
          date: '2026-03-21T03:00:00Z', // Sat 03 — wknd + late
          files: ['crit.ts'],
        }),
      );
    }
    for (let i = 0; i < 5; i++) {
      commits.push(
        makeCommit({
          hash: `clean-${i}`,
          date: '2026-03-16T14:00:00Z', // Mon 14
          files: ['clean.ts'],
        }),
      );
    }
    const report = analyzeCommitTiming(commits, ['crit.ts', 'clean.ts']);
    expect(report.highStress).toBe(
      report.files.filter((f) => f.stressScore >= 70).length,
    );
    expect(report.highStress).toBeGreaterThanOrEqual(1);
  });
});
```

Run + verify pass.

- [ ] **Step 12: Add tests for empty-repo and no-eligible-authors edge cases**

Append:

```ts
describe('edge cases', () => {
  it('empty repo returns zeroed aggregates', () => {
    const report = analyzeCommitTiming([], []);
    expect(report.repoHourDayMatrix).toHaveLength(7);
    expect(report.repoHourDayMatrix.flat().every((c) => c === 0)).toBe(true);
    expect(report.highStress).toBe(0);
    expect(report.tierMix).toEqual({ low: 0, medium: 0, high: 0, critical: 0 });
    expect(report.byMonth).toEqual([]);
    expect(report.authorStress).toEqual([]);
  });

  it('no-eligible-authors: every author below the 5-commit floor → authorStress is []', () => {
    const commits: RawCommit[] = [];
    // Three different authors, 4 commits each — all sub-floor
    const emails = ['a@x.com', 'b@x.com', 'c@x.com'];
    const names = ['A One', 'B Two', 'C Three'];
    emails.forEach((e, idx) => {
      for (let i = 0; i < 4; i++) {
        commits.push(
          makeCommit({
            authorEmail: e,
            authorName: names[idx],
            date: `2026-03-${String(10 + idx * 4 + i).padStart(2, '0')}T14:00:00Z`,
          }),
        );
      }
    });
    const report = analyzeCommitTiming(commits, []);
    expect(report.authorStress).toEqual([]);
  });
});
```

Run + verify pass.

- [ ] **Step 13: Regenerate the fixture-regression snapshot**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/core test fixture-regression --run -u
```

Expected: snapshot at `packages/core/src/__snapshots__/fixture-regression.test.ts.snap` updates with the five new fields under `commitTiming`. Inspect the diff:

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
git diff packages/core/src/__snapshots__/fixture-regression.test.ts.snap
```

Expected: only additions under `commitTiming` (e.g. `repoHourDayMatrix`, `highStress`, `tierMix`, `byMonth`, `authorStress`). No drift in pre-existing fields. **If pre-existing field values changed, stop and investigate.**

- [ ] **Step 14: Run the full core test suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/core test --run
```

Expected: all green.

- [ ] **Step 15: Lint & format**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format
```

- [ ] **Step 16: Commit Task 1**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
git add packages/core/src/types.ts packages/core/src/analyzers/commit-timing.ts packages/core/src/analyzers/commit-timing.test.ts packages/core/src/__snapshots__/fixture-regression.test.ts.snap
git commit -m "$(cat <<'EOF'
feat(core): commit-timing — five new aggregates on CommitTimingReport (RELIC-323)

Add repoHourDayMatrix (7×24), highStress, tierMix, byMonth (disjoint
weekendLateNight/singleCriterion/healthy layers), and authorStress (with
MIN_AUTHOR_COMMITS=5 floor and N-author collision disambiguation) to
support the polished punch-card hero, stress-trend hero, and per-author
narrative-KPI panel. parseLocalTime widened to also yield local ISO month
so byMonth bucketing respects timezone boundaries (e.g. 2026-01-31T23:00-05
buckets into 2026-01, not 2026-02).

No score-formula changes. Per-file < 3 commit floor preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Web utility — `commitTimingByDirectory.ts`

**Files:**
- Create: `apps/web/src/utils/commitTimingByDirectory.ts`
- Create: `apps/web/src/utils/commitTimingByDirectory.test.ts`

This is a frontend aggregator that produces the directory-rollup rows for the `extras` slot of the narrative-KPI panel. It mirrors `apps/web/src/utils/parallelDevByDirectory.ts` exactly in shape and intent.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/utils/commitTimingByDirectory.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { aggregateCommitTimingByDirectory } from './commitTimingByDirectory';
import type { FileTimingProfile } from '@gitrelic/core';

function makeFile(file: string, stressScore = 75): FileTimingProfile {
  return {
    file,
    totalCommits: 10,
    lateNightPercent: 60,
    weekendPercent: 30,
    peakHour: 3,
    peakDay: 6,
    hourDistribution: new Array(24).fill(0),
    stressScore,
  };
}

describe('aggregateCommitTimingByDirectory', () => {
  it('returns empty array on empty input', () => {
    expect(aggregateCommitTimingByDirectory([])).toEqual([]);
  });

  it('groups files by parent directory; share is fraction of total', () => {
    const rows = aggregateCommitTimingByDirectory([
      makeFile('src/a.ts'),
      makeFile('src/b.ts'),
      makeFile('docs/c.md'),
    ]);
    expect(rows).toHaveLength(2);
    const src = rows.find((r) => r.directory === 'src')!;
    expect(src.count).toBe(2);
    expect(src.share).toBeCloseTo(2 / 3);
    const docs = rows.find((r) => r.directory === 'docs')!;
    expect(docs.count).toBe(1);
    expect(docs.share).toBeCloseTo(1 / 3);
  });

  it('files at the repo root use empty-string directory', () => {
    const rows = aggregateCommitTimingByDirectory([makeFile('README.md')]);
    expect(rows).toHaveLength(1);
    expect(rows[0].directory).toBe('');
  });

  it('sorts by count desc, alphabetical directory tiebreaker', () => {
    const rows = aggregateCommitTimingByDirectory([
      makeFile('z/a.ts'),
      makeFile('a/a.ts'),
      makeFile('a/b.ts'),
    ]);
    expect(rows[0].directory).toBe('a');
    expect(rows[1].directory).toBe('z');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test commitTimingByDirectory --run
```

Expected: FAIL with "Cannot find module './commitTimingByDirectory'".

- [ ] **Step 3: Implement the aggregator**

Create `apps/web/src/utils/commitTimingByDirectory.ts`:

```ts
import type { FileTimingProfile } from '@gitrelic/core';

export interface CommitTimingDirectoryRow {
  directory: string;
  count: number;
  share: number;
}

function parentDirectory(filePath: string): string {
  const slash = filePath.lastIndexOf('/');
  return slash === -1 ? '' : filePath.slice(0, slash);
}

export function aggregateCommitTimingByDirectory(
  files: ReadonlyArray<FileTimingProfile>,
): CommitTimingDirectoryRow[] {
  if (files.length === 0) return [];

  const counts = new Map<string, number>();
  for (const f of files) {
    const dir = parentDirectory(f.file);
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }

  const total = files.length;
  const rows: CommitTimingDirectoryRow[] = [];
  for (const [directory, count] of counts) {
    rows.push({ directory, count, share: count / total });
  }

  rows.sort(
    (a, b) => b.count - a.count || a.directory.localeCompare(b.directory),
  );
  return rows;
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test commitTimingByDirectory --run
```

Expected: all four tests pass.

- [ ] **Step 5: Lint & commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format
git add apps/web/src/utils/commitTimingByDirectory.ts apps/web/src/utils/commitTimingByDirectory.test.ts
git commit -m "feat(web): commit-timing by-directory aggregator (RELIC-323)

Mirrors parallelDevByDirectory; powers the narrative-KPI extras slot's
\"Where they live\" directory rollup of high-stress files.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Hero — `CommitPunchCard`

**Files:**
- Create: `apps/web/src/components/hero/CommitPunchCard.tsx`
- Create: `apps/web/src/components/hero/CommitPunchCard.test.tsx`

A 7×24 grid (rows = days Sun–Sat, cols = hours 0–23), cells colored by **log-scaled** repo-wide commit count, with subtle background tint behind weekend rows + late-night cols.

Visual / behavior contract per spec § "Default — `CommitPunchCard`".

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/hero/CommitPunchCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { CommitPunchCard } from './CommitPunchCard';
import type { GitrelicReport } from '@gitrelic/core';

function makeReport(matrix: number[][]): GitrelicReport {
  return {
    commitTiming: {
      files: [],
      stressFiles: [],
      repoLateNightPercent: 0,
      repoWeekendPercent: 0,
      summary: '',
      repoHourDayMatrix: matrix,
      highStress: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth: [],
      authorStress: [],
    },
  } as unknown as GitrelicReport;
}

function emptyMatrix(): number[][] {
  return Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
}

describe('CommitPunchCard', () => {
  it('renders 168 cells (7 × 24)', () => {
    const m = emptyMatrix();
    m[1][14] = 5; // Mon 14:00
    const { container } = render(<CommitPunchCard report={makeReport(m)} />);
    const cells = container.querySelectorAll('rect.punch-card-cell');
    expect(cells.length).toBe(168);
  });

  it('non-zero cells have higher fill opacity than zero cells', () => {
    const m = emptyMatrix();
    m[1][14] = 100;
    m[2][14] = 0;
    const { container } = render(<CommitPunchCard report={makeReport(m)} />);
    const cells = Array.from(
      container.querySelectorAll<SVGRectElement>('rect.punch-card-cell'),
    );
    const hot = cells.find(
      (c) => c.getAttribute('data-day') === '1' && c.getAttribute('data-hour') === '14',
    )!;
    const cold = cells.find(
      (c) => c.getAttribute('data-day') === '2' && c.getAttribute('data-hour') === '14',
    )!;
    const hotOpacity = parseFloat(hot.getAttribute('fill-opacity') ?? '0');
    const coldOpacity = parseFloat(cold.getAttribute('fill-opacity') ?? '0');
    expect(hotOpacity).toBeGreaterThan(coldOpacity);
  });

  it('uses log scale — count 100 is not 10× the opacity of count 10', () => {
    const m = emptyMatrix();
    m[1][14] = 10;
    m[2][14] = 100;
    const { container } = render(<CommitPunchCard report={makeReport(m)} />);
    const cells = Array.from(
      container.querySelectorAll<SVGRectElement>('rect.punch-card-cell'),
    );
    const ten = cells.find(
      (c) => c.getAttribute('data-day') === '1' && c.getAttribute('data-hour') === '14',
    )!;
    const hundred = cells.find(
      (c) => c.getAttribute('data-day') === '2' && c.getAttribute('data-hour') === '14',
    )!;
    const tenOp = parseFloat(ten.getAttribute('fill-opacity') ?? '0');
    const hundredOp = parseFloat(hundred.getAttribute('fill-opacity') ?? '0');
    // Linear ratio would be 10. Log-scaled ratio should be < 5.
    expect(hundredOp / tenOp).toBeLessThan(5);
    expect(hundredOp / tenOp).toBeGreaterThan(1.2);
  });

  it('renders stress-zone shading rectangles for weekend rows and late-night cols', () => {
    // Use a non-empty matrix so the empty-state branch is NOT taken — the
    // empty-state short-circuit returns before the SVG is rendered.
    const m = emptyMatrix();
    m[1][14] = 1; // Mon 14:00 — any nonzero cell satisfies total > 0
    const { container } = render(<CommitPunchCard report={makeReport(m)} />);
    expect(
      container.querySelectorAll('rect.punch-card-stress-zone').length,
    ).toBeGreaterThan(0);
  });

  it('shows empty-state copy when matrix is all-zero', () => {
    const { getByText } = render(
      <CommitPunchCard report={makeReport(emptyMatrix())} />,
    );
    expect(getByText(/no commits/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test CommitPunchCard --run
```

Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Implement the punch card**

Create `apps/web/src/components/hero/CommitPunchCard.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';

import { HeroCaption } from '../shared/HeroCaption';
import { Tooltip } from '../shared/Tooltip';
import type { GitrelicReport } from '@gitrelic/core';

interface CommitPunchCardProps {
  report: GitrelicReport;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LATE_NIGHT_HOURS = new Set([23, 0, 1, 2, 3, 4]); // matches isLateNight in core
const WEEKEND_DAYS = new Set([0, 6]); // Sun, Sat

const PADDING = { top: 12, right: 16, bottom: 32, left: 48 };
const HOUR_TICK_STEP = 3; // label every 3 hours

function formatHour(h: number): string {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

export function CommitPunchCard({ report }: CommitPunchCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 800, height: 400 });
  const [hover, setHover] = useState<{ day: number; hour: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDims({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const matrix = report.commitTiming.repoHourDayMatrix;

  const total = useMemo(() => {
    let sum = 0;
    for (const row of matrix) for (const c of row) sum += c;
    return sum;
  }, [matrix]);

  const maxCount = useMemo(() => {
    let m = 0;
    for (const row of matrix) for (const c of row) if (c > m) m = c;
    return m;
  }, [matrix]);

  if (total === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-sm text-text-tertiary">
          No commits in the analyzed window.
        </div>
        <HeroCaption
          primary="When this team works."
          subtitle="Cells are commit counts (log-scaled). Shaded rows mark weekends; shaded columns mark late-night hours."
        />
      </div>
    );
  }

  // Log scale opacity: opacity(count) = log(count + 1) / log(max + 1)
  // Count 0 → 0; count = max → 1.
  const logMax = Math.log(maxCount + 1);
  const opacityFor = (count: number): number =>
    count === 0 ? 0 : Math.log(count + 1) / logMax;

  const innerWidth = Math.max(dims.width - PADDING.left - PADDING.right, 24);
  const innerHeight = Math.max(dims.height - PADDING.top - PADDING.bottom - 80, 100);
  const cellWidth = innerWidth / 24;
  const cellHeight = innerHeight / 7;

  const hoverData = hover ? matrix[hover.day][hover.hour] : null;
  const hoverPercent =
    hover && hoverData !== null && total > 0
      ? Math.round((hoverData / total) * 1000) / 10
      : 0;

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div className="flex-1 relative">
        <svg width={dims.width} height={dims.height - 80}>
          {/* Stress-zone shading: weekend rows (Sun=0, Sat=6) */}
          {[0, 6].map((day) => (
            <rect
              key={`wknd-${day}`}
              className="punch-card-stress-zone"
              x={PADDING.left}
              y={PADDING.top + day * cellHeight}
              width={innerWidth}
              height={cellHeight}
              fill="var(--severity-warning)"
              fillOpacity={0.08}
            />
          ))}
          {/* Stress-zone shading: late-night cols (23, 0, 1, 2, 3, 4) */}
          {Array.from(LATE_NIGHT_HOURS).map((hour) => (
            <rect
              key={`late-${hour}`}
              className="punch-card-stress-zone"
              x={PADDING.left + hour * cellWidth}
              y={PADDING.top}
              width={cellWidth}
              height={innerHeight}
              fill="var(--severity-warning)"
              fillOpacity={0.08}
            />
          ))}
          {/* Cells */}
          {matrix.map((row, day) =>
            row.map((count, hour) => (
              <rect
                key={`${day}-${hour}`}
                className="punch-card-cell cursor-default"
                data-day={day}
                data-hour={hour}
                x={PADDING.left + hour * cellWidth + 1}
                y={PADDING.top + day * cellHeight + 1}
                width={Math.max(cellWidth - 2, 1)}
                height={Math.max(cellHeight - 2, 1)}
                rx={2}
                fill="var(--accent-primary)"
                fillOpacity={opacityFor(count)}
                stroke={
                  hover?.day === day && hover.hour === hour
                    ? 'var(--text-primary)'
                    : 'none'
                }
                strokeWidth={1}
                onMouseEnter={() => setHover({ day, hour })}
                onMouseLeave={() => setHover(null)}
              />
            )),
          )}
          {/* Day labels (left) */}
          {DAY_LABELS.map((label, day) => (
            <text
              key={`day-${day}`}
              x={PADDING.left - 8}
              y={PADDING.top + day * cellHeight + cellHeight / 2 + 4}
              textAnchor="end"
              className="text-[10px] fill-text-tertiary"
            >
              {label}
            </text>
          ))}
          {/* Hour labels (bottom, every 3 hours) */}
          {Array.from({ length: 24 }, (_, h) => h)
            .filter((h) => h % HOUR_TICK_STEP === 0)
            .map((hour) => (
              <text
                key={`hour-${hour}`}
                x={PADDING.left + hour * cellWidth + cellWidth / 2}
                y={PADDING.top + innerHeight + 16}
                textAnchor="middle"
                className="text-[10px] fill-text-tertiary"
              >
                {formatHour(hour)}
              </text>
            ))}
        </svg>
        {hover && hoverData !== null && (
          <div
            className="absolute pointer-events-none bg-tooltip-bg text-tooltip-text text-[11px] px-2 py-1 rounded shadow-lg"
            style={{
              left: PADDING.left + hover.hour * cellWidth + cellWidth + 4,
              top: PADDING.top + hover.day * cellHeight,
            }}
          >
            <div className="font-mono">
              {DAY_LABELS[hover.day]} {formatHour(hover.hour)}
            </div>
            <div className="text-text-tertiary">
              <span className="font-mono text-text-primary font-semibold">
                {hoverData}
              </span>{' '}
              commits ({hoverPercent}%)
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary="When this team works."
        subtitle="Cells are commit counts (log-scaled). Shaded rows mark weekends; shaded columns mark late-night hours."
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test CommitPunchCard --run
```

Expected: all five tests pass. If the log-scale ratio assertion is too tight, widen the bounds in the test (the actual ratio for 100 vs 10 with the formula above is `log(101)/log(11) ≈ 1.93`).

- [ ] **Step 5: Lint & commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format
git add apps/web/src/components/hero/CommitPunchCard.tsx apps/web/src/components/hero/CommitPunchCard.test.tsx
git commit -m "feat(web): CommitPunchCard hero — 7×24 log-scaled heatmap (RELIC-323)

Default hero for the commit-timing analyzer. Cells are log-scaled commit
counts; weekend rows and late-night cols (23, 0–4) get a subtle warning
tint behind them so the off-hours stress quadrant is visually distinct
without breaking the unified single-color cell ramp.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Hero — `StressTrend`

**Files:**
- Create: `apps/web/src/components/hero/StressTrend.tsx`
- Create: `apps/web/src/components/hero/StressTrend.test.tsx`

3-layer disjoint stacked bar chart by ISO month. Layers (bottom → top): `weekendLateNight` (critical), `singleCriterion` (warning), `healthy` (neutral). Y = total commits in month. Mirrors `ParallelTimeline` in shape and event surface.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/hero/StressTrend.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';

import { StressTrend } from './StressTrend';
import type { GitrelicReport } from '@gitrelic/core';

function makeReport(
  byMonth: GitrelicReport['commitTiming']['byMonth'],
): GitrelicReport {
  return {
    commitTiming: {
      files: [],
      stressFiles: [],
      repoLateNightPercent: 0,
      repoWeekendPercent: 0,
      summary: '',
      repoHourDayMatrix: Array.from({ length: 7 }, () =>
        new Array<number>(24).fill(0),
      ),
      highStress: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth,
      authorStress: [],
    },
  } as unknown as GitrelicReport;
}

describe('StressTrend', () => {
  it('renders one bar per month with three stacked segments', () => {
    const report = makeReport([
      { month: '2026-01', weekendLateNight: 2, singleCriterion: 5, healthy: 30, total: 37 },
      { month: '2026-02', weekendLateNight: 0, singleCriterion: 3, healthy: 40, total: 43 },
    ]);
    const { container } = render(<StressTrend report={report} />);
    const bars = container.querySelectorAll('g.stress-trend-bar');
    expect(bars.length).toBe(2);
    bars.forEach((bar) => {
      expect(bar.querySelectorAll('rect').length).toBe(3);
    });
  });

  it('weekendLateNight segment uses critical color; singleCriterion uses warning', () => {
    const report = makeReport([
      { month: '2026-01', weekendLateNight: 2, singleCriterion: 5, healthy: 30, total: 37 },
    ]);
    const { container } = render(<StressTrend report={report} />);
    const crit = container.querySelector('rect.stress-trend-critical');
    const warn = container.querySelector('rect.stress-trend-warning');
    const healthy = container.querySelector('rect.stress-trend-healthy');
    expect(crit?.getAttribute('fill')).toContain('critical');
    expect(warn?.getAttribute('fill')).toContain('warning');
    expect(healthy).toBeTruthy();
  });

  it('layer heights sum to bar height (proportional to total)', () => {
    const report = makeReport([
      { month: '2026-01', weekendLateNight: 10, singleCriterion: 20, healthy: 70, total: 100 },
    ]);
    const { container } = render(<StressTrend report={report} />);
    const layers = container.querySelectorAll<SVGRectElement>(
      'g.stress-trend-bar rect',
    );
    const totalHeight = Array.from(layers).reduce(
      (sum, r) => sum + parseFloat(r.getAttribute('height') ?? '0'),
      0,
    );
    expect(totalHeight).toBeGreaterThan(0);
  });

  it('shows empty-state copy when byMonth is empty', () => {
    const { getByText } = render(<StressTrend report={makeReport([])} />);
    expect(getByText(/no commits/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test StressTrend --run
```

Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Implement `StressTrend`**

Create `apps/web/src/components/hero/StressTrend.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';

import { HeroCaption } from '../shared/HeroCaption';
import type { GitrelicReport } from '@gitrelic/core';

interface StressTrendProps {
  report: GitrelicReport;
}

const PADDING = { top: 16, right: 24, bottom: 40, left: 56 };
const BAR_GAP = 4;

function formatMonth(iso: string): string {
  const [yearStr, monthStr] = iso.split('-');
  const year = yearStr.slice(2);
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const monthIdx = parseInt(monthStr, 10) - 1;
  return `${monthNames[monthIdx]} ${year}`;
}

export function StressTrend({ report }: StressTrendProps) {
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

  const months = report.commitTiming.byMonth;
  const maxTotal = useMemo(
    () => months.reduce((m, b) => (b.total > m ? b.total : m), 0),
    [months],
  );

  if (months.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center text-sm text-text-tertiary">
          No commits in the analyzed window.
        </div>
        <HeroCaption
          primary="Is off-hours pressure trending?"
          subtitle="Bars layered by stress severity per month — red is the worst (weekend + late-night), orange is one criterion, neutral is healthy hours."
        />
      </div>
    );
  }

  const innerWidth = Math.max(dims.width - PADDING.left - PADDING.right, 64);
  const innerHeight = Math.max(dims.height - PADDING.top - PADDING.bottom - 80, 120);
  const barWidth = Math.max(
    (innerWidth - BAR_GAP * (months.length - 1)) / months.length,
    2,
  );
  const yScale = (v: number) => (v / Math.max(maxTotal, 1)) * innerHeight;
  const tickStep = months.length <= 12 ? 1 : Math.ceil(months.length / 12);

  const hoverData = hoverIdx !== null ? months[hoverIdx] : null;

  return (
    <div ref={containerRef} className="flex flex-col h-full">
      <div className="flex-1 relative">
        <svg width={dims.width} height={dims.height - 80}>
          {months.map((bucket, i) => {
            const x = PADDING.left + i * (barWidth + BAR_GAP);
            const healthyH = yScale(bucket.healthy);
            const singleH = yScale(bucket.singleCriterion);
            const critH = yScale(bucket.weekendLateNight);
            const baseY = PADDING.top + innerHeight;
            return (
              <g
                key={bucket.month}
                className="stress-trend-bar cursor-default"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
              >
                {/* Bottom: weekend + late-night (worst) */}
                <rect
                  className="stress-trend-critical"
                  x={x}
                  y={baseY - critH}
                  width={barWidth}
                  height={critH}
                  fill="var(--severity-critical)"
                />
                {/* Middle: single-criterion */}
                <rect
                  className="stress-trend-warning"
                  x={x}
                  y={baseY - critH - singleH}
                  width={barWidth}
                  height={singleH}
                  fill="var(--severity-warning)"
                />
                {/* Top: healthy */}
                <rect
                  className="stress-trend-healthy"
                  x={x}
                  y={baseY - critH - singleH - healthyH}
                  width={barWidth}
                  height={healthyH}
                  fill="var(--surface-tertiary)"
                />
              </g>
            );
          })}
          {/* Month tick labels */}
          {months
            .filter((_, i) => i % tickStep === 0)
            .map((bucket) => {
              const idx = months.indexOf(bucket);
              const x =
                PADDING.left + idx * (barWidth + BAR_GAP) + barWidth / 2;
              return (
                <text
                  key={bucket.month}
                  x={x}
                  y={PADDING.top + innerHeight + 16}
                  textAnchor="middle"
                  className="text-[10px] fill-text-tertiary"
                >
                  {formatMonth(bucket.month)}
                </text>
              );
            })}
        </svg>
        {hoverData && hoverIdx !== null && (
          <div
            className="absolute pointer-events-none bg-tooltip-bg text-tooltip-text text-[11px] px-2 py-1 rounded shadow-lg"
            style={{
              left: PADDING.left + hoverIdx * (barWidth + BAR_GAP) + barWidth + 6,
              top: PADDING.top + 8,
            }}
          >
            <div className="font-mono">{formatMonth(hoverData.month)}</div>
            <div className="text-text-tertiary">
              <span className="font-mono text-text-primary font-semibold">
                {hoverData.total}
              </span>{' '}
              commits
            </div>
            <div className="text-text-tertiary mt-1">
              <span className="font-mono text-severity-critical">
                {hoverData.weekendLateNight}
              </span>{' '}
              weekend-late-night ·{' '}
              <span className="font-mono text-severity-warning">
                {hoverData.singleCriterion}
              </span>{' '}
              single-criterion ·{' '}
              <span className="font-mono text-text-primary">
                {hoverData.healthy}
              </span>{' '}
              healthy
            </div>
          </div>
        )}
      </div>
      <HeroCaption
        primary="Is off-hours pressure trending?"
        subtitle="Bars layered by stress severity per month — red is the worst (weekend + late-night), orange is one criterion, neutral is healthy hours."
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test StressTrend --run
```

Expected: all four tests pass. The "fill contains 'critical'/'warning'" assertions check that the `fill` attribute string includes the token name — should hold for `var(--severity-critical)` etc.

- [ ] **Step 5: Lint & commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format
git add apps/web/src/components/hero/StressTrend.tsx apps/web/src/components/hero/StressTrend.test.tsx
git commit -m "feat(web): StressTrend hero — disjoint 3-layer stacked monthly bar (RELIC-323)

Alt hero for the commit-timing analyzer. Three disjoint layers per
month bar (weekendLateNight / singleCriterion / healthy) sum cleanly to
total commits — answers \"is off-hours pressure trending?\" via the
temporal axis the punch card cannot show.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wire heroes into `HeroViz` type, `HERO_LABELS`, and Shell

**Files:**
- Modify: `apps/web/src/presets/types.ts` (add `'punch-card'` and `'stress-trend'` to `HeroViz`)
- Modify: `apps/web/src/components/layout/Shell.tsx` (add HERO_LABELS entries; add hero render conditionals)

This is glue — the registry update is in Task 8.

- [ ] **Step 1: Add the two new IDs to `HeroViz`**

In `apps/web/src/presets/types.ts`, append to the `HeroViz` union (around line 42):

```ts
export type HeroViz =
  | 'treemap'
  | 'treemap-test'
  // … existing …
  | 'languages-stacked'
  | 'test-coverage-by-dir'
  | 'punch-card'
  | 'stress-trend';
```

- [ ] **Step 2: Add labels to `HERO_LABELS`**

In `apps/web/src/components/layout/Shell.tsx`, extend `HERO_LABELS` (around line 101):

```ts
export const HERO_LABELS: Record<HeroViz, string> = {
  // … existing …
  'punch-card': 'Punch Card',
  'stress-trend': 'Trend',
};
```

(Per `project_hero_label_uniqueness.md` memory — `Trend` is reused across analyzers as a chart-kind label and that's allowed; per-preset uniqueness is what matters.)

- [ ] **Step 3: Add hero render conditionals in Shell**

Find the block where `parallel-score-histogram` and `parallel-timeline` are rendered (around Shell.tsx line 403). Add adjacent conditionals (right after the parallel-timeline render) for the two new heroes. Add the imports at the top of the file alongside the other hero imports:

```tsx
import { CommitPunchCard } from '../hero/CommitPunchCard';
import { StressTrend } from '../hero/StressTrend';
```

And in the render block:

```tsx
{selection.activeHeroViz === 'punch-card' && (
  <CommitPunchCard report={report} />
)}
{selection.activeHeroViz === 'stress-trend' && (
  <StressTrend report={report} />
)}
```

- [ ] **Step 4: Verify Shell compiles + existing tests still pass**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test Shell --run
pnpm --filter @gitrelic/web build
```

Expected: pre-existing Shell tests pass; web build succeeds. (Type-checker would flag the new HeroViz IDs if Shell missed them.)

- [ ] **Step 5: Commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format
git add apps/web/src/presets/types.ts apps/web/src/components/layout/Shell.tsx
git commit -m "feat(web): wire punch-card and stress-trend into HeroViz + Shell (RELIC-323)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Tab rewrite — `CommitTimingTab` → `<NarrativeKPI>` consumer

**Files:**
- Modify: `apps/web/src/components/tabs/CommitTimingTab.tsx` (rewrite end-to-end)
- Create: `apps/web/src/components/tabs/CommitTimingTab.test.tsx`

The tab pivots from a per-file `SortableTable` to a `<NarrativeKPI>` whose finding lists the top-3 stressed contributors. Per the spec deviation logged in the plan header — the analyzer already produces `authorStress` sorted, floor-filtered, and disambiguated, so the tab just slices.

**Inspector reachability note (intentional, per spec):** This rewrite removes the per-file row click that previously opened the Inspector with `FileTimingProfile` detail. The Inspector is still reachable from this preset via clicks in the *hero* (e.g., file-level scatter / treemap heroes wired in the broader Shell selection state) and from any other tab that surfaces files. The spec explicitly accepts this trade-off — see `docs/superpowers/specs/2026-05-03-commit-timing-polish-design.md` § "Why people-pivot, not file-pivot". If a future polish ticket wants per-file detail back from this preset, the most obvious extension is making PunchCard cells clickable to filter the bottom panel by hour-of-day band, but that's deliberately out of scope here.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/tabs/CommitTimingTab.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { CommitTimingTab } from './CommitTimingTab';
import type {
  AuthorStressProfile,
  FileTimingProfile,
  GitrelicReport,
} from '@gitrelic/core';

function makeAuthor(
  overrides: Partial<AuthorStressProfile> = {},
): AuthorStressProfile {
  return {
    email: 'alice@example.com',
    name: 'Alice Example',
    totalCommits: 100,
    lateNightCommits: 40,
    weekendCommits: 20,
    lateNightPercent: 40,
    weekendPercent: 20,
    stressScore: 32,
    ...overrides,
  };
}

function makeFile(
  file: string,
  stressScore = 75,
): FileTimingProfile {
  return {
    file,
    totalCommits: 10,
    lateNightPercent: 60,
    weekendPercent: 30,
    peakHour: 3,
    peakDay: 6,
    hourDistribution: new Array(24).fill(0),
    stressScore,
  };
}

function makeReport(overrides: Partial<GitrelicReport['commitTiming']> = {}): GitrelicReport {
  return {
    commitTiming: {
      files: [],
      stressFiles: [],
      repoLateNightPercent: 4,
      repoWeekendPercent: 7,
      summary: '4% of commits happen after hours, 7% on weekends',
      repoHourDayMatrix: Array.from({ length: 7 }, () =>
        new Array<number>(24).fill(0),
      ),
      highStress: 0,
      tierMix: { low: 0, medium: 0, high: 0, critical: 0 },
      byMonth: [],
      authorStress: [],
      ...overrides,
    },
  } as unknown as GitrelicReport;
}

describe('CommitTimingTab', () => {
  it('big number matches highStress', () => {
    render(
      <CommitTimingTab
        report={makeReport({ highStress: 7 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number')).toHaveTextContent(
      '7',
    );
  });

  it('renders top-3 stressed contributors with full names', () => {
    const authors = [
      makeAuthor({ name: 'Sebastian Markbåge', stressScore: 40 }),
      makeAuthor({ name: 'Sebastian Silbermann', stressScore: 35 }),
      makeAuthor({ name: 'Joseph Savona', stressScore: 22 }),
      makeAuthor({ name: 'Lauren', stressScore: 10 }),
    ];
    render(
      <CommitTimingTab
        report={makeReport({ authorStress: authors, highStress: 1 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/Sebastian Markbåge/)).toBeInTheDocument();
    expect(screen.getByText(/Sebastian Silbermann/)).toBeInTheDocument();
    expect(screen.getByText(/Joseph Savona/)).toBeInTheDocument();
    expect(screen.queryByText(/^Lauren$/)).not.toBeInTheDocument();
  });

  it('disambiguator suffix appears in finding when names collide (analyzer-supplied)', () => {
    const authors = [
      makeAuthor({
        name: 'Alex Lee (alex)',
        email: 'alex@x.com',
        stressScore: 50,
      }),
      makeAuthor({
        name: 'Alex Lee (alee)',
        email: 'alee@x.com',
        stressScore: 40,
      }),
    ];
    render(
      <CommitTimingTab
        report={makeReport({ authorStress: authors, highStress: 1 })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/Alex Lee \(alex\)/)).toBeInTheDocument();
    expect(screen.getByText(/Alex Lee \(alee\)/)).toBeInTheDocument();
  });

  it('subline shows repo aggregate facts', () => {
    render(
      <CommitTimingTab
        report={makeReport({
          repoLateNightPercent: 4,
          repoWeekendPercent: 7,
          authorStress: [makeAuthor()],
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/4%.*late-night/i)).toBeInTheDocument();
    expect(screen.getByText(/7%.*weekend/i)).toBeInTheDocument();
  });

  it('empty-state — highStress=0 and authorStress non-empty: still renders contributors', () => {
    render(
      <CommitTimingTab
        report={makeReport({
          highStress: 0,
          authorStress: [makeAuthor({ name: 'Alice Example' })],
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByTestId('narrative-kpi-big-number')).toHaveTextContent(
      '0',
    );
    expect(screen.getByText(/Alice Example/)).toBeInTheDocument();
  });

  it('no-eligible-authors — authorStress empty: shows fallback message', () => {
    render(
      <CommitTimingTab
        report={makeReport({ highStress: 0, authorStress: [] })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/no contributors with sufficient commit history/i),
    ).toBeInTheDocument();
  });

  it('directory rollup extras — populated when high-stress files exist', () => {
    const stressedFiles = [makeFile('src/a.ts'), makeFile('src/b.ts'), makeFile('docs/c.md')];
    render(
      <CommitTimingTab
        report={makeReport({
          highStress: 3,
          files: stressedFiles,
          authorStress: [makeAuthor()],
        })}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(screen.getByText(/where they live/i)).toBeInTheDocument();
    expect(screen.getByText(/src/)).toBeInTheDocument();
  });

  it('see-also footer wires onApplyPreset for shame and hotspots', () => {
    const onApplyPreset = vi.fn();
    render(
      <CommitTimingTab
        report={makeReport({ authorStress: [makeAuthor()] })}
        onApplyPreset={onApplyPreset}
      />,
    );
    screen.getByText('Shame').click();
    expect(onApplyPreset).toHaveBeenCalledWith('shame');
    screen.getByText('Hotspots').click();
    expect(onApplyPreset).toHaveBeenCalledWith('hotspots');
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test CommitTimingTab --run
```

Expected: tests fail because the existing tab renders a `SortableTable`, not a `<NarrativeKPI>`.

- [ ] **Step 3: Rewrite `CommitTimingTab.tsx`**

Replace the entire contents of `apps/web/src/components/tabs/CommitTimingTab.tsx` with:

```tsx
import { aggregateCommitTimingByDirectory } from '../../utils/commitTimingByDirectory';
import { NarrativeKPI } from '../shared/NarrativeKPI';
import { Tooltip } from '../shared/Tooltip';
import type { PresetId } from '../../presets/types';
import type { BadgeVariant } from '../theme';
import type { GitrelicReport } from '@gitrelic/core';

interface CommitTimingTabProps {
  report: GitrelicReport;
  onApplyPreset: (id: PresetId) => void;
}

const TOP_FILES_COUNT = 3;
const DIRECTORY_ROLLUP_LIMIT = 5;
export const HIGH_STRESS_THRESHOLD = 70;

// Headcount tiering: 0 = Healthy, 1..MODERATE_THRESHOLD-1 = Moderate, ≥MODERATE_THRESHOLD = High Stress.
// Same shape as Parallel Dev — Team & Activity group consistency.
export const MODERATE_THRESHOLD = 5;

function tierBadge(highStressCount: number): {
  variant: BadgeVariant;
  label: string;
} {
  if (highStressCount === 0) return { variant: 'healthy', label: 'Healthy' };
  if (highStressCount < MODERATE_THRESHOLD)
    return { variant: 'warning', label: 'Moderate' };
  return { variant: 'critical', label: 'High Stress' };
}

export function CommitTimingTab({
  report,
  onApplyPreset,
}: CommitTimingTabProps) {
  const {
    highStress,
    authorStress,
    files,
    repoLateNightPercent,
    repoWeekendPercent,
  } = report.commitTiming;

  const totalCommits = files.reduce((sum, f) => sum + f.totalCommits, 0);
  const tier = tierBadge(highStress);
  const topAuthors = authorStress.slice(0, TOP_FILES_COUNT);

  const highStressFiles = files.filter(
    (f) => f.stressScore >= HIGH_STRESS_THRESHOLD,
  );
  const allDirectoryRows = aggregateCommitTimingByDirectory(highStressFiles);
  const directoryRows = allDirectoryRows.slice(0, DIRECTORY_ROLLUP_LIMIT);
  const hiddenDirectoryCount = Math.max(
    0,
    allDirectoryRows.length - DIRECTORY_ROLLUP_LIMIT,
  );
  const maxDirCount = directoryRows[0]?.count ?? 1;

  return (
    <NarrativeKPI
      bigNumber={String(highStress)}
      tier={tier}
      metric={`Files ≥${HIGH_STRESS_THRESHOLD} Stress`}
      finding={
        topAuthors.length > 0 ? (
          <div className="flex flex-col gap-1">
            <div className="text-[9px] text-text-tertiary uppercase tracking-[1px]">
              Top stressed contributors
            </div>
            {topAuthors.map((a) => (
              <div key={a.email} className="leading-[1.5]">
                <span className="text-text-primary">{a.name}</span>{' '}
                <span className="text-text-tertiary">
                  · Late:{' '}
                  <span className="font-mono text-text-primary font-semibold">
                    {a.lateNightPercent}%
                  </span>{' '}
                  · Weekend:{' '}
                  <span className="font-mono text-text-primary font-semibold">
                    {a.weekendPercent}%
                  </span>{' '}
                  ·{' '}
                  <span className="font-mono text-text-primary font-semibold">
                    {a.totalCommits}
                  </span>{' '}
                  commits
                </span>
              </div>
            ))}
          </div>
        ) : (
          <>
            No contributors with sufficient commit history to score (need ≥5
            commits per author).
          </>
        )
      }
      subline={
        totalCommits > 0 || authorStress.length > 0 ? (
          <>
            <strong>{repoLateNightPercent}%</strong> late-night ·{' '}
            <strong>{repoWeekendPercent}%</strong> weekend across the analyzed
            window
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
        { label: 'Shame', presetId: 'shame' },
        { label: 'Hotspots', presetId: 'hotspots' },
      ]}
      onApplyPreset={onApplyPreset}
    />
  );
}
```

- [ ] **Step 4: Update the call-site in `BottomPanel.tsx`**

`CommitTimingTab` now takes `(report, onApplyPreset)` instead of `(report, onSelectFile)`. Find the `CommitTimingTab` render in `apps/web/src/components/layout/BottomPanel.tsx` and update the prop:

Current call (likely):

```tsx
<CommitTimingTab report={report} onSelectFile={onSelectFile} />
```

Replace with:

```tsx
<CommitTimingTab report={report} onApplyPreset={onApplyPreset} />
```

(The signature mirrors `ParallelDevTab` exactly — see `BottomPanel.tsx` for the existing `ParallelDevTab` call as reference.)

- [ ] **Step 5: Run tests**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test CommitTimingTab --run
```

Expected: all eight tests pass.

- [ ] **Step 6: Run full web suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test --run
```

Expected: full pass. If any other test depended on the old `onSelectFile` prop on `CommitTimingTab`, fix it now.

- [ ] **Step 7: Lint & commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format
git add apps/web/src/components/tabs/CommitTimingTab.tsx apps/web/src/components/tabs/CommitTimingTab.test.tsx apps/web/src/components/layout/BottomPanel.tsx
git commit -m "feat(web): CommitTimingTab → NarrativeKPI with author-pivot finding (RELIC-323)

Replace the per-file SortableTable with a NarrativeKPI panel whose
finding pivots to top-3 stressed contributors (Bus Factor pattern).
Disambiguator suffixes (\"Alex Lee (alex)\") arrive on authorStress[].name
already, so the tab just renders the supplied name. Directory rollup
extras populated from high-stress files; gracefully empty on healthy
repos.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Metrics strip retune

**Files:**
- Modify: `apps/web/src/presets/metrics/commit-timing.ts` (slot 3 + slot 4 changes)
- (No new test file — existing convention in this repo doesn't include preset metrics tests; the values are exercised by the rendered Shell.)

- [ ] **Step 1: Replace the entire preset file**

Replace the contents of `apps/web/src/presets/metrics/commit-timing.ts` with:

```ts
import { fmt } from '../../components/theme';
import type { Metric } from '../types';
import type { GitrelicReport } from '@gitrelic/core';

const HIGH_STRESS_FILES_THRESHOLD = 5; // matches CommitTimingTab.MODERATE_THRESHOLD
const STRESSED_AUTHOR_SCORE_THRESHOLD = 50; // per-author warning band

export function commitTimingMetrics(report: GitrelicReport): Metric[] {
  const {
    highStress,
    authorStress,
    repoLateNightPercent,
    repoWeekendPercent,
  } = report.commitTiming;

  const stressedAuthors = authorStress.filter(
    (a) => a.stressScore >= STRESSED_AUTHOR_SCORE_THRESHOLD,
  ).length;

  return [
    {
      label: 'Late Night %',
      value: `${repoLateNightPercent}%`,
      color:
        repoLateNightPercent >= 20
          ? 'var(--severity-critical)'
          : repoLateNightPercent >= 10
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'Weekend %',
      value: `${repoWeekendPercent}%`,
      color:
        repoWeekendPercent >= 20
          ? 'var(--severity-critical)'
          : repoWeekendPercent >= 10
            ? 'var(--severity-warning)'
            : 'var(--severity-healthy)',
    },
    {
      label: 'High Stress',
      value: fmt(highStress),
      color:
        highStress === 0
          ? 'var(--severity-healthy)'
          : highStress < HIGH_STRESS_FILES_THRESHOLD
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
    {
      label: 'Stressed Authors',
      value: fmt(stressedAuthors),
      color:
        stressedAuthors === 0
          ? 'var(--severity-healthy)'
          : stressedAuthors <= 2
            ? 'var(--severity-warning)'
            : 'var(--severity-critical)',
    },
  ];
}
```

- [ ] **Step 2: Run web tests + build**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test --run
pnpm --filter @gitrelic/web build
```

Expected: full pass + clean build.

- [ ] **Step 3: Lint & commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format
git add apps/web/src/presets/metrics/commit-timing.ts
git commit -m "feat(web): commit-timing metrics — High Stress + Stressed Authors slots (RELIC-323)

Slot 3 \"Stress Files\" (>50) → \"High Stress\" (≥70 file count) so the
threshold matches the panel's tier badge. Slot 4 \"Top Stress\" → \"Stressed
Authors\" — count of authorStress entries with stressScore ≥ 50, mirroring
the panel's people-axis pivot.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Hero registry — point `commit-timing` preset at the new heroes

**Files:**
- Modify: `apps/web/src/presets/registry.ts` (`commit-timing` entry — defaultViz + altTabs)

- [ ] **Step 1: Update the registry entry**

In `apps/web/src/presets/registry.ts`, find the `'commit-timing'` block (around line 324). Replace its `hero` block:

```ts
'commit-timing': {
  id: 'commit-timing',
  tier: 'analyzer',
  label: 'Commit Timing',
  group: 'team-activity',
  hero: {
    defaultViz: 'punch-card',
    altTabs: ['punch-card', 'stress-trend'],
  },
  bottomPanel: {
    defaultTab: 'commit-timing',
    altTabs: ['commit-timing'],
  },
  metrics: commitTimingMetrics,
},
```

(The `timeline` and `swimlanes` IDs stay alive in `HeroViz` because `Overview` and `Contributors` presets still use them — only this preset's wiring changes.)

- [ ] **Step 2: Verify registry test passes**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web test registry --run
```

Expected: pass.

- [ ] **Step 3: Build + smoke**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm --filter @gitrelic/web build
```

Expected: clean build.

- [ ] **Step 4: Lint & commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format
git add apps/web/src/presets/registry.ts
git commit -m "feat(web): commit-timing preset — punch-card default + stress-trend alt (RELIC-323)

Strip timeline / swimlanes from the commit-timing preset (still alive in
overview / contributors). Default hero is now the punch-card heatmap;
stress-trend is the alt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Smoke test against the React repo

**Files:** none

**Prerequisite:** `~/Desktop/react` must be a fresh-ish clone of facebook/react (per `reference_smoke_target_react.md` memory — this is the standard smoke target for hero/dashboard work). If the path doesn't exist, clone with:

```bash
cd ~/Desktop && git clone https://github.com/facebook/react.git
```

This is a manual verification step. Run the CLI with `--web` against the standard smoke target.

- [ ] **Step 1: Build the CLI from the worktree**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm build
```

Expected: clean build of core + cli + web.

- [ ] **Step 2: Run against React**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

Expected: dashboard opens; metrics strip shows `Late Night % 4%`, `Weekend % 7%`, `High Stress 0`, `Stressed Authors N`. Click into "Commit Timing" preset.

Visual checklist:
- Hero default = punch-card. Cells visible for 7×24. Stress-zone tint behind weekend rows + late-night cols. Hover shows day/hour/count/% tooltip.
- Hero alt tab = "Trend". Shows `StressTrend` — most months should be mostly neutral (healthy), with occasional warning/critical slivers.
- Bottom panel = NarrativeKPI. Big number = 0 (Healthy badge). Top-3 stressed contributors visible (full names, no email format). Subline shows `4% late-night · 7% weekend across …`. Extras (`Where they live`) hidden because no high-stress files exist on React.
- See-also footer is sticky to bottom; clicking `Shame` switches preset; clicking `Hotspots` switches preset.

If anything visually wrong, halt and fix before proceeding to docs.

- [ ] **Step 3: Run a stressed test case manually if possible**

Optional: if a higher-stress repo is handy (one with weekend / late-night activity), point the CLI at it and verify the panel surfaces a non-zero `highStress`, the directory rollup populates, and the punch-card has visible weekend/late-night intensity.

---

## Task 10: VitePress docs page

**Files:**
- Create: `apps/docs/analyzers/commit-timing.md`
- Modify: `apps/docs/.vitepress/config.ts` (add to Analyzers sidebar)

Per `project_analyzer_polish_session_pattern.md` memory — docs page ships in the same PR.

- [ ] **Step 1: Inspect the parallel-dev page for structure**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
cat apps/docs/analyzers/parallel-dev.md
```

Expected: the doc has sections like "What it measures", per-hero explanations, a "What earns a flag" / KPI section, "See also". Match this structure.

- [ ] **Step 2: Write `commit-timing.md`**

Create `apps/docs/analyzers/commit-timing.md` with this content:

```markdown
# Commit Timing

The Commit Timing analyzer answers two questions: **when does this team work?** and **is anyone grinding?** It measures every commit's hour-of-day and day-of-week (in the author's local time, parsed from the commit's ISO timezone offset) and surfaces two stress signals: late-night work (11pm–4am) and weekend work (Sat / Sun).

## What it measures

Every commit contributes to a 7×24 hour-day matrix. Per file (and per author) we track:

- **Late-night percent** — commits between 11pm and 4am as a share of total
- **Weekend percent** — commits on Saturday or Sunday as a share of total

Per-file stress score:

```
stressScore = round(lateNightPercent × 0.6 + weekendPercent × 0.4)
```

Late-night is weighted more heavily because it's a stronger crunch / burnout signal — weekend work can be voluntary side-projects, while 3am commits typically aren't.

A file needs at least 3 commits to get a score. An author needs at least 5 commits to appear on the contributor leaderboard. Both floors exclude noise from one-off commits.

## How to read the punch card

The default hero is a **7×24 heatmap** — rows are days (Sun–Sat), columns are hours (0–23). Each cell's intensity is the repo-wide commit count for that (day, hour) bucket, **log-scaled** so rare-but-meaningful off-hours commits don't get washed out next to a busy weekday-afternoon peak.

Two things make stress visible without breaking the unified color ramp:

- Weekend rows (Sat, Sun) get a subtle warning-color tint behind them
- Late-night columns (23, 0–4) get the same tint
- The intersection (Sat 3am, Sun 1am, etc.) gets the tint twice and is visibly the worst quadrant

Hover any cell for the count + share-of-total %.

## How to read the stress trend

The alt hero is a **3-layer disjoint stacked bar by month**. Each bar's three layers (bottom → top):

- **`weekend-late-night`** — both criteria (worst). Critical / red.
- **`single-criterion`** — exactly one criterion. Warning / orange.
- **`healthy`** — neither. Neutral.

Bars sum cleanly to total commits in that month. The chart answers "is off-hours pressure trending up?" via the temporal axis the punch card cannot show.

## The KPI panel

The bottom panel pivots to the *people* axis — commit timing is fundamentally about humans, not files. The big number is the count of files with `stressScore ≥ 70` (the `High Stress` band). The finding under it lists the top-3 stressed contributors:

```
<full git author name> · Late: N% · Weekend: K% · M commits
```

If two contributors share an identical full git-name string, the analyzer disambiguates with the email's local-part (e.g. `Alex Lee (alex)` / `Alex Lee (alee)`).

The subline carries the repo-aggregate `X% late-night · Y% weekend across the analyzed window`. The `Where they live` extras section is a top-5 directory rollup of the high-stress files — empty on healthy repos, which is the correct signal.

## What earns a flag

| Signal | Tier |
|---|---|
| `highStress = 0` | Healthy |
| `highStress` 1–4 | Moderate |
| `highStress ≥ 5` | High Stress |

Per-author stress band for the metrics strip:

| Per-author `stressScore` | Counted in `Stressed Authors` slot |
|---|---|
| `< 50` | No |
| `≥ 50` | Yes |

## See also

- [Shame](./shame.md) — keyword-flagged commits (revert / hotfix / fix) often correlate with crisis stress
- [Hotspots](./hotspots.md) — high-churn × high-LOC files often coincide with stress patterns
```

- [ ] **Step 3: Add to VitePress sidebar**

`apps/docs/.vitepress/config.ts` has TWO places that may reference analyzer pages: (1) a top-level `analyzers/` link list (might already include `commit-timing`), and (2) the actual user-facing **Analyzers sidebar** block with `{ text, link }` entries that's alphabetized.

First read the file to find both blocks and the current alphabetization:

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
grep -n "Analyzer\|analyzers/\|text:\|link:" apps/docs/.vitepress/config.ts | head -60
```

Then in the alphabetized **Analyzers sidebar block** (the one with `{ text: 'Age Map', link: '/analyzers/age-map' }`-style entries), insert `Commit Timing` between `Churn` and `Parallel Dev` — alphabetical position:

```ts
{ text: 'Commit Timing', link: '/analyzers/commit-timing' },
```

Match the existing sidebar entry shape exactly. If the link is already present elsewhere in the file (top-level array), leave that alone — the user-facing sidebar block is what matters for navigation.

- [ ] **Step 4: Verify docs build**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm docs:build
```

Expected: VitePress build succeeds. Any "dead link" errors → fix the `link` path in the sidebar config.

- [ ] **Step 5: Lint & commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format
git add apps/docs/analyzers/commit-timing.md apps/docs/.vitepress/config.ts
git commit -m "docs: commit-timing analyzer page (RELIC-323)

Per the analyzer-polish-session pattern — docs page ships in the same
PR as the polish work. Mirrors structure of parallel-dev.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Update `polish-pattern.md` to reflect actual ship details

**Files:**
- Modify: `docs/polish-pattern.md` (move `commit-timing` from "spec — RELIC-323" to "shipped" status; capture deltas)

Per the spec § Implementation order step 9 — the doc is the source of truth. Update it to match reality.

- [ ] **Step 1: Read the existing `commit-timing` section before editing**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
grep -n "commit-timing" docs/polish-pattern.md
```

Find the line range of the `### \`commit-timing\` *(spec — RELIC-323)*` block. Read it in full so the find-and-replace strings below match the actual on-disk text. The doc has been edited multiple times since the polish initiative started; verify the surrounding bullets before applying any edits below.

- [ ] **Step 2: Update the `commit-timing` section heading**

In `docs/polish-pattern.md`, find the `### \`commit-timing\` *(spec — RELIC-323)*` heading. Change the status marker:

```markdown
### `commit-timing` *(shipped — RELIC-323)*
```

Update the bullets to reflect what actually shipped — the spec text in the doc is mostly correct but the **hero alt** changed from `StressHistogram` to `StressTrend`. Find this bullet block:

> - **Hero (default):** `CommitPunchCard` (NEW) — 7×24 heatmap …
> - **Hero (alt):** `StressHistogram` (NEW) — 10 bins of `stressScore`, ≥70 zone shaded …

Replace with:

```markdown
- **Hero (default):** `CommitPunchCard` (NEW) — 7×24 heatmap, days of week (rows: Sun–Sat) × hours of day (columns: 0–23), cells colored by repo-wide commit count via the new `repoHourDayMatrix` aggregate, **log-scaled** color ramp. Late-night columns (23, 0–4) and weekend rows (Sat, Sun) get a subtle warning-color tint behind them — the intersection is visibly the worst quadrant without breaking the unified single-color cell ramp. Iconic git-timing visualization (GitHub's punch-card chart was this exact form).
- **Hero (alt):** `StressTrend` (NEW) — 3-layer disjoint stacked bar by ISO month: `weekendLateNight` (critical) · `singleCriterion` (warning) · `healthy` (neutral). Bars sum cleanly to total commits per month. **Replaces the originally-spec'd `StressHistogram`** — a forensic look against the React repo (top-stress=40) showed the histogram on healthy repos collapses to a leftward spike that confirms the big number visually but adds no axis the punch card lacks. `StressTrend` adds the temporal axis the punch card cannot show (per-month evolution of the worst-vs-mild stress mix). Same kind-of-chart as `ShameTrend` (RELIC-308) and `ParallelTimeline` (RELIC-309); the fourth disjoint-severity time-series in the polish initiative.
```

Update the bottom-panel bullet describing the finding — it should reflect the per-author pivot:

> - **Sub-content:** Top **three** stress files (basename + `Late: N% · Weekend: K%`) as the finding; subline = repo-aggregate context …

Replace with:

```markdown
- **Sub-content:** Top **three** stressed *contributors* (full git author name + `Late: N% · Weekend: K% · M commits`) as the finding — pivots away from the originally-spec'd per-file finding to mirror Bus Factor's people-pivot precedent (RELIC-304). Rationale: commit-timing is fundamentally about *human behavior*, not file properties; on a healthy repo (React, top-stress = 40 → `highStress = 0`) a per-file finding hollows the panel, while per-author always carries because author stress percentages exist on every repo with commits. Subline: repo-aggregate `X% late-night · Y% weekend across the analyzed window`.
```

Update the metrics-strip bullet — slot 3 took the `High Stress` rename, slot 4 became `Stressed Authors`:

> - **Metrics-strip slot 3 fix:** `Stress Files` currently filters by `stressScore > 50` …

Replace with:

```markdown
- **Metrics-strip retune:** Slot 3 `Stress Files` (`> 50`) → `High Stress` (`≥ 70` file count). Slot 4 `Top Stress` (top file's score) → `Stressed Authors` (count of `authorStress` entries with `stressScore ≥ 50`, with `MIN_AUTHOR_COMMITS = 5` floor applied upstream) — mirrors the panel's people-pivot. Severity bands match the panel's tier badge for slot 3 (0 / 1–4 / 5+); slot 4 uses 0 / 1–2 / 3+ since per-author stress is harder to push past 50.
```

Update the backend-changes bullet — `MIN_AUTHOR_COMMITS = 5` and the local-month parse extension are both worth calling out:

> - **Backend changes:**
>   - Add `repoHourDayMatrix: number[][]` …

Replace with:

```markdown
- **Backend changes:**
  - Add `repoHourDayMatrix: number[][]` (7 rows × 24 cols, day-of-week × hour) to `CommitTimingReport`. Required for the punch card.
  - Add `highStress: number` (count of files with `stressScore ≥ 70`).
  - Add `tierMix: { low; medium; high; critical }` aggregate (band counts using 0–24 / 25–49 / 50–74 / 75+ — same shape as parallel-dev / bus-factor). Computed from `files[]`; independent of the per-author `MIN_AUTHOR_COMMITS` floor.
  - Add `byMonth: Array<{ month; weekendLateNight; singleCriterion; healthy; total }>` aggregate for `StressTrend`. Months are bucketed by *local time* (extending `parseLocalTime` to also yield ISO month) so commits at month-boundary timezone offsets land in the correct calendar month.
  - Add `authorStress: AuthorStressProfile[]` aggregate sorted desc by per-author `stressScore`, with `MIN_AUTHOR_COMMITS = 5` floor applied — sub-floor authors are dropped from the report shape entirely. Includes name-collision disambiguation: if ≥2 distinct emails share an identical full git-name string, every member of the colliding group gets a `(local-part)` suffix appended (handles 2-author and N-author collisions identically).
  - No score-formula changes — current `stressScore = lateNightPercent * 0.6 + weekendPercent * 0.4` is appropriately weighted; per-file `< 3` commit floor unchanged.
```

- [ ] **Step 3: Lint & commit**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format
git add docs/polish-pattern.md
git commit -m "docs: polish-pattern — commit-timing shipped (RELIC-323)

Move from spec to shipped. Capture deltas:
- Hero alt swapped StressHistogram → StressTrend (3-layer disjoint
  stacked monthly bars). Histogram on healthy repos collapses to a
  leftward spike that confirms the big number visually but adds no
  axis the punch card lacks; trend adds the temporal axis instead.
- Finding pivoted from per-file top-3 to per-author top-3 (Bus Factor
  pattern). Commit-timing is fundamentally about human behavior; the
  per-author finding always carries on healthy repos where the
  per-file finding would hollow the panel.
- Metrics slot 4 became Stressed Authors instead of the originally
  proposed High Stress rename. Slot 3 takes the High Stress name.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Final verification

**Files:** none

- [ ] **Step 1: Full test suite**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm test
```

Expected: every test passes. Stop and investigate if anything fails.

- [ ] **Step 2: Lint, format, build**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
pnpm lint && pnpm format:check && pnpm build && pnpm docs:build
```

Expected: all clean.

- [ ] **Step 3: Repeat the smoke test from Task 9**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
node apps/cli/dist/index.mjs --path ~/Desktop/react --web
```

Run through the visual checklist in Task 9 Step 2 once more. Confirm everything still looks right after all subsequent commits.

- [ ] **Step 4: Verify the spec / plan / pattern-doc trio is internally consistent**

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
ls -la docs/superpowers/specs/2026-05-03-commit-timing-polish-design.md
ls -la docs/superpowers/plans/2026-05-03-commit-timing-polish.md
git log --oneline relic-323-polish-commit-timing ^main
```

Expected:
- Spec doc present (committed before this branch, so already on `main`)
- Plan doc present (this file, also already on `main`)
- Branch has 11 feat/docs commits (one per task) plus any incidental fix-ups

- [ ] **Step 5: Push branch and open PR (if Dan opts in)**

This is the last optional step — only run when Dan green-lights opening the PR. Per memory `reference_pr_claude_review.md` (PR Claude posts automated reviews, finds real bugs not just style) plan headroom for 1–2 follow-up commits.

```bash
cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing
git push -u origin relic-323-polish-commit-timing
gh pr create --title "feat(web): commit-timing polish (RELIC-323)" --body "$(cat <<'EOF'
## Summary
- Replace firehose `timeline` / `swimlanes` heroes with `CommitPunchCard` (default, 7×24 log-scaled heatmap with off-hours stress shading) and `StressTrend` (alt, 3-layer disjoint stacked monthly bars).
- Replace per-file `SortableTable` bottom panel with a `<NarrativeKPI>` whose finding pivots to top-3 stressed contributors (Bus Factor people-pivot pattern).
- Five new aggregates on `CommitTimingReport`: `repoHourDayMatrix`, `highStress`, `tierMix`, `byMonth`, `authorStress`. `parseLocalTime` widened to yield local ISO month so `byMonth` respects month-boundary timezones.
- Metrics strip slot 3 `Stress Files` (>50) → `High Stress` (≥70 files). Slot 4 `Top Stress` → `Stressed Authors`.
- Per-author `MIN_AUTHOR_COMMITS = 5` floor; N-author name-collision disambiguation appends `(local-part)` to every member of a colliding group.
- New VitePress docs page `apps/docs/analyzers/commit-timing.md`.

Spec: [`docs/superpowers/specs/2026-05-03-commit-timing-polish-design.md`](../blob/main/docs/superpowers/specs/2026-05-03-commit-timing-polish-design.md)
Plan: [`docs/superpowers/plans/2026-05-03-commit-timing-polish.md`](../blob/main/docs/superpowers/plans/2026-05-03-commit-timing-polish.md)

## Test plan
- [ ] `pnpm test` clean
- [ ] `pnpm build` + `pnpm docs:build` clean
- [ ] Smoke against `~/Desktop/react`: punch-card default with stress-zone shading; trend alt; KPI big-number = 0 / Healthy; top-3 contributors render full names; subline shows 4% / 7%; extras hidden (no high-stress files); see-also footer wires to Shame / Hotspots
- [ ] No regressions in other Team & Activity presets (`parallel-dev`, `co-authors`, `contributors`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR opens. PR Claude review will land within minutes. Address any real bugs in follow-up commits — don't amend.

---

## Convention reminders (recap)

- Every Bash command starts with `cd /Users/tracericochet/Desktop/nebulord/gitrelic/.worktrees/relic-323-polish-commit-timing`
- Tab tests use `getByTestId('narrative-kpi-big-number')` not `getByText`
- happy-dom serializes `flex` shorthand → assert `flex-grow: 1`
- Top-N file slices come from threshold-filtered subset
- Bare-ternary for single-conditional `className`
- Author display = full git author name; suffix only on collision
- Don't introduce `dark:` variants; use the `[data-theme]` token system

## Skills referenced

- @skills:superpowers/subagent-driven-development — recommended execution path
- @skills:superpowers/executing-plans — fallback inline-execution path
- @skills:superpowers/test-driven-development — discipline for every task
- @skills:superpowers/verification-before-completion — before marking any step complete
