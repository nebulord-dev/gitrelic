import type { ChurnVelocityReport, FileChurnVelocity, ChurnTrend } from '../types.js';
import type { RawCommit } from '../utils/git.js';

function getTrend(score: number): ChurnTrend {
  if (score > 60) return 'accelerating';
  if (score < 40) return 'decelerating';
  return 'stable';
}

export function analyzeChurnVelocity(
  commits: RawCommit[],
  trackedFiles: string[],
): ChurnVelocityReport {
  if (commits.length < 2) {
    return {
      files: [],
      acceleratingFiles: [],
      summary: 'Insufficient history for velocity analysis',
    };
  }

  const trackedSet = new Set(trackedFiles);
  // Avoid Math.min/max(...dates) — the spread overflows the JS call stack
  // on repos with ~125k+ commits. Scan in a single pass instead.
  let minDate = Infinity;
  let maxDate = -Infinity;
  for (const commit of commits) {
    const ts = new Date(commit.date).getTime();
    if (ts < minDate) minDate = ts;
    if (ts > maxDate) maxDate = ts;
  }
  const midpoint = minDate + (maxDate - minDate) / 2;

  const fileCommitDates = new Map<string, number[]>();
  for (const commit of commits) {
    const ts = new Date(commit.date).getTime();
    for (const file of commit.files) {
      if (!trackedSet.has(file)) continue;
      if (!fileCommitDates.has(file)) fileCommitDates.set(file, []);
      fileCommitDates.get(file)!.push(ts);
    }
  }

  const files: FileChurnVelocity[] = [];
  for (const [file, timestamps] of fileCommitDates) {
    if (timestamps.length < 2) continue;
    const recentCommits = timestamps.filter((t) => t >= midpoint).length;
    const olderCommits = timestamps.filter((t) => t < midpoint).length;
    const total = recentCommits + olderCommits;
    const velocityScore = Math.round((recentCommits / total) * 100);
    files.push({
      file,
      velocityScore,
      trend: getTrend(velocityScore),
      recentCommits,
      olderCommits,
      totalCommits: total,
    });
  }

  files.sort((a, b) => b.velocityScore - a.velocityScore);
  const acceleratingFiles = files.filter((f) => f.trend === 'accelerating').slice(0, 10);
  const accCount = files.filter((f) => f.trend === 'accelerating').length;
  const decCount = files.filter((f) => f.trend === 'decelerating').length;
  const summary = `${accCount} file${accCount !== 1 ? 's' : ''} accelerating, ${decCount} decelerating`;

  return { files, acceleratingFiles, summary };
}
