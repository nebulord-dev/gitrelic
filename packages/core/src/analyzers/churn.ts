import type { ChurnReport, FileChurn, ChurnCategory } from '../types.js';
import type { RawCommit } from '../utils/git.js';

/**
 * Analyzes the churn of files based on the provided commits and tracked files.
 * @param commits - The raw commits from the repository.
 * @param trackedFiles - The list of currently tracked files in the repository.
 * @Returns a report with the top 20 files by commit count, the number of hot files, and a summary.
 */
export function analyzeChurn(
  commits: RawCommit[],
  trackedFiles: string[],
): ChurnReport {
  const fileCounts: Record<string, number> = {};

  for (const commit of commits) {
    for (const file of commit.files) {
      fileCounts[file] = (fileCounts[file] ?? 0) + 1;
    }
  }

  // Only report on currently tracked files (ignore deleted files)
  const trackedSet = new Set(trackedFiles);
  const tracked = Object.entries(fileCounts).filter(([file]) =>
    trackedSet.has(file),
  );
  // Scale against tracked files only: a deleted file or lockfile that out-churned
  // everything still in the repo would otherwise deflate every score. A loop,
  // not Math.max(...spread), which overflows the stack on huge repos.
  let maxCount = 1;
  for (const [, count] of tracked) if (count > maxCount) maxCount = count;

  const files: FileChurn[] = tracked
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
  const hotspotCount = files.filter((f) => f.churnScore > 75).length;

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
