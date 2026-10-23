import { MAX_FIX_FILES } from './fix-rate.js';
import type { BlastRadiusReport, FileBlastRadius } from '../types.js';
import type { RawCommit } from '../utils/git.js';

/**
 * Commits a file needs before its median means anything: fix rate's floor.
 * Below it one wide commit decides the number (React's top 100 averages were
 * all files with three commits or fewer).
 */
export const MIN_BLAST_COMMITS = 8;

/**
 * How many other files change with each file. Classic reads the average,
 * scaled to the widest file; Atlas reads the median and its spread, for files
 * with `MIN_BLAST_COMMITS` commits.
 * @param commits - The analysis window's commits.
 * @param files - The ownership set (fixtures and generated files left out).
 */
export function analyzeBlastRadius(
  commits: RawCommit[],
  files: string[],
): BlastRadiusReport {
  if (commits.length === 0) {
    return {
      files: [],
      topBlasters: [],
      minCommits: MIN_BLAST_COMMITS,
      rated: 0,
      summary: 'No commits to analyze',
    };
  }

  const trackedSet = new Set(files);
  const fileCoChanges = new Map<
    string,
    { coChangedCounts: number[]; maxCoChanged: number }
  >();

  for (const commit of commits) {
    const changed = commit.files.filter((f) => trackedSet.has(f));
    // A sweeping commit (more than 20 files) says nothing about one file.
    if (changed.length > MAX_FIX_FILES) continue;

    const otherCount = changed.length - 1;
    for (const file of changed) {
      if (!fileCoChanges.has(file))
        fileCoChanges.set(file, { coChangedCounts: [], maxCoChanged: 0 });
      const entry = fileCoChanges.get(file)!;
      entry.coChangedCounts.push(otherCount);
      entry.maxCoChanged = Math.max(entry.maxCoChanged, otherCount);
    }
  }

  const rawFiles: {
    file: string;
    avg: number;
    max: number;
    total: number;
    counts: number[];
  }[] = [];
  for (const [file, data] of fileCoChanges) {
    const avg =
      data.coChangedCounts.reduce((s, n) => s + n, 0) /
      data.coChangedCounts.length;
    rawFiles.push({
      file,
      avg,
      max: data.maxCoChanged,
      total: data.coChangedCounts.length,
      counts: data.coChangedCounts,
    });
  }

  // Loop, not Math.max(...spread): the spread overflows the stack on huge repos.
  let maxAvg = 1;
  for (const f of rawFiles) if (f.avg > maxAvg) maxAvg = f.avg;

  const out: FileBlastRadius[] = rawFiles
    .map((f) => ({
      file: f.file,
      blastScore: Math.round((f.avg / maxAvg) * 100),
      avgCoChangedFiles: Math.round(f.avg * 10) / 10,
      maxCoChangedFiles: f.max,
      totalCommits: f.total,
      ...(f.total >= MIN_BLAST_COMMITS ? spread(f.counts) : {}),
    }))
    .sort((a, b) => b.blastScore - a.blastScore);

  const topBlasters = out.slice(0, 10);
  const highBlast = out.filter((f) => f.blastScore >= 70).length;
  const summary = `${highBlast} high blast-radius file${highBlast !== 1 ? 's' : ''} (architectural load-bearers)`;

  return {
    files: out,
    topBlasters,
    minCommits: MIN_BLAST_COMMITS,
    rated: out.filter((f) => f.medianCoChanged !== undefined).length,
    summary,
  };
}

/** The median (upper-middle, as Age's) and the footprint of a file's commits. */
function spread(counts: number[]): {
  medianCoChanged: number;
  footprint: number[];
} {
  const sorted = [...counts].sort((a, b) => a - b);
  const footprint = new Array<number>(MAX_FIX_FILES).fill(0);
  for (const c of counts) footprint[Math.min(MAX_FIX_FILES - 1, c)]++;
  return { medianCoChanged: sorted[Math.floor(sorted.length / 2)], footprint };
}
