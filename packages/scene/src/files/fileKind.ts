import { isTestPath } from './isTestPath';
import type { GitrelicReport } from '@gitrelic/core';

/**
 * How a file should be grouped in source-vs-test views. Fixtures count as
 * tests; generated/vendored code is neither — it shouldn't crowd the Tests
 * view (a Go repo's vendor/ tree) or inflate the Source view.
 */
export type FileKind = 'source' | 'test' | 'generated';

/**
 * Returns a classifier for one report. Reports that carry `fileClasses`
 * (source files are absent from it) use core's classification; reports
 * without it — empty after normalizeReport — fall back to the local path
 * heuristic. (A repo with no non-source files also yields an empty map; the
 * heuristic then finds nothing either.)
 */
export function makeFileKind(
  report: Pick<GitrelicReport, 'fileClasses'>,
): (file: string) => FileKind {
  const classes = report.fileClasses ?? {};
  if (Object.keys(classes).length === 0) {
    return (file) => (isTestPath(file) ? 'test' : 'source');
  }
  return (file) => {
    const cls = classes[file];
    if (cls === 'generated') return 'generated';
    return cls ? 'test' : 'source';
  };
}
