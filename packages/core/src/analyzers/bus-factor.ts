import type { RawCommit } from '../utils/git.js';
import type { BusFactorReport, FileBusFactor, BusFactorRisk } from '../types.js';

/**
 * Analyzes the bus factor of files based on the provided commits and tracked files.
 * @param commits - The raw commits from the repository.
 * @param trackedFiles - The list of currently tracked files in the repository.
 * @Returns a report with the top 20 files by bus factor, the number of critical files, and a summary.
 */
export function analyzeBusFactor(commits: RawCommit[], trackedFiles: string[]): BusFactorReport {
  // Map: file → Map<author, commitCount>
  const fileAuthors: Map<string, Map<string, number>> = new Map();
  const trackedSet = new Set(trackedFiles);

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!trackedSet.has(file)) continue;
      if (!fileAuthors.has(file)) fileAuthors.set(file, new Map());
      const authors = fileAuthors.get(file)!;
      authors.set(commit.authorEmail, (authors.get(commit.authorEmail) ?? 0) + 1);
    }
  }

  const files: FileBusFactor[] = [];

  for (const [file, authors] of fileAuthors.entries()) {
    const totalCommits = Array.from(authors.values()).reduce((a, b) => a + b, 0);
    const sorted = Array.from(authors.entries()).sort((a, b) => b[1] - a[1]);
    const [dominantAuthor, dominantCount] = sorted[0];
    const dominantAuthorPercent = Math.round((dominantCount / totalCommits) * 100);
    const uniqueAuthors = authors.size;

    files.push({
      file,
      uniqueAuthors,
      authors: sorted.map(([email]) => email),
      dominantAuthor,
      dominantAuthorPercent,
      risk: getBusFactorRisk(uniqueAuthors, dominantAuthorPercent),
    });
  }

  files.sort((a, b) => a.uniqueAuthors - b.uniqueAuthors || b.dominantAuthorPercent - a.dominantAuthorPercent);

  const criticalFiles = files.filter(f => f.risk === 'critical');

  // Overall bus factor: if removed this many people, half of high-churn files become single-author
  const overallBusFactor = Math.min(
    ...files.slice(0, 20).map(f => f.uniqueAuthors),
    999
  );

  const worstFile = criticalFiles[0];
  const summary = worstFile
    ? `${criticalFiles.length} files are owned by a single author — ${worstFile.file} is most at risk`
    : 'Bus factor looks healthy across the codebase';

  return { files, criticalFiles, overallBusFactor, summary };
}

function getBusFactorRisk(uniqueAuthors: number, dominantPercent: number): BusFactorRisk {
  if (uniqueAuthors === 1 || dominantPercent >= 90) return 'critical';
  if (dominantPercent >= 75) return 'high';
  if (dominantPercent >= 50) return 'medium';
  return 'low';
}
