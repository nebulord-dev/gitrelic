import { describe, expect, it } from 'vitest';

import { HitTester, hitLink, segmentDistance } from './hitTest';
import { MarkStore } from './markStore';
import type { LiveLink, Mark, Rgba } from '@gitrelic/scene';

const grey: Rgba = { r: 0.5, g: 0.5, b: 0.5, a: 1 };

function storeOf(...marks: Mark[]): MarkStore {
  const s = new MarkStore();
  for (const m of marks) s.upsert(m, m, grey);
  return s;
}

function mark(id: string, extra: Partial<Mark>): Mark {
  return {
    id,
    shape: 'dot',
    paint: '--file',
    x: 0,
    y: 0,
    r: 0,
    w: 0,
    h: 0,
    a0: 0,
    a1: 0,
    alpha: 1,
    ...extra,
  };
}

function hit(store: MarkStore, x: number, y: number, tol = 0) {
  const t = new HitTester();
  t.build(store);
  return t.hitMark(store, x, y, tol);
}

describe('HitTester', () => {
  it('hits dots by radius, with tolerance', () => {
    const s = storeOf(mark('person:a', { x: 100, y: 100, r: 10 }));
    expect(hit(s, 105, 105)).toBe('person:a');
    expect(hit(s, 112, 100)).toBeNull();
    expect(hit(s, 112, 100, 3)).toBe('person:a');
  });

  it('hits cards and bars by their rectangle', () => {
    const s = storeOf(
      mark('analyzer:x', { shape: 'card', x: 50, y: 50, w: 100, h: 20 }),
    );
    expect(hit(s, 99, 59)).toBe('analyzer:x');
    expect(hit(s, 50, 61)).toBeNull();
  });

  it('hits arcs by radius band and angle (clockwise from 12)', () => {
    // A quarter ring from 12 to 3 o'clock, radii 100..120.
    const s = storeOf(
      mark('cell:0:0', {
        shape: 'arc',
        x: 0,
        y: 0,
        r: 100,
        h: 20,
        a0: 0,
        a1: Math.PI / 2,
      }),
    );
    expect(hit(s, 75, -75)).toBe('cell:0:0'); // 1:30, radius ~106
    expect(hit(s, -75, -75)).toBeNull(); // 10:30: wrong angle
    expect(hit(s, 50, -50)).toBeNull(); // inside the hole
    expect(hit(s, 110, 1)).toBeNull(); // just past 3 o'clock
  });

  it('handles arcs that cross 12 o’clock', () => {
    const s = storeOf(
      mark('cell:6:23', { shape: 'arc', r: 100, h: 20, a0: -0.3, a1: 0.3 }),
    );
    expect(hit(s, 0, -110)).toBe('cell:6:23');
    expect(hit(s, -20, -108)).toBe('cell:6:23');
    expect(hit(s, 60, -90)).toBeNull();
  });

  it('prefers higher z, then the later-drawn mark', () => {
    const under = mark('file:a', { x: 0, y: 0, r: 10, z: 1 });
    const over = mark('file:b', { x: 2, y: 0, r: 10 });
    expect(hit(storeOf(under, over), 1, 0)).toBe('file:a');
    expect(
      hit(storeOf(mark('file:a', { r: 10 }), mark('file:b', { r: 10 })), 0, 0),
    ).toBe('file:b');
  });

  it('ignores marks that have all but faded out', () => {
    const s = storeOf(mark('person:a', { r: 10, alpha: 0.01 }));
    expect(hit(s, 0, 0)).toBeNull();
  });

  it('finds marks that span several grid cells', () => {
    const s = storeOf(
      mark('analyzer:big', { shape: 'card', x: 0, y: 0, w: 400, h: 400 }),
    );
    expect(hit(s, 190, -190)).toBe('analyzer:big');
  });
});

describe('hitLink', () => {
  const s = storeOf(
    mark('person:a', { x: 0, y: 0, r: 2 }),
    mark('person:b', { x: 100, y: 0, r: 2 }),
  );
  const link = (extra: Partial<LiveLink> = {}): LiveLink => ({
    id: 'ab',
    source: 'person:a',
    target: 'person:b',
    curve: 'straight',
    width: 2,
    paint: '--link',
    alpha: 1,
    progress: 1,
    ...extra,
  });

  it('hits near the segment, counting its width', () => {
    expect(hitLink([link()], s, 50, 3, 2)).toBe('ab');
    expect(hitLink([link()], s, 50, 10, 2)).toBeNull();
  });

  it('only counts the part that has been drawn', () => {
    expect(hitLink([link({ progress: 0.4 })], s, 30, 0, 1)).toBe('ab');
    expect(hitLink([link({ progress: 0.4 })], s, 70, 0, 1)).toBeNull();
  });

  it('skips undrawn links and links to missing marks', () => {
    expect(hitLink([link({ progress: 0 })], s, 50, 0, 5)).toBeNull();
    expect(hitLink([link({ target: 'person:x' })], s, 50, 0, 5)).toBeNull();
  });
});

describe('segmentDistance', () => {
  it('measures to the nearest point, clamped to the ends', () => {
    expect(segmentDistance(5, 5, 0, 0, 10, 0)).toBe(5);
    expect(segmentDistance(-3, 4, 0, 0, 10, 0)).toBe(5);
    expect(segmentDistance(3, 4, 0, 0, 0, 0)).toBe(5);
  });
});
