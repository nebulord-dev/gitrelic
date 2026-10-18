import { describe, expect, it } from 'vitest';

import { arcBand } from './arcBand';

const pairs = (flat: number[]) =>
  Array.from({ length: flat.length / 2 }, (_, i) => [
    flat[i * 2],
    flat[i * 2 + 1],
  ]);

describe('arcBand', () => {
  it('runs the outer edge clockwise from 12 o’clock, then the inner edge back', () => {
    const pts = pairs(arcBand(0, 0, 10, 20, 0, Math.PI / 2));
    const [first] = pts;
    expect(first[0]).toBeCloseTo(0, 9);
    expect(first[1]).toBeCloseTo(-20, 9); // 12 o'clock, outer
    const lastOuter = pts[pts.length / 2 - 1];
    expect(lastOuter[0]).toBeCloseTo(20, 9); // 3 o'clock, outer
    const lastInner = pts.at(-1)!;
    expect(lastInner[1]).toBeCloseTo(-10, 9); // back at 12, inner
  });

  it('keeps every point inside the band', () => {
    for (const [x, y] of pairs(arcBand(5, 5, 10, 20, 1, 2.5))) {
      const r = Math.hypot(x - 5, y - 5);
      expect(r).toBeGreaterThan(9.999);
      expect(r).toBeLessThan(20.001);
    }
  });

  it('flattens finer for longer arcs, and never below one segment', () => {
    expect(arcBand(0, 0, 1, 2, 0, 0.001)).toHaveLength(8);
    expect(arcBand(0, 0, 1, 2, 0, Math.PI * 2).length).toBeGreaterThan(300);
  });
});
