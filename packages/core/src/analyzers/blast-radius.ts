import type { RawCommit } from '../utils/git.js';
import type { BlastRadiusReport, FileBlastRadius } from '../types.js';

const MAX_FILES_PER_COMMIT = 30;

export function analyzeBlastRadius(commits: RawCommit[], trackedFiles: string[]): BlastRadiusReport {
  if (commits.length === 0) {
    return { files: [], topBlasters: [], summary: 'No commits to analyze' };
  }

  const trackedSet = new Set(trackedFiles);
  const fileCoChanges = new Map<string, { coChangedCounts: number[]; maxCoChanged: number }>();

  for (const commit of commits) {
    const files = commit.files.filter(f => trackedSet.has(f));
    if (files.length >= MAX_FILES_PER_COMMIT) continue;

    const otherCount = files.length - 1;
    for (const file of files) {
      if (!fileCoChanges.has(file)) fileCoChanges.set(file, { coChangedCounts: [], maxCoChanged: 0 });
      const entry = fileCoChanges.get(file)!;
      entry.coChangedCounts.push(otherCount);
      entry.maxCoChanged = Math.max(entry.maxCoChanged, otherCount);
    }
  }

  const rawFiles: { file: string; avg: number; max: number; total: number }[] = [];
  for (const [file, data] of fileCoChanges) {
    const avg = data.coChangedCounts.reduce((s, n) => s + n, 0) / data.coChangedCounts.length;
    rawFiles.push({ file, avg, max: data.maxCoChanged, total: data.coChangedCounts.length });
  }

  const maxAvg = Math.max(...rawFiles.map(f => f.avg), 1);

  const files: FileBlastRadius[] = rawFiles
    .map(f => ({
      file: f.file,
      blastScore: Math.round((f.avg / maxAvg) * 100),
      avgCoChangedFiles: Math.round(f.avg * 10) / 10,
      maxCoChangedFiles: f.max,
      totalCommits: f.total,
    }))
    .sort((a, b) => b.blastScore - a.blastScore);

  const topBlasters = files.slice(0, 10);
  const highBlast = files.filter(f => f.blastScore >= 70).length;
  const summary = `${highBlast} high blast-radius file${highBlast !== 1 ? 's' : ''} (architectural load-bearers)`;

  return { files, topBlasters, summary };
}
