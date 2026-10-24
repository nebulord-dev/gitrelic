import { describe, expect, it } from 'vitest';

import { insidePoly, polyDashes, polyWorld } from './polyShape';

// A diamond touching the middle of each side of its box.
const DIAMOND = [0, -0.5, 0.5, 0, 0, 0.5, -0.5, 0];

describe('polyWorld', () => {
  it('stretches the points over the box around the center', () => {
    expect(polyWorld(DIAMOND, 100, 50, 40, 20)).toEqual([
      100, 40, 120, 50, 100, 60, 80, 50,
    ]);
  });

  it('collapses to the center when the box does (entering, leaving)', () => {
    expect(polyWorld(DIAMOND, 7, 9, 0, 0)).toEqual([7, 9, 7, 9, 7, 9, 7, 9]);
  });
});

describe('insidePoly', () => {
  it('tells inside from outside', () => {
    expect(insidePoly(DIAMOND, 0, 0)).toBe(true);
    expect(insidePoly(DIAMOND, 0.2, 0.2)).toBe(true);
    // The box's corner is outside the diamond.
    expect(insidePoly(DIAMOND, 0.4, 0.4)).toBe(false);
  });

  it("doesn't care about winding", () => {
    const reversed = [-0.5, 0, 0, 0.5, 0.5, 0, 0, -0.5];
    expect(insidePoly(reversed, 0.1, 0.1)).toBe(true);
    expect(insidePoly(reversed, 0.45, 0.45)).toBe(false);
  });
});

describe('polyDashes', () => {
  const square = [0, 0, 10, 0, 10, 10, 0, 10];

  it('dashes the outline with equal gaps', () => {
    const segs = polyDashes(square, 5);
    // 40 units of outline: four 5-unit dashes, one per side.
    expect(segs.length / 4).toBe(4);
    expect(segs.slice(0, 4)).toEqual([0, 0, 5, 0]);
  });

  it('carries the pattern across corners', () => {
    const segs = polyDashes(square, 3);
    // Dashes at 0–3, 6–9 on the first side, then 12–15 starts 2 into the second.
    expect(segs.slice(8, 12)).toEqual([10, 2, 10, 5]);
  });

  it('draws nothing for a non-positive dash', () => {
    expect(polyDashes(square, 0)).toEqual([]);
  });
});
