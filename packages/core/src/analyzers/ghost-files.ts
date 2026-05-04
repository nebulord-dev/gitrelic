import type {
  BusFactorReport,
  ContributorReport,
  LocReport,
  GhostFilesReport,
  GhostFile,
} from '../types.js';

const GHOST_OWNERSHIP_THRESHOLD = 80;

export function analyzeGhostFiles(
  busFactorReport: BusFactorReport,
  contributorReport: ContributorReport,
  locReport: LocReport,
): GhostFilesReport {
  const contributorMap = new Map(
    contributorReport.contributors.map((c) => [c.email, c]),
  );
  const locMap = new Map(locReport.files.map((f) => [f.file, f.lines]));

  const files: GhostFile[] = [];

  for (const fileBus of busFactorReport.files) {
    if (fileBus.dominantAuthorPercent < GHOST_OWNERSHIP_THRESHOLD) continue;

    const author = contributorMap.get(fileBus.dominantAuthor);
    if (!author || !author.isGhost) continue;

    files.push({
      file: fileBus.file,
      dominantAuthor: fileBus.dominantAuthor,
      dominantAuthorPercent: fileBus.dominantAuthorPercent,
      lastAuthorCommitDate: author.lastCommit,
      authorInactiveDays: Math.floor(
        (Date.now() - new Date(author.lastCommit).getTime()) / 86_400_000,
      ),
      loc: locMap.get(fileBus.file) ?? 0,
    });
  }

  files.sort((a, b) => b.dominantAuthorPercent - a.dominantAuthorPercent);

  const totalGhostFiles = files.length;
  const ghostOwners = new Set(files.map((f) => f.dominantAuthor)).size;
  const ghostLoc = files.reduce((sum, f) => sum + f.loc, 0);
  // Buckets are exhaustive over `files`: the `isGhost` gate above guarantees
  // every flagged file has `authorInactiveDays >= 180`, so trueGhost + fading
  // === totalGhostFiles. The `'tier mix sums to totalGhostFiles'` test locks
  // this in. If a future change loosens the gate, the subline counts would
  // silently undercount.
  const tierMix = {
    trueGhost: files.filter((f) => f.authorInactiveDays >= 365).length,
    fading: files.filter(
      (f) => f.authorInactiveDays >= 180 && f.authorInactiveDays < 365,
    ).length,
  };

  const summary =
    totalGhostFiles > 0
      ? `${totalGhostFiles} file${totalGhostFiles !== 1 ? 's' : ''} owned by inactive contributors — knowledge may be lost`
      : 'No ghost files detected';

  return {
    files,
    totalGhostFiles,
    ghostOwners,
    ghostLoc,
    tierMix,
    summary,
  };
}
