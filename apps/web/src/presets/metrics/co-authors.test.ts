import { describe, it, expect } from 'vitest';

import { coAuthorsMetrics } from './co-authors';
import type { GitrelicReport } from '@gitrelic/core';

function makeReport(
  overrides: Partial<GitrelicReport['coAuthors']> = {},
): GitrelicReport {
  return {
    coAuthors: {
      pairs: [],
      authorStats: [],
      totalCoAuthoredCommits: 0,
      summary: '',
      aiAssistedCommits: 0,
      humanAuthoredCommits: 0,
      aiAdoptionPercent: 0,
      aiAdoptionTier: 'none',
      aiAuthors: [],
      humanPairs: [],
      filteredBotCommits: 0,
      byMonth: [],
      perAuthorMix: [],
      ...overrides,
    },
  } as unknown as GitrelicReport;
}

describe('coAuthorsMetrics', () => {
  it('produces exactly 5 slots in the documented order', () => {
    const metrics = coAuthorsMetrics(makeReport());
    expect(metrics).toHaveLength(5);
    expect(metrics.map((m) => m.label)).toEqual([
      'AI Adoption',
      'AI Commits',
      'AI Authors',
      'Human Pairs',
      'Co-Author Commits',
    ]);
  });

  it('shows percentage suffix on slot 1', () => {
    const metrics = coAuthorsMetrics(makeReport({ aiAdoptionPercent: 47 }));
    expect(metrics[0].value).toBe('47%');
  });

  it('renders all-stale on empty report', () => {
    const metrics = coAuthorsMetrics(makeReport());
    for (const m of metrics) {
      expect(m.color).toContain('text-tertiary');
    }
  });

  it('renders coupling color for non-zero values', () => {
    const metrics = coAuthorsMetrics(
      makeReport({
        aiAdoptionPercent: 30,
        aiAssistedCommits: 50,
        aiAuthors: [
          {
            author: 'a@b.com',
            displayName: 'A',
            aiCommits: 50,
            totalCommits: 100,
            personalRatio: 50,
          },
        ],
        humanPairs: [
          {
            authorA: 'a@b.com',
            authorB: 'b@c.com',
            coAuthoredCommits: 5,
            files: [],
            classification: 'human-pair',
          },
        ],
        totalCoAuthoredCommits: 50,
      }),
    );
    for (const m of metrics) {
      expect(m.color).toContain('coupling');
    }
  });
});
