import { describe, expect, it } from 'vitest';

import {
  circlePolygon,
  insetPolygon,
  polygonArea,
  polygonCentroid,
  voronoiTreemap,
  type Point,
} from './voronoiTreemap';

const CLIP = circlePolygon(0, 0, 100, 64);
const clipArea = polygonArea(CLIP);

function inside(p: Point, poly: readonly Point[]): boolean {
  // Convex and counter-clockwise: every edge has the point on its left (or on it).
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    if ((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) < -1e-6) return false;
  }
  return true;
}

describe('voronoiTreemap', () => {
  const weights = [
    418, 219, 230, 130, 95, 93, 79, 76, 62, 58, 54, 43, 40, 38, 36, 31, 27, 23,
    20, 18, 15, 12, 11, 10,
  ];

  it('gives each weight a cell whose area is close to its share', () => {
    const cells = voronoiTreemap(weights, CLIP, { seed: 1 });
    const total = weights.reduce((a, b) => a + b, 0);
    expect(cells).toHaveLength(weights.length);
    let error = 0;
    cells.forEach((cell, i) => {
      error += Math.abs(polygonArea(cell) - (clipArea * weights[i]) / total);
    });
    expect(error / clipArea).toBeLessThan(0.03);
  });

  it('tiles the clip: cells cover it without overlapping', () => {
    const cells = voronoiTreemap(weights, CLIP, { seed: 1 });
    const covered = cells.reduce((a, c) => a + polygonArea(c), 0);
    expect(covered / clipArea).toBeCloseTo(1, 3);
  });

  it('keeps every vertex inside the clip', () => {
    for (const cell of voronoiTreemap(weights, CLIP, { seed: 7 })) {
      for (const p of cell) expect(inside(p, CLIP)).toBe(true);
    }
  });

  it('is deterministic for a seed', () => {
    expect(voronoiTreemap(weights, CLIP, { seed: 3 })).toEqual(
      voronoiTreemap(weights, CLIP, { seed: 3 }),
    );
  });

  it('fills the clip with one weight', () => {
    const [cell] = voronoiTreemap([5], CLIP, { seed: 1 });
    expect(polygonArea(cell) / clipArea).toBeCloseTo(1, 6);
  });

  it('returns nothing for no weights', () => {
    expect(voronoiTreemap([], CLIP, { seed: 1 })).toEqual([]);
  });

  it('handles equal weights', () => {
    const cells = voronoiTreemap([1, 1, 1, 1], CLIP, { seed: 2 });
    for (const c of cells)
      expect(polygonArea(c) / clipArea).toBeCloseTo(0.25, 1);
  });
});

describe('insetPolygon', () => {
  const square: Point[] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ];
  it('moves every edge inward', () => {
    const inner = insetPolygon(square, 1);
    expect(polygonArea(inner)).toBeCloseTo(64, 9);
    for (const [x, y] of inner) {
      expect(x).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(y).toBeLessThanOrEqual(9 + 1e-9);
    }
  });
  it('is empty when the polygon is too thin', () => {
    expect(insetPolygon(square, 6)).toEqual([]);
  });
});

describe('polygon helpers', () => {
  const square: Point[] = [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2],
  ];
  it('measures area and centroid', () => {
    expect(polygonArea(square)).toBe(4);
    expect(polygonCentroid(square)).toEqual([1, 1]);
  });
  it('builds a counter-clockwise circle', () => {
    expect(polygonArea(CLIP)).toBeGreaterThan(0);
    // A regular 64-gon: n/2 · r² · sin(2π/n).
    expect(polygonArea(CLIP)).toBeCloseTo(
      32 * 100 * 100 * Math.sin(Math.PI / 32),
      6,
    );
  });
});
