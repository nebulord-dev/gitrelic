// Conservative heuristic for distinguishing test/snapshot/fixture paths from
// production source. Designed to be liftable to core later (gitrelic.config.json
// `testPaths`) — keep it pure and free of web-only deps.
//
// Rules:
//   - Any of these segments appearing as a *full* path segment (not substring):
//     __tests__, __snapshots__, __fixtures__, tests, cypress
//   - A basename matching /\.(test|spec)\./
//
// Singular `test/` is intentionally NOT matched — it's too ambiguous (latest/,
// contest/ contexts in some repos) and the plural is the dominant convention.

const TEST_DIR_SEGMENTS = new Set([
  '__tests__',
  '__snapshots__',
  '__fixtures__',
  'tests',
  'cypress',
]);

const TEST_FILENAME_PATTERN = /\.(test|spec)\./;

export function isTestPath(filePath: string): boolean {
  if (filePath.length === 0) return false;
  const segments = filePath.split('/');
  for (let i = 0; i < segments.length - 1; i++) {
    if (TEST_DIR_SEGMENTS.has(segments[i]!)) return true;
  }
  return TEST_FILENAME_PATTERN.test(segments[segments.length - 1]!);
}
