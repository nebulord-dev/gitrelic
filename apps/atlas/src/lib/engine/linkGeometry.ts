// Tessellates every link into one triangle list with per-vertex colour, so
// all links draw in a single mesh draw call. Pure — the Pixi side only
// uploads the arrays — and allocation-free once the buffers are big enough.

import { resolvePaint, type LiveLink, type Palette } from '@gitrelic/scene';

import type { MarkStore } from './markStore';

/** Points along a curved link (straight links use 2). */
export const CURVE_SEGMENTS = 16;
/** How far an `arc` link bows out, as a fraction of its length, unless the link sets `bow`. */
export const BOW = 0.2;
/** A ribbon narrows to this fraction of its width at the target end. */
export const RIBBON_TAPER = 0.35;

export class LinkBuffers {
  /** x, y per vertex. */
  positions = new Float32Array(1024);
  /** r, g, b, a per vertex (straight alpha; the shader premultiplies). */
  colors = new Float32Array(2048);
  indices = new Uint32Array(1536);
  vertexCount = 0;
  indexCount = 0;

  reserve(vertices: number, indices: number): void {
    if (vertices * 2 > this.positions.length) {
      this.positions = grow(this.positions, vertices * 2);
      this.colors = grow(this.colors, vertices * 4);
    }
    if (indices > this.indices.length)
      this.indices = grow(this.indices, indices);
  }
}

/**
 * Fills `out` with the drawn part (`progress`) of every link whose endpoints
 * are in the store, from the source mark's edge to the target's, so a link
 * never shows through a hollow mark (the Overview's repo ring). Returns
 * `out`, with `vertexCount`/`indexCount` set.
 */
export function tessellateLinks(
  links: Iterable<LiveLink>,
  store: MarkStore,
  palette: Palette,
  out: LinkBuffers,
): LinkBuffers {
  out.vertexCount = 0;
  out.indexCount = 0;
  for (const link of links) {
    if (link.progress <= 0 || link.alpha <= 0 || link.width <= 0) continue;
    const s = store.indexOf(link.source);
    const t = store.indexOf(link.target);
    if (s === -1 || t === -1) continue;

    const x1 = store.x[s];
    const y1 = store.y[s];
    const x2 = store.x[t];
    const y2 = store.y[t];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len === 0) continue;
    // Where the curve leaves the source's edge and meets the target's, as
    // curve parameters: radius over chord length, which a bowed curve's
    // slightly longer path overshoots by a hair, never into the mark.
    const u0 = store.r[s] / len;
    const u1 = 1 - store.r[t] / len;
    if (u1 <= u0) continue;

    const points = link.curve === 'straight' ? 2 : CURVE_SEGMENTS + 1;
    out.reserve(
      out.vertexCount + points * 2,
      out.indexCount + (points - 1) * 6,
    );

    // Quadratic Bézier through a control point bowed off the chord's midpoint
    // (to the chord's left, so A→B and B→A bow opposite ways and don't overlap).
    const bow =
      link.curve === 'straight' || link.curve === 's-curve'
        ? 0
        : (link.bow ?? BOW) * len;
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    const cx = (x1 + x2) / 2 + nx * bow;
    const cy = (y1 + y2) / 2 + ny * bow;

    // An S-curve is a cubic whose control points sit level with its ends,
    // halfway across, so it leaves and arrives horizontally.
    const sCurve = link.curve === 's-curve';
    const mx = (x1 + x2) / 2;

    const c = resolvePaint(link.paint, palette);
    const a = c.a * link.alpha;
    const base = out.vertexCount;

    for (let k = 0; k < points; k++) {
      const u = u0 + (k / (points - 1)) * link.progress * (u1 - u0);
      const v = 1 - u;
      let px: number;
      let py: number;
      // Tangent of the curve at u, for the strip's normal.
      let tx: number;
      let ty: number;
      if (sCurve) {
        const b1 = 3 * v * v * u + 3 * v * u * u;
        px = v * v * v * x1 + b1 * mx + u * u * u * x2;
        py =
          (v * v * v + 3 * v * v * u) * y1 + (3 * v * u * u + u * u * u) * y2;
        tx = 3 * v * v * (mx - x1) + 3 * u * u * (x2 - mx);
        ty = 6 * v * u * (y2 - y1);
      } else {
        px = v * v * x1 + 2 * v * u * cx + u * u * x2;
        py = v * v * y1 + 2 * v * u * cy + u * u * y2;
        tx = 2 * v * (cx - x1) + 2 * u * (x2 - cx);
        ty = 2 * v * (cy - y1) + 2 * u * (y2 - cy);
      }
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const half =
        (link.curve === 'ribbon'
          ? link.width * (1 - (1 - RIBBON_TAPER) * u)
          : link.width) / 2;

      const vi = out.vertexCount;
      out.positions[vi * 2] = px - ty * half;
      out.positions[vi * 2 + 1] = py + tx * half;
      out.positions[vi * 2 + 2] = px + ty * half;
      out.positions[vi * 2 + 3] = py - tx * half;
      // Both vertices of the pair share the colour; written out, not looped
      // over an array, so the per-point work allocates nothing.
      const ci = vi * 4;
      out.colors[ci] = out.colors[ci + 4] = c.r;
      out.colors[ci + 1] = out.colors[ci + 5] = c.g;
      out.colors[ci + 2] = out.colors[ci + 6] = c.b;
      out.colors[ci + 3] = out.colors[ci + 7] = a;
      out.vertexCount += 2;
    }
    for (let k = 0; k < points - 1; k++) {
      const p = base + k * 2;
      const ii = out.indexCount;
      out.indices[ii] = p;
      out.indices[ii + 1] = p + 1;
      out.indices[ii + 2] = p + 2;
      out.indices[ii + 3] = p + 1;
      out.indices[ii + 4] = p + 3;
      out.indices[ii + 5] = p + 2;
      out.indexCount += 6;
    }
  }
  return out;
}

function grow<T extends Float32Array | Uint32Array>(a: T, min: number): T {
  let size = a.length;
  while (size < min) size *= 2;
  const b = new (a.constructor as new (n: number) => T)(size);
  b.set(a);
  return b;
}
