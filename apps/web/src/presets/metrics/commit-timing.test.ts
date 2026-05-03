import { describe, expect, it } from 'vitest';

import { commitTimingMetrics } from './commit-timing';

import type {
  CommitTimingReport,
  FileTimingProfile,
  GitrelicReport,
} from '@gitrelic/core';

function makeFile(
  overrides: Partial<FileTimingProfile> = {},
): FileTimingProfile {
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
    const metrics = commitTimingMetrics(
      makeReport({ repoLateNightPercent: 15 }),
    );
    expect(metrics[0].value).toBe('15%');
    expect(metrics[0].color).toBe('var(--severity-warning)');
  });

  it('marks Late Night % as critical at or above 20 percent', () => {
    const metrics = commitTimingMetrics(
      makeReport({ repoLateNightPercent: 25 }),
    );
    expect(metrics[0].value).toBe('25%');
    expect(metrics[0].color).toBe('var(--severity-critical)');
  });

  it('marks Weekend % as warning between 10 and 20 percent', () => {
    const metrics = commitTimingMetrics(makeReport({ repoWeekendPercent: 15 }));
    expect(metrics[1].value).toBe('15%');
    expect(metrics[1].color).toBe('var(--severity-warning)');
  });

  it('marks Weekend % as critical at or above 20 percent', () => {
    const metrics = commitTimingMetrics(makeReport({ repoWeekendPercent: 22 }));
    expect(metrics[1].value).toBe('22%');
    expect(metrics[1].color).toBe('var(--severity-critical)');
  });

  it('counts only files with stressScore above the 50 threshold', () => {
    const stressFiles = [
      makeFile({ file: 'a.ts', stressScore: 82 }),
      makeFile({ file: 'b.ts', stressScore: 30 }),
      makeFile({ file: 'c.ts', stressScore: 51 }),
    ];
    const metrics = commitTimingMetrics(
      makeReport({ stressFiles, files: stressFiles }),
    );
    expect(metrics[2].value).toBe('2');
    expect(metrics[2].color).toBe('var(--severity-warning)');
  });

  it('keeps Stress Files healthy when no file exceeds the threshold even if the list is non-empty', () => {
    const stressFiles = [
      makeFile({ stressScore: 40 }),
      makeFile({ stressScore: 50 }), // boundary — must be strictly greater than 50
    ];
    const metrics = commitTimingMetrics(
      makeReport({ stressFiles, files: stressFiles }),
    );
    expect(metrics[2].value).toBe('0');
    expect(metrics[2].color).toBe('var(--severity-healthy)');
  });

  it('marks Stress Files as critical with 5 or more stressed files', () => {
    const stressFiles = Array.from({ length: 6 }, (_, i) =>
      makeFile({ file: `f${i}.ts`, stressScore: 60 + i }),
    );
    const metrics = commitTimingMetrics(
      makeReport({ stressFiles, files: stressFiles }),
    );
    expect(metrics[2].value).toBe('6');
    expect(metrics[2].color).toBe('var(--severity-critical)');
  });

  it('marks Top Stress as critical at or above 70', () => {
    const stressFiles = [makeFile({ stressScore: 82 })];
    const metrics = commitTimingMetrics(
      makeReport({ stressFiles, files: stressFiles }),
    );
    expect(metrics[3].value).toBe('82');
    expect(metrics[3].color).toBe('var(--severity-critical)');
  });

  it('marks Top Stress as warning above the 50 threshold but below 70', () => {
    const stressFiles = [makeFile({ stressScore: 55 })];
    const metrics = commitTimingMetrics(
      makeReport({ stressFiles, files: stressFiles }),
    );
    expect(metrics[3].value).toBe('55');
    expect(metrics[3].color).toBe('var(--severity-warning)');
  });

  it('keeps Top Stress healthy when the top score is at or below the 50 threshold', () => {
    const stressFiles = [makeFile({ stressScore: 45 })];
    const metrics = commitTimingMetrics(
      makeReport({ stressFiles, files: stressFiles }),
    );
    expect(metrics[3].value).toBe('45');
    expect(metrics[3].color).toBe('var(--severity-healthy)');
  });
});
