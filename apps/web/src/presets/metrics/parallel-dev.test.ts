import { describe, expect, it } from 'vitest';

import { parallelDevMetrics } from './parallel-dev';
import type {
  FileParallelDev,
  GitrelicReport,
  ParallelDevReport,
  ParallelWindow,
} from '@gitrelic/core';

function makeWindow(overrides: Partial<ParallelWindow> = {}): ParallelWindow {
  return {
    weekStart: '2024-01-01',
    authors: ['a', 'b'],
    commitCount: 5,
    ...overrides,
  };
}

function makeFile(overrides: Partial<FileParallelDev> = {}): FileParallelDev {
  return {
    file: 'a.ts',
    parallelScore: 50,
    totalActiveWeeks: 10,
    parallelWeeks: 3,
    peakAuthors: 2,
    peakWindow: makeWindow(),
    topWindows: [],
    narrative: '',
    ...overrides,
  };
}

function makeReport(parallelDev: Partial<ParallelDevReport>): GitrelicReport {
  return {
    parallelDev: {
      files: parallelDev.files ?? [],
      hotFiles: parallelDev.hotFiles ?? [],
      totalParallelFiles: parallelDev.totalParallelFiles ?? 0,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('parallelDevMetrics', () => {
  it('returns healthy zeros when nothing parallel occurred', () => {
    const metrics = parallelDevMetrics(makeReport({}));
    expect(metrics).toHaveLength(4);
    expect(metrics[0].value).toBe('0');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[2].value).toBe('—');
    expect(metrics[2].color).toBe('var(--severity-healthy)');
    expect(metrics[3].value).toBe('—');
  });

  it('computes aggregates from hot files and files list', () => {
    const files = [
      makeFile({ file: 'a.ts', peakAuthors: 5 }),
      makeFile({ file: 'b.ts', peakAuthors: 2 }),
    ];
    const hotFiles = [makeFile({ file: 'a.ts', parallelScore: 82 })];
    const metrics = parallelDevMetrics(
      makeReport({ files, hotFiles, totalParallelFiles: 2 }),
    );
    expect(metrics[0].value).toBe('2');
    expect(metrics[1].value).toBe('1');
    expect(metrics[2].value).toBe('82');
    expect(metrics[2].color).toBe('var(--severity-critical)');
    expect(metrics[3].value).toBe('5');
    expect(metrics[3].color).toBe('var(--severity-warning)');
  });

  it('marks Top Score as warning below the 70 threshold', () => {
    const hotFiles = [makeFile({ parallelScore: 65 })];
    const metrics = parallelDevMetrics(
      makeReport({ files: [makeFile()], hotFiles, totalParallelFiles: 1 }),
    );
    expect(metrics[2].color).toBe('var(--severity-warning)');
  });
});
