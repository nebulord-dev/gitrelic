import { describe, expect, it } from 'vitest';

import { MONTHLY_AFTER, timeBins } from './bins';
import { WEEK_MS } from './week';

const at = (iso: string) => ({
  timeMs: Date.parse(iso),
  author: 'a',
  files: [],
});

describe('timeBins', () => {
  it('bins by Monday-start UTC weeks, first commit to last', () => {
    // Wed 7 Jan 2026 and Mon 19 Jan 2026: three weeks from Mon 5 Jan.
    const bins = timeBins([
      at('2026-01-07T10:00:00Z'),
      at('2026-01-19T00:00:00Z'),
    ]);
    expect(bins.unit).toBe('week');
    expect(
      bins.binStarts.map((ms) => new Date(ms).toISOString().slice(0, 10)),
    ).toEqual(['2026-01-05', '2026-01-12', '2026-01-19']);
    expect(bins.binOf(Date.parse('2026-01-18T23:59:59Z'))).toBe(1);
    expect(bins.binOf(Date.parse('2026-01-19T00:00:00Z'))).toBe(2);
  });

  it('bins by calendar month past two years of weeks', () => {
    const start = Date.parse('2020-01-06T00:00:00Z');
    const bins = timeBins([
      { timeMs: start, author: 'a', files: [] },
      { timeMs: start + MONTHLY_AFTER * WEEK_MS + 1, author: 'a', files: [] },
    ]);
    expect(bins.unit).toBe('month');
    expect(new Date(bins.binStarts[0]).toISOString().slice(0, 10)).toBe(
      '2020-01-01',
    );
    expect(bins.binOf(Date.parse('2020-03-15T00:00:00Z'))).toBe(2);
  });

  it('has no bins without commits', () => {
    expect(timeBins([]).binStarts).toEqual([]);
  });
});
