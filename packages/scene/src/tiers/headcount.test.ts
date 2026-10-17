import { describe, expect, it } from 'vitest';

import { HEADCOUNT_MODERATE_THRESHOLD, headcountTier } from './headcount';

describe('headcountTier', () => {
  it.each([
    [0, 'none'],
    [1, 'moderate'],
    [HEADCOUNT_MODERATE_THRESHOLD - 1, 'moderate'],
    [HEADCOUNT_MODERATE_THRESHOLD, 'high'],
    [100, 'high'],
  ])('%i flagged → %s', (count, tier) => {
    expect(headcountTier(count)).toBe(tier);
  });
});
