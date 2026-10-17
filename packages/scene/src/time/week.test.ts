import { describe, expect, it } from 'vitest';

import { startOfUtcWeek, WEEK_MS } from './week';

const monday = Date.parse('2026-01-05T00:00:00Z');

describe('startOfUtcWeek', () => {
  it.each([
    ['Monday midnight', '2026-01-05T00:00:00Z'],
    ['Monday afternoon', '2026-01-05T15:30:00Z'],
    ['Wednesday', '2026-01-07T12:00:00Z'],
    ['Sunday, last millisecond', '2026-01-11T23:59:59.999Z'],
  ])('%s → that Monday', (_, iso) => {
    expect(startOfUtcWeek(Date.parse(iso))).toBe(monday);
  });

  it('puts Sunday in the week that started six days earlier', () => {
    expect(startOfUtcWeek(Date.parse('2026-01-04T10:00:00Z'))).toBe(
      monday - WEEK_MS,
    );
  });

  it('uses UTC, not the local wall clock', () => {
    // 23:30 Sunday in UTC-8 is 07:30 Monday UTC.
    expect(startOfUtcWeek(Date.parse('2026-01-04T23:30:00-08:00'))).toBe(
      monday,
    );
  });
});
