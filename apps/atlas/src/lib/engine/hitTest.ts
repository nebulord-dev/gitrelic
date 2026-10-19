// What's under the pointer, in world coordinates. Marks go into a uniform
// grid by bounding box, so a lookup only runs exact tests on the few marks
// near the point. Marks move while tweening, so the stage rebuilds the grid
// lazily — on the first pointer query after anything changed.

import { SHAPE_CODES, type MarkStore } from './markStore';
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
 * of the straight segment between its endpoints. Curves are hit-tested as
 * their chord, which is close enough for the gentle arcs the layouts draw.
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
    // Edge to edge, as linkGeometry draws it.
    const dx = store.x[t] - store.x[s];
    const dy = store.y[t] - store.y[s];
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    const u0 = store.r[s] / len;
    const u1 = u0 + (1 - store.r[t] / len - u0) * link.progress;
    if (u1 <= u0) continue;
    const x1 = store.x[s] + dx * u0;
    const y1 = store.y[s] + dy * u0;
    const x2 = store.x[s] + dx * u1;
    const y2 = store.y[s] + dy * u1;
    const d = segmentDistance(wx, wy, x1, y1, x2, y2) - link.width / 2;
    if (d <= tolerance && d < bestDist) {
      best = link.id;
      bestDist = d;
    }
  }
  return best;
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
      // gaps, so slop never picks the neighbouring hour.
      const angle = Math.atan2(dx, -dy);
      const span = store.a1[i] - store.a0[i];
      const into = (((angle - store.a0[i]) % TAU) + TAU) % TAU;
      return span >= TAU || into <= span;
    }
    default:
      return (
        Math.abs(dx) <= store.w[i] / 2 + tol &&
        Math.abs(dy) <= store.h[i] / 2 + tol
      );
  }
}
