import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ChurnBar, prepareChurnBarData } from './ChurnBar';

import type { GitrelicReport } from '@gitrelic/core';

interface ChurnFixture {
  file: string;
  commitCount: number;
  churnScore: number;
  category: 'hot' | 'warm' | 'cold' | 'frozen';
}

function makeReport(churnFiles: ChurnFixture[]): GitrelicReport {
  return {
    churn: { files: churnFiles, topFiles: [], hotspotCount: 0, summary: '' },
    busFactors: { files: [], criticalFiles: [], overallBusFactor: 0, summary: '' },
  } as unknown as GitrelicReport;
}

describe('prepareChurnBarData', () => {
  it('sorts rows by commitCount desc', () => {
    const rows = prepareChurnBarData(
      makeReport([
        { file: 'a', commitCount: 10, churnScore: 50, category: 'warm' },
        { file: 'b', commitCount: 80, churnScore: 95, category: 'hot' },
        { file: 'c', commitCount: 30, churnScore: 60, category: 'warm' },
      ]),
    );
    expect(rows.map((r) => r.file)).toEqual(['b', 'c', 'a']);
  });

  it('breaks commit-count ties by file path asc for determinism', () => {
    const rows = prepareChurnBarData(
      makeReport([
        { file: 'src/zeta.ts', commitCount: 50, churnScore: 70, category: 'warm' },
        { file: 'src/alpha.ts', commitCount: 50, churnScore: 70, category: 'warm' },
        { file: 'src/mid.ts', commitCount: 50, churnScore: 70, category: 'warm' },
      ]),
    );
    expect(rows.map((r) => r.file)).toEqual(['src/alpha.ts', 'src/mid.ts', 'src/zeta.ts']);
  });

  it('caps at 100 rows by default', () => {
    const many: ChurnFixture[] = Array.from({ length: 150 }, (_, i) => ({
      file: `f${i}.ts`,
      commitCount: 200 - i,
      churnScore: 80,
      category: 'hot',
    }));
    const rows = prepareChurnBarData(makeReport(many));
    expect(rows).toHaveLength(100);
    expect(rows[0].file).toBe('f0.ts');
    expect(rows[99].file).toBe('f99.ts');
  });

  it('honors a custom topN', () => {
    const many: ChurnFixture[] = Array.from({ length: 20 }, (_, i) => ({
      file: `f${i}.ts`,
      commitCount: 20 - i,
      churnScore: 50,
      category: 'warm',
    }));
    expect(prepareChurnBarData(makeReport(many), 5)).toHaveLength(5);
  });

  it('returns [] when churn.files is empty', () => {
    expect(prepareChurnBarData(makeReport([]))).toEqual([]);
  });

  it('exposes basename, full path, commit count, and category on each row', () => {
    const rows = prepareChurnBarData(
      makeReport([
        { file: 'packages/core/src/runner.ts', commitCount: 99, churnScore: 90, category: 'hot' },
      ]),
    );
    expect(rows[0]).toEqual({
      file: 'packages/core/src/runner.ts',
      name: 'runner.ts',
      commitCount: 99,
      category: 'hot',
    });
  });

  it('does not mutate the input churn.files array', () => {
    const churnFiles: ChurnFixture[] = [
      { file: 'a', commitCount: 10, churnScore: 50, category: 'warm' },
      { file: 'b', commitCount: 80, churnScore: 95, category: 'hot' },
    ];
    const beforeOrder = churnFiles.map((f) => f.file);
    prepareChurnBarData(makeReport(churnFiles));
    expect(churnFiles.map((f) => f.file)).toEqual(beforeOrder);
  });
});

describe('ChurnBar', () => {
  it('renders the empty state when there are no churned files', () => {
    render(<ChurnBar report={makeReport([])} selectedFile={null} onSelectFile={() => {}} />);
    expect(screen.getByText('No file churn detected.')).toBeTruthy();
  });
});
