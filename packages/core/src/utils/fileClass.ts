// ─── File classification ───────────────────────────────────────────────────────
//
// Ownership metrics measure who would be missed if they left. Test fixtures,
// snapshots and generated code inflate them badly: in React, ~550 of the 1,665
// "critical" bus-factor files were compiler test fixtures nobody maintains by
// hand. Classifying files lets the runner keep them out of ownership analysis.
//
// Precedence: generated > fixture > test > source. Directory rules match whole
// path segments only (never the filename), so `vendors/` or `fixtures.ts`
// don't trigger them. Singular `test/` is deliberately not a test directory —
// too ambiguous; the plural is the dominant convention.

export type FileClass = 'source' | 'test' | 'fixture' | 'generated';

const GENERATED_DIRS = new Set(['__generated__', 'vendor', 'third_party']);
const GENERATED_FILE =
  /(\.generated\.|\.pb\.go$|_pb2\.py$|\.g\.dart$|\.min\.(js|css)$)/;

const FIXTURE_DIRS = new Set([
  '__fixtures__',
  'fixtures',
  'fixture',
  'testdata',
  '__snapshots__',
  '__mocks__',
]);
const FIXTURE_FILE = /\.snap$/;

const TEST_DIRS = new Set(['__tests__', 'tests', 'cypress']);
const TEST_FILE = /\.(test|spec)\./;

export function classifyFile(filePath: string): FileClass {
  if (filePath.length === 0) return 'source';
  const segments = filePath.split('/');
  const dirs = segments.slice(0, -1);
  const base = segments[segments.length - 1]!;

  if (dirs.some((d) => GENERATED_DIRS.has(d)) || GENERATED_FILE.test(base)) {
    return 'generated';
  }
  if (dirs.some((d) => FIXTURE_DIRS.has(d)) || FIXTURE_FILE.test(base)) {
    return 'fixture';
  }
  if (dirs.some((d) => TEST_DIRS.has(d)) || TEST_FILE.test(base)) {
    return 'test';
  }
  return 'source';
}
