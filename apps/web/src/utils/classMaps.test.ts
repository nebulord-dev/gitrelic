import { describe, expect, it } from 'vitest';

import { badgeClasses, severityText } from './classMaps';

describe('badgeClasses', () => {
  it('covers every BadgeVariant with bg + text classes', () => {
    expect(badgeClasses).toEqual({
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
    });
  });
});

describe('severityText', () => {
  it('covers every BadgeVariant with a foreground severity class', () => {
    expect(severityText).toEqual({
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
    });
  });
});
