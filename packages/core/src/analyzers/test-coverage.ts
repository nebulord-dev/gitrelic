import path from 'node:path';

import type { TestCoverageProxyReport, DirectoryCoverage } from '../types.js';

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

  for (const file of trackedFiles) {
    if (!isCodeFile(file)) continue;
    const dir = path.dirname(file);
    if (!dirStats.has(dir)) dirStats.set(dir, { source: 0, test: 0 });
    const entry = dirStats.get(dir)!;
    if (isTestFile(file)) {
      entry.test++;
    } else {
      entry.source++;
    }
  }

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

  return { directories, uncoveredDirectories, overallRatio, summary };
}
