import { describe, expect, it } from 'vitest';

import { blastRadiusMetrics } from './blast-radius';

import type { BlastRadiusReport, FileBlastRadius, GitrelicReport } from '@gitrelic/core';

function makeFile(overrides: Partial<FileBlastRadius> = {}): FileBlastRadius {
  return {
    file: 'a.ts',
    blastScore: 50,
    avgCoChangedFiles: 5,
    maxCoChangedFiles: 10,
    totalCommits: 20,
    ...overrides,
  };
}

function makeReport(blastRadius: Partial<BlastRadiusReport>): GitrelicReport {
  return {
    blastRadius: {
      files: blastRadius.files ?? [],
      topBlasters: blastRadius.topBlasters ?? [],
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('blastRadiusMetrics', () => {
  it('returns healthy/em-dash values when no files exist', () => {
    const metrics = blastRadiusMetrics(makeReport({}));
    expect(metrics).toHaveLength(4);
    expect(metrics[0].value).toBe('—');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1].value).toBe('—');
    expect(metrics[2].value).toBe('—');
    expect(metrics[3].value).toBe('0');
  });

  it('computes aggregates from files list and top blaster', () => {
    const files = [
      makeFile({ file: 'a.ts', avgCoChangedFiles: 8, maxCoChangedFiles: 25 }),
      makeFile({ file: 'b.ts', avgCoChangedFiles: 4, maxCoChangedFiles: 10 }),
    ];
    const topBlasters = [makeFile({ file: 'a.ts', blastScore: 82 })];
    const metrics = blastRadiusMetrics(makeReport({ files, topBlasters }));
    expect(metrics[0].value).toBe('82');
    expect(metrics[0].color).toBe('var(--severity-critical)');
    expect(metrics[1].value).toBe('25');
    expect(metrics[1].color).toBe('var(--severity-warning)');
    expect(metrics[2].value).toBe('6');
    expect(metrics[3].value).toBe('2');
  });

  it('returns em-dash for Top Blast Score when files exist but topBlasters is empty', () => {
    const metrics = blastRadiusMetrics(makeReport({ files: [makeFile()], topBlasters: [] }));
    expect(metrics[0].value).toBe('—');
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[3].value).toBe('1');
  });

  it('rounds fractional top blast scores', () => {
    const files = [makeFile()];
    const topBlasters = [makeFile({ blastScore: 65.7 })];
    const metrics = blastRadiusMetrics(makeReport({ files, topBlasters }));
    expect(metrics[0].value).toBe('66');
    expect(metrics[0].color).toBe('var(--severity-warning)');
  });
});
