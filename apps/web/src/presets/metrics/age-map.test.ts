import { describe, expect, it } from 'vitest';

import { ageMapMetrics } from './age-map';
import type { AgeMapReport, FileAge, GitrelicReport } from '@gitrelic/core';

function makeFile(overrides: Partial<FileAge> = {}): FileAge {
  return {
    file: 'a.ts',
    lastCommitDate: '2024-01-01',
    ageInDays: 100,
    status: 'fresh',
    ...overrides,
  };
}

function makeReport(ageMap: Partial<AgeMapReport>): GitrelicReport {
  return {
    ageMap: {
      files: ageMap.files ?? [],
      staleFiles: ageMap.staleFiles ?? [],
      ancientFiles: ageMap.ancientFiles ?? [],
      medianAgeDays: ageMap.medianAgeDays ?? 0,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('ageMapMetrics', () => {
  it('returns healthy/em-dash values when no files are tracked', () => {
    const metrics = ageMapMetrics(makeReport({}));
    expect(metrics).toHaveLength(4);
    expect(metrics[0].value).toBe('—');
    expect(metrics[0].color).toBe('var(--text-primary)');
    expect(metrics[1].value).toBe('0');
    expect(metrics[1].color).toBe('var(--severity-healthy)');
    expect(metrics[2].color).toBe('var(--severity-healthy)');
    expect(metrics[3].value).toBe('0');
  });

  it('counts fresh files from files array by status', () => {
    const files = [
      makeFile({ status: 'fresh' }),
      makeFile({ status: 'fresh' }),
      makeFile({ status: 'stale' }),
      makeFile({ status: 'ancient' }),
    ];
    const staleFiles = [makeFile({ status: 'stale' })];
    const ancientFiles = [makeFile({ status: 'ancient' })];
    const metrics = ageMapMetrics(
      makeReport({ files, staleFiles, ancientFiles, medianAgeDays: 200 }),
    );
    expect(metrics[0].value).toBe('200');
    expect(metrics[1].value).toBe('1');
    expect(metrics[1].color).toBe('var(--severity-warning)');
    expect(metrics[2].value).toBe('1');
    expect(metrics[3].value).toBe('2');
  });

  it('warns when median age exceeds a year', () => {
    const metrics = ageMapMetrics(
      makeReport({ files: [makeFile()], medianAgeDays: 400 }),
    );
    expect(metrics[0].color).toBe('var(--severity-warning)');
  });
});
