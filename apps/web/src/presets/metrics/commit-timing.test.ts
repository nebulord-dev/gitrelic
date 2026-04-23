import { describe, expect, it } from 'vitest';

import { commitTimingMetrics } from './commit-timing';

import type { CommitTimingReport, FileTimingProfile, GitrelicReport } from '@gitrelic/core';

function makeFile(overrides: Partial<FileTimingProfile> = {}): FileTimingProfile {
  return {
    file: 'a.ts',
    totalCommits: 10,
    lateNightPercent: 0,
    weekendPercent: 0,
    peakHour: 14,
    peakDay: 2,
    hourDistribution: Array.from({ length: 24 }, () => 0),
    stressScore: 30,
    ...overrides,
  };
}

function makeReport(commitTiming: Partial<CommitTimingReport>): GitrelicReport {
  return {
    commitTiming: {
      files: commitTiming.files ?? [],
      stressFiles: commitTiming.stressFiles ?? [],
      repoLateNightPercent: commitTiming.repoLateNightPercent ?? 0,
      repoWeekendPercent: commitTiming.repoWeekendPercent ?? 0,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('commitTimingMetrics', () => {
  it('returns healthy zeros when repo has no stress patterns', () => {
    const metrics = commitTimingMetrics(makeReport({}));
    expect(metrics).toHaveLength(4);
    expect(metrics[0].value).toBe('0%');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1].value).toBe('0%');
    expect(metrics[1].color).toBe('var(--severity-healthy)');
    expect(metrics[2].value).toBe('0');
    expect(metrics[2].color).toBe('var(--severity-healthy)');
    expect(metrics[3].value).toBe('—');
    expect(metrics[3].color).toBe('var(--severity-healthy)');
  });

  it('marks Late Night % as warning between 10 and 20 percent', () => {
    const metrics = commitTimingMetrics(makeReport({ repoLateNightPercent: 15 }));
    expect(metrics[0].value).toBe('15%');
    expect(metrics[0].color).toBe('var(--severity-warning)');
  });

  it('marks Late Night % as critical at or above 20 percent', () => {
    const metrics = commitTimingMetrics(makeReport({ repoLateNightPercent: 25 }));
    expect(metrics[0].value).toBe('25%');
    expect(metrics[0].color).toBe('var(--severity-critical)');
  });

  it('marks Weekend % as critical at or above 20 percent', () => {
    const metrics = commitTimingMetrics(makeReport({ repoWeekendPercent: 22 }));
    expect(metrics[1].value).toBe('22%');
    expect(metrics[1].color).toBe('var(--severity-critical)');
  });

  it('marks Top Stress as critical at or above 70', () => {
    const stressFiles = [makeFile({ stressScore: 82 })];
    const metrics = commitTimingMetrics(makeReport({ stressFiles, files: stressFiles }));
    expect(metrics[2].value).toBe('1');
    expect(metrics[2].color).toBe('var(--severity-warning)');
    expect(metrics[3].value).toBe('82');
    expect(metrics[3].color).toBe('var(--severity-critical)');
  });

  it('marks Top Stress as warning below the 70 threshold', () => {
    const stressFiles = [makeFile({ stressScore: 55 })];
    const metrics = commitTimingMetrics(makeReport({ stressFiles, files: stressFiles }));
    expect(metrics[3].value).toBe('55');
    expect(metrics[3].color).toBe('var(--severity-warning)');
  });
});
