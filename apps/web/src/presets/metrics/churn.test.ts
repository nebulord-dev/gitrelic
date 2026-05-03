import { describe, expect, it } from 'vitest';

import { churnMetrics } from './churn';

import type { FileChurn, GitrelicReport, RawCommit } from '@gitrelic/core';

function makeFile(overrides: Partial<FileChurn> = {}): FileChurn {
  return {
    file: 'a.ts',
    commitCount: 10,
    churnScore: 50,
    category: 'warm',
    ...overrides,
  };
}

function makeReport(files: FileChurn[], totalCommits: number): GitrelicReport {
  const commits = Array.from({ length: totalCommits }, (_, i) => ({
    hash: String(i),
  })) as unknown as RawCommit[];
  return {
    churn: { files, topFiles: [], hotspotCount: 0, summary: '' },
    commits,
  } as unknown as GitrelicReport;
}

describe('churnMetrics', () => {
  it('returns healthy/em-dash values when there is no churn', () => {
    const metrics = churnMetrics(makeReport([], 0));
    expect(metrics).toHaveLength(4);
    expect(metrics[0]).toMatchObject({ label: 'Hot Files', value: '0' });
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1]).toMatchObject({ label: 'Top File Commits', value: '—' });
    expect(metrics[1].color).toBe('var(--severity-healthy)');
    expect(metrics[2]).toMatchObject({ label: 'Top File Share', value: '—' });
    expect(metrics[3]).toMatchObject({ label: 'Tracked Files', value: '0' });
  });

  it('counts hot files (churnScore > 75) and colors critical', () => {
    const metrics = churnMetrics(
      makeReport(
        [
          makeFile({
            file: 'a.ts',
            commitCount: 80,
            churnScore: 90,
            category: 'hot',
          }),
          makeFile({
            file: 'b.ts',
            commitCount: 75,
            churnScore: 85,
            category: 'hot',
          }),
          makeFile({
            file: 'c.ts',
            commitCount: 30,
            churnScore: 50,
            category: 'warm',
          }),
        ],
        100,
      ),
    );
    expect(metrics[0].value).toBe('2');
    expect(metrics[0].color).toBe('var(--severity-critical)');
  });

  it('reports top churn as the max commitCount, formatted with thousands separators', () => {
    const metrics = churnMetrics(
      makeReport(
        [
          makeFile({
            file: 'a.ts',
            commitCount: 1847,
            churnScore: 90,
            category: 'hot',
          }),
          makeFile({
            file: 'b.ts',
            commitCount: 12,
            churnScore: 30,
            category: 'cold',
          }),
        ],
        2000,
      ),
    );
    expect(metrics[1].value).toBe('1,847');
  });

  it('reports top file % rounded to one decimal', () => {
    const metrics = churnMetrics(
      makeReport(
        [
          makeFile({
            file: 'a.ts',
            commitCount: 80,
            churnScore: 90,
            category: 'hot',
          }),
        ],
        2400,
      ),
    );
    // 80 / 2400 = 0.0333 → 3.3%
    expect(metrics[2].value).toBe('3.3%');
  });

  it('reports tracked files count formatted with thousands separators', () => {
    const files: FileChurn[] = Array.from({ length: 1234 }, (_, i) =>
      makeFile({ file: `f${i}.ts` }),
    );
    const metrics = churnMetrics(makeReport(files, 5000));
    expect(metrics[3].value).toBe('1,234');
  });

  it('colors Top File Commits warning when there is churn but no hot files', () => {
    const metrics = churnMetrics(
      makeReport(
        [
          makeFile({
            file: 'a.ts',
            commitCount: 30,
            churnScore: 50,
            category: 'warm',
          }),
        ],
        100,
      ),
    );
    expect(metrics[1].color).toBe('var(--severity-warning)');
  });
});
