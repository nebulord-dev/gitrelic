import type { CoAuthorMonthEntry } from '@gitrelic/core';

// Adapter seam — extend here when month data needs reshaping for the trend hero.
export function aiAdoptionByMonth(
  byMonth: CoAuthorMonthEntry[],
): CoAuthorMonthEntry[] {
  return [...byMonth];
}
