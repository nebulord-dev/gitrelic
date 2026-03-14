import { describe, it, expect } from 'vitest';
import { analyzeTestCoverage } from './test-coverage.js';

describe('analyzeTestCoverage', () => {
  it('counts test and source files per directory', () => {
    const files = ['src/a.ts', 'src/a.test.ts', 'src/b.ts'];
    const result = analyzeTestCoverage(files);
    const srcDir = result.directories.find(d => d.directory === 'src')!;
    expect(srcDir.sourceFiles).toBe(2);
    expect(srcDir.testFiles).toBe(1);
    expect(srcDir.coverageRatio).toBeCloseTo(0.5);
    expect(srcDir.hasTests).toBe(true);
  });

  it('detects .spec files as tests', () => {
    const files = ['lib/util.ts', 'lib/util.spec.ts'];
    const result = analyzeTestCoverage(files);
    const dir = result.directories.find(d => d.directory === 'lib')!;
    expect(dir.testFiles).toBe(1);
  });

  it('identifies uncovered directories', () => {
    const files = ['src/a.ts', 'src/a.test.ts', 'utils/helper.ts'];
    const result = analyzeTestCoverage(files);
    expect(result.uncoveredDirectories.map(d => d.directory)).toContain('utils');
  });

  it('ignores non-code files for source count', () => {
    const files = ['src/a.ts', 'src/readme.md', 'src/config.json', 'src/style.css'];
    const result = analyzeTestCoverage(files);
    const dir = result.directories.find(d => d.directory === 'src')!;
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
  });

  it('produces a summary', () => {
    const files = ['src/a.ts', 'src/a.test.ts'];
    const result = analyzeTestCoverage(files);
    expect(result.summary).toBeTruthy();
  });
});
