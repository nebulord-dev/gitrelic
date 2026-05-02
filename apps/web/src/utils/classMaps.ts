import type { BadgeVariant } from '../components/theme';

/**
 * Typed Tailwind class lookups for tier-driven styling (severity, accent, domain).
 *
 * Maps `BadgeVariant` → fully-composed Tailwind class strings (bg + text together)
 * for the `badgeClasses` use case, or fg-only strings for `severityText`.
 *
 * Single source of truth: changing a tier's color means editing this file plus
 * the corresponding CSS variable in `index.css`. Class consumers don't compose
 * tier names via template literal (`text-severity-${tier}`) — that bypasses the
 * type system and is grep-hostile.
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
