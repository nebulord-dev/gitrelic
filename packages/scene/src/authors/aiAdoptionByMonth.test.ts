import { describe, it, expect } from 'vitest';

import { aiAdoptionByMonth } from './aiAdoptionByMonth';
import type { CoAuthorMonthEntry } from '@gitrelic/core';

describe('aiAdoptionByMonth', () => {
  it('passes through a populated byMonth array', () => {
    const input: CoAuthorMonthEntry[] = [
      { month: '2026-01', aiAssisted: 5, pureHuman: 3, total: 8 },
      { month: '2026-02', aiAssisted: 7, pureHuman: 2, total: 9 },
    ];
    expect(aiAdoptionByMonth(input)).toEqual(input);
  });

  it('returns empty array for empty input', () => {
    expect(aiAdoptionByMonth([])).toEqual([]);
  });

  it('preserves chronological ordering', () => {
    const input: CoAuthorMonthEntry[] = [
      { month: '2026-01', aiAssisted: 0, pureHuman: 1, total: 1 },
      { month: '2026-03', aiAssisted: 1, pureHuman: 0, total: 1 },
    ];
    expect(aiAdoptionByMonth(input).map((m) => m.month)).toEqual([
      '2026-01',
      '2026-03',
    ]);
  });
});
