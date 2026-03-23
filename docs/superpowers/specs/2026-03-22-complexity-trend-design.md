# Complexity Over Time — Design Spec

> Track net LOC growth per file across monthly buckets to surface which files are growing vs. shrinking.

## Motivation

From the kanban: "Track lines-of-code per file across commits to show whether files are growing or shrinking. Growing + high churn = compounding risk."

This is a core Tornhill insight — a file that is both highly churned *and* steadily growing is accumulating complexity in the exact place where the most work happens. That's compounding risk.

## Data Source

Existing `fileStats` on `RawCommit` — per-file `insertions` and `deletions` already parsed from `git log --numstat`. No new git calls required.

## Report Shape

```typescript
interface FileGrowthBucket {
  month: string;        // "2025-06"
  netLines: number;     // insertions - deletions that month
  cumulative: number;   // running total of net lines within the analysis window (not absolute file size)
}

interface FileComplexityTrend {
  file: string;
  buckets: FileGrowthBucket[];
  totalNetLines: number;          // sum of all net lines across all buckets
  recentGrowthRate: number;       // avg net lines/month over last 3 active months
  trend: GrowthTrend;
}

type GrowthTrend = 'growing' | 'shrinking' | 'stable';

interface ComplexityTrendReport {
  files: FileComplexityTrend[];
  growingFiles: FileComplexityTrend[];   // top 10 growers by recentGrowthRate
  shrinkingFiles: FileComplexityTrend[]; // top 10 shrinkers
  summary: string;
}
```

## Algorithm

1. **Bucket**: Iterate commits chronologically. For each commit's `fileStats`, bucket `insertions - deletions` by file and `YYYY-MM` month key. Only files present in `trackedFiles` are included (filters out renamed/deleted files). Binary files where insertions/deletions are both 0 are skipped.
2. **Cumulate**: For each file, sort buckets chronologically and compute a running `cumulative` total.
3. **Recent growth rate**: Take the last 3 months that had any activity for the file. Average their `netLines`. Skipping inactive months avoids penalizing sporadically-edited files.
4. **Classify trend**:
   - `growing`: `recentGrowthRate > 5`
   - `shrinking`: `recentGrowthRate < -5`
   - `stable`: `-5 <= recentGrowthRate <= 5`
5. **Filter**: Exclude files with fewer than 2 active months (not enough data for a trend).
6. **Sort**: `files` sorted by absolute `recentGrowthRate` descending, then alphabetically by file path as tiebreaker.
7. **Top lists**: `growingFiles` = top 10 with `trend === 'growing'` by `recentGrowthRate` descending. `shrinkingFiles` = top 10 with `trend === 'shrinking'` by `recentGrowthRate` ascending (most negative first).
8. **Summary**: Counts come from the filtered `files` array (only files with 2+ active months). e.g. "12 files growing, 5 shrinking, 40 stable"

## Trend Threshold Rationale

The 5-line/month threshold filters noise from trivial edits (import additions, single-line fixes). A file averaging 6+ net new lines per month over its recent active window is meaningfully growing.

## Integration Points

- **New file**: `packages/core/src/analyzers/complexity-trend.ts`
- **Types**: Add all interfaces/types above to `packages/core/src/types.ts`
- **Runner**: Call `analyzeComplexityTrend(commits, trackedFiles)` from `runner.ts`, add `complexityTrend` to `GitloreReport`
- **Export**: Re-export from `packages/core/src/index.ts`

## Signature

```typescript
export function analyzeComplexityTrend(
  commits: RawCommit[],
  trackedFiles: string[]
): ComplexityTrendReport
```

Same pattern as every other analyzer: receives commits + tracked files, returns a typed report. Pure function, no I/O.

## Scope Boundaries

- **No composite scoring** — cursed files and future dashboards own cross-signal correlation.
- **No file reads** — purely derived from existing `fileStats` insertions/deletions.
- **No acceleration detection** — can be added later as a v2.
- **No CLI panel or web tab** — this task is data layer only. CLI/web surfaces are separate backlog items.
- **Approximation, not exact** — cumulative net lines from the `--since` window, not absolute file size. The trend direction is the valuable signal.

## Testing

Unit tests with mock commits covering:
- Basic growing file (more insertions than deletions over months)
- Shrinking file (more deletions)
- Stable file (balanced edits)
- File with < 2 active months excluded
- Recent growth rate uses last 3 *active* months, not calendar months
- Empty commits array returns empty report
- Files not in `trackedFiles` are excluded
- Cumulative values computed correctly across buckets (e.g. month 1 = +10, month 2 = -3, cumulative = 10, 7)
- Sort tiebreaker: files with same growth rate sorted alphabetically
