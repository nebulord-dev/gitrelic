import { describe, it, expect } from 'vitest';

import { analyzeTestCoverage } from './test-coverage.js';

describe('analyzeTestCoverage', () => {
  it('counts test and source files per directory', () => {
    const files = ['src/a.ts', 'src/a.test.ts', 'src/b.ts'];
    const result = analyzeTestCoverage(files);
    const srcDir = result.directories.find((d) => d.directory === 'src')!;
    expect(srcDir.sourceFiles).toBe(2);
    expect(srcDir.testFiles).toBe(1);
    expect(srcDir.coverageRatio).toBeCloseTo(0.5);
    expect(srcDir.hasTests).toBe(true);
  });

  it('detects .spec files as tests', () => {
    const files = ['lib/util.ts', 'lib/util.spec.ts'];
    const result = analyzeTestCoverage(files);
    const dir = result.directories.find((d) => d.directory === 'lib')!;
    expect(dir.testFiles).toBe(1);
  });

  it('identifies uncovered directories', () => {
    const files = ['src/a.ts', 'src/a.test.ts', 'utils/helper.ts'];
    const result = analyzeTestCoverage(files);
    expect(result.uncoveredDirectories.map((d) => d.directory)).toContain('utils');
  });

  it('ignores non-code files for source count', () => {
    const files = ['src/a.ts', 'src/readme.md', 'src/config.json', 'src/style.css'];
    const result = analyzeTestCoverage(files);
    const dir = result.directories.find((d) => d.directory === 'src')!;
    expect(dir.sourceFiles).toBe(1); // only a.ts
  });

  it('computes overall ratio', () => {
    const files = ['src/a.ts', 'src/a.test.ts', 'src/b.ts', 'src/b.test.ts'];
    const result = analyzeTestCoverage(files);
    expect(result.overallRatio).toBeCloseTo(1.0);
  });

  it('handles empty file list', () => {
    const result = analyzeTestCoverage([]);
    expect(result.directories).toHaveLength(0);
    expect(result.overallRatio).toBe(0);
    expect(result.files).toHaveLength(0);
  });

  it('produces a summary', () => {
    const files = ['src/a.ts', 'src/a.test.ts'];
    const result = analyzeTestCoverage(files);
    expect(result.summary).toBeTruthy();
  });
});

describe('analyzeTestCoverage — files[]', () => {
  it('marks a source file as hasTestSibling when a sibling test exists in the same dir', () => {
    const files = ['src/a.ts', 'src/a.test.ts', 'src/b.ts'];
    const { files: perFile } = analyzeTestCoverage(files);
    const a = perFile.find((f) => f.file === 'src/a.ts')!;
    const b = perFile.find((f) => f.file === 'src/b.ts')!;
    expect(a.hasTestSibling).toBe(true);
    expect(b.hasTestSibling).toBe(false);
  });

  it('detects siblings across .spec naming', () => {
    const files = ['lib/util.ts', 'lib/util.spec.ts'];
    const { files: perFile } = analyzeTestCoverage(files);
    expect(perFile.find((f) => f.file === 'lib/util.ts')!.hasTestSibling).toBe(true);
  });

  it('detects siblings under a __tests__ subdirectory', () => {
    const files = ['src/foo.ts', 'src/__tests__/foo.test.ts'];
    const { files: perFile } = analyzeTestCoverage(files);
    expect(perFile.find((f) => f.file === 'src/foo.ts')!.hasTestSibling).toBe(true);
  });

  it('does not include test files themselves in files[]', () => {
    const files = ['src/a.ts', 'src/a.test.ts'];
    const { files: perFile } = analyzeTestCoverage(files);
    expect(perFile.map((f) => f.file)).toEqual(['src/a.ts']);
  });

  it('does not include non-code files in files[]', () => {
    const files = ['src/a.ts', 'src/readme.md', 'src/style.css'];
    const { files: perFile } = analyzeTestCoverage(files);
    expect(perFile.map((f) => f.file)).toEqual(['src/a.ts']);
  });

  it('returns empty files[] when only a test file is tracked', () => {
    const { files: perFile } = analyzeTestCoverage(['src/orphan.test.ts']);
    expect(perFile).toHaveLength(0);
  });
});
