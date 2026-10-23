import { describe, expect, it } from 'vitest';

import { activeWeeks, fitBars, recentShare, spanLabels } from './activity';

const MON = Date.UTC(2026, 2, 2);

describe('activity words', () => {
  it('names the first and last month of the series', () => {
    const [from, to] = spanLabels({
      start: MON,
      totals: new Array(10).fill(1),
      hits: [],
    });
    expect(from).toContain('2026');
    expect(from).not.toBe(to);
    expect(spanLabels({ start: 0, totals: [], hits: [] })).toEqual(['', '']);
  });

  it('splits matching commits into the older and recent half', () => {
    const a = { start: MON, totals: [5, 5, 5, 5], hits: [1, 0, 2, 3] };
    expect(recentShare(a)).toBe('5 of 6 commits in the recent half');
    expect(activeWeeks(a)).toBe(3);
    expect(recentShare({ ...a, hits: [0, 0, 0, 1] })).toBe(
      '1 of 1 commit in the recent half',
    );
    expect(recentShare({ ...a, hits: [0, 0, 0, 0] })).toBeNull();
  });

  it('merges weeks into at most maxBars bars, keeping the sums', () => {
    const totals = Array.from({ length: 600 }, (_, i) => i % 3);
    const hits = totals.map((n) => (n > 1 ? 1 : 0));
    const fit = fitBars({ start: MON, totals, hits }, 120);
    expect(fit.totals.length).toBeLessThanOrEqual(120);
    expect(fit.weeksPerBar).toBe(5);
    const sum = (xs: number[]) => xs.reduce((s, n) => s + n, 0);
    expect(sum(fit.totals)).toBe(sum(totals));
    expect(sum(fit.hits)).toBe(sum(hits));
    const short = { start: MON, totals: [1, 2], hits: [0, 1] };
    expect(fitBars(short, 120)).toEqual({
      totals: [1, 2],
      hits: [0, 1],
      split: null,
      weeksPerBar: 1,
    });
  });

  it('merges a lens’s split the same way', () => {
    const totals = Array.from({ length: 600 }, () => 2);
    const split = totals.map((_, i) => (i % 2 === 0 ? 1 : 0));
    const fit = fitBars({ start: MON, totals, hits: [] }, 120, split);
    expect(fit.split).toHaveLength(fit.totals.length);
    expect(fit.split!.reduce((s, n) => s + n, 0)).toBe(300);
    expect(
      fitBars({ start: MON, totals: [1], hits: [0] }, 120, [1]).split,
    ).toEqual([1]);
  });
});
