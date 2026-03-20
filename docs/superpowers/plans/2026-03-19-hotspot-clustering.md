# Hotspot Root Cause Clustering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cluster the top 20 hotspots by shared traits (directory, ownership, temporal inflection, coupling hub) to surface systemic root causes behind churn concentration.

**Architecture:** Pure synthesis analyzer consuming existing report data. Four independent dimension functions produce clusters, which are assembled into a ranked report with multi-signal detection. Surfaces in CLI (compact panel) and web (section within Hotspots tab).

**Tech Stack:** TypeScript, Vitest, Ink (CLI), React + Tailwind (web)

**Spec:** `docs/superpowers/specs/2026-03-19-hotspot-clustering-design.md`

---

### Task 1: Add types to `packages/core/src/types.ts`

**Files:**
- Modify: `packages/core/src/types.ts`

- [ ] **Step 1: Add the new types at the end of the types file, before the `RunCodeloreOptions` section**

Add after the `CoAuthorReport` section (after line 382), before `RunCodeloreOptions`:

```ts
// ─── Hotspot clustering ────────────────────────────────────────────────────

export type ClusterDimension = 'structural' | 'ownership' | 'temporal' | 'coupling-hub';

export interface ClusterMember {
  file: string;
  hotspotScore: number;
}

export interface HotspotCluster {
  dimension: ClusterDimension;
  label: string;
  members: ClusterMember[];
  clusterScore: number;
  narrative: string;
  sharedTrait: string;
}

export interface HotspotClusterReport {
  clusters: HotspotCluster[];
  multiSignalFiles: MultiSignalFile[];
  summary: string;
}

export interface MultiSignalFile {
  file: string;
  clusterCount: number;
  dimensions: ClusterDimension[];
}
```

- [ ] **Step 2: Add `hotspotClusters` to `CodeloreReport`**

Add after the `coAuthors: CoAuthorReport;` line in the `CodeloreReport` interface:

```ts
  hotspotClusters: HotspotClusterReport;
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm --filter @codelore/core build`
Expected: Build succeeds (CLI/web will fail until wired up — that's fine)

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/types.ts
git commit -m "feat(core): add hotspot clustering types"
```

---

### Task 2: Implement structural clustering

**Files:**
- Create: `packages/core/src/analyzers/hotspot-clustering.ts`
- Create: `packages/core/src/analyzers/hotspot-clustering.test.ts`

- [ ] **Step 1: Write failing tests for structural clustering**

Create `packages/core/src/analyzers/hotspot-clustering.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type {
  HotspotReport, HotspotEntry, BusFactorReport, CouplingReport,
  ContributorReport, ClusterMember,
} from '../types.js';
import type { RawCommit } from '../utils/git.js';
import { analyzeHotspotClustering } from './hotspot-clustering.js';

// ─── Test helpers ────────────────────────────────────────────────────────────

function makeHotspotReport(entries: { file: string; score: number }[]): HotspotReport {
  const files: HotspotEntry[] = entries.map(e => ({
    file: e.file,
    hotspotScore: e.score,
    churnScore: e.score,
    loc: 100,
    category: e.score >= 75 ? 'critical' : e.score >= 50 ? 'warning' : e.score >= 25 ? 'moderate' : 'low',
  }));
  return {
    files,
    topHotspots: files.slice(0, 20),
    summary: '',
  };
}

function emptyBusFactor(): BusFactorReport {
  return { files: [], criticalFiles: [], overallBusFactor: 999, summary: '' };
}

function emptyCoupling(): CouplingReport {
  return { pairs: [], fileProfiles: [], topPairs: [], summary: '' };
}

function emptyContributors(): ContributorReport {
  return {
    contributors: [
      { email: 'a@dev.com', name: 'A', commitCount: 10, firstCommit: '', lastCommit: '', filesOwned: 0, linesChanged: 0, activeDays: 0, focusAreas: [], isActive: true },
      { email: 'b@dev.com', name: 'B', commitCount: 5, firstCommit: '', lastCommit: '', filesOwned: 0, linesChanged: 0, activeDays: 0, focusAreas: [], isActive: true },
    ],
    activeContributors: [],
    ghostContributors: [],
    topContributor: {} as any,
    summary: '',
  };
}

// ─── Structural clustering ───────────────────────────────────────────────────

describe('structural clustering', () => {
  it('groups hotspots in the same directory prefix', () => {
    const hotspots = makeHotspotReport([
      { file: 'src/auth/login.ts', score: 80 },
      { file: 'src/auth/session.ts', score: 70 },
      { file: 'src/api/handler.ts', score: 60 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), [],
      ['src/auth/login.ts', 'src/auth/session.ts', 'src/api/handler.ts', 'src/api/routes.ts']
    );

    const structural = result.clusters.filter(c => c.dimension === 'structural');
    expect(structural.length).toBe(1);
    expect(structural[0].sharedTrait).toBe('src/auth');
    expect(structural[0].members).toHaveLength(2);
  });

  it('discards singleton groups', () => {
    const hotspots = makeHotspotReport([
      { file: 'src/auth/login.ts', score: 80 },
      { file: 'src/api/handler.ts', score: 60 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), [],
      ['src/auth/login.ts', 'src/api/handler.ts']
    );

    const structural = result.clusters.filter(c => c.dimension === 'structural');
    expect(structural).toHaveLength(0);
  });

  it('filters out overly broad prefixes (>50% of tracked files)', () => {
    const hotspots = makeHotspotReport([
      { file: 'src/a.ts', score: 80 },
      { file: 'src/b.ts', score: 70 },
    ]);
    // src/ contains all 3 tracked files — >50%
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), [],
      ['src/a.ts', 'src/b.ts', 'src/c.ts']
    );

    const structural = result.clusters.filter(c => c.dimension === 'structural');
    expect(structural).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @codelore/core exec vitest run src/analyzers/hotspot-clustering.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create `hotspot-clustering.ts` with structural clustering + stub assembly**

Create `packages/core/src/analyzers/hotspot-clustering.ts`:

```ts
import type { RawCommit } from '../utils/git.js';
import type {
  HotspotReport, BusFactorReport, CouplingReport, ContributorReport,
  HotspotClusterReport, HotspotCluster, ClusterMember, MultiSignalFile, ClusterDimension,
} from '../types.js';

export function analyzeHotspotClustering(
  hotspots: HotspotReport,
  busFactor: BusFactorReport,
  coupling: CouplingReport,
  contributors: ContributorReport,
  commits: RawCommit[],
  trackedFiles: string[],
): HotspotClusterReport {
  const top = hotspots.topHotspots.map(h => ({ file: h.file, hotspotScore: h.hotspotScore }));

  const allClusters: HotspotCluster[] = [
    ...clusterByStructure(top, trackedFiles),
  ];

  return assembleReport(allClusters);
}

// ─── Structural ──────────────────────────────────────────────────────────────

function getDirectoryPrefix(filePath: string): string {
  const parts = filePath.split('/');
  if (parts.length <= 2) return parts[0];
  return parts.slice(0, 2).join('/');
}

function clusterByStructure(hotspots: ClusterMember[], trackedFiles: string[]): HotspotCluster[] {
  // Count tracked files per prefix for breadth filter
  const prefixCounts = new Map<string, number>();
  for (const f of trackedFiles) {
    const prefix = getDirectoryPrefix(f);
    prefixCounts.set(prefix, (prefixCounts.get(prefix) ?? 0) + 1);
  }
  const halfTotal = trackedFiles.length / 2;

  // Group hotspots by prefix
  const groups = new Map<string, ClusterMember[]>();
  for (const h of hotspots) {
    const prefix = getDirectoryPrefix(h.file);
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push(h);
  }

  const clusters: HotspotCluster[] = [];
  for (const [prefix, members] of groups) {
    if (members.length < 2) continue;
    if ((prefixCounts.get(prefix) ?? 0) > halfTotal) continue;

    const avgScore = Math.round(members.reduce((s, m) => s + m.hotspotScore, 0) / members.length);
    clusters.push({
      dimension: 'structural',
      label: prefix,
      members,
      clusterScore: members.length * avgScore,
      narrative: `${members.length} of your top 20 hotspots live in \`${prefix}/\`. The problem may not be individual files — this subsystem's design is concentrating risk.`,
      sharedTrait: prefix,
    });
  }

  return clusters;
}

// ─── Assembly ────────────────────────────────────────────────────────────────

function assembleReport(clusters: HotspotCluster[]): HotspotClusterReport {
  clusters.sort((a, b) => b.clusterScore - a.clusterScore);

  const fileClusters = new Map<string, ClusterDimension[]>();
  for (const cluster of clusters) {
    for (const member of cluster.members) {
      if (!fileClusters.has(member.file)) fileClusters.set(member.file, []);
      fileClusters.get(member.file)!.push(cluster.dimension);
    }
  }

  const multiSignalFiles: MultiSignalFile[] = [];
  for (const [file, dimensions] of fileClusters) {
    if (dimensions.length >= 2) {
      multiSignalFiles.push({ file, clusterCount: dimensions.length, dimensions });
    }
  }
  multiSignalFiles.sort((a, b) => b.clusterCount - a.clusterCount);

  if (clusters.length === 0) {
    return { clusters, multiSignalFiles, summary: 'No root cause patterns detected — hotspots appear independent.' };
  }

  const dimensionCount = new Set(clusters.map(c => c.dimension)).size;
  const top = clusters[0];
  let summary = `${clusters.length} root cause cluster${clusters.length !== 1 ? 's' : ''} found across ${dimensionCount} dimension${dimensionCount !== 1 ? 's' : ''}. \`${top.label}\` (${top.dimension}) explains the most hotspots.`;

  if (multiSignalFiles.length > 0) {
    const msf = multiSignalFiles[0];
    summary += ` \`${msf.file}\` appears in ${msf.clusterCount} clusters (${msf.dimensions.join(', ')}) — this file is hot for multiple systemic reasons and is the strongest candidate for intervention.`;
  }

  return { clusters, multiSignalFiles, summary };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @codelore/core exec vitest run src/analyzers/hotspot-clustering.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analyzers/hotspot-clustering.ts packages/core/src/analyzers/hotspot-clustering.test.ts
git commit -m "feat(core): add structural clustering dimension + assembly"
```

---

### Task 3: Implement ownership clustering

**Files:**
- Modify: `packages/core/src/analyzers/hotspot-clustering.ts`
- Modify: `packages/core/src/analyzers/hotspot-clustering.test.ts`

- [ ] **Step 1: Write failing tests for ownership clustering**

Add to `hotspot-clustering.test.ts`:

```ts
function makeBusFactor(entries: { file: string; dominantAuthor: string; dominantAuthorPercent: number }[]): BusFactorReport {
  return {
    files: entries.map(e => ({
      file: e.file,
      uniqueAuthors: 2,
      authors: [e.dominantAuthor],
      dominantAuthor: e.dominantAuthor,
      dominantAuthorPercent: e.dominantAuthorPercent,
      risk: 'medium' as const,
    })),
    criticalFiles: [],
    overallBusFactor: 2,
    summary: '',
  };
}

describe('ownership clustering', () => {
  it('groups hotspots by dominant author', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
      { file: 'c.ts', score: 60 },
    ]);
    const bf = makeBusFactor([
      { file: 'a.ts', dominantAuthor: 'alice@dev.com', dominantAuthorPercent: 85 },
      { file: 'b.ts', dominantAuthor: 'alice@dev.com', dominantAuthorPercent: 90 },
      { file: 'c.ts', dominantAuthor: 'bob@dev.com', dominantAuthorPercent: 75 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, bf, emptyCoupling(), emptyContributors(), [],
      ['a.ts', 'b.ts', 'c.ts']
    );

    const ownership = result.clusters.filter(c => c.dimension === 'ownership');
    expect(ownership).toHaveLength(1);
    expect(ownership[0].sharedTrait).toBe('alice@dev.com');
    expect(ownership[0].label).toContain('alice@dev.com');
    expect(ownership[0].label).toContain('avg');
    expect(ownership[0].members).toHaveLength(2);
  });

  it('skips ownership dimension for single-author repos', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
    ]);
    const bf = makeBusFactor([
      { file: 'a.ts', dominantAuthor: 'solo@dev.com', dominantAuthorPercent: 100 },
      { file: 'b.ts', dominantAuthor: 'solo@dev.com', dominantAuthorPercent: 100 },
    ]);
    const singleAuthorContribs: ContributorReport = {
      contributors: [
        { email: 'solo@dev.com', name: 'Solo', commitCount: 100, firstCommit: '', lastCommit: '', filesOwned: 0, linesChanged: 0, activeDays: 0, focusAreas: [], isActive: true },
      ],
      activeContributors: [],
      ghostContributors: [],
      topContributor: {} as any,
      summary: '',
    };
    const result = analyzeHotspotClustering(
      hotspots, bf, emptyCoupling(), singleAuthorContribs, [],
      ['a.ts', 'b.ts']
    );

    const ownership = result.clusters.filter(c => c.dimension === 'ownership');
    expect(ownership).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `pnpm --filter @codelore/core exec vitest run src/analyzers/hotspot-clustering.test.ts`
Expected: ownership tests FAIL (function doesn't cluster by ownership yet)

- [ ] **Step 3: Implement ownership clustering**

Add to `hotspot-clustering.ts` — new function `clusterByOwnership` and wire it into `analyzeHotspotClustering`:

```ts
// Add to analyzeHotspotClustering, after structural:
//   ...clusterByOwnership(top, busFactor, contributors),

function clusterByOwnership(
  hotspots: ClusterMember[],
  busFactor: BusFactorReport,
  contributors: ContributorReport,
): HotspotCluster[] {
  if (contributors.contributors.length <= 1) return [];

  const busFactorByFile = new Map(busFactor.files.map(f => [f.file, f]));
  const groups = new Map<string, { members: ClusterMember[]; percents: number[] }>();

  for (const h of hotspots) {
    const bf = busFactorByFile.get(h.file);
    if (!bf) continue;
    const author = bf.dominantAuthor;
    if (!groups.has(author)) groups.set(author, { members: [], percents: [] });
    const g = groups.get(author)!;
    g.members.push(h);
    g.percents.push(bf.dominantAuthorPercent);
  }

  const clusters: HotspotCluster[] = [];
  for (const [author, { members, percents }] of groups) {
    if (members.length < 2) continue;

    const avgScore = Math.round(members.reduce((s, m) => s + m.hotspotScore, 0) / members.length);
    const avgPercent = Math.round(percents.reduce((s, p) => s + p, 0) / percents.length);
    clusters.push({
      dimension: 'ownership',
      label: `${author} (avg ${avgPercent}%)`,
      members,
      clusterScore: members.length * avgScore,
      narrative: `${author} owns ${members.length} of the top 20 hotspots (avg ${avgPercent}% ownership). Either they're the team's most critical contributor or they're spreading complexity.`,
      sharedTrait: author,
    });
  }

  return clusters;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @codelore/core exec vitest run src/analyzers/hotspot-clustering.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analyzers/hotspot-clustering.ts packages/core/src/analyzers/hotspot-clustering.test.ts
git commit -m "feat(core): add ownership clustering dimension"
```

---

### Task 4: Implement temporal clustering

**Files:**
- Modify: `packages/core/src/analyzers/hotspot-clustering.ts`
- Modify: `packages/core/src/analyzers/hotspot-clustering.test.ts`

- [ ] **Step 1: Write failing tests for temporal clustering**

Add to `hotspot-clustering.test.ts`:

```ts
function makeCommits(fileCommits: { file: string; dates: string[] }[]): RawCommit[] {
  const commits: RawCommit[] = [];
  for (const fc of fileCommits) {
    for (const date of fc.dates) {
      commits.push({
        hash: `${fc.file}-${date}`,
        authorEmail: 'dev@test.com',
        authorName: 'Dev',
        date,
        message: 'change',
        files: [fc.file],
        fileStats: [],
        insertions: 1,
        deletions: 0,
      });
    }
  }
  return commits;
}

describe('temporal clustering', () => {
  it('groups hotspots whose churn inflected in the same month', () => {
    // Both files have low activity early, spike in 2025-10
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
    ]);
    const commits = makeCommits([
      { file: 'a.ts', dates: ['2025-06-01', '2025-07-01', '2025-10-01', '2025-10-10', '2025-10-20', '2025-11-01'] },
      { file: 'b.ts', dates: ['2025-05-01', '2025-08-01', '2025-10-05', '2025-10-15', '2025-10-25', '2025-11-05'] },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), commits,
      ['a.ts', 'b.ts']
    );

    const temporal = result.clusters.filter(c => c.dimension === 'temporal');
    expect(temporal).toHaveLength(1);
    expect(temporal[0].members).toHaveLength(2);
    expect(temporal[0].sharedTrait).toContain('2025-10');
  });

  it('skips files with fewer than 4 commits', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
    ]);
    const commits = makeCommits([
      { file: 'a.ts', dates: ['2025-06-01', '2025-10-01', '2025-10-10'] },
      { file: 'b.ts', dates: ['2025-06-01', '2025-10-01', '2025-10-10'] },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), commits,
      ['a.ts', 'b.ts']
    );

    const temporal = result.clusters.filter(c => c.dimension === 'temporal');
    expect(temporal).toHaveLength(0);
  });

  it('skips temporal dimension when less than 3 distinct months', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
    ]);
    const commits = makeCommits([
      { file: 'a.ts', dates: ['2025-10-01', '2025-10-10', '2025-10-20', '2025-11-01'] },
      { file: 'b.ts', dates: ['2025-10-05', '2025-10-15', '2025-10-25', '2025-11-05'] },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), commits,
      ['a.ts', 'b.ts']
    );

    const temporal = result.clusters.filter(c => c.dimension === 'temporal');
    expect(temporal).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `pnpm --filter @codelore/core exec vitest run src/analyzers/hotspot-clustering.test.ts`
Expected: temporal tests FAIL

- [ ] **Step 3: Implement temporal clustering**

Add to `hotspot-clustering.ts` — new function `clusterByTemporal` and wire into `analyzeHotspotClustering`:

```ts
// Add to analyzeHotspotClustering, after ownership:
//   ...clusterByTemporal(top, commits),

function toMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function findInflectionMonth(timestamps: string[]): string | null {
  if (timestamps.length < 4) return null;

  const monthlyCounts = new Map<string, number>();
  for (const ts of timestamps) {
    const key = toMonthKey(ts);
    monthlyCounts.set(key, (monthlyCounts.get(key) ?? 0) + 1);
  }

  const avg = timestamps.length / monthlyCounts.size;

  // Find first month exceeding the average — that's the inflection
  const sorted = [...monthlyCounts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [month, count] of sorted) {
    if (count > avg) return month;
  }

  return null;
}

function clusterByTemporal(hotspots: ClusterMember[], commits: RawCommit[]): HotspotCluster[] {
  const hotspotSet = new Set(hotspots.map(h => h.file));

  // Collect per-file commit dates
  const fileDates = new Map<string, string[]>();
  for (const commit of commits) {
    for (const file of commit.files) {
      if (!hotspotSet.has(file)) continue;
      if (!fileDates.has(file)) fileDates.set(file, []);
      fileDates.get(file)!.push(commit.date);
    }
  }

  // Check minimum 3 distinct months across all hotspot commits
  const allMonths = new Set<string>();
  for (const dates of fileDates.values()) {
    for (const d of dates) allMonths.add(toMonthKey(d));
  }
  if (allMonths.size < 3) return [];

  // Find inflection month per file
  const scoreByFile = new Map(hotspots.map(h => [h.file, h.hotspotScore]));
  const inflections = new Map<string, ClusterMember[]>();
  for (const [file, dates] of fileDates) {
    const month = findInflectionMonth(dates);
    if (!month) continue;
    if (!inflections.has(month)) inflections.set(month, []);
    inflections.get(month)!.push({ file, hotspotScore: scoreByFile.get(file)! });
  }

  const clusters: HotspotCluster[] = [];
  for (const [month, members] of inflections) {
    if (members.length < 2) continue;

    const avgScore = Math.round(members.reduce((s, m) => s + m.hotspotScore, 0) / members.length);
    const [year, mo] = month.split('-');
    const monthName = new Date(Number(year), Number(mo) - 1).toLocaleString('en', { month: 'short' });
    const label = `${monthName} ${year} inflection`;

    clusters.push({
      dimension: 'temporal',
      label,
      members,
      clusterScore: members.length * avgScore,
      narrative: `${members.length} hotspots started accelerating in ${monthName} ${year}. Something happened that month — a migration, a feature push, or a staffing change — that destabilized multiple files simultaneously.`,
      sharedTrait: month,
    });
  }

  return clusters;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @codelore/core exec vitest run src/analyzers/hotspot-clustering.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analyzers/hotspot-clustering.ts packages/core/src/analyzers/hotspot-clustering.test.ts
git commit -m "feat(core): add temporal clustering dimension with inflection detection"
```

---

### Task 5: Implement coupling hub detection

**Files:**
- Modify: `packages/core/src/analyzers/hotspot-clustering.ts`
- Modify: `packages/core/src/analyzers/hotspot-clustering.test.ts`

- [ ] **Step 1: Write failing tests for coupling hub detection**

Add to `hotspot-clustering.test.ts`:

```ts
function makeCoupling(pairs: { fileA: string; fileB: string; coCommits: number; strength: number }[]): CouplingReport {
  return {
    pairs: pairs.map(p => ({
      fileA: p.fileA,
      fileB: p.fileB,
      coCommits: p.coCommits,
      totalCommitsA: 10,
      totalCommitsB: 10,
      couplingStrength: p.strength,
    })),
    fileProfiles: [],
    topPairs: [],
    summary: '',
  };
}

describe('coupling hub detection', () => {
  it('finds non-hotspot files coupled to 2+ hotspots', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
    ]);
    const coupling = makeCoupling([
      { fileA: 'config.ts', fileB: 'a.ts', coCommits: 5, strength: 50 },
      { fileA: 'config.ts', fileB: 'b.ts', coCommits: 4, strength: 45 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), coupling, emptyContributors(), [],
      ['a.ts', 'b.ts', 'config.ts']
    );

    const hubs = result.clusters.filter(c => c.dimension === 'coupling-hub');
    expect(hubs).toHaveLength(1);
    expect(hubs[0].sharedTrait).toBe('config.ts');
    expect(hubs[0].members).toHaveLength(2);
  });

  it('ignores hub files that are themselves hotspots', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
      { file: 'hub.ts', score: 90 },
    ]);
    const coupling = makeCoupling([
      { fileA: 'hub.ts', fileB: 'a.ts', coCommits: 5, strength: 50 },
      { fileA: 'hub.ts', fileB: 'b.ts', coCommits: 4, strength: 45 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), coupling, emptyContributors(), [],
      ['a.ts', 'b.ts', 'hub.ts']
    );

    const hubs = result.clusters.filter(c => c.dimension === 'coupling-hub');
    expect(hubs).toHaveLength(0);
  });

  it('returns empty when no coupling data exists', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), [],
      ['a.ts', 'b.ts']
    );

    const hubs = result.clusters.filter(c => c.dimension === 'coupling-hub');
    expect(hubs).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `pnpm --filter @codelore/core exec vitest run src/analyzers/hotspot-clustering.test.ts`
Expected: coupling hub tests FAIL

- [ ] **Step 3: Implement coupling hub detection**

Add to `hotspot-clustering.ts` — new function `clusterByCouplingHub` and wire into `analyzeHotspotClustering`:

```ts
// Add to analyzeHotspotClustering, after temporal:
//   ...clusterByCouplingHub(top, coupling),

function clusterByCouplingHub(hotspots: ClusterMember[], coupling: CouplingReport): HotspotCluster[] {
  if (coupling.pairs.length === 0) return [];

  const hotspotSet = new Set(hotspots.map(h => h.file));
  const scoreByFile = new Map(hotspots.map(h => [h.file, h.hotspotScore]));

  // For each pair, if one side is a hotspot and the other isn't, record the non-hotspot as a potential hub
  const hubToHotspots = new Map<string, Set<string>>();
  for (const pair of coupling.pairs) {
    const aIsHot = hotspotSet.has(pair.fileA);
    const bIsHot = hotspotSet.has(pair.fileB);

    if (aIsHot && !bIsHot) {
      if (!hubToHotspots.has(pair.fileB)) hubToHotspots.set(pair.fileB, new Set());
      hubToHotspots.get(pair.fileB)!.add(pair.fileA);
    }
    if (bIsHot && !aIsHot) {
      if (!hubToHotspots.has(pair.fileA)) hubToHotspots.set(pair.fileA, new Set());
      hubToHotspots.get(pair.fileA)!.add(pair.fileB);
    }
  }

  const clusters: HotspotCluster[] = [];
  for (const [hub, hotspotFiles] of hubToHotspots) {
    if (hotspotFiles.size < 2) continue;

    const members: ClusterMember[] = [...hotspotFiles].map(f => ({
      file: f,
      hotspotScore: scoreByFile.get(f)!,
    }));
    const avgScore = Math.round(members.reduce((s, m) => s + m.hotspotScore, 0) / members.length);

    clusters.push({
      dimension: 'coupling-hub',
      label: `${hub} (hub)`,
      members,
      clusterScore: members.length * avgScore,
      narrative: `\`${hub}\` isn't a hotspot itself, but it's temporally coupled to ${members.length} files that are. Changes to this quiet file ripple outward — it may be the root cause behind the churn you're seeing.`,
      sharedTrait: hub,
    });
  }

  return clusters;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @codelore/core exec vitest run src/analyzers/hotspot-clustering.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/analyzers/hotspot-clustering.ts packages/core/src/analyzers/hotspot-clustering.test.ts
git commit -m "feat(core): add coupling hub detection dimension"
```

---

### Task 6: Test assembly, multi-signal detection, and edge cases

**Files:**
- Modify: `packages/core/src/analyzers/hotspot-clustering.test.ts`

- [ ] **Step 1: Write tests for assembly and multi-signal**

Add to `hotspot-clustering.test.ts`:

```ts
describe('assembly and multi-signal detection', () => {
  it('ranks clusters by clusterScore descending', () => {
    const hotspots = makeHotspotReport([
      { file: 'src/auth/a.ts', score: 80 },
      { file: 'src/auth/b.ts', score: 70 },
      { file: 'src/api/c.ts', score: 90 },
      { file: 'src/api/d.ts', score: 85 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), [],
      ['src/auth/a.ts', 'src/auth/b.ts', 'src/api/c.ts', 'src/api/d.ts', 'src/other/e.ts', 'src/other/f.ts', 'src/other/g.ts']
    );

    const scores = result.clusters.map(c => c.clusterScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('detects multi-signal files appearing in 2+ clusters', () => {
    const hotspots = makeHotspotReport([
      { file: 'src/auth/a.ts', score: 80 },
      { file: 'src/auth/b.ts', score: 70 },
    ]);
    const bf = makeBusFactor([
      { file: 'src/auth/a.ts', dominantAuthor: 'alice@dev.com', dominantAuthorPercent: 85 },
      { file: 'src/auth/b.ts', dominantAuthor: 'alice@dev.com', dominantAuthorPercent: 90 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, bf, emptyCoupling(), emptyContributors(), [],
      ['src/auth/a.ts', 'src/auth/b.ts', 'src/other/c.ts', 'src/other/d.ts', 'src/other/e.ts']
    );

    // Both files should appear in structural (src/auth) and ownership (alice) clusters
    expect(result.multiSignalFiles.length).toBeGreaterThanOrEqual(1);
    expect(result.multiSignalFiles[0].clusterCount).toBe(2);
    expect(result.multiSignalFiles[0].dimensions).toContain('structural');
    expect(result.multiSignalFiles[0].dimensions).toContain('ownership');
  });

  it('returns empty report with correct summary when no clusters found', () => {
    const hotspots = makeHotspotReport([
      { file: 'a.ts', score: 80 },
      { file: 'b.ts', score: 70 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), [],
      ['a.ts', 'b.ts']
    );

    expect(result.clusters).toHaveLength(0);
    expect(result.summary).toBe('No root cause patterns detected — hotspots appear independent.');
  });

  it('generates narratives containing dimension-specific content', () => {
    const hotspots = makeHotspotReport([
      { file: 'src/auth/a.ts', score: 80 },
      { file: 'src/auth/b.ts', score: 70 },
    ]);
    const bf = makeBusFactor([
      { file: 'src/auth/a.ts', dominantAuthor: 'alice@dev.com', dominantAuthorPercent: 85 },
      { file: 'src/auth/b.ts', dominantAuthor: 'alice@dev.com', dominantAuthorPercent: 90 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, bf, emptyCoupling(), emptyContributors(), [],
      ['src/auth/a.ts', 'src/auth/b.ts', 'src/other/c.ts', 'src/other/d.ts', 'src/other/e.ts']
    );

    const structural = result.clusters.find(c => c.dimension === 'structural');
    expect(structural?.narrative).toContain('src/auth');
    expect(structural?.narrative).toContain('subsystem');

    const ownership = result.clusters.find(c => c.dimension === 'ownership');
    expect(ownership?.narrative).toContain('alice@dev.com');
    expect(ownership?.narrative).toContain('ownership');
  });

  it('handles small repos with few hotspots gracefully', () => {
    const hotspots = makeHotspotReport([
      { file: 'src/auth/a.ts', score: 20 },
      { file: 'src/auth/b.ts', score: 15 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), [],
      ['src/auth/a.ts', 'src/auth/b.ts', 'src/other/c.ts', 'src/other/d.ts', 'src/other/e.ts']
    );

    // Should still attempt clustering with available data
    expect(result.clusters.length).toBeGreaterThanOrEqual(0);
    // If clusters exist, they should have valid scores
    for (const c of result.clusters) {
      expect(c.clusterScore).toBeGreaterThan(0);
      expect(c.members.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('generates a summary string when clusters exist', () => {
    const hotspots = makeHotspotReport([
      { file: 'src/auth/a.ts', score: 80 },
      { file: 'src/auth/b.ts', score: 70 },
    ]);
    const result = analyzeHotspotClustering(
      hotspots, emptyBusFactor(), emptyCoupling(), emptyContributors(), [],
      ['src/auth/a.ts', 'src/auth/b.ts', 'src/other/c.ts', 'src/other/d.ts', 'src/other/e.ts']
    );

    expect(result.summary).toContain('root cause cluster');
    expect(result.summary).toContain('src/auth');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm --filter @codelore/core exec vitest run src/analyzers/hotspot-clustering.test.ts`
Expected: All tests PASS (assembly was already implemented in Task 2)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/analyzers/hotspot-clustering.test.ts
git commit -m "test(core): add assembly and multi-signal detection tests"
```

---

### Task 7: Wire into runner and exports

**Files:**
- Modify: `packages/core/src/runner.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add import and call in runner.ts**

In `packages/core/src/runner.ts`, add the import at the top with the other analyzer imports:

```ts
import { analyzeHotspotClustering } from './analyzers/hotspot-clustering.js';
```

Add after the `coAuthors` analysis (after line 114) and before the `findCursedFiles` call:

```ts
  onProgress?.('Clustering hotspots...');
  const hotspotClusters = analyzeHotspotClustering(hotspots, busFactors, coupling, contributors, commits, trackedFiles);
```

Add `hotspotClusters` to the return object, after `coAuthors`:

```ts
    hotspotClusters,
```

- [ ] **Step 2: Update exports in index.ts**

In `packages/core/src/index.ts`, add the function export:

```ts
export { analyzeHotspotClustering } from './analyzers/hotspot-clustering.js';
```

Add the type exports alongside the existing ones:

```ts
  HotspotClusterReport,
  HotspotCluster,
  ClusterMember,
  ClusterDimension,
  MultiSignalFile,
```

- [ ] **Step 3: Build and verify**

Run: `pnpm --filter @codelore/core build`
Expected: Build succeeds

- [ ] **Step 4: Run all core tests**

Run: `pnpm --filter @codelore/core exec vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/runner.ts packages/core/src/index.ts
git commit -m "feat(core): wire hotspot clustering into runner and exports"
```

---

### Task 8: Add CLI panel

**Files:**
- Modify: `apps/cli/src/components/App.tsx`

- [ ] **Step 1: Add `ClusteringPanel` component**

Add after the `HotspotPanel` function in `App.tsx`:

```tsx
function ClusteringPanel({ report }: { report: CodeloreReport }) {
  const { hotspotClusters } = report;
  if (hotspotClusters.clusters.length === 0) return null;

  const dimensionColor: Record<string, string> = {
    'structural': 'green',
    'ownership': 'blue',
    'temporal': 'yellow',
    'coupling-hub': 'red',
  };

  return (
    <Box flexDirection="column">
      <Text color="magenta" bold>
        {`── Root Causes (${hotspotClusters.clusters.length} cluster${hotspotClusters.clusters.length !== 1 ? 's' : ''}) ──────────────────────────────`}
      </Text>
      <Text color="gray" dimColor>{hotspotClusters.summary}</Text>
      <Box flexDirection="column" marginTop={1}>
        {hotspotClusters.clusters.slice(0, 3).map(c => (
          <Box key={`${c.dimension}-${c.sharedTrait}`} flexDirection="column" marginBottom={1}>
            <Box gap={2}>
              <Text color={dimensionColor[c.dimension] ?? 'gray'}>[{c.dimension}]</Text>
              <Text color="white">{c.label}</Text>
              <Text color="gray" dimColor>— {c.members.length} hotspots</Text>
            </Box>
            <Text color="gray" dimColor>  "{c.narrative.split('.')[0]}."</Text>
          </Box>
        ))}
        {hotspotClusters.multiSignalFiles.length > 0 && (
          <Box gap={2}>
            <Text color="red">⚑</Text>
            <Text color="white">{hotspotClusters.multiSignalFiles[0].file}</Text>
            <Text color="gray" dimColor>
              appears in {hotspotClusters.multiSignalFiles[0].clusterCount} clusters
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}
```

- [ ] **Step 2: Render the panel after HotspotPanel**

In the `App` component's return, add after the `<HotspotPanel>` block:

```tsx
      <Newline />
      <ClusteringPanel report={report} />
```

- [ ] **Step 3: Build the full project**

Run: `pnpm build`
Expected: All packages build successfully

- [ ] **Step 4: Commit**

```bash
git add apps/cli/src/components/App.tsx
git commit -m "feat(cli): add hotspot root cause clustering panel"
```

---

### Task 9: Add web dashboard component

**Files:**
- Create: `apps/web/src/components/HotspotClusters.tsx`
- Modify: `apps/web/src/components/Dashboard.tsx`

- [ ] **Step 1: Create `HotspotClusters.tsx`**

Create `apps/web/src/components/HotspotClusters.tsx`:

```tsx
import type { HotspotClusterReport, ClusterDimension } from '@codelore/core';

const dimensionBadge: Record<ClusterDimension, string> = {
  'structural': 'bg-green-950 text-green-400',
  'ownership': 'bg-blue-950 text-blue-400',
  'temporal': 'bg-amber-950 text-amber-400',
  'coupling-hub': 'bg-red-950 text-red-400',
};

export default function HotspotClusters({ data }: { data: HotspotClusterReport }) {
  if (data.clusters.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-white font-semibold mb-1">Root Cause Clusters</h3>
      <p className="text-gray-500 text-xs mb-4">{data.summary}</p>

      {data.multiSignalFiles.length > 0 && (
        <div className="bg-red-950 border border-red-800 rounded p-3 mb-4">
          <p className="text-red-300 text-sm font-semibold mb-1">Multi-Signal Files</p>
          {data.multiSignalFiles.map(f => (
            <div key={f.file} className="flex items-center gap-2 py-1">
              <span className="text-red-400 text-sm font-mono truncate flex-1">{f.file}</span>
              <span className="text-red-500 text-xs">{f.clusterCount} clusters</span>
              <div className="flex gap-1">
                {f.dimensions.map(d => (
                  <span key={d} className={`text-xs px-1.5 py-0.5 rounded ${dimensionBadge[d]}`}>{d}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {data.clusters.map(c => (
          <div key={`${c.dimension}-${c.sharedTrait}`} className="bg-gray-900 border border-gray-800 rounded p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-xs px-2 py-1 rounded ${dimensionBadge[c.dimension]}`}>{c.dimension}</span>
              <span className="text-white font-mono text-sm">{c.label}</span>
              <span className="text-gray-500 text-xs ml-auto">{c.members.length} hotspots · score {c.clusterScore}</span>
            </div>
            <p className="text-gray-400 text-sm italic mb-3">"{c.narrative}"</p>
            <div className="flex flex-wrap gap-2">
              {c.members.map(m => (
                <span key={m.file} className="text-xs font-mono bg-gray-800 text-gray-300 px-2 py-1 rounded">
                  {m.file} <span className="text-gray-500">({m.hotspotScore})</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate into ChurnTab in Dashboard.tsx**

In `Dashboard.tsx`, add the import at the top:

```tsx
import HotspotClusters from './HotspotClusters';
```

In the `ChurnTab` function, add the clustering section after the hotspot list (before the closing `</div>`):

```tsx
      <HotspotClusters data={report.hotspotClusters} />
```

- [ ] **Step 3: Build the full project**

Run: `pnpm build`
Expected: All packages build successfully

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/HotspotClusters.tsx apps/web/src/components/Dashboard.tsx
git commit -m "feat(dashboard): add hotspot root cause clusters to Hotspots tab"
```

---

### Task 10: Integration test and manual verification

**Files:**
- None created — verification only

- [ ] **Step 1: Run all core tests**

Run: `pnpm --filter @codelore/core exec vitest run`
Expected: All tests PASS

- [ ] **Step 2: Build the entire project**

Run: `pnpm build`
Expected: Clean build, no errors

- [ ] **Step 3: Manual test against a real repo**

Run: `node apps/cli/dist/index.js --path . --since all`
Expected: CLI output includes the Root Causes panel after Hotspots (or doesn't render if no clusters found — that's correct for small repos)

- [ ] **Step 4: Manual test web dashboard**

Run: `node apps/cli/dist/index.js --path ~/path/to/larger-repo --web --since all`
Expected: Web dashboard Hotspots tab shows the clustering section below the leaderboard

- [ ] **Step 5: Final commit — update kanban**

Move "Hotspot root cause clustering" from Backlog to Done in `.claude/kanban.md` with a summary.

```bash
git add .claude/kanban.md
git commit -m "docs: update kanban — hotspot clustering done"
```
