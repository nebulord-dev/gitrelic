// Headcount tiering for the analyzers that flag rare files (parallel dev,
// rewrite ratio, commit timing): 0 flagged = none, 1..4 = moderate, ≥5 = high.
// Flagged files are uncommon at any repo size, so a fixed count works where a
// percentage wouldn't.

export const HEADCOUNT_MODERATE_THRESHOLD = 5;

export type HeadcountTier = 'none' | 'moderate' | 'high';

export function headcountTier(flaggedCount: number): HeadcountTier {
  if (flaggedCount <= 0) return 'none';
  return flaggedCount < HEADCOUNT_MODERATE_THRESHOLD ? 'moderate' : 'high';
}
