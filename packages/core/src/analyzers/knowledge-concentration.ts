import type {
  BusFactorReport,
  KnowledgeConcentrationReport,
} from '../types.js';

const SINGLE_AUTHOR_THRESHOLD = 80;

export function analyzeKnowledgeConcentration(
  busFactorReport: BusFactorReport,
): KnowledgeConcentrationReport {
  const totalFiles = busFactorReport.files.length;
  const singleAuthorFiles = busFactorReport.files.filter(
    (f) => f.dominantAuthorPercent > SINGLE_AUTHOR_THRESHOLD,
  ).length;

  const concentrationIndex =
    totalFiles > 0 ? Math.round((singleAuthorFiles / totalFiles) * 100) : 0;

  const summary =
    totalFiles > 0
      ? `${concentrationIndex}% of files are single-author dominant (${singleAuthorFiles}/${totalFiles})`
      : 'No files to analyze';

  return { singleAuthorFiles, totalFiles, concentrationIndex, summary };
}
