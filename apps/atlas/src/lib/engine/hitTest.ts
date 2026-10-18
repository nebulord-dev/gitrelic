// What's under the pointer, in world coordinates. Marks go into a uniform
// grid by bounding box, so a lookup only runs exact tests on the few marks
// near the point. Marks move while tweening, so the stage rebuilds the grid
// lazily — on the first pointer query after anything changed.

import { SHAPE_CODES, type MarkStore } from './markStore';
import type { EntityId, LiveLink } from '@gitrelic/scene';

const TAU = Math.PI * 2;
/** Nearly invisible marks (fading out) can't be picked. */
const MIN_ALPHA = 0.05;

export class HitTester {
  private grid = new Map<string, number[]>();

  constructor(private readonly cell = 32) {}

  build(store: MarkStore): void {
    this.grid.clear();
    for (let i = 0; i < store.count; i++) {
      const [hw, hh] = halfExtent(store, i);
      const x0 = Math.floor((store.x[i] - hw) / this.cell);
      const x1 = Math.floor((store.x[i] + hw) / this.cell);
      const y0 = Math.floor((store.y[i] - hh) / this.cell);
      const y1 = Math.floor((store.y[i] + hh) / this.cell);
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
   * The topmost mark at (wx, wy): highest `z`, then the later slot (drawn
   * later). `tolerance` widens every shape, in world units, for touch.
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
    let bestZ = -Infinity;
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        for (const i of this.grid.get(`${gx},${gy}`) ?? []) {
          if (i >= store.count || store.alpha[i] < MIN_ALPHA) continue;
          if (!contains(store, i, wx, wy, tolerance)) continue;
          const z = store.marks[i].z ?? 0;
          if (z > bestZ || (z === bestZ && i > best)) {
            best = i;
            bestZ = z;
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
    const x1 = store.x[s];
    const y1 = store.y[s];
    const x2 = x1 + (store.x[t] - x1) * link.progress;
    const y2 = y1 + (store.y[t] - y1) * link.progress;
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

function halfExtent(store: MarkStore, i: number): [number, number] {
  switch (store.shape[i]) {
    case SHAPE_CODES.dot:
    case SHAPE_CODES.ring:
      return [store.r[i], store.r[i]];
    case SHAPE_CODES.arc:
      return [store.r[i] + store.h[i], store.r[i] + store.h[i]];
    default:
      return [store.w[i] / 2, store.h[i] / 2];
  }
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
      return Math.hypot(dx, dy) <= store.r[i] + tol;
    case SHAPE_CODES.arc: {
      const dist = Math.hypot(dx, dy);
      if (dist < store.r[i] - tol || dist > store.r[i] + store.h[i] + tol)
        return false;
      // Angles run clockwise from 12 o'clock, like the layouts'.
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
