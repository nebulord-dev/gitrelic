import { describe, expect, it } from 'vitest';

import { ghostFilesMetrics } from './ghost-files';

import type { GhostFile, GitrelicReport } from '@gitrelic/core';

function makeFile(overrides: Partial<GhostFile> = {}): GhostFile {
  return {
    file: 'a.ts',
    dominantAuthor: 'dev@example.com',
    dominantAuthorPercent: 90,
    lastAuthorCommitDate: '2024-01-01',
    authorInactiveDays: 200,
    loc: 100,
    ...overrides,
  };
}

function makeReport(files: GhostFile[]): GitrelicReport {
  return {
    ghostFiles: { files, totalGhostFiles: files.length },
  } as unknown as GitrelicReport;
}

describe('ghostFilesMetrics', () => {
  it('returns healthy/em-dash values when list is empty', () => {
    const metrics = ghostFilesMetrics(makeReport([]));
    expect(metrics).toHaveLength(5);
    expect(metrics[0]).toMatchObject({ label: 'Ghost Files', value: '0' });
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1]).toMatchObject({
      label: 'True Ghosts (>365d)',
      value: '0',
    });
    expect(metrics[1].color).toBe('var(--severity-healthy)');
    expect(metrics[2]).toMatchObject({
      label: 'Fading (180–365d)',
      value: '0',
    });
    expect(metrics[2].color).toBe('var(--severity-healthy)');
    expect(metrics[3]).toMatchObject({ label: 'Ghost LOC', value: '0' });
    expect(metrics[3].color).toBe('var(--severity-healthy)');
    expect(metrics[4]).toMatchObject({
      label: 'Max Inactive Days',
      value: '—',
    });
    expect(metrics[4].color).toBe('var(--severity-healthy)');
  });

  it('returns correct aggregates for a non-empty list', () => {
    const files = [
      makeFile({ file: 'a.ts', authorInactiveDays: 400, loc: 500 }),
      makeFile({ file: 'b.ts', authorInactiveDays: 250, loc: 200 }),
      makeFile({ file: 'c.ts', authorInactiveDays: 190, loc: 100 }),
    ];
    const metrics = ghostFilesMetrics(makeReport(files));
    expect(metrics[0].value).toBe('3');
    expect(metrics[0].color).toBe('var(--severity-critical)');
    expect(metrics[1].value).toBe('1');
    expect(metrics[1].color).toBe('var(--severity-critical)');
    expect(metrics[2].value).toBe('2');
    expect(metrics[2].color).toBe('var(--severity-warning)');
    expect(metrics[3].value).toBe('800');
    expect(metrics[3].color).toBe('var(--severity-warning)');
    expect(metrics[4].value).toBe('400');
    expect(metrics[4].color).toBe('var(--severity-critical)');
  });

  it('counts 365 as Fading (inclusive upper bound), not True Ghost', () => {
    const metrics = ghostFilesMetrics(
      makeReport([makeFile({ authorInactiveDays: 365 })]),
    );
    expect(metrics[1].value).toBe('0');
    expect(metrics[2].value).toBe('1');
  });

  it('counts 366 as True Ghost (>365 strict)', () => {
    const metrics = ghostFilesMetrics(
      makeReport([makeFile({ authorInactiveDays: 366 })]),
    );
    expect(metrics[1].value).toBe('1');
    expect(metrics[2].value).toBe('0');
  });

  it('counts 180 as Fading (inclusive lower bound)', () => {
    const metrics = ghostFilesMetrics(
      makeReport([makeFile({ authorInactiveDays: 180 })]),
    );
    expect(metrics[2].value).toBe('1');
  });

  it('excludes files with inactiveDays < 180 from Fading range', () => {
    const metrics = ghostFilesMetrics(
      makeReport([makeFile({ authorInactiveDays: 179 })]),
    );
    expect(metrics[1].value).toBe('0');
    expect(metrics[2].value).toBe('0');
  });

  it('formats Ghost LOC with thousands separator via fmt()', () => {
    const files = [
      makeFile({ file: 'a.ts', loc: 1500 }),
      makeFile({ file: 'b.ts', loc: 2500 }),
    ];
    const metrics = ghostFilesMetrics(makeReport(files));
    expect(metrics[3].value).toBe('4,000');
  });

  it('guarded max handles single file without spread', () => {
    const metrics = ghostFilesMetrics(
      makeReport([makeFile({ authorInactiveDays: 500 })]),
    );
    expect(metrics[4].value).toBe('500');
  });
});
