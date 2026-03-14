import type { RawCommit } from '../utils/git.js';
import type { RewriteRatioReport, FileRewriteRatio } from '../types.js';

export function analyzeRewriteRatio(commits: RawCommit[], trackedFiles: string[]): RewriteRatioReport {
  if (commits.length === 0) {
    return { files: [], topRewriters: [], summary: 'No commits to analyze' };
  }

  const trackedSet = new Set(trackedFiles);
  const fileStats = new Map<string, { insertions: number; deletions: number }>();

  for (const commit of commits) {
    for (const stat of (commit.fileStats ?? [])) {
      if (!trackedSet.has(stat.file)) continue;
      const entry = fileStats.get(stat.file) ?? { insertions: 0, deletions: 0 };
      entry.insertions += stat.insertions;
      entry.deletions += stat.deletions;
      fileStats.set(stat.file, entry);
    }
  }

  const files: FileRewriteRatio[] = [];
  for (const [file, stats] of fileStats) {
    const { insertions, deletions } = stats;
    if (insertions === 0 && deletions === 0) continue;
    const maxVal = Math.max(insertions, deletions);
    const minVal = Math.min(insertions, deletions);
    const ratio = maxVal > 0 ? Math.round((minVal / maxVal) * 100) / 100 : 0;
    const rewriteScore = Math.round(ratio * 100);
    files.push({ file, rewriteScore, totalInsertions: insertions, totalDeletions: deletions, ratio });
  }

  files.sort((a, b) => b.rewriteScore - a.rewriteScore);
  const topRewriters = files.slice(0, 10);
  const highRewrite = files.filter(f => f.rewriteScore >= 70).length;
  const summary = `${highRewrite} file${highRewrite !== 1 ? 's' : ''} with high rewrite ratio (code that doesn't stick)`;

  return { files, topRewriters, summary };
}
