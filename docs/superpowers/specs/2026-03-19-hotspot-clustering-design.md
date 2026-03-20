# Hotspot Root Cause Clustering ("Geographic Profiling") — Design Spec

> Date: 2026-03-19
> Status: Approved
> Kanban ref: "Hotspot root cause clustering" (Backlog > Smarts & Analysis)

## Overview

Multiple hotspots often share a hidden root cause. Inspired by Tornhill's criminal geographic profiling analogy — multiple crime scenes reveal a hidden anchor point — this analyzer clusters the top hotspots by shared traits to surface *why* they're hot, not just *that* they're hot.

Pure synthesis layer over existing analyzer data. No new git primitives needed.

## Data Model

New types in `packages/core/src/types.ts`:

```ts
type ClusterDimension = 'structural' | 'ownership' | 'temporal' | 'coupling-hub';

interface HotspotCluster {
  dimension: ClusterDimension;
  label: string;              // e.g. "src/auth/", "alice@dev.com", "Oct 2025 inflection", "config.ts (hub)"
  members: string[];          // file paths of hotspot files in this cluster
  memberScores: number[];     // corresponding hotspot scores
  clusterScore: number;       // memberCount × avgHotspotScore
  narrative: string;          // human-readable explanation
  sharedTrait: string;        // the specific value that binds them (directory, author email, date range, hub file)
}

interface HotspotClusterReport {
  clusters: HotspotCluster[];           // ranked by clusterScore desc
  multiSignalFiles: MultiSignalFile[];  // files appearing in 2+ clusters
  summary: string;
}

interface MultiSignalFile {
  file: string;
  clusterCount: number;
  dimensions: ClusterDimension[];       // which dimensions flagged this file
}
```

`HotspotClusterReport` is added to `CodeloreReport` as `hotspotClusters`.

## Input

The top 20 hotspots from `HotspotReport.topHotspots`, plus data from:
- `BusFactorReport` (ownership dimension)
- `CouplingReport` (coupling hub dimension)
- `ChurnVelocityReport` (temporal dimension — inflection detection)
- `trackedFiles` (structural dimension — breadth filter)
- Raw commits (temporal dimension — per-file commit timestamps)

## Clustering Algorithm

Four independent dimension functions, each receiving the top 20 hotspots + relevant report data and returning `HotspotCluster[]`.

### Structural clustering

- Extract directory prefix from each hotspot's file path using the first 2 path segments (e.g. `src/auth/middleware.ts` → `src/auth/`).
- Group hotspots by prefix. Discard groups of 1 (not a cluster).
- **Breadth filter**: if a prefix contains >50% of all tracked files in the repo, discard it — too generic to be meaningful (e.g. `src/` in a flat project).

### Ownership clustering

- Look up each hotspot's dominant author from bus factor data.
- Group hotspots by dominant author. Discard groups of 1.
- Label includes the author and their average ownership percentage across cluster members.
- **Skip entirely** when `contributors.contributors.length === 1` (single-author repo).

### Temporal clustering

- For each hotspot, compute a churn inflection point: split its commit timestamps into monthly buckets, find the month where commit density first exceeded the file's overall monthly average. That's when the file "got hot."
- Group hotspots whose inflection points fall within the same calendar month.
- Discard groups of 1. Label includes the month/year (e.g. "Oct 2025 inflection").
- **Minimum data**: files with fewer than 4 commits skip temporal analysis. Requires at least 3 distinct months of commit data across all hotspots to run; otherwise skip the dimension entirely.

### Coupling hub detection

- From the coupling report, find all non-hotspot files that appear in `CoupledPair` entries with 2+ hotspot files.
- Each such hub file forms a cluster whose members are the hotspots it's coupled to.
- This is the "killer's home address" — a quiet file causing fires elsewhere.
- Label is the hub file path. The hub itself is stored in `sharedTrait`.

### Assembly

1. Collect all clusters from all four dimensions.
2. Score each: `members.length × average(memberScores)`.
3. Sort descending by `clusterScore`.
4. Scan for files appearing in 2+ clusters → populate `multiSignalFiles`.
5. Generate narratives per cluster.

### Overlap policy

Files can appear in multiple clusters. Files appearing in 2+ clusters are flagged as `MultiSignalFile` entries — these are the strongest candidates for intervention.

## Narrative Generation

Template-based narratives per dimension with interpolated values. No AI generation.

**Structural:**
> "{N} of your top 20 hotspots live in `{prefix}`. The problem may not be individual files — this subsystem's design is concentrating risk."

**Ownership:**
> "{author} owns {N} of the top 20 hotspots (avg {pct}% ownership). Either they're the team's most critical contributor or they're spreading complexity."

**Temporal:**
> "{N} hotspots started accelerating in {month} {year}. Something happened that month — a migration, a feature push, or a staffing change — that destabilized multiple files simultaneously."

**Coupling hub:**
> "`{hubFile}` isn't a hotspot itself, but it's temporally coupled to {N} files that are. Changes to this quiet file ripple outward — it may be the root cause behind the churn you're seeing."

**Multi-signal callout** (in the report summary):
> "`{file}` appears in {N} clusters ({dimensions joined}) — this file is hot for multiple systemic reasons and is the strongest candidate for intervention."

**Report summary:**
> "{N} root cause clusters found across {M} dimensions. `{topCluster.label}` ({topCluster.dimension}) explains the most hotspots."

Empty state: "No root cause patterns detected — hotspots appear independent."

## Integration Points

### Core (`packages/core`)

- **New file**: `src/analyzers/hotspot-clustering.ts` — four dimension functions + assembly + narrative generation.
- **`runner.ts`**: call `analyzeHotspotClustering()` after hotspots, coupling, bus factor, and churn velocity are computed. Pass those reports + `trackedFiles` + commits.
- **`types.ts`**: add `ClusterDimension`, `HotspotCluster`, `HotspotClusterReport`, `MultiSignalFile` types and `hotspotClusters` field on `CodeloreReport`.
- **`index.ts`**: export the new analyzer function.

### CLI (`apps/cli`)

New `ClusteringPanel` component in `App.tsx`, rendered directly after `HotspotPanel`. Compact format — top 3 clusters with dimension badge, member count, and narrative one-liner. Multi-signal file callout for the top file if any exist.

```
── Root Causes (4 clusters) ────────────────────────────
  [structural] src/auth/ — 6 hotspots cluster here
    "This subsystem's design is concentrating risk."
  [coupling-hub] config.ts — coupled to 3 hotspots
    "Changes to this quiet file ripple outward."
  [ownership] alice@dev.com — owns 4 hotspots
    "Critical contributor or complexity spreader."
  ⚑ src/auth/middleware.ts appears in 3 clusters
```

Empty state: panel does not render (same pattern as other panels).

### Web (`apps/web`)

New section within the existing Hotspots tab in `Dashboard.tsx`, below the hotspot leaderboard. New component: `HotspotClusters.tsx`.

- Dimension badges color-coded: green (structural), blue (ownership), amber (temporal), red (coupling-hub)
- Each cluster shows member file list with hotspot scores + narrative text
- Multi-signal files highlighted at the top of the section if any exist

## Edge Cases

| Case | Behavior |
|------|----------|
| No clusters found | Empty `clusters` array, summary says "hotspots appear independent". CLI panel and web section don't render. |
| Single-author repo | Skip ownership dimension entirely. Other three dimensions proceed. |
| Small repo (<5 hotspots above "moderate") | Fall back to top 10 by score regardless of category. Still require clusters of 2+. |
| Flat directory structure | Breadth filter discards prefixes containing >50% of tracked files. |
| No coupling data | Coupling hub dimension returns zero clusters. Other dimensions proceed. |
| Short history window (<3 distinct months) | Skip temporal dimension entirely. No error. |
| Files with <4 commits | Skip those files in temporal analysis. |

## Testing

Unit tests colocated at `packages/core/src/analyzers/hotspot-clustering.test.ts`.

- Test each dimension function independently with mock data
- Test assembly: scoring, sorting, multi-signal detection
- Test narrative generation for each dimension
- Test edge cases: no clusters, single author, flat directory, no coupling, short history
- Test breadth filter for structural dimension
- Test minimum thresholds (cluster size 2+, 4 commits for temporal, 3 months for temporal)

## Out of Scope

- Configurable top-N hotspot count (hardcoded to 20, revisit if needed)
- AI-generated narratives (template-based is sufficient)
- Dedicated CLI flag (e.g. `--clusters`) — always shown when clusters exist
- Dedicated web dashboard tab — integrated into existing Hotspots tab
