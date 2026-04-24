import { describe, expect, it } from 'vitest';

import { renamesMetrics } from './renames';

import type { FileRenameChain, GitrelicReport } from '@gitrelic/core';

function makeChain(
  currentPath: string,
  renameCount: number,
  previousNames: string[] = [],
): FileRenameChain {
  return { currentPath, previousNames, renameCount };
}

function makeReport(
  chains: FileRenameChain[],
  opts?: { totalRenames?: number; filesWithRenames?: number },
): GitrelicReport {
  return {
    renameTracking: {
      renames: [],
      chains,
      totalRenames: opts?.totalRenames ?? chains.reduce((s, c) => s + c.renameCount, 0),
      filesWithRenames: opts?.filesWithRenames ?? chains.length,
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('renamesMetrics', () => {
  it('returns healthy/em-dash values when the report has no renames', () => {
    const metrics = renamesMetrics(makeReport([]));
    expect(metrics).toHaveLength(5);
    expect(metrics[0]).toMatchObject({ label: 'Files Renamed', value: '0' });
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1]).toMatchObject({ label: 'Total Renames', value: '0' });
    expect(metrics[2]).toMatchObject({ label: 'Longest Chain', value: '—' });
    expect(metrics[3]).toMatchObject({ label: 'Avg Renames/File', value: '—' });
    expect(metrics[4]).toMatchObject({ label: 'Most Renamed', value: '—' });
  });

  it('returns correct aggregates for a non-empty list', () => {
    const chains = [
      makeChain('src/new.ts', 3),
      makeChain('lib/other.ts', 1),
      makeChain('tmp.ts', 2),
    ];
    const metrics = renamesMetrics(makeReport(chains));
    expect(metrics[0].value).toBe('3');
    expect(metrics[1].value).toBe('6');
    expect(metrics[2].value).toBe('3');
    expect(metrics[3].value).toBe('2');
    expect(metrics[4].value).toBe('new.ts');
  });

  it('uses totalRenames and filesWithRenames from the report directly', () => {
    const chains = [makeChain('a.ts', 1)];
    const metrics = renamesMetrics(makeReport(chains, { totalRenames: 42, filesWithRenames: 7 }));
    expect(metrics[0].value).toBe('7');
    expect(metrics[1].value).toBe('42');
    expect(metrics[3].value).toBe('6');
  });

  it('Avg Renames/File is em-dash when filesWithRenames is 0', () => {
    const metrics = renamesMetrics(makeReport([], { totalRenames: 0, filesWithRenames: 0 }));
    expect(metrics[3].value).toBe('—');
  });

  it('guarded max handles single chain without spread', () => {
    const chains = [makeChain('a.ts', 5)];
    const metrics = renamesMetrics(makeReport(chains));
    expect(metrics[2].value).toBe('5');
  });

  it('picks the chain with the highest renameCount for Most Renamed', () => {
    const chains = [
      makeChain('low.ts', 1),
      makeChain('a/b/winner.ts', 7),
      makeChain('middle.ts', 3),
    ];
    const metrics = renamesMetrics(makeReport(chains));
    expect(metrics[4].value).toBe('winner.ts');
  });

  it('formats Total Renames with thousands separator via fmt()', () => {
    const chains = [makeChain('a.ts', 1234)];
    const metrics = renamesMetrics(makeReport(chains));
    expect(metrics[1].value).toBe('1,234');
  });

  it('rounds Avg Renames/File to an integer', () => {
    const chains = [makeChain('a.ts', 1), makeChain('b.ts', 2), makeChain('c.ts', 2)];
    const metrics = renamesMetrics(makeReport(chains));
    expect(metrics[3].value).toBe('2');
  });

  it('falls back to the full path when currentPath has no separator', () => {
    const chains = [makeChain('readme', 3)];
    const metrics = renamesMetrics(makeReport(chains));
    expect(metrics[4].value).toBe('readme');
  });
});
