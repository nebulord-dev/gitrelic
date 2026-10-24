import { describe, expect, it } from 'vitest';

import { HitTester, hitLink, segmentDistance, wedgeBounds } from './hitTest';
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

  it('hits a fan card at its edge, not the invisible port there', () => {
    const s = storeOf(
      mark('view:code-health', { shape: 'card', x: 0, y: 0, w: 260, h: 84 }),
      mark('port:code-health:out', { x: 130, y: 0, alpha: 0 }),
    );
    expect(hit(s, 129, 0, 4)).toBe('view:code-health');
    expect(hit(s, 136, 0, 4)).toBeNull();
  });

  it('hits a polygon by its shape, not its box, and without slop', () => {
    // Two triangles splitting a 100 × 100 box along its diagonal.
    const s = storeOf(
      mark('dir:a', {
        shape: 'poly',
        x: 50,
        y: 50,
        w: 100,
        h: 100,
        pts: [-0.5, -0.5, 0.5, -0.5, -0.5, 0.5],
      }),
      mark('dir:b', {
        shape: 'poly',
        x: 50,
        y: 50,
        w: 100,
        h: 100,
        pts: [0.5, -0.5, 0.5, 0.5, -0.5, 0.5],
      }),
    );
    expect(hit(s, 20, 20)).toBe('dir:a');
    expect(hit(s, 80, 80)).toBe('dir:b');
    // Just over the diagonal into a's half: tolerance doesn't hand it to b.
    expect(hit(s, 48, 50, 6)).toBe('dir:a');
    expect(hit(s, 150, 50)).toBeNull();
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

  it("picks the mark drawn on top, by the store's draw order", () => {
    const raised = mark('file:a', { x: 0, y: 0, r: 10, z: 1 });
    const later = mark('file:b', { x: 2, y: 0, r: 10 });
    expect(hit(storeOf(raised, later), 1, 0)).toBe('file:a');
    expect(
      hit(storeOf(mark('file:a', { r: 10 }), mark('file:b', { r: 10 })), 0, 0),
    ).toBe('file:b');
    // Arcs are their own layer under every dot, whatever their z or slot.
    const arc = mark('cell:0:0', {
      shape: 'arc',
      r: 0,
      h: 20,
      a0: 0,
      a1: Math.PI * 2,
      z: 9,
    });
    expect(hit(storeOf(mark('person:a', { r: 10 }), arc), 0, 0)).toBe(
      'person:a',
    );
  });

  it('agrees with the draw order after marks are removed', () => {
    const s = storeOf(
      mark('file:a', { r: 10 }),
      mark('file:b', { r: 10 }),
      mark('file:c', { r: 10 }),
    );
    s.remove('file:a');
    const order = s.drawOrder();
    expect(hit(s, 0, 0)).toBe(s.marks[order[order.length - 1]].id);
    expect(hit(s, 0, 0)).toBe('file:c');
  });

  it('ignores marks that have all but faded out, or are painted faint', () => {
    expect(hit(storeOf(mark('person:a', { r: 10, alpha: 0.01 })), 0, 0)).toBe(
      null,
    );
    const faint = new MarkStore();
    const m = mark('person:a', { r: 10 });
    faint.upsert(m, m, { ...grey, a: 0.02 });
    expect(hit(faint, 0, 0)).toBeNull();
  });

  it('finds marks that span several grid cells', () => {
    const s = storeOf(
      mark('analyzer:big', { shape: 'card', x: 0, y: 0, w: 400, h: 400 }),
    );
    expect(hit(s, 190, -190)).toBe('analyzer:big');
  });
});

describe('wedgeBounds', () => {
  // `+ 0` folds -0 into 0, which toEqual tells apart.
  const round = (b: number[]) => b.map((v) => Math.round(v * 1000) / 1000 + 0);

  it("boxes a quarter ring, including the 12 and 3 o'clock extremes", () => {
    expect(round(wedgeBounds(0, 0, 100, 120, 0, Math.PI / 2))).toEqual([
      0, -120, 120, 0,
    ]);
  });

  it('keeps a thin wedge small when it passes no cardinal angle', () => {
    const [x0, y0, x1, y1] = wedgeBounds(0, 0, 100, 120, 0.1, 0.2);
    expect(x1 - x0).toBeLessThan(15);
    expect(y1 - y0).toBeLessThan(25);
  });

  it('reaches the outer radius where the wedge crosses a cardinal', () => {
    expect(wedgeBounds(0, 0, 100, 120, 1.4, 1.7)[2]).toBeCloseTo(120, 9);
    // Wrapping through 12 o'clock from a negative start.
    expect(wedgeBounds(10, 10, 100, 120, -0.1, 0.1)[1]).toBeCloseTo(-110, 9);
  });

  it('boxes the whole circle for a full ring', () => {
    expect(wedgeBounds(5, 5, 0, 10, 0, Math.PI * 2)).toEqual([-5, -5, 15, 15]);
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

  it("misses inside a mark, where the link isn't drawn", () => {
    const ringed = storeOf(
      mark('repo', { shape: 'ring', x: 0, y: 0, r: 40 }),
      mark('person:b', { x: 100, y: 0, r: 2 }),
    );
    const spoke = link({ source: 'repo' });
    expect(hitLink([spoke], ringed, 20, 0, 1)).toBeNull();
    expect(hitLink([spoke], ringed, 60, 0, 1)).toBe('ab');
  });

  it('follows a band through its bend, at its offset ends', () => {
    const tall = storeOf(
      mark('person:a', { x: 0, y: 0, r: 0 }),
      mark('person:b', { x: 100, y: 100, r: 0 }),
    );
    const band = link({ curve: 'band', width: 4, ends: [10, 10] });
    // Near the ends the band runs level at y 10 and 110, far from the
    // chord; at the middle it crosses (50, 60).
    expect(hitLink([band], tall, 5, 10, 1)).toBe('ab');
    expect(hitLink([band], tall, 95, 110, 1)).toBe('ab');
    expect(hitLink([band], tall, 50, 60, 1)).toBe('ab');
    // On the chord near the start, the band isn't there.
    expect(hitLink([band], tall, 20, 30, 1)).toBeNull();
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
