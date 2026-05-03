import { describe, expect, it } from 'vitest';

import { languagesMetrics } from './languages';

import type { GitrelicReport, LocReport } from '@gitrelic/core';

function makeReport(loc: Partial<LocReport>): GitrelicReport {
  return {
    loc: {
      totalFiles: loc.totalFiles ?? 0,
      totalLines: loc.totalLines ?? 0,
      files: loc.files ?? [],
      languages: loc.languages ?? [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('languagesMetrics', () => {
  it('returns em-dash values when no languages detected', () => {
    const metrics = languagesMetrics(makeReport({}));
    expect(metrics).toHaveLength(5);
    expect(metrics[0].value).toBe('0');
    expect(metrics[1].value).toBe('—');
    expect(metrics[2].value).toBe('—');
    expect(metrics[3].value).toBe('0');
    expect(metrics[4].value).toBe('0');
  });

  it('reports top language and share from the first language entry', () => {
    const languages = [
      { language: 'TypeScript', files: 40, lines: 4000, percentage: 72.5 },
      { language: 'JavaScript', files: 10, lines: 1200, percentage: 21.8 },
    ];
    const metrics = languagesMetrics(
      makeReport({ totalFiles: 50, totalLines: 5200, languages }),
    );
    expect(metrics[0].value).toBe('2');
    expect(metrics[1].value).toBe('TypeScript');
    expect(metrics[2].value).toBe('73%');
    expect(metrics[3].value).toBe('50');
    expect(metrics[4].value).toBe('5,200');
  });
});
