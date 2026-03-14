import type { BusFactorReport, ContributorReport, LocReport, GhostFilesReport, GhostFile } from '../types.js';

const GHOST_OWNERSHIP_THRESHOLD = 70;

export function analyzeGhostFiles(
  busFactorReport: BusFactorReport,
  contributorReport: ContributorReport,
  locReport: LocReport,
): GhostFilesReport {
  const contributorMap = new Map(
    contributorReport.contributors.map(c => [c.email, c])
  );
  const locMap = new Map(
    locReport.files.map(f => [f.file, f.lines])
  );

  const files: GhostFile[] = [];

  for (const fileBus of busFactorReport.files) {
    if (fileBus.dominantAuthorPercent < GHOST_OWNERSHIP_THRESHOLD) continue;

    const author = contributorMap.get(fileBus.dominantAuthor);
    if (!author || author.isActive) continue;

    files.push({
      file: fileBus.file,
      dominantAuthor: fileBus.dominantAuthor,
      dominantAuthorPercent: fileBus.dominantAuthorPercent,
      lastAuthorCommitDate: author.lastCommit,
      authorInactiveDays: Math.floor(
        (Date.now() - new Date(author.lastCommit).getTime()) / 86_400_000
      ),
      loc: locMap.get(fileBus.file) ?? 0,
    });
  }

  files.sort((a, b) => b.dominantAuthorPercent - a.dominantAuthorPercent);

  const totalGhostFiles = files.length;
  const summary = totalGhostFiles > 0
    ? `${totalGhostFiles} file${totalGhostFiles !== 1 ? 's' : ''} owned by inactive contributors — knowledge may be lost`
    : 'No ghost files detected';

  return { files, totalGhostFiles, summary };
}
