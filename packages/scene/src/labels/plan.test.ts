import { describe, expect, it } from 'vitest';

import { DEFAULT_LABEL_CAP, planLabels, type LabelCandidate } from './plan';

const box = (
  id: string,
  x: number,
  y: number,
  priority = 0,
  w = 40,
  h = 12,
): LabelCandidate => ({ id, x, y, w, h, priority });

describe('planLabels', () => {
  it('keeps labels that do not touch', () => {
    expect(
      planLabels([box('a', 0, 0), box('b', 100, 0), box('c', 0, 100)]),
    ).toEqual(['a', 'b', 'c']);
  });

  it('drops the lower-priority label of an overlapping pair', () => {
    expect(planLabels([box('low', 0, 0, 1), box('high', 10, 5, 5)])).toEqual([
      'high',
    ]);
  });

  it('breaks priority ties by id, whatever the input order', () => {
    const a = box('a', 0, 0);
    const b = box('b', 5, 0);
    expect(planLabels([b, a])).toEqual(['a']);
    expect(planLabels([a, b])).toEqual(['a']);
  });

  it('keeps the minimum gap between labels', () => {
    // 1 px apart: closer than the default 2 px gap.
    expect(planLabels([box('a', 0, 0, 1), box('b', 41, 0)])).toEqual(['a']);
    expect(
      planLabels([box('a', 0, 0, 1), box('b', 41, 0)], { gap: 0 }),
    ).toEqual(['a', 'b']);
  });

  it('detects overlaps across grid cell boundaries', () => {
    // Straddles the 64 px cell edge; must still collide.
    expect(planLabels([box('a', 50, 50, 1, 30, 30), box('b', 70, 70)])).toEqual(
      ['a'],
    );
  });

  it('stops at the cap', () => {
    const many = Array.from({ length: 400 }, (_, i) =>
      box(
        `l${String(i).padStart(3, '0')}`,
        (i % 20) * 100,
        Math.floor(i / 20) * 50,
      ),
    );
    expect(planLabels(many)).toHaveLength(DEFAULT_LABEL_CAP);
    expect(planLabels(many, { cap: 3 })).toEqual(['l000', 'l001', 'l002']);
  });

  it('always shows pinned labels, over others and past the cap', () => {
    const labels = [
      box('top', 0, 0, 10),
      box('hovered', 5, 0, 0),
      box('far', 500, 0, 5),
    ];
    const pinned = new Set(['hovered']);
    expect(planLabels(labels, { pinned })).toEqual(['hovered', 'far']);
    expect(planLabels(labels, { pinned, cap: 0 })).toEqual(['hovered']);
  });

  it('skips labels entirely off screen, and non-finite ones', () => {
    const view = { width: 200, height: 100 };
    expect(
      planLabels(
        [
          box('in', 60, 10),
          box('edge', -30, 10, 0, 40),
          box('left', -100, 10),
          box('below', 10, 150),
          box('nan', Number.NaN, 0),
        ],
        { view },
      ),
    ).toEqual(['edge', 'in']);
  });

  it('places nothing from nothing', () => {
    expect(planLabels([])).toEqual([]);
  });
});
