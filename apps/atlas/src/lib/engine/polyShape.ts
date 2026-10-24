// A `poly` mark's geometry: its `pts` (x,y pairs from −0.5 to 0.5) are
// stretched over the mark's `w × h` box around `x,y`, so the tween engine
// animates the box and the polygon follows (grows from its parent, shrinks
// into it) without vertex data of its own.

/** The polygon in world units, flat x,y pairs (Pixi's `poly` takes these). */
export function polyWorld(
  pts: readonly number[],
  x: number,
  y: number,
  w: number,
  h: number,
): number[] {
  const out = new Array<number>(pts.length);
  for (let k = 0; k < pts.length; k += 2) {
    out[k] = x + pts[k] * w;
    out[k + 1] = y + pts[k + 1] * h;
  }
  return out;
}

/**
 * Whether box-relative point `u,v` (each −0.5 to 0.5) is inside the
 * polygon: even-odd ray casting, so either winding works. Stretching is
 * affine, so testing in the box's units gives the world's answer.
 */
export function insidePoly(
  pts: readonly number[],
  u: number,
  v: number,
): boolean {
  let inside = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2];
    const yi = pts[i * 2 + 1];
    const xj = pts[j * 2];
    const yj = pts[j * 2 + 1];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

/**
 * Dashes along a closed polygon's outline: segments as x0,y0,x1,y1 runs,
 * `dash` long with `dash` gaps, carried across corners so the pattern
 * doesn't restart at every vertex.
 */
export function polyDashes(world: readonly number[], dash: number): number[] {
  const out: number[] = [];
  if (dash <= 0) return out;
  const n = world.length / 2;
  let along = 0; // distance into the current dash-and-gap period
  for (let i = 0; i < n; i++) {
    const x0 = world[i * 2];
    const y0 = world[i * 2 + 1];
    const x1 = world[((i + 1) % n) * 2];
    const y1 = world[((i + 1) % n) * 2 + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    let t = 0;
    while (t < len) {
      const inDash = along < dash;
      const step = Math.min(len - t, (inDash ? dash : 2 * dash) - along);
      if (inDash) {
        const a = t / len;
        const b = (t + step) / len;
        out.push(
          x0 + (x1 - x0) * a,
          y0 + (y1 - y0) * a,
          x0 + (x1 - x0) * b,
          y0 + (y1 - y0) * b,
        );
      }
      t += step;
      along = (along + step) % (2 * dash);
    }
  }
  return out;
}
