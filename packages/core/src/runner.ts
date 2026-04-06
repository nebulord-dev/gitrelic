import path from 'node:path';

import { analyzeAgeMap } from './analyzers/age-map.js';
import { analyzeBlastRadius } from './analyzers/blast-radius.js';
import { analyzeBusFactor } from './analyzers/bus-factor.js';
import { analyzeChurnVelocity } from './analyzers/churn-velocity.js';
import { analyzeChurn } from './analyzers/churn.js';
import { analyzeCoAuthors } from './analyzers/co-author.js';
import { analyzeCommitTiming } from './analyzers/commit-timing.js';
import { analyzeComplexityTrend } from './analyzers/complexity-trend.js';
import { analyzeContributors } from './analyzers/contributors.js';
import { analyzeCoupling } from './analyzers/coupling.js';
import { findCursedFiles } from './analyzers/cursed-files.js';
import { analyzeDeadCode } from './analyzers/dead-code.js';
import { analyzeForensics } from './analyzers/forensics.js';
import { analyzeGhostFiles } from './analyzers/ghost-files.js';
import { analyzeHotspotClustering } from './analyzers/hotspot-clustering.js';
import { analyzeHotspots } from './analyzers/hotspot.js';
import { analyzeKnowledgeConcentration } from './analyzers/knowledge-concentration.js';
import { analyzeLoc } from './analyzers/loc.js';
import { analyzeParallelDev } from './analyzers/parallel-dev.js';
import { analyzeRenameTracking } from './analyzers/rename-tracking.js';
import { analyzeRewriteRatio } from './analyzers/rewrite-ratio.js';
import { analyzeTestCoverage } from './analyzers/test-coverage.js';
import { getAllCommits, getTrackedFiles, getBranches, detectPrimaryLanguage } from './utils/git.js';

import type { GitloreReport, RunGitloreOptions } from './types.js';

/**
 * Runs the GitLore analysis on a given git repository and returns a comprehensive report.
 * @param options - The options for running the analysis, including repository path, branch, and since date.
 * @Returns a GitloreReport containing churn, bus factor, age map, contributors, cursed files, and forensics data.
 */
export async function runGitlore(options: RunGitloreOptions): Promise<GitloreReport> {
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
    (new Date(lastCommit).getTime() - new Date(firstCommit).getTime()) / 86_400_000,
  );
  const uniqueAuthors = new Set(commits.map((c) => c.authorEmail)).size;

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
      (f) => f.dominantAuthor === contributor.email,
    ).length;
  }

  onProgress?.('Analyzing commit message forensics...');
  const forensics = analyzeForensics(commits, trackedFiles);

  onProgress?.('Detecting parallel development...');
  const parallelDev = analyzeParallelDev(commits, trackedFiles);

  onProgress?.('Counting lines of code...');
  const loc = await analyzeLoc(trackedFiles, repoPath);

  onProgress?.('Computing hotspot scores...');
  const hotspots = analyzeHotspots(churn, loc);

  onProgress?.('Mapping file coupling...');
  const coupling = analyzeCoupling(commits, trackedFiles);

  onProgress?.('Analyzing churn velocity...');
  const churnVelocity = analyzeChurnVelocity(commits, trackedFiles);

  onProgress?.('Calculating rewrite ratios...');
  const rewriteRatio = analyzeRewriteRatio(commits, trackedFiles);

  onProgress?.('Measuring blast radius...');
  const blastRadius = analyzeBlastRadius(commits, trackedFiles);

  onProgress?.('Finding dead code candidates...');
  const deadCode = analyzeDeadCode(commits, trackedFiles, ageMap, loc);

  onProgress?.('Checking test coverage...');
  const testCoverage = analyzeTestCoverage(trackedFiles);

  onProgress?.('Detecting ghost files...');
  const ghostFiles = analyzeGhostFiles(busFactors, contributors, loc);

  onProgress?.('Measuring knowledge concentration...');
  const knowledgeConcentration = analyzeKnowledgeConcentration(busFactors);

  onProgress?.('Analyzing co-authorship...');
  const coAuthors = analyzeCoAuthors(commits);

  onProgress?.('Clustering hotspots...');
  const hotspotClusters = analyzeHotspotClustering(
    hotspots,
    busFactors,
    coupling,
    contributors,
    commits,
    trackedFiles,
  );

  onProgress?.('Tracking complexity trends...');
  const complexityTrend = analyzeComplexityTrend(commits, trackedFiles);

  onProgress?.('Analyzing commit timing...');
  const commitTiming = analyzeCommitTiming(commits, trackedFiles);

  onProgress?.('Tracking file renames...');
  const renameTracking = await analyzeRenameTracking(repoPath, trackedFiles, { since });

  onProgress?.('Finding cursed files...');
  const cursedFiles = findCursedFiles(
    churn,
    busFactors,
    ageMap,
    forensics,
    parallelDev,
    commits.length,
  );

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
    parallelDev,
    loc,
    hotspots,
    coupling,
    churnVelocity,
    rewriteRatio,
    blastRadius,
    deadCode,
    testCoverage,
    ghostFiles,
    knowledgeConcentration,
    coAuthors,
    hotspotClusters,
    complexityTrend,
    commitTiming,
    renameTracking,
  };
}
