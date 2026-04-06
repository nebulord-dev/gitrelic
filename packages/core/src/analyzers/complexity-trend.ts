import type {
  ComplexityTrendReport,
  FileComplexityTrend,
  FileGrowthBucket,
  GrowthTrend,
} from '../types.js';
import type { RawCommit } from '../utils/git.js';

function getTrend(rate: number): GrowthTrend {
  if (rate > 5) return 'growing';
  if (rate < -5) return 'shrinking';
  return 'stable';
}

export function analyzeComplexityTrend(
  commits: RawCommit[],
  trackedFiles: string[],
): ComplexityTrendReport {
  if (commits.length === 0) {
    return { files: [], growingFiles: [], shrinkingFiles: [], summary: 'No commits to analyze' };
  }

  const trackedSet = new Set(trackedFiles);

  // Step 1: Bucket net lines by file and month
  const fileBuckets = new Map<string, Map<string, number>>();
  for (const commit of commits) {
    const month = commit.date.slice(0, 7); // "YYYY-MM"
    for (const stat of commit.fileStats ?? []) {
      if (!trackedSet.has(stat.file)) continue;
      if (stat.insertions === 0 && stat.deletions === 0) continue;
      if (!fileBuckets.has(stat.file)) fileBuckets.set(stat.file, new Map());
      const months = fileBuckets.get(stat.file)!;
      months.set(month, (months.get(month) ?? 0) + stat.insertions - stat.deletions);
    }
  }

  // Step 2-5: Build entries, cumulate, classify, filter
  const files: FileComplexityTrend[] = [];
  for (const [file, monthMap] of fileBuckets) {
    const sortedMonths = [...monthMap.keys()].sort();
    if (sortedMonths.length < 2) continue;

    let cumulative = 0;
    const buckets: FileGrowthBucket[] = sortedMonths.map((month) => {
      const netLines = monthMap.get(month)!;
      cumulative += netLines;
      return { month, netLines, cumulative };
    });

    const totalNetLines = buckets.reduce((sum, b) => sum + b.netLines, 0);
    const recentBuckets = buckets.slice(-3);
    const recentGrowthRate = Math.round(
      recentBuckets.reduce((sum, b) => sum + b.netLines, 0) / recentBuckets.length,
    );

    files.push({
      file,
      buckets,
      totalNetLines,
      recentGrowthRate,
      trend: getTrend(recentGrowthRate),
    });
  }

  // Step 6: Sort by absolute recentGrowthRate desc, alphabetical tiebreaker
  files.sort((a, b) => {
    const diff = Math.abs(b.recentGrowthRate) - Math.abs(a.recentGrowthRate);
    return diff !== 0 ? diff : a.file.localeCompare(b.file);
  });

  // Step 7: Top lists
  const growingFiles = files.filter((f) => f.trend === 'growing').slice(0, 10);
  const shrinkingFiles = files
    .filter((f) => f.trend === 'shrinking')
    .sort((a, b) => a.recentGrowthRate - b.recentGrowthRate)
    .slice(0, 10);

  // Step 8: Summary
  const growCount = files.filter((f) => f.trend === 'growing').length;
  const shrinkCount = files.filter((f) => f.trend === 'shrinking').length;
  const stableCount = files.filter((f) => f.trend === 'stable').length;
  const summary = `${growCount} file${growCount !== 1 ? 's' : ''} growing, ${shrinkCount} shrinking, ${stableCount} stable`;

  return { files, growingFiles, shrinkingFiles, summary };
}
