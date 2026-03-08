import type { RawCommit } from '../utils/git.js';
import type { ChurnReport, FileChurn, ChurnCategory } from '../types.js';

export function analyzeChurn(commits: RawCommit[], trackedFiles: string[]): ChurnReport {
  const fileCounts: Record<string, number> = {};

  for (const commit of commits) {
    for (const file of commit.files) {
      fileCounts[file] = (fileCounts[file] ?? 0) + 1;
    }
  }

  // Only report on currently tracked files (ignore deleted files)
  const trackedSet = new Set(trackedFiles);
  const maxCount = Math.max(...Object.values(fileCounts), 1);

  const files: FileChurn[] = Object.entries(fileCounts)
    .filter(([file]) => trackedSet.has(file))
    .map(([file, commitCount]) => {
      const churnScore = Math.round((commitCount / maxCount) * 100);
      return {
        file,
        commitCount,
        churnScore,
        category: getChurnCategory(churnScore),
      };
    })
    .sort((a, b) => b.commitCount - a.commitCount);

  const topFiles = files.slice(0, 20);
  const hotspotCount = files.filter(f => f.churnScore > 75).length;

  const topFile = topFiles[0];
  const totalCommits = commits.length;
  const summary = topFile
    ? `${topFile.file} has been modified in ${Math.round((topFile.commitCount / totalCommits) * 100)}% of all commits`
    : 'No churn data available';

  return { files, topFiles, hotspotCount, summary };
}

function getChurnCategory(score: number): ChurnCategory {
  if (score > 75) return 'hot';
  if (score > 40) return 'warm';
  if (score > 10) return 'cold';
  return 'frozen';
}
