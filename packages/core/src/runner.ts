import path from 'node:path';
import {
  getAllCommits,
  getTrackedFiles,
  getCurrentBranch,
  getBranches,
  detectPrimaryLanguage,
} from './utils/git.js';
import { analyzeChurn } from './analyzers/churn.js';
import { analyzeBusFactor } from './analyzers/bus-factor.js';
import { analyzeAgeMap } from './analyzers/age-map.js';
import { analyzeContributors } from './analyzers/contributors.js';
import { findCursedFiles } from './analyzers/cursed-files.js';
import { analyzeForensics } from './analyzers/forensics.js';
import type { LoreReport, RunLoreOptions } from './types.js';

/**
 * Runs the Lore analysis on a given git repository and returns a comprehensive report.
 * @param options - The options for running the analysis, including repository path, branch, and since date.
 * @Returns a LoreReport containing churn, bus factor, age map, contributors, cursed files, and forensics data. 
 */
export async function runLore(options: RunLoreOptions): Promise<LoreReport> {
  const { repoPath, branch, since, onProgress } = options;
  const repoName = path.basename(repoPath);

  onProgress?.('Reading git history...');
  const commits = await getAllCommits(repoPath, { since, branch });

  if (commits.length === 0) {
    throw new Error('No commits found. Is this a git repository?');
  }

  onProgress?.('Scanning tracked files...');
  const trackedFiles = await getTrackedFiles(repoPath);
  const branches = await getBranches(repoPath);
  const primaryLanguage = detectPrimaryLanguage(trackedFiles);

  const sorted = [...commits].sort((a, b) => a.date.localeCompare(b.date));
  const firstCommit = sorted[0].date;
  const lastCommit = sorted[sorted.length - 1].date;
  const ageInDays = Math.floor(
    (new Date(lastCommit).getTime() - new Date(firstCommit).getTime()) / 86_400_000
  );
  const uniqueAuthors = new Set(commits.map(c => c.authorEmail)).size;

  onProgress?.('Analyzing churn...');
  const churn = analyzeChurn(commits, trackedFiles);

  onProgress?.('Calculating bus factors...');
  const busFactors = analyzeBusFactor(commits, trackedFiles);

  onProgress?.('Building age map...');
  const ageMap = analyzeAgeMap(commits, trackedFiles, ageInDays);

  onProgress?.('Profiling contributors...');
  const contributors = analyzeContributors(commits, ageInDays);

  // Backfill filesOwned from bus factor data
  for (const contributor of contributors.contributors) {
    contributor.filesOwned = busFactors.files.filter(
      f => f.dominantAuthor === contributor.email
    ).length;
  }

  onProgress?.('Analyzing commit message forensics...');
  const forensics = analyzeForensics(commits, trackedFiles);

  onProgress?.('Finding cursed files...');
  const cursedFiles = findCursedFiles(churn, busFactors, ageMap, forensics, commits.length);

  return {
    timestamp: new Date().toISOString(),
    repoPath,
    repoName,
    meta: {
      totalCommits: commits.length,
      totalFiles: trackedFiles.length,
      totalAuthors: uniqueAuthors,
      firstCommit,
      lastCommit,
      ageInDays,
      primaryLanguage,
      branches,
    },
    churn,
    busFactors,
    ageMap,
    contributors,
    cursedFiles,
    forensics,
  };
}
