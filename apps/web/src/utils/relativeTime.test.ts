import { describe, expect, it } from 'vitest';

import { formatRelative } from './relativeTime';

describe('formatRelative', () => {
  it('returns em-dash when days is null', () => {
    expect(formatRelative(null)).toBe('—');
  });

  it('returns "today" for sub-day ages', () => {
    expect(formatRelative(0)).toBe('today');
    expect(formatRelative(0.5)).toBe('today');
  });

  it('returns "Xd ago" for ages under 30 days, rounded', () => {
    expect(formatRelative(1)).toBe('1d ago');
    expect(formatRelative(7.4)).toBe('7d ago');
    expect(formatRelative(29)).toBe('29d ago');
  });

  it('returns "Xmo ago" for ages between 30 and 365 days, rounded', () => {
    expect(formatRelative(30)).toBe('1mo ago');
    expect(formatRelative(60)).toBe('2mo ago');
    expect(formatRelative(364)).toBe('12mo ago');
  });

  it('returns "X.Xy ago" for ages 1 to 9 years, one decimal', () => {
    expect(formatRelative(365)).toBe('1.0y ago');
    expect(formatRelative(548)).toBe('1.5y ago');
    expect(formatRelative(3285)).toBe('9.0y ago');
  });

  it('returns "Xy ago" for ages 10+ years, no decimals', () => {
    expect(formatRelative(3650)).toBe('10y ago');
    expect(formatRelative(7305)).toBe('20y ago');
  });
});
