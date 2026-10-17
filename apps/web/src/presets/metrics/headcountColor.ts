import { headcountTier } from '@gitrelic/scene';

const COLOR = {
  none: 'var(--severity-healthy)',
  moderate: 'var(--severity-warning)',
  high: 'var(--severity-critical)',
} as const;

/** Metrics-strip color for a count of flagged files (see `headcountTier`). */
export function headcountColor(flaggedCount: number): string {
  return COLOR[headcountTier(flaggedCount)];
}
