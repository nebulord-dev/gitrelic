import { describe, expect, it } from 'vitest';

import { severityForChurn } from './churn';

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
