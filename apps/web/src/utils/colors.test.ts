import { describe, expect, it } from 'vitest';

import { authorColor, categoryColor } from './colors';

describe('categoryColor', () => {
  it('returns red for critical', () => {
    expect(categoryColor('critical', 0.5)).toBe('rgba(248, 81, 73, 0.5)');
  });

  it('returns amber for warning', () => {
    expect(categoryColor('warning', 1)).toBe('rgba(210, 153, 34, 1)');
  });

  it('returns blue for moderate', () => {
    expect(categoryColor('moderate', 0.3)).toBe('rgba(88, 166, 255, 0.3)');
  });

  it('returns green for low/unknown', () => {
    expect(categoryColor('low', 0.5)).toBe('rgba(63, 185, 80, 0.5)');
    expect(categoryColor('unknown', 0.5)).toBe('rgba(63, 185, 80, 0.5)');
  });
});

describe('authorColor', () => {
  it('returns an hsl string', () => {
    const color = authorColor('alice@dev.com');
    expect(color).toMatch(/^hsl\(\d+, \d+%, \d+%\)$/);
  });

  it('is deterministic — same email returns same color', () => {
    expect(authorColor('bob@dev.com')).toBe(authorColor('bob@dev.com'));
  });

  it('returns different colors for different emails', () => {
    expect(authorColor('alice@dev.com')).not.toBe(authorColor('bob@dev.com'));
  });
});
