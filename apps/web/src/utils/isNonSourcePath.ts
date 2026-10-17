import { isTestPath } from './isTestPath';
import type { GitrelicReport } from '@gitrelic/core';

/**
 * True for test, fixture and generated files. Reports from core ≥ 0.50 carry
 * the authoritative `fileClasses` map (source files are absent from it); for
 * older reports, whose map is empty after normalizeReport, fall back to the
 * local path heuristic. (A fresh report from a repo with no non-source files
 * also has an empty map; the heuristic then finds nothing either.)
 */
export function isNonSourcePath(
  report: Pick<GitrelicReport, 'fileClasses'>,
  file: string,
): boolean {
  const classes = report.fileClasses ?? {};
  if (Object.keys(classes).length === 0) return isTestPath(file);
  return file in classes;
}
