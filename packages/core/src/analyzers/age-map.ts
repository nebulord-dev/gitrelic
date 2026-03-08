import type { RawCommit } from '../utils/git.js';
import type { AgeMapReport, FileAge, AgeStatus } from '../types.js';

export function analyzeAgeMap(commits: RawCommit[], trackedFiles: string[], repoAgeDays: number): AgeMapReport {
  // Map: file → most recent commit date
  const fileLastCommit: Map<string, string> = new Map();
  const trackedSet = new Set(trackedFiles);

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!trackedSet.has(file)) continue;
      const existing = fileLastCommit.get(file);
      if (!existing || commit.date > existing) {
        fileLastCommit.set(file, commit.date);
      }
    }
  }

  const now = Date.now();

  const files: FileAge[] = Array.from(fileLastCommit.entries()).map(([file, lastCommitDate]) => {
    const ageInDays = Math.floor((now - new Date(lastCommitDate).getTime()) / 86_400_000);
    return { file, lastCommitDate, ageInDays, status: getAgeStatus(ageInDays, repoAgeDays) };
  }).sort((a, b) => b.ageInDays - a.ageInDays);

  const staleFiles = files.filter(f => f.status === 'stale');
  const ancientFiles = files.filter(f => f.status === 'ancient');

  const ages = files.map(f => f.ageInDays).sort((a, b) => a - b);
  const medianAgeDays = ages[Math.floor(ages.length / 2)] ?? 0;

  const summary = ancientFiles.length > 0
    ? `${ancientFiles.length} files haven't been touched in over ${Math.round(repoAgeDays * 0.66)} days — they may be dead weight or critical infrastructure nobody dares touch`
    : staleFiles.length > 0
    ? `${staleFiles.length} files are going stale (no commits in ${Math.round(repoAgeDays * 0.33)}+ days)`
    : 'The codebase is actively maintained across most files';

  return { files, staleFiles, ancientFiles, medianAgeDays, summary };
}

function getAgeStatus(ageInDays: number, repoAgeDays: number): AgeStatus {
  const freshLimit = Math.round(repoAgeDays * 0.08);
  const agingLimit = Math.round(repoAgeDays * 0.33);
  const staleLimit = Math.round(repoAgeDays * 0.66);

  if (ageInDays <= freshLimit) return 'fresh';
  if (ageInDays <= agingLimit) return 'aging';
  if (ageInDays <= staleLimit) return 'stale';
  return 'ancient';
}
