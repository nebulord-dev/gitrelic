import { describe, expect, it } from 'vitest';

import { shameMetrics } from './shame';

import type { FileForensics, GitrelicReport } from '@gitrelic/core';

function makeEntry(overrides: Partial<FileForensics> = {}): FileForensics {
  return {
    file: 'a.ts',
    shameScore: 50,
    rawShamePoints: 10,
    shameCommitCount: 3,
    topShameCommits: [],
    dominantKeywords: [],
    ...overrides,
  };
}

function makeReport(
  files: FileForensics[],
  totalShameCommits?: number,
): GitrelicReport {
  return {
    forensics: {
      files,
      shameLeaderboard: files.slice(0, 10),
      totalShameCommits:
        totalShameCommits ?? files.reduce((s, f) => s + f.shameCommitCount, 0),
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('shameMetrics', () => {
  it('returns healthy/em-dash values when the report has no shame', () => {
    const metrics = shameMetrics(makeReport([]));
    expect(metrics).toHaveLength(5);
    expect(metrics[0]).toMatchObject({ label: 'Shameful Files', value: '0' });
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1]).toMatchObject({ label: 'Top Score', value: '—' });
    expect(metrics[1].color).toBe('var(--severity-healthy)');
    expect(metrics[2]).toMatchObject({ label: 'Critical (≥70)', value: '0' });
    expect(metrics[2].color).toBe('var(--severity-healthy)');
    expect(metrics[3]).toMatchObject({ label: 'Shame Commits', value: '0' });
    expect(metrics[4]).toMatchObject({ label: 'Avg Score', value: '—' });
  });

  it('returns correct aggregates for a non-empty list', () => {
    const files = [
      makeEntry({ file: 'a.ts', shameScore: 85, shameCommitCount: 10 }),
      makeEntry({ file: 'b.ts', shameScore: 70, shameCommitCount: 5 }),
      makeEntry({ file: 'c.ts', shameScore: 20, shameCommitCount: 2 }),
    ];
    const metrics = shameMetrics(makeReport(files));
    expect(metrics[0].value).toBe('3');
    expect(metrics[1].value).toBe('85');
    expect(metrics[2].value).toBe('2');
    expect(metrics[3].value).toBe('17');
    expect(metrics[4].value).toBe('58');
  });

  it('uses totalShameCommits from the report, not a derived sum', () => {
    const metrics = shameMetrics(
      makeReport([makeEntry({ shameCommitCount: 1 })], 999),
    );
    expect(metrics[3].value).toBe('999');
  });

  it('colors Top Score as critical at or above the 70 threshold', () => {
    const metrics = shameMetrics(makeReport([makeEntry({ shameScore: 70 })]));
    expect(metrics[1].color).toBe('var(--severity-critical)');
  });

  it('colors Top Score as warning below the 70 threshold', () => {
    const metrics = shameMetrics(makeReport([makeEntry({ shameScore: 60 })]));
    expect(metrics[1].color).toBe('var(--severity-warning)');
  });

  it('counts Critical strictly at score >= 70', () => {
    const files = [
      makeEntry({ file: 'a.ts', shameScore: 70 }),
      makeEntry({ file: 'b.ts', shameScore: 69 }),
      makeEntry({ file: 'c.ts', shameScore: 100 }),
    ];
    const metrics = shameMetrics(makeReport(files));
    expect(metrics[2].value).toBe('2');
  });

  it('guarded max handles single file without spread', () => {
    const metrics = shameMetrics(makeReport([makeEntry({ shameScore: 42 })]));
    expect(metrics[1].value).toBe('42');
  });

  it('formats Shame Commits with thousands separator via fmt()', () => {
    const metrics = shameMetrics(makeReport([], 1234));
    expect(metrics[3].value).toBe('1,234');
  });

  it('rounds Avg Score to an integer', () => {
    const files = [
      makeEntry({ shameScore: 10 }),
      makeEntry({ shameScore: 20 }),
      makeEntry({ shameScore: 30 }),
    ];
    const metrics = shameMetrics(makeReport(files));
    expect(metrics[4].value).toBe('20');
  });
});
