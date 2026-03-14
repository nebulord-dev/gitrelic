import type { RawCommit } from '../utils/git.js';
import type { AgeMapReport, LocReport, DeadCodeReport, DeadCodeCandidate } from '../types.js';

export function analyzeDeadCode(
  commits: RawCommit[],
  trackedFiles: string[],
  ageMap: AgeMapReport,
  locReport: LocReport,
): DeadCodeReport {
  const activeFiles = new Set<string>();
  for (const commit of commits) {
    for (const file of commit.files) {
      activeFiles.add(file);
    }
  }

  const ageByFile = new Map(ageMap.files.map(f => [f.file, f]));
  const locByFile = new Map(locReport.files.map(f => [f.file, f]));

  const candidates: DeadCodeCandidate[] = [];
  for (const file of trackedFiles) {
    if (activeFiles.has(file)) continue;
    const age = ageByFile.get(file);
    const loc = locByFile.get(file);
    candidates.push({
      file,
      lastCommitDate: age?.lastCommitDate ?? 'unknown',
      ageInDays: age?.ageInDays ?? 0,
      language: loc?.language ?? 'Other',
      loc: loc?.lines ?? 0,
    });
  }

  candidates.sort((a, b) => b.ageInDays - a.ageInDays);
  const totalDeadFiles = candidates.length;
  const totalDeadLines = candidates.reduce((s, c) => s + c.loc, 0);
  const summary = totalDeadFiles > 0
    ? `${totalDeadFiles} file${totalDeadFiles !== 1 ? 's' : ''} (${totalDeadLines.toLocaleString()} lines) with no commits in the analysis window`
    : 'No dead code candidates found';

  return { candidates, totalDeadFiles, totalDeadLines, summary };
}
