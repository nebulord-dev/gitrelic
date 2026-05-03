import { describe, expect, it } from 'vitest';

import { coAuthorsMetrics } from './co-authors';

import type { CoAuthorPair, GitrelicReport } from '@gitrelic/core';

function makePair(overrides: Partial<CoAuthorPair> = {}): CoAuthorPair {
  return {
    authorA: 'Alice <a@e.com>',
    authorB: 'Bob <b@e.com>',
    coAuthoredCommits: 5,
    files: [],
    ...overrides,
  };
}

function makeReport(
  pairs: CoAuthorPair[],
  totalCoAuthoredCommits?: number,
): GitrelicReport {
  return {
    coAuthors: {
      pairs,
      authorStats: [],
      totalCoAuthoredCommits:
        totalCoAuthoredCommits ??
        pairs.reduce((s, p) => s + p.coAuthoredCommits, 0),
      summary: '',
    },
  } as unknown as GitrelicReport;
}

describe('coAuthorsMetrics', () => {
  it('returns healthy/em-dash values when pairs list is empty', () => {
    const metrics = coAuthorsMetrics(makeReport([]));
    expect(metrics).toHaveLength(5);
    expect(metrics[0]).toMatchObject({ label: 'Pairs', value: '0' });
    expect(metrics[0].color).toBe('var(--severity-healthy)');
    expect(metrics[1]).toMatchObject({ label: 'Co-commits', value: '0' });
    expect(metrics[2]).toMatchObject({ label: 'Collaborators', value: '0' });
    expect(metrics[3]).toMatchObject({ label: 'Avg Commits/Pair', value: '—' });
    expect(metrics[4]).toMatchObject({ label: 'Top Pair Commits', value: '—' });
  });

  it('returns correct aggregates for a non-empty list', () => {
    const pairs = [
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Bob <b@e.com>',
        coAuthoredCommits: 10,
      }),
      makePair({
        authorA: 'Alice <a@e.com>',
        authorB: 'Cara <c@e.com>',
        coAuthoredCommits: 4,
      }),
      makePair({
        authorA: 'Bob <b@e.com>',
        authorB: 'Cara <c@e.com>',
        coAuthoredCommits: 2,
      }),
    ];
    const metrics = coAuthorsMetrics(makeReport(pairs));
    expect(metrics[0].value).toBe('3');
    expect(metrics[1].value).toBe('16');
    expect(metrics[2].value).toBe('3');
    expect(metrics[3].value).toBe('5');
    expect(metrics[4].value).toBe('10');
  });

  it('uses totalCoAuthoredCommits from the report, not a pair sum', () => {
    const pairs = [makePair({ coAuthoredCommits: 5 })];
    const metrics = coAuthorsMetrics(makeReport(pairs, 123));
    expect(metrics[1].value).toBe('123');
  });

  it('rounds Avg Commits/Pair to an integer', () => {
    const pairs = [
      makePair({
        authorA: 'a@e.com',
        authorB: 'b@e.com',
        coAuthoredCommits: 3,
      }),
      makePair({
        authorA: 'a@e.com',
        authorB: 'c@e.com',
        coAuthoredCommits: 4,
      }),
    ];
    const metrics = coAuthorsMetrics(makeReport(pairs));
    expect(metrics[3].value).toBe('4');
  });

  it('guarded max handles single pair without spread', () => {
    const pairs = [makePair({ coAuthoredCommits: 99 })];
    const metrics = coAuthorsMetrics(makeReport(pairs));
    expect(metrics[4].value).toBe('99');
  });

  it('deduplicates authors across pairs when counting collaborators', () => {
    const pairs = [
      makePair({ authorA: 'a@e.com', authorB: 'b@e.com' }),
      makePair({ authorA: 'a@e.com', authorB: 'b@e.com' }),
    ];
    const metrics = coAuthorsMetrics(makeReport(pairs));
    expect(metrics[2].value).toBe('2');
  });

  it('colors Pairs as accent when non-zero (collaboration is a positive signal)', () => {
    const metrics = coAuthorsMetrics(makeReport([makePair()]));
    expect(metrics[0].color).toBe('var(--accent-primary)');
  });

  it('formats Co-commits with thousands separator via fmt()', () => {
    const metrics = coAuthorsMetrics(
      makeReport([makePair({ coAuthoredCommits: 1234 })]),
    );
    expect(metrics[1].value).toBe('1,234');
  });
});
