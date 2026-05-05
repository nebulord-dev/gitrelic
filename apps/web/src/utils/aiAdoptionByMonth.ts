import type { CoAuthorMonthEntry } from '@gitrelic/core';

/**
 * Passthrough/normalizer for the trend hero. Currently a no-op shape adapter,
 * but lives in apps/web/src/utils/ so future presentation tweaks (e.g.,
 * gap-filling missing months) land here without touching the analyzer.
 */
export function aiAdoptionByMonth(
  byMonth: CoAuthorMonthEntry[],
): CoAuthorMonthEntry[] {
  return [...byMonth];
}
