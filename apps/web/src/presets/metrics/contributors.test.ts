import { describe, expect, it } from 'vitest';

import { contributorsMetrics } from './contributors';
import type {
  Contributor,
  ContributorReport,
  GitrelicReport,
} from '@gitrelic/core';

function makeContributor(overrides: Partial<Contributor> = {}): Contributor {
  return {
    email: 'a@x',
    name: 'A',
    commitCount: 1,
    firstCommit: '2025-01-01T00:00:00Z',
    lastCommit: '2025-01-01T00:00:00Z',
    filesOwned: 0,
    linesChanged: 0,
    activeDays: 1,
    focusAreas: [],
    isActive: true,
    ...overrides,
  };
}

function makeReport(
  contributors: Partial<ContributorReport> = {},
): GitrelicReport {
  return {
    contributors: {
      contributors: contributors.contributors ?? [],
      activeContributors: contributors.activeContributors ?? [],
      ghostContributors: contributors.ghostContributors ?? [],
      topContributor: contributors.topContributor ?? makeContributor(),
      summary: '',
      top3CommitShare: contributors.top3CommitShare ?? 0,
      newcomers90d: contributors.newcomers90d ?? 0,
    },
  } as unknown as GitrelicReport;
}

describe('contributorsMetrics', () => {
  it('returns exactly 4 slots in the canonical order', () => {
    const m = contributorsMetrics(makeReport());
    expect(m).toHaveLength(4);
    expect(m.map((s) => s.label)).toEqual([
      'Active Contributors',
      'Top-3 Share',
      'Ghost Authors',
      'Newcomers (90d)',
    ]);
  });

  describe('slot 1 — Active Contributors', () => {
    it('is critical at 0 active (empty repo)', () => {
      // Default makeReport() has activeContributors: []. Spec table starts at
      // 1=critical and is silent on 0; treating 0 as critical matches intent —
      // an empty repo is more alarming than a single-author one, not less.
      const m = contributorsMetrics(makeReport());
      expect(m[0].value).toBe('0');
      expect(m[0].color).toBe('var(--severity-critical)');
    });

    it('is critical at 1 active', () => {
      const m = contributorsMetrics(
        makeReport({ activeContributors: [makeContributor()] }),
      );
      expect(m[0].value).toBe('1');
      expect(m[0].color).toBe('var(--severity-critical)');
    });

    it('is warning at 2..5 active', () => {
      const five = Array.from({ length: 5 }, (_, i) =>
        makeContributor({ email: `a${i}@x` }),
      );
      const m = contributorsMetrics(makeReport({ activeContributors: five }));
      expect(m[0].value).toBe('5');
      expect(m[0].color).toBe('var(--severity-warning)');
    });

    it('is healthy at 6+ active', () => {
      const six = Array.from({ length: 6 }, (_, i) =>
        makeContributor({ email: `a${i}@x` }),
      );
      const m = contributorsMetrics(makeReport({ activeContributors: six }));
      expect(m[0].color).toBe('var(--severity-healthy)');
    });
  });

  describe('slot 2 — Top-3 Share', () => {
    it('renders the percent with no decimal', () => {
      const m = contributorsMetrics(makeReport({ top3CommitShare: 65.7 }));
      expect(m[1].value).toBe('66%');
    });

    it('is healthy below 40%', () => {
      const m = contributorsMetrics(makeReport({ top3CommitShare: 39.9 }));
      expect(m[1].color).toBe('var(--severity-healthy)');
    });

    it('is warning between 40% and 69%', () => {
      const m = contributorsMetrics(makeReport({ top3CommitShare: 60 }));
      expect(m[1].color).toBe('var(--severity-warning)');
    });

    it('is critical at 70%+', () => {
      const m = contributorsMetrics(makeReport({ top3CommitShare: 70 }));
      expect(m[1].color).toBe('var(--severity-critical)');
    });
  });

  describe('slot 3 — Ghost Authors', () => {
    it('is healthy at 0 ghosts', () => {
      const m = contributorsMetrics(makeReport());
      expect(m[2].value).toBe('0');
      expect(m[2].color).toBe('var(--severity-healthy)');
    });

    it('is warning when ghost ratio < 30%', () => {
      // 2 ghosts out of 10 contributors = 20% ratio
      const all = Array.from({ length: 10 }, (_, i) =>
        makeContributor({ email: `a${i}@x` }),
      );
      const ghosts = all.slice(0, 2);
      const m = contributorsMetrics(
        makeReport({ contributors: all, ghostContributors: ghosts }),
      );
      expect(m[2].value).toBe('2');
      expect(m[2].color).toBe('var(--severity-warning)');
    });

    it('is critical when ghost ratio >= 30%', () => {
      // 3 ghosts out of 10 = 30% ratio
      const all = Array.from({ length: 10 }, (_, i) =>
        makeContributor({ email: `a${i}@x` }),
      );
      const ghosts = all.slice(0, 3);
      const m = contributorsMetrics(
        makeReport({ contributors: all, ghostContributors: ghosts }),
      );
      expect(m[2].color).toBe('var(--severity-critical)');
    });
  });

  describe('slot 4 — Newcomers (90d)', () => {
    it('is stale (neutral) at 0 newcomers', () => {
      const m = contributorsMetrics(makeReport());
      expect(m[3].value).toBe('0');
      expect(m[3].color).toBe('var(--text-tertiary)');
    });

    it('is healthy with 1+ newcomers', () => {
      const m = contributorsMetrics(makeReport({ newcomers90d: 3 }));
      expect(m[3].value).toBe('3');
      expect(m[3].color).toBe('var(--severity-healthy)');
    });
  });

  it('does not render the deprecated "Total Commits" label', () => {
    const m = contributorsMetrics(makeReport());
    expect(m.find((s) => s.label === 'Total Commits')).toBeUndefined();
  });
});
