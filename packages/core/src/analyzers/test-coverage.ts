import path from 'node:path';

import type { TestCoverageProxyReport, DirectoryCoverage, TestCoverageFile } from '../types.js';

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.rb',
  '.go',
  '.rs',
  '.java',
  '.cs',
  '.cpp',
  '.c',
  '.php',
  '.swift',
  '.kt',
  '.vue',
  '.svelte',
  '.astro',
]);

function isTestFile(file: string): boolean {
  const base = path.basename(file);
  return /\.(test|spec)\./.test(base) || file.includes('__tests__/');
}

function isCodeFile(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
}

export function analyzeTestCoverage(trackedFiles: string[]): TestCoverageProxyReport {
  const dirStats = new Map<string, { source: number; test: number }>();
  const sourceFiles: string[] = [];
  const testFileSet = new Set<string>();

  for (const file of trackedFiles) {
    if (!isCodeFile(file)) continue;
    const dir = path.dirname(file);
    if (!dirStats.has(dir)) dirStats.set(dir, { source: 0, test: 0 });
    const entry = dirStats.get(dir)!;
    if (isTestFile(file)) {
      entry.test++;
      testFileSet.add(file);
    } else {
      entry.source++;
      sourceFiles.push(file);
    }
  }

  // Build per-file hasTestSibling: a source file has a sibling if some test
  // file shares its basename (minus .test/.spec) and lives either in the same
  // directory or a __tests__ subdirectory of it.
  const stem = (file: string): string => {
    const base = path.basename(file);
    return base.replace(/\.(test|spec)\.[^.]+$/, '').replace(/\.[^.]+$/, '');
  };
  const testStemsByDir = new Map<string, Set<string>>();
  for (const t of testFileSet) {
    let dir = path.dirname(t);
    if (path.basename(dir) === '__tests__') dir = path.dirname(dir);
    if (!testStemsByDir.has(dir)) testStemsByDir.set(dir, new Set());
    testStemsByDir.get(dir)!.add(stem(t));
  }

  const files: TestCoverageFile[] = sourceFiles.map((file) => {
    const dir = path.dirname(file);
    const siblings = testStemsByDir.get(dir);
    return {
      file,
      hasTestSibling: siblings ? siblings.has(stem(file)) : false,
    };
  });

  const directories: DirectoryCoverage[] = [...dirStats.entries()]
    .map(([directory, { source, test }]) => ({
      directory,
      sourceFiles: source,
      testFiles: test,
      coverageRatio: source > 0 ? Math.round((test / source) * 100) / 100 : 0,
      hasTests: test > 0,
    }))
    .sort((a, b) => a.coverageRatio - b.coverageRatio);

  const uncoveredDirectories = directories.filter((d) => !d.hasTests && d.sourceFiles > 0);

  const totalSource = directories.reduce((s, d) => s + d.sourceFiles, 0);
  const totalTest = directories.reduce((s, d) => s + d.testFiles, 0);
  const overallRatio = totalSource > 0 ? Math.round((totalTest / totalSource) * 100) / 100 : 0;

  const summary =
    uncoveredDirectories.length > 0
      ? `${uncoveredDirectories.length} director${uncoveredDirectories.length !== 1 ? 'ies' : 'y'} with source files but no tests`
      : totalSource > 0
        ? 'All directories with source files have tests'
        : 'No source files found';

  return { directories, uncoveredDirectories, files, overallRatio, summary };
}
