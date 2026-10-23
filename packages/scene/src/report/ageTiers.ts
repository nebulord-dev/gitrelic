import type { AgeMapReport, AgeStatus, FileAge } from '@gitrelic/core';

/**
 * The files in one of classic's age tiers. Reports carried these as
 * `staleFiles` and `ancientFiles` until RELIC-374; once every tracked file
 * had an age, the copies were most of `ageMap`'s size, so they're derived
 * from `files` instead.
 */
export function filesInTier(
  ageMap: AgeMapReport,
  status: AgeStatus,
): FileAge[] {
  return ageMap.files.filter((f) => f.status === status);
}
