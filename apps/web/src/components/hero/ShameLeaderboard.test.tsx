import { describe, expect, it } from 'vitest';

import { prepareShameData } from './ShameLeaderboard';

import type { FileForensics, GitrelicReport } from '@gitrelic/core';

function makeEntry(overrides: Partial<FileForensics> = {}): FileForensics {
  return {
    file: 'src/a.ts',
    shameScore: 50,
    rawShamePoints: 10,
    shameCommitCount: 3,
    topShameCommits: [],
    dominantKeywords: ['fix', 'hack'],
    ...overrides,
  };
}

function makeReport(leaderboard: FileForensics[]): GitrelicReport {
  return {
    forensics: {
      files: leaderboard,
      shameLeaderboard: leaderboard,
      totalShameCommits: leaderboard.reduce((s, f) => s + f.shameCommitCount, 0),
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('prepareShameData', () => {
  it('returns empty array when leaderboard is empty', () => {
    expect(prepareShameData(makeReport([]))).toEqual([]);
  });

  it('preserves the order of the pre-sorted leaderboard', () => {
    const entries = [
      makeEntry({ file: 'a.ts', shameScore: 90 }),
      makeEntry({ file: 'b.ts', shameScore: 30 }),
      makeEntry({ file: 'c.ts', shameScore: 70 }),
    ];
    const result = prepareShameData(makeReport(entries));
    expect(result.map((r) => r.file)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('derives basename from a nested path', () => {
    const result = prepareShameData(
      makeReport([makeEntry({ file: 'src/nested/dir/component.tsx' })]),
    );
    expect(result[0].name).toBe('component.tsx');
  });

  it('falls back to the full path when the basename would be empty', () => {
    const result = prepareShameData(makeReport([makeEntry({ file: 'readme' })]));
    expect(result[0].name).toBe('readme');
  });

  it('classifies shameScore >= 70 as critical', () => {
    expect(prepareShameData(makeReport([makeEntry({ shameScore: 70 })]))[0].severity).toBe(
      'critical',
    );
    expect(prepareShameData(makeReport([makeEntry({ shameScore: 100 })]))[0].severity).toBe(
      'critical',
    );
  });

  it('classifies 40 <= shameScore < 70 as warning', () => {
    expect(prepareShameData(makeReport([makeEntry({ shameScore: 40 })]))[0].severity).toBe(
      'warning',
    );
    expect(prepareShameData(makeReport([makeEntry({ shameScore: 69 })]))[0].severity).toBe(
      'warning',
    );
  });

  it('classifies shameScore < 40 as low', () => {
    expect(prepareShameData(makeReport([makeEntry({ shameScore: 0 })]))[0].severity).toBe('low');
    expect(prepareShameData(makeReport([makeEntry({ shameScore: 39 })]))[0].severity).toBe('low');
  });

  it('uses the first dominantKeyword as topKeyword, null when the list is empty', () => {
    const withKeywords = prepareShameData(
      makeReport([makeEntry({ dominantKeywords: ['wtf', 'hack'] })]),
    );
    expect(withKeywords[0].topKeyword).toBe('wtf');

    const withoutKeywords = prepareShameData(makeReport([makeEntry({ dominantKeywords: [] })]));
    expect(withoutKeywords[0].topKeyword).toBeNull();
  });

  it('passes through file, score, and shameCommitCount verbatim', () => {
    const entry = makeEntry({
      file: 'src/util.ts',
      shameScore: 42,
      shameCommitCount: 11,
    });
    const [row] = prepareShameData(makeReport([entry]));
    expect(row.file).toBe('src/util.ts');
    expect(row.score).toBe(42);
    expect(row.shameCommitCount).toBe(11);
  });
});
