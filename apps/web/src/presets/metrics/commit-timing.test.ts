import { describe, expect, it } from 'vitest';

import { commitTimingMetrics } from './commit-timing';
import type {
  AuthorStressProfile,
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

function makeAuthor(
  overrides: Partial<AuthorStressProfile> = {},
): AuthorStressProfile {
  return {
    email: 'alex@example.com',
    name: 'Alex Lee',
    totalCommits: 50,
    lateNightCommits: 0,
    weekendCommits: 0,
    lateNightPercent: 0,
    weekendPercent: 0,
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
      repoHourDayMatrix:
        commitTiming.repoHourDayMatrix ??
        Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
      highStress: commitTiming.highStress ?? 0,
      tierMix: commitTiming.tierMix ?? {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      byMonth: commitTiming.byMonth ?? [],
      authorStress: commitTiming.authorStress ?? [],
    },
  } as unknown as GitrelicReport;
}

describe('commitTimingMetrics', () => {
  it('returns healthy zeros when repo has no stress patterns', () => {
    const metrics = commitTimingMetrics(makeReport({}));
    expect(metrics).toHaveLength(4);
    expect(metrics[0].label).toBe('Late Night %');
    expect(metrics[0].value).toBe('0%');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1].label).toBe('Weekend %');
    expect(metrics[1].value).toBe('0%');
    expect(metrics[1].color).toBe('var(--severity-healthy)');
    expect(metrics[2].label).toBe('High Stress');
    expect(metrics[2].value).toBe('0');
    expect(metrics[2].color).toBe('var(--severity-healthy)');
    expect(metrics[3].label).toBe('Stressed Authors');
    expect(metrics[3].value).toBe('0');
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

  it('marks High Stress as warning when between 1 and 4 high-stress files', () => {
    const metrics = commitTimingMetrics(makeReport({ highStress: 3 }));
    expect(metrics[2].value).toBe('3');
    expect(metrics[2].color).toBe('var(--severity-warning)');
  });

  it('marks High Stress as critical at 5 or more high-stress files', () => {
    const metrics = commitTimingMetrics(makeReport({ highStress: 7 }));
    expect(metrics[2].value).toBe('7');
    expect(metrics[2].color).toBe('var(--severity-critical)');
  });

  it('keeps High Stress healthy at zero', () => {
    const metrics = commitTimingMetrics(makeReport({ highStress: 0 }));
    expect(metrics[2].value).toBe('0');
    expect(metrics[2].color).toBe('var(--severity-healthy)');
  });

  it('counts only authors with stressScore >= 50 toward Stressed Authors', () => {
    const authorStress = [
      makeAuthor({ email: 'a@x', stressScore: 80 }),
      makeAuthor({ email: 'b@x', stressScore: 50 }), // boundary — included
      makeAuthor({ email: 'c@x', stressScore: 49 }), // excluded
      makeAuthor({ email: 'd@x', stressScore: 10 }),
    ];
    const metrics = commitTimingMetrics(makeReport({ authorStress }));
    expect(metrics[3].value).toBe('2');
    expect(metrics[3].color).toBe('var(--severity-warning)');
  });

  it('marks Stressed Authors as critical with more than 2 stressed authors', () => {
    const authorStress = [
      makeAuthor({ email: 'a@x', stressScore: 90 }),
      makeAuthor({ email: 'b@x', stressScore: 70 }),
      makeAuthor({ email: 'c@x', stressScore: 60 }),
    ];
    const metrics = commitTimingMetrics(makeReport({ authorStress }));
    expect(metrics[3].value).toBe('3');
    expect(metrics[3].color).toBe('var(--severity-critical)');
  });

  it('keeps Stressed Authors healthy when none meet the threshold', () => {
    const authorStress = [
      makeAuthor({ email: 'a@x', stressScore: 49 }),
      makeAuthor({ email: 'b@x', stressScore: 30 }),
    ];
    const metrics = commitTimingMetrics(makeReport({ authorStress }));
    expect(metrics[3].value).toBe('0');
    expect(metrics[3].color).toBe('var(--severity-healthy)');
  });

  it('still references file inputs only via highStress (does not look at stressFiles)', () => {
    // Even with a populated stressFiles list, the High Stress slot is now
    // driven exclusively by report.commitTiming.highStress.
    const stressFiles = [
      makeFile({ stressScore: 90 }),
      makeFile({ stressScore: 80 }),
    ];
    const metrics = commitTimingMetrics(
      makeReport({ stressFiles, files: stressFiles, highStress: 0 }),
    );
    expect(metrics[2].value).toBe('0');
    expect(metrics[2].color).toBe('var(--severity-healthy)');
  });
});
