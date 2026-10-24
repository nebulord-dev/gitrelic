// What's under the pointer, in world coordinates. Marks go into a uniform
// grid by bounding box, so a lookup only runs exact tests on the few marks
// near the point. Marks move while tweening, so the stage rebuilds the grid
// lazily — on the first pointer query after anything changed.

import { BOW, CURVE_SEGMENTS } from './linkGeometry';
import { SHAPE_CODES, type MarkStore } from './markStore';
import { insidePoly } from './polyShape';
import type { EntityId, LiveLink } from '@gitrelic/scene';

const TAU = Math.PI * 2;
/** Nearly invisible marks (fading out, or a faint paint) can't be picked. */
const MIN_ALPHA = 0.05;

export class HitTester {
  private grid = new Map<string, number[]>();

  constructor(private readonly cell = 32) {}

  build(store: MarkStore): void {
    this.grid.clear();
    for (let i = 0; i < store.count; i++) {
      const [bx0, by0, bx1, by1] = bounds(store, i);
      const x0 = Math.floor(bx0 / this.cell);
      const x1 = Math.floor(bx1 / this.cell);
      const y0 = Math.floor(by0 / this.cell);
      const y1 = Math.floor(by1 / this.cell);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gy = y0; gy <= y1; gy++) {
          const key = `${gx},${gy}`;
          const bucket = this.grid.get(key);
          if (bucket) bucket.push(i);
          else this.grid.set(key, [i]);
        }
      }
    }
  }

  /**
   * The topmost mark at (wx, wy), by the store's `drawOrder` — the order the
   * renderer paints in. `tolerance` widens every shape, in world units.
   */
  hitMark(
    store: MarkStore,
    wx: number,
    wy: number,
    tolerance = 0,
  ): EntityId | null {
    const gx0 = Math.floor((wx - tolerance) / this.cell);
    const gx1 = Math.floor((wx + tolerance) / this.cell);
    const gy0 = Math.floor((wy - tolerance) / this.cell);
    const gy1 = Math.floor((wy + tolerance) / this.cell);
    let best = -1;
    let bestRank = -1;
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        for (const i of this.grid.get(`${gx},${gy}`) ?? []) {
          if (i >= store.count) continue;
          if (store.alpha[i] * store.opacity[i] < MIN_ALPHA) continue;
          if (!contains(store, i, wx, wy, tolerance)) continue;
          const rank = store.paintRank(i);
          if (rank > bestRank) {
            best = i;
            bestRank = rank;
          }
        }
      }
    }
    return best === -1 ? null : store.marks[best].id;
  }
}

/**
 * The closest link within `tolerance` of (wx, wy), measured to the drawn part
 * of the link: its chord when straight, else the curve as linkGeometry draws
 * it, sampled into segments (a flow's S-shaped bands are nowhere near their
 * chord). Width counts as linkGeometry's does: across the curve, or upright
 * for a band.
 */
export function hitLink(
  links: Iterable<LiveLink>,
  store: MarkStore,
  wx: number,
  wy: number,
  tolerance: number,
): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const link of links) {
    if (link.progress <= 0 || link.alpha < MIN_ALPHA) continue;
    const s = store.indexOf(link.source);
    const t = store.indexOf(link.target);
    if (s === -1 || t === -1) continue;
    const x1 = store.x[s];
    const y1 = store.y[s] + (link.ends?.[0] ?? 0);
    const x2 = store.x[t];
    const y2 = store.y[t] + (link.ends?.[1] ?? 0);
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len === 0) continue;
    // Edge to edge, as linkGeometry draws it.
    const u0 = store.r[s] / len;
    const u1 = u0 + (1 - store.r[t] / len - u0) * link.progress;
    if (u1 <= u0) continue;

    const steps = link.curve === 'straight' ? 1 : CURVE_SEGMENTS;
    let [px, py] = linkPoint(link, x1, y1, x2, y2, len, u0);
    let d = Infinity;
    for (let k = 1; k <= steps; k++) {
      const [qx, qy] = linkPoint(
        link,
        x1,
        y1,
        x2,
        y2,
        len,
        u0 + (k / steps) * (u1 - u0),
      );
      d = Math.min(
        d,
        link.curve === 'band'
          ? bandDistance(wx, wy, px, py, qx, qy)
          : segmentDistance(wx, wy, px, py, qx, qy),
      );
      px = qx;
      py = qy;
    }
    d -= link.width / 2;
    if (d <= tolerance && d < bestDist) {
      best = link.id;
      bestDist = d;
    }
  }
  return best;
}

/** A point on a link's curve at parameter u, as linkGeometry computes it. */
function linkPoint(
  link: LiveLink,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  len: number,
  u: number,
): [number, number] {
  const v = 1 - u;
  if (link.curve === 's-curve' || link.curve === 'band') {
    const mx = (x1 + x2) / 2;
    return [
      v * v * v * x1 + (3 * v * v * u + 3 * v * u * u) * mx + u * u * u * x2,
      (v * v * v + 3 * v * v * u) * y1 + (3 * v * u * u + u * u * u) * y2,
    ];
  }
  const bow = link.curve === 'straight' ? 0 : (link.bow ?? BOW) * len;
  const cx = (x1 + x2) / 2 - ((y2 - y1) / len) * bow;
  const cy = (y1 + y2) / 2 + ((x2 - x1) / len) * bow;
  return [
    v * v * x1 + 2 * v * u * cx + u * u * x2,
    v * v * y1 + 2 * v * u * cy + u * u * y2,
  ];
}

/**
 * Vertical distance from (px, py) to a segment, for a band, whose width is
 * upright: within the segment's x span, the gap to the line at that x;
 * outside it, the distance to the nearer end.
 */
function bandDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  if (px < lo || px > hi || hi === lo)
    return segmentDistance(px, py, x1, y1, x2, y2);
  const y = y1 + ((px - x1) / (x2 - x1)) * (y2 - y1);
  return Math.abs(py - y);
}

export function segmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const t =
    len2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/** A mark's world bounding box: x0, y0, x1, y1. */
function bounds(store: MarkStore, i: number): [number, number, number, number] {
  const x = store.x[i];
  const y = store.y[i];
  switch (store.shape[i]) {
    case SHAPE_CODES.dot:
    case SHAPE_CODES.ring:
    case SHAPE_CODES.outline: {
      const r = store.r[i];
      return [x - r, y - r, x + r, y + r];
    }
    case SHAPE_CODES.arc:
      return wedgeBounds(
        x,
        y,
        store.r[i],
        store.r[i] + store.h[i],
        store.a0[i],
        store.a1[i],
      );
    default: {
      const hw = store.w[i] / 2;
      const hh = store.h[i] / 2;
      return [x - hw, y - hh, x + hw, y + hh];
    }
  }
}

/**
 * The box of a ring wedge, not its whole circle: the four corners plus any
 * of 12, 3, 6 and 9 o'clock the span passes, on the outer radius. A clock
 * cell then fills a few grid cells instead of the whole ring's.
 */
export function wedgeBounds(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  a0: number,
  a1: number,
): [number, number, number, number] {
  if (a1 - a0 >= TAU) return [cx - outer, cy - outer, cx + outer, cy + outer];
  // Clockwise from 12 o'clock: x = sin, y = -cos.
  const xs = [
    inner * Math.sin(a0),
    inner * Math.sin(a1),
    outer * Math.sin(a0),
    outer * Math.sin(a1),
  ];
  const ys = [
    -inner * Math.cos(a0),
    -inner * Math.cos(a1),
    -outer * Math.cos(a0),
    -outer * Math.cos(a1),
  ];
  const start = ((a0 % TAU) + TAU) % TAU;
  const span = a1 - a0;
  for (let q = 0; q < 4; q++) {
    const angle = (q * Math.PI) / 2;
    if ((((angle - start) % TAU) + TAU) % TAU <= span) {
      xs.push(outer * Math.sin(angle));
      ys.push(-outer * Math.cos(angle));
    }
  }
  return [
    cx + Math.min(...xs),
    cy + Math.min(...ys),
    cx + Math.max(...xs),
    cy + Math.max(...ys),
  ];
}

function contains(
  store: MarkStore,
  i: number,
  wx: number,
  wy: number,
  tol: number,
): boolean {
  const dx = wx - store.x[i];
  const dy = wy - store.y[i];
  switch (store.shape[i]) {
    case SHAPE_CODES.dot:
    case SHAPE_CODES.ring:
    case SHAPE_CODES.outline:
      return Math.hypot(dx, dy) <= store.r[i] + tol;
    case SHAPE_CODES.arc: {
      const dist = Math.hypot(dx, dy);
      if (dist < store.r[i] - tol || dist > store.r[i] + store.h[i] + tol)
        return false;
      // Angles run clockwise from 12 o'clock, like the layouts'. Tolerance
      // widens the band radially only: the gaps between clock cells stay
      // gaps, so slop never picks the neighboring hour.
      const angle = Math.atan2(dx, -dy);
      const span = store.a1[i] - store.a0[i];
      const into = (((angle - store.a0[i]) % TAU) + TAU) % TAU;
      return span >= TAU || into <= span;
    }
    case SHAPE_CODES.poly: {
      // No slop: cells tile edge to edge, so slop would pick the neighbor.
      const pts = store.marks[i].pts;
      const w = store.w[i];
      const h = store.h[i];
      return !!pts && w > 0 && h > 0 && insidePoly(pts, dx / w, dy / h);
    }
    default:
      return (
        Math.abs(dx) <= store.w[i] / 2 + tol &&
        Math.abs(dy) <= store.h[i] / 2 + tol
      );
  }
}
