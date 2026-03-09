import type { ChurnReport, BusFactorReport, AgeMapReport, ForensicsReport } from '../types.js';
import type { CursedFile } from '../types.js';

export function findCursedFiles(
  churn: ChurnReport,
  busFactor: BusFactorReport,
  ageMap: AgeMapReport,
  forensics: ForensicsReport,
  totalCommits: number
): CursedFile[] {
  // Index the other reports by file for O(1) lookups
  const churnByFile = new Map(churn.files.map(f => [f.file, f]));
  const busFactorByFile = new Map(busFactor.files.map(f => [f.file, f]));
  const ageByFile = new Map(ageMap.files.map(f => [f.file, f]));
  const forensicsByFile = new Map(forensics.files.map(f => [f.file, f]));

  const candidates = new Set([
    ...churn.topFiles.map(f => f.file),
    ...busFactor.criticalFiles.map(f => f.file),
    ...forensics.shameLeaderboard.map(f => f.file),
  ]);

  const cursed: CursedFile[] = [];

  for (const file of candidates) {
    const c = churnByFile.get(file);
    const b = busFactorByFile.get(file);
    const a = ageByFile.get(file);
    const f = forensicsByFile.get(file);

    // Churn data is required to produce a CursedFile (needed for score, narrative, and churn field).
    // Shame-only files (no churn data) are evaluated but dropped here intentionally.
    if (!c) continue;

    const reasons: string[] = [];
    let curseScore = 0;

    // High churn
    if (c.churnScore > 75) {
      reasons.push(`Modified in ${Math.round((c.commitCount / totalCommits) * 100)}% of all commits`);
      curseScore += 35;
    } else if (c.churnScore > 40) {
      reasons.push(`Frequently modified (${c.commitCount} commits)`);
      curseScore += 15;
    }

    // Bus factor risk
    if (b) {
      if (b.risk === 'critical') {
        reasons.push(`Single author owns ${b.dominantAuthorPercent}% of changes`);
        curseScore += 30;
      } else if (b.risk === 'high') {
        reasons.push(`Heavily concentrated ownership (${b.dominantAuthorPercent}% one author)`);
        curseScore += 15;
      } else if (b.uniqueAuthors > 5) {
        reasons.push(`${b.uniqueAuthors} different authors — high coordination overhead`);
        curseScore += 10;
      }
    }

    // Age paradox: old but still churning
    if (a && a.ageInDays < 30 && c.churnScore > 60) {
      reasons.push('Still actively changing despite being a core file');
      curseScore += 10;
    }

    // Shame bonus
    if (f) {
      const topKw = f.dominantKeywords[0];
      if (f.shameScore >= 75) {
        reasons.push(
          `${f.shameCommitCount} shame commits detected${topKw ? ` ("${topKw}" appears repeatedly)` : ''} — this file keeps breaking`
        );
        curseScore += 20;
      } else if (f.shameScore >= 50) {
        reasons.push(`High rate of fix/revert commits (shame score: ${f.shameScore}/100)`);
        curseScore += 12;
      } else if (f.shameScore >= 25) {
        reasons.push('Notable pattern of shame commits');
        curseScore += 6;
      }
    }

    if (curseScore < 50 || reasons.length === 0) continue;

    const narrative = buildNarrative(file, c.commitCount, b?.uniqueAuthors ?? 1, c.churnScore, totalCommits);

    cursed.push({
      file,
      curseScore: Math.min(curseScore, 100),
      reasons,
      churn: c.commitCount,
      authors: b?.uniqueAuthors ?? 1,
      ageDays: a?.ageInDays ?? 0,
      narrative,
    });
  }

  return cursed.sort((a, b) => b.curseScore - a.curseScore);
}

function buildNarrative(
  file: string,
  commits: number,
  authors: number,
  churnScore: number,
  totalCommits: number
): string {
  const pct = Math.round((commits / totalCommits) * 100);

  if (authors === 1 && churnScore > 75) {
    return `${file} has been touched in ${pct}% of all commits by a single author. That person is a single point of failure.`;
  }
  if (authors > 5 && churnScore > 60) {
    return `${file} has been touched by ${authors} authors in ${commits} commits — it's either the heart of the codebase or a coordination nightmare.`;
  }
  if (churnScore > 75) {
    return `${file} appears in ${pct}% of commits. High churn here often signals unclear ownership or accumulated tech debt.`;
  }
  return `${file} has seen ${commits} commits from ${authors} author${authors === 1 ? '' : 's'} — worth keeping an eye on.`;
}
