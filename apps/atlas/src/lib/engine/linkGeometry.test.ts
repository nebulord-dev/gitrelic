import { describe, expect, it } from 'vitest';

import { CURVE_SEGMENTS, LinkBuffers, tessellateLinks } from './linkGeometry';
import { MarkStore } from './markStore';
import type { LiveLink, Mark, Palette, Rgba } from '@gitrelic/scene';

const RED: Rgba = { r: 1, g: 0, b: 0, a: 0.5 };
const palette = new Proxy({} as Palette, { get: () => RED });

function store(points: [string, number, number, number?][]): MarkStore {
  const s = new MarkStore();
  for (const [id, x, y, r = 0] of points) {
    const m: Mark = {
      id,
      shape: 'dot',
      paint: '--file',
      x,
      y,
      r,
      w: 0,
      h: 0,
      a0: 0,
      a1: 0,
      alpha: 1,
    };
    s.upsert(m, m, RED);
  }
  return s;
}

const link = (extra: Partial<LiveLink> = {}): LiveLink => ({
  id: 'ab',
  source: 'a',
  target: 'b',
  curve: 'straight',
  width: 2,
  paint: '--link',
  alpha: 1,
  progress: 1,
  ...extra,
});

const s = store([
  ['a', 0, 0],
  ['b', 100, 0],
]);

/** Vertex k's position. */
const at = (out: LinkBuffers, k: number) => [
  out.positions[k * 2],
  out.positions[k * 2 + 1],
];

describe('tessellateLinks', () => {
  it('draws an S-curve that leaves and arrives level', () => {
    const tall = store([
      ['a', 0, 0],
      ['b', 100, 80],
    ]);
    const out = tessellateLinks(
      [link({ curve: 's-curve' })],
      tall,
      palette,
      new LinkBuffers(),
    );
    expect(out.vertexCount).toBe((CURVE_SEGMENTS + 1) * 2);
    const mid = (k: number) => {
      const [x0, y0] = at(out, k * 2);
      const [x1, y1] = at(out, k * 2 + 1);
      return [(x0 + x1) / 2, (y0 + y1) / 2];
    };
    // Its ends sit on the marks; the strip is vertical there (level tangent).
    expect(mid(0)).toEqual([0, 0]);
    expect(mid(CURVE_SEGMENTS)[0]).toBeCloseTo(100);
    expect(mid(CURVE_SEGMENTS)[1]).toBeCloseTo(80);
    expect(at(out, 0)[0]).toBeCloseTo(0);
    expect(at(out, CURVE_SEGMENTS * 2)[0]).toBeCloseTo(100);
    // Halfway, it crosses the chord's midpoint.
    const [hx, hy] = mid(CURVE_SEGMENTS / 2);
    expect(hx).toBeCloseTo(50);
    expect(hy).toBeCloseTo(40);
    // A quarter in, it has dropped less than the chord has: level at first.
    expect(mid(CURVE_SEGMENTS / 4)[1]).toBeLessThan(20);
  });

  it('turns a straight link into one quad of the right width', () => {
    const out = tessellateLinks([link()], s, palette, new LinkBuffers());
    expect(out.vertexCount).toBe(4);
    expect(out.indexCount).toBe(6);
    expect(at(out, 0)).toEqual([0, 1]);
    expect(at(out, 1)).toEqual([0, -1]);
    expect(at(out, 2)).toEqual([100, 1]);
    expect(at(out, 3)).toEqual([100, -1]);
  });

  it("runs from the source's edge to the target's", () => {
    const ringed = store([
      ['a', 0, 0, 40],
      ['b', 100, 0, 10],
    ]);
    const out = tessellateLinks([link()], ringed, palette, new LinkBuffers());
    expect(at(out, 0)[0]).toBeCloseTo(40, 6);
    expect(at(out, 2)[0]).toBeCloseTo(90, 6);
    // Drawing in, the fraction is of the visible part.
    tessellateLinks([link({ progress: 0.5 })], ringed, palette, out);
    expect(at(out, 2)[0]).toBeCloseTo(65, 6);
  });

  it('skips a link whose marks overlap', () => {
    const touching = store([
      ['a', 0, 0, 60],
      ['b', 100, 0, 50],
    ]);
    const out = tessellateLinks([link()], touching, palette, new LinkBuffers());
    expect(out.vertexCount).toBe(0);
  });

  it('only draws the drawn fraction', () => {
    const out = tessellateLinks(
      [link({ progress: 0.25 })],
      s,
      palette,
      new LinkBuffers(),
    );
    expect(at(out, 2)[0]).toBeCloseTo(25, 6);
  });

  it('colours by paint × link alpha', () => {
    const out = tessellateLinks(
      [link({ alpha: 0.5 })],
      s,
      palette,
      new LinkBuffers(),
    );
    expect([...out.colors.slice(0, 4)]).toEqual([1, 0, 0, 0.25]);
  });

  it('bows arcs off the chord and keeps their ends on the marks', () => {
    const out = tessellateLinks(
      [link({ curve: 'arc' })],
      s,
      palette,
      new LinkBuffers(),
    );
    expect(out.vertexCount).toBe((CURVE_SEGMENTS + 1) * 2);
    const mid = CURVE_SEGMENTS / 2;
    const centre = (at(out, mid * 2)[1] + at(out, mid * 2 + 1)[1]) / 2;
    expect(Math.abs(centre)).toBeGreaterThan(5);
    const last = CURVE_SEGMENTS * 2;
    expect((at(out, last)[0] + at(out, last + 1)[0]) / 2).toBeCloseTo(100, 6);
  });

  it('bows an arc by its own share when it sets one', () => {
    const peak = (bow?: number) => {
      const out = tessellateLinks(
        [link({ curve: 'arc', bow })],
        s,
        palette,
        new LinkBuffers(),
      );
      const mid = CURVE_SEGMENTS / 2;
      return Math.abs((at(out, mid * 2)[1] + at(out, mid * 2 + 1)[1]) / 2);
    };
    // A quadratic curve peaks at half its control offset: 0.1 of the chord
    // by default, 0.5 at bow 1.
    expect(peak()).toBeCloseTo(10, 0);
    expect(peak(1)).toBeCloseTo(50, 0);
  });

  it('draws a band with upright width from its offset ends', () => {
    const tall = store([
      ['a', 0, 0],
      ['b', 100, 80],
    ]);
    const out = tessellateLinks(
      [link({ curve: 'band', width: 10, ends: [-5, 20] })],
      tall,
      palette,
      new LinkBuffers(),
    );
    // Every vertex pair is stacked straight up and down, 10 apart, even
    // mid-bend, so bands stacked along a node keep meeting edge to edge.
    for (let k = 0; k <= CURVE_SEGMENTS; k++) {
      const [ax, ay] = at(out, k * 2);
      const [bx, by] = at(out, k * 2 + 1);
      expect(ax).toBeCloseTo(bx, 9);
      expect(ay - by).toBeCloseTo(10, 9);
    }
    // Its middle line starts 5 above a and ends 20 below b.
    const [, y0a] = at(out, 0);
    const [, y0b] = at(out, 1);
    expect((y0a + y0b) / 2).toBeCloseTo(-5);
    const [, y1a] = at(out, CURVE_SEGMENTS * 2);
    const [, y1b] = at(out, CURVE_SEGMENTS * 2 + 1);
    expect((y1a + y1b) / 2).toBeCloseTo(100);
  });

  it('tapers ribbons towards the target', () => {
    const out = tessellateLinks(
      [link({ curve: 'ribbon', width: 10 })],
      s,
      palette,
      new LinkBuffers(),
    );
    const width = (k: number) => {
      const [ax, ay] = at(out, k * 2);
      const [bx, by] = at(out, k * 2 + 1);
      return Math.hypot(ax - bx, ay - by);
    };
    expect(width(0)).toBeCloseTo(10, 5);
    expect(width(CURVE_SEGMENTS)).toBeCloseTo(3.5, 5);
  });

  it('skips undrawn, invisible, zero-length and dangling links', () => {
    const same = store([
      ['a', 5, 5],
      ['b', 5, 5],
    ]);
    const out = new LinkBuffers();
    tessellateLinks(
      [link({ progress: 0 }), link({ alpha: 0 }), link({ target: 'x' })],
      s,
      palette,
      out,
    );
    expect(out.vertexCount).toBe(0);
    tessellateLinks([link()], same, palette, out);
    expect(out.vertexCount).toBe(0);
  });

  it('grows its buffers for thousands of links and indexes them consistently', () => {
    const many = Array.from({ length: 2000 }, (_, i) =>
      link({ id: `l${i}`, curve: 'arc' }),
    );
    const out = tessellateLinks(many, s, palette, new LinkBuffers());
    expect(out.vertexCount).toBe(2000 * (CURVE_SEGMENTS + 1) * 2);
    let max = 0;
    for (let i = 0; i < out.indexCount; i++)
      max = Math.max(max, out.indices[i]);
    expect(max).toBe(out.vertexCount - 1);
  });
});
