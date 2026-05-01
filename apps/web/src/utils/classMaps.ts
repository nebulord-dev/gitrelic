import type { BadgeVariant } from '../components/theme';

/**
 * Combined background + foreground classes per variant.
 * Replaces the legacy `badgeStyles` lookup in `components/theme.ts`,
 * which returns CSS-var strings for inline-style consumption.
 * Migrate consumers from `badgeStyles[v]` (used in `style={{}}`)
 * to `badgeClasses[v]` (used in `className`) as part of the Tailwind
 * migration (RELIC-336).
 */
export const badgeClasses: Record<BadgeVariant, string> = {
  critical: 'bg-severity-critical-bg text-severity-critical-text',
  warning: 'bg-severity-warning-bg text-severity-warning-text',
  moderate: 'bg-severity-moderate-bg text-severity-moderate-text',
  healthy: 'bg-severity-healthy-bg text-severity-healthy-text',
  ownership: 'bg-accent-ownership-bg text-accent-ownership-text',
  coupling: 'bg-accent-coupling-bg text-accent-coupling-text',
  temporal: 'bg-accent-temporal-bg text-accent-temporal-text',
  shame: 'bg-severity-critical-bg text-severity-critical-text',
  parallel: 'bg-severity-warning-bg text-severity-warning-text',
  stale: 'bg-surface-tertiary text-text-tertiary',
};

/**
 * Foreground-only severity color per variant — for big numbers, icons,
 * or text accents that need just the bold severity color (no background).
 */
export const severityText: Record<BadgeVariant, string> = {
  critical: 'text-severity-critical',
  warning: 'text-severity-warning',
  moderate: 'text-severity-moderate',
  healthy: 'text-severity-healthy',
  ownership: 'text-accent-ownership',
  coupling: 'text-accent-coupling',
  temporal: 'text-accent-temporal',
  shame: 'text-severity-critical',
  parallel: 'text-severity-warning',
  stale: 'text-text-tertiary',
};
