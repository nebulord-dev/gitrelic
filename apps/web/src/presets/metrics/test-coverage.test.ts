import { describe, expect, it } from 'vitest';

import { testCoverageMetrics } from './test-coverage';

import type { DirectoryCoverage, GitrelicReport, TestCoverageProxyReport } from '@gitrelic/core';

function makeDir(overrides: Partial<DirectoryCoverage> = {}): DirectoryCoverage {
  return {
    directory: 'src',
    sourceFiles: 10,
    testFiles: 5,
    coverageRatio: 0.5,
    hasTests: true,
    ...overrides,
  };
}

function makeReport(testCoverage: Partial<TestCoverageProxyReport>): GitrelicReport {
  return {
    testCoverage: {
      directories: testCoverage.directories ?? [],
      uncoveredDirectories: testCoverage.uncoveredDirectories ?? [],
      overallRatio: testCoverage.overallRatio ?? 0,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('testCoverageMetrics', () => {
  it('returns healthy/em-dash values when no directories are tracked', () => {
    const metrics = testCoverageMetrics(makeReport({}));
    expect(metrics).toHaveLength(4);
    expect(metrics[0].value).toBe('—');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1].value).toBe('0');
    expect(metrics[1].color).toBe('var(--severity-healthy)');
    expect(metrics[2].value).toBe('0');
    expect(metrics[3].value).toBe('0');
  });

  it('reports healthy when overall ratio is at least 50%', () => {
    const metrics = testCoverageMetrics(
      makeReport({ directories: [makeDir()], overallRatio: 0.6 }),
    );
    expect(metrics[0].value).toBe('60%');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
  });

  it('warns between 20% and 50%', () => {
    const metrics = testCoverageMetrics(
      makeReport({ directories: [makeDir()], overallRatio: 0.3 }),
    );
    expect(metrics[0].color).toBe('var(--severity-warning)');
  });

  it('marks critical below 20%', () => {
    const metrics = testCoverageMetrics(
      makeReport({ directories: [makeDir()], overallRatio: 0.1 }),
    );
    expect(metrics[0].color).toBe('var(--severity-critical)');
  });

  it('derives covered dirs from directories minus uncoveredDirectories', () => {
    const directories = [makeDir(), makeDir({ directory: 'lib' }), makeDir({ directory: 'app' })];
    const uncoveredDirectories = [makeDir({ directory: 'lib', hasTests: false })];
    const metrics = testCoverageMetrics(
      makeReport({ directories, uncoveredDirectories, overallRatio: 0.7 }),
    );
    expect(metrics[2].value).toBe('3');
    expect(metrics[3].value).toBe('2');
  });
});
