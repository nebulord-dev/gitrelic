import { describe, expect, it } from 'vitest';

import { deadCodeMetrics } from './dead-code';
import type {
  DeadCodeCandidate,
  DeadCodeReport,
  GitrelicReport,
} from '@gitrelic/core';

function makeCandidate(
  overrides: Partial<DeadCodeCandidate> = {},
): DeadCodeCandidate {
  return {
    file: 'a.ts',
    lastCommitDate: '2022-01-01',
    ageInDays: 200,
    language: 'TypeScript',
    loc: 10,
    ...overrides,
  };
}

function makeReport(deadCode: Partial<DeadCodeReport>): GitrelicReport {
  return {
    deadCode: {
      candidates: deadCode.candidates ?? [],
      totalDeadFiles: deadCode.totalDeadFiles ?? 0,
      totalDeadLines: deadCode.totalDeadLines ?? 0,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('deadCodeMetrics', () => {
  it('returns healthy/em-dash values when there are no dead files', () => {
    const metrics = deadCodeMetrics(makeReport({}));
    expect(metrics).toHaveLength(4);
    expect(metrics[0]).toMatchObject({ label: 'Dead Files', value: '0' });
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[2].value).toBe('—');
    expect(metrics[3].value).toBe('—');
  });

  it('returns correct aggregates for non-empty candidates', () => {
    const candidates = [
      makeCandidate({ file: 'a.ts', ageInDays: 400 }),
      makeCandidate({ file: 'b.ts', ageInDays: 200 }),
    ];
    const metrics = deadCodeMetrics(
      makeReport({ candidates, totalDeadFiles: 2, totalDeadLines: 500 }),
    );
    expect(metrics[0].value).toBe('2');
    expect(metrics[1].value).toBe('500');
    expect(metrics[2].value).toBe('400');
    expect(metrics[3].value).toBe('300');
  });

  it('warns when oldest exceeds one year', () => {
    const candidates = [makeCandidate({ ageInDays: 400 })];
    const metrics = deadCodeMetrics(
      makeReport({ candidates, totalDeadFiles: 1, totalDeadLines: 10 }),
    );
    expect(metrics[2].color).toBe('var(--severity-warning)');
  });

  it('warns on large dead LOC', () => {
    const metrics = deadCodeMetrics(
      makeReport({
        candidates: [makeCandidate()],
        totalDeadFiles: 1,
        totalDeadLines: 2000,
      }),
    );
    expect(metrics[1].color).toBe('var(--severity-warning)');
  });

  it('formats large counts with thousands separators', () => {
    const metrics = deadCodeMetrics(
      makeReport({
        candidates: [makeCandidate()],
        totalDeadFiles: 1234,
        totalDeadLines: 50000,
      }),
    );
    expect(metrics[0].value).toBe('1,234');
    expect(metrics[1].value).toBe('50,000');
  });
});
