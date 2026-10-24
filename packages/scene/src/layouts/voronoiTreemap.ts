// A Voronoi treemap (one level): a convex shape split into one cell per
// weight, each cell's area proportional to its weight. Cells are a power
// diagram (a Voronoi diagram where each site has a weight), so every cell is
// the clip cut by one straight line per other site; sites move to their
// cells' centroids and weights grow or shrink toward each cell's target area
// until the areas are close (Nocaj & Brandes, "Computing Voronoi Treemaps",
// 2012). Pure and seeded, so the same weights always give the same picture.

export type Point = readonly [number, number];

export interface VoronoiTreemapOptions {
  /** Seeds where the sites start. The same seed gives the same cells. */
  seed: number;
  /** Stop once the area error (a share of the clip) is under this. */
  tolerance?: number;
  maxIterations?: number;
}

/** Shoelace area; positive for the winding `circlePolygon` uses. */
export function polygonArea(poly: readonly Point[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

export function polygonCentroid(poly: readonly Point[]): Point {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    const cross = x1 * y2 - x2 * y1;
    a += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(a) < 1e-12) return poly[0] ?? [0, 0];
  return [cx / (3 * a), cy / (3 * a)];
}

/** A circle as an `n`-gon, wound so `polygonArea` is positive. */
export function circlePolygon(
  cx: number,
  cy: number,
  r: number,
  n: number,
): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as const;
  });
}

/** Keeps the part of a convex polygon where `a·x + b·y ≤ c` (Sutherland–Hodgman, one edge). */
function clipHalfPlane(
  poly: readonly Point[],
  a: number,
  b: number,
  c: number,
): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const fp = a * p[0] + b * p[1] - c;
    const fq = a * q[0] + b * q[1] - c;
    if (fp <= 0) out.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  }
  return out;
}

/** Each site's power cell within the clip. */
function powerCells(
  sites: Point[],
  weights: number[],
  clip: readonly Point[],
): Point[][] {
  return sites.map((s, i) => {
    let cell: Point[] = [...clip];
    for (let j = 0; j < sites.length && cell.length > 0; j++) {
      if (j === i) continue;
      const t = sites[j];
      // |p − s|² − wᵢ ≤ |p − t|² − wⱼ, which is linear in p.
      cell = clipHalfPlane(
        cell,
        2 * (t[0] - s[0]),
        2 * (t[1] - s[1]),
        t[0] * t[0] +
          t[1] * t[1] -
          s[0] * s[0] -
          s[1] * s[1] -
          weights[j] +
          weights[i],
      );
    }
    return cell.length >= 3 ? cell : [];
  });
}

/** mulberry32: a small seeded PRNG. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bbox(poly: readonly Point[]) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
}

function insideConvex(p: Point, poly: readonly Point[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    if ((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax) < 0) return false;
  }
  return true;
}

/**
 * One cell per weight, in input order, splitting the convex `clip` (wound so
 * `polygonArea` is positive) in proportion to the weights.
 */
export function voronoiTreemap(
  values: readonly number[],
  clip: readonly Point[],
  { seed, tolerance = 0.01, maxIterations = 200 }: VoronoiTreemapOptions,
): Point[][] {
  const n = values.length;
  if (n === 0) return [];
  if (n === 1) return [[...clip]];

  const area = polygonArea(clip);
  const total = values.reduce((a, b) => a + b, 0);
  // All-zero weights split the clip evenly.
  const target = values.map((v) => (total > 0 ? (area * v) / total : area / n));
  const rand = random(seed);
  const box = bbox(clip);
  const sites: Point[] = [];
  while (sites.length < n) {
    const p: Point = [
      box.x0 + rand() * (box.x1 - box.x0),
      box.y0 + rand() * (box.y1 - box.y0),
    ];
    if (insideConvex(p, clip)) sites.push(p);
  }
  // Every site starts with the same weight (an ordinary Voronoi diagram), on
  // the scale of a cell's area so the multiplicative steps below have room.
  const weights = new Array<number>(n).fill(area / n / 2);

  let cells = powerCells(sites, weights, clip);
  for (let iter = 0; iter < maxIterations; iter++) {
    const areas = cells.map((c) => (c.length ? polygonArea(c) : 0));
    const error =
      areas.reduce((e, a, i) => e + Math.abs(a - target[i]), 0) / area;
    if (error < tolerance) break;

    for (let i = 0; i < n; i++) {
      if (cells[i].length) sites[i] = polygonCentroid(cells[i]);
      // Grow a cell that's too small, shrink one that's too big; a lost cell
      // (no area) gets its weight back up from nothing.
      const ratio = areas[i] > 0 ? target[i] / areas[i] : 2;
      weights[i] = Math.max(
        weights[i] * Math.min(2, Math.max(0.5, ratio)),
        1e-9,
      );
    }
    // A site whose weight exceeds a neighbor's by more than their squared
    // distance swallows that neighbor's site, and with it the whole cell:
    // cap it just under that.
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const d2 =
          (sites[i][0] - sites[j][0]) ** 2 + (sites[i][1] - sites[j][1]) ** 2;
        if (weights[i] > weights[j] + d2) weights[i] = weights[j] + d2 * 0.999;
      }
    }
    cells = powerCells(sites, weights, clip);
  }
  return cells;
}

/**
 * A convex polygon (wound as `circlePolygon`) with every edge moved `d`
 * inward: the gap between neighboring cells. Empty when it's too thin.
 */
export function insetPolygon(poly: readonly Point[], d: number): Point[] {
  let out: Point[] = [...poly];
  for (let i = 0; i < poly.length && out.length > 0; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % poly.length];
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    // The inside is to the left of each edge: keep n·p ≥ n·a + d, n its left normal.
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    out = clipHalfPlane(out, -nx, -ny, -(nx * ax + ny * ay) - d);
  }
  return out.length >= 3 ? out : [];
}
