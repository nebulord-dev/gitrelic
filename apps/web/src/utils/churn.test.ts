import { describe, expect, it } from 'vitest';

import { churnCategoryDescription, severityForChurn } from './churn';

describe('severityForChurn', () => {
  it('maps hot → critical', () => {
    expect(severityForChurn('hot')).toBe('critical');
  });

  it('maps warm → warning', () => {
    expect(severityForChurn('warm')).toBe('warning');
  });

  it('maps cold → moderate', () => {
    expect(severityForChurn('cold')).toBe('moderate');
  });

  it('maps frozen → healthy', () => {
    expect(severityForChurn('frozen')).toBe('healthy');
  });
});

describe('churnCategoryDescription', () => {
  it('describes hot as the top tier', () => {
    expect(churnCategoryDescription('hot')).toBe('top tier — 76+ churn score');
  });

  it('describes warm as the mid-high tier', () => {
    expect(churnCategoryDescription('warm')).toBe(
      'mid-high tier — 41–75 churn score',
    );
  });

  it('describes cold as the low tier', () => {
    expect(churnCategoryDescription('cold')).toBe(
      'low tier — 11–40 churn score',
    );
  });

  it('describes frozen as rarely touched', () => {
    expect(churnCategoryDescription('frozen')).toBe(
      'rarely touched — ≤10 churn score',
    );
  });
});
