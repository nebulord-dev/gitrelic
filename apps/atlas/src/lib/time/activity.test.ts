import { describe, expect, it } from 'vitest';

import { activeWeeks, recentShare, spanLabels } from './activity';

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
});
