import { describe, expect, it } from 'vitest';

import { prepareRiskRows, truncateLabel } from './RiskHeatmap';

import type { GitrelicReport } from '@gitrelic/core';

interface FixtureFile {
  file: string;
  churn?: number;
  commits?: number;
  blast?: number;
  shame?: number;
  ghost?: boolean;
}

const DEFAULT_COMMITS = 10;

function makeReport(files: FixtureFile[]): GitrelicReport {
  return {
    busFactors: {
      files: files.map((f) => ({
        file: f.file,
        uniqueAuthors: 1,
        authors: [],
        dominantAuthor: 'x',
        dominantAuthorPercent: 100,
        risk: 'critical',
      })),
      criticalFiles: [],
      overallBusFactor: 1,
      summary: '',
    },
    churn: {
      files: files
        .filter((f) => f.churn != null || f.commits != null)
        .map((f) => ({
          file: f.file,
          commitCount: f.commits ?? DEFAULT_COMMITS,
          churnScore: f.churn ?? 0,
          uniqueAuthors: 1,
        })),
      topFiles: [],
      summary: '',
    },
    blastRadius: {
      files: files
        .filter((f) => f.blast != null)
        .map((f) => ({
          file: f.file,
          blastScore: f.blast ?? 0,
          maxCoChanged: 0,
          avgCoChanged: 0,
          commitCount: 1,
        })),
      topBlasters: [],
      summary: '',
    },
    forensics: {
      files: files
        .filter((f) => f.shame != null)
        .map((f) => ({
          file: f.file,
          shameScore: f.shame ?? 0,
          rawShamePoints: 0,
          shameCommitCount: 0,
          topShameCommits: [],
          dominantKeywords: [],
        })),
      shameLeaderboard: [],
      summary: '',
    },
    ghostFiles: {
      files: files
        .filter((f) => f.ghost)
        .map((f) => ({
          file: f.file,
          lastAuthor: 'x',
          lastCommitDate: '',
          ageInDays: 0,
        })),
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('prepareRiskRows', () => {
  it('drops files below the composite threshold', () => {
    const rows = prepareRiskRows(
      makeReport([
        { file: 'low', churn: 10, blast: 0, shame: 0 },
        { file: 'high', churn: 80, blast: 60, shame: 60, ghost: true },
      ]),
    );
    expect(rows.map((r) => r.file)).toEqual(['high']);
  });

  it('sorts by composite desc', () => {
    const rows = prepareRiskRows(
      makeReport([
        { file: 'small', churn: 50, blast: 50, shame: 0 }, // 27.5 → filtered
        { file: 'medium', churn: 80, blast: 50, shame: 0 }, // 36.5
        { file: 'large', churn: 100, blast: 100, shame: 100, ghost: true }, // 100
      ]),
    );
    expect(rows.map((r) => r.file)).toEqual(['large', 'medium']);
  });

  it('caps at 30 rows', () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      file: `f${i}`,
      churn: 100,
      blast: 100,
      shame: 100,
      ghost: true,
    }));
    const rows = prepareRiskRows(makeReport(many));
    expect(rows).toHaveLength(30);
  });

  it('treats missing analyzer entries as zero', () => {
    const rows = prepareRiskRows(makeReport([{ file: 'sparse', churn: 100 }]));
    expect(rows).toHaveLength(1);
    expect(rows[0].blast).toBe(0);
    expect(rows[0].shame).toBe(0);
    expect(rows[0].ghost).toBe(0);
    expect(rows[0].churn).toBe(100);
  });

  it('marks ghost-listed files at 100', () => {
    const rows = prepareRiskRows(
      makeReport([{ file: 'orphan', churn: 60, blast: 60, shame: 60, ghost: true }]),
    );
    expect(rows[0].ghost).toBe(100);
  });

  it('filters out files with fewer than 3 commits', () => {
    const rows = prepareRiskRows(
      makeReport([
        // Single-commit file with shame=100 would otherwise dominate the heatmap.
        { file: 'one-shot', churn: 80, blast: 80, shame: 100, ghost: true, commits: 1 },
        { file: 'two-shot', churn: 80, blast: 80, shame: 100, ghost: true, commits: 2 },
        { file: 'real', churn: 80, blast: 80, shame: 100, ghost: true, commits: 3 },
      ]),
    );
    expect(rows.map((r) => r.file)).toEqual(['real']);
  });
});

describe('truncateLabel', () => {
  it('returns basename when there is no parent dir', () => {
    expect(truncateLabel('README.md')).toBe('README.md');
  });

  it('prefixes parent dir for nested files', () => {
    expect(truncateLabel('fixtures/flight-ssr-bench/server.node.js', 40)).toBe(
      'flight-ssr-bench/server.node.js',
    );
  });

  it('disambiguates same-named files in different parent dirs', () => {
    expect(truncateLabel('a/server.node.js')).toBe('a/server.node.js');
    expect(truncateLabel('b/server.node.js')).toBe('b/server.node.js');
  });

  it('ellipsis-trims the parent side when label exceeds the budget', () => {
    const out = truncateLabel('very-long-parent-directory-name/short.ts', 20);
    expect(out.endsWith('/short.ts')).toBe(true);
    expect(out.startsWith('\u2026')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(20);
  });

  it('truncates the basename itself when it alone exceeds the budget', () => {
    const out = truncateLabel('a/this-basename-is-way-too-long.ts', 18);
    expect(out.endsWith('\u2026')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(18);
  });
});
