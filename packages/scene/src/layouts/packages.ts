// Hotspots by package (docs/atlas-views.md › Hotspots, alternate form): each
// package is a circle, its files dots in a sunflower with the hottest at the
// centre, so where heat concentrates reads at a glance — a small package full
// of hot files against a big one with none.
//
// Packages are the directories `packageOf` names; files at the root gather in
// the repo's own circle. Circles are packed on a spiral, biggest first, and
// the scene's bounds wrap whatever that produces (the stage fits it).

import { packageOf, type HotspotPoint } from '../hotspots/points';
import { ids, REPO_ID, type EntityId } from '../ids';
import type { Mark, Scene, Viewport } from '../model';

const RAMP = ['--risk-0', '--risk-1', '--risk-2', '--risk-3'] as const;
const DOT_R = [1.8, 2.8, 3.6, 4.6] as const;
/** Distance between neighbouring dots in a sunflower, world units. */
const SPACING = 7;
const GAP = 14;
const MARGIN = 32;
/** Room above the top circles for their names. */
const LABEL_ROOM_Y = 28;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/**
 * Most a small repo's packing is spread out to fill the stage. The stage
 * never zooms past 1:1 (dots would balloon), so the layout uses the room
 * itself; dots grow only by the square root, so they stay dots.
 */
export const PACKAGES_MAX_GROW = 3;

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

interface Circle {
  pkg: string;
  files: HotspotPoint[];
  hot: number;
  r: number;
  x: number;
  y: number;
}

export function packagesScene(
  points: readonly HotspotPoint[],
  viewport: Viewport,
): Scene {
  const byPkg = new Map<string, HotspotPoint[]>();
  // Points arrive hottest first, so each package's list is too.
  for (const p of points) {
    const pkg = packageOf(p.file);
    const list = byPkg.get(pkg);
    if (list) list.push(p);
    else byPkg.set(pkg, [p]);
  }

  const circles: Circle[] = [...byPkg]
    .map(([pkg, files]) => ({
      pkg,
      files,
      hot: files.filter((f) => f.tier > 0).length,
      r: SPACING * Math.sqrt(files.length) + 8,
      x: 0,
      y: 0,
    }))
    .sort((a, b) => b.r - a.r || (a.pkg < b.pkg ? -1 : 1));
  pack(circles);

  const raw = boundsOf(circles);
  const grow =
    raw.w > 0 && raw.h > 0
      ? Math.min(
          PACKAGES_MAX_GROW,
          Math.max(
            1,
            Math.min(viewport.width / raw.w, viewport.height / raw.h),
          ),
        )
      : 1;
  for (const c of circles) {
    c.x *= grow;
    c.y *= grow;
    c.r *= grow;
  }
  const spacing = SPACING * grow;
  const dotGrow = Math.sqrt(grow);

  const marks: Mark[] = [];
  for (const c of circles) {
    const id: EntityId = c.pkg ? ids.dir(c.pkg) : REPO_ID;
    const name = c.pkg ? c.pkg.replace(/^packages\//, '') : '(root files)';
    marks.push({
      id,
      // A faint disc, not a ring: the ring sprite's stroke grows with its
      // radius, and a package circle is hundreds of units across.
      shape: 'dot',
      paint: c.hot > 0 ? '--dir' : '--ghost',
      x: c.x,
      y: c.y,
      r: c.r,
      w: 0,
      h: 0,
      a0: 0,
      a1: 0,
      alpha: c.hot > 0 ? 0.1 : 0.06,
    });
    // The name rides on a label-only card above the disc: the label layer
    // skips marks as faint as the disc. `package:` isn't an entity kind, so
    // clicking the name selects nothing; clicking the disc selects the dir.
    marks.push({
      id: `package:${c.pkg}`,
      shape: 'card',
      paint: '--muted',
      x: c.x,
      y: c.y - c.r - 10,
      r: 0,
      w: 0,
      h: 0,
      a0: 0,
      a1: 0,
      alpha: 1,
      parent: id,
      label:
        c.hot > 0 ? `${name} · ${c.hot} of ${c.files.length} at 25+` : name,
      labelPriority: 500 + c.hot * 10 + Math.log2(c.files.length),
      labelAnchor: 'center',
    });
    c.files.forEach((f, k) => {
      const d = spacing * Math.sqrt(k);
      const a = k * GOLDEN;
      marks.push({
        id: ids.file(f.file),
        shape: 'dot',
        paint: RAMP[f.tier],
        x: c.x + d * Math.cos(a),
        y: c.y + d * Math.sin(a),
        r: DOT_R[f.tier] * dotGrow,
        w: 0,
        h: 0,
        a0: 0,
        a1: 0,
        alpha: f.tier > 0 ? 1 : 0.55,
        // Only warm files claim label space; the package names come first.
        ...(f.tier > 0
          ? { label: baseName(f.file), labelPriority: f.score }
          : {}),
        z: f.tier + 1,
      });
    });
  }

  return { marks, links: [], guides: [], bounds: boundsOf(circles) };
}

/**
 * Places each circle at the first point on an outward spiral where it
 * touches none already placed. Biggest first, so the small ones fill in
 * around them. Deterministic: same input, same picture.
 */
function pack(circles: Circle[]): void {
  const placed: Circle[] = [];
  for (const c of circles) {
    if (placed.length === 0) {
      placed.push(c);
      continue;
    }
    for (let t = 0; ; t += 0.04) {
      const rad = 3 * t;
      const x = rad * Math.cos(t);
      const y = rad * Math.sin(t);
      if (
        placed.every((p) => Math.hypot(p.x - x, p.y - y) >= p.r + c.r + GAP)
      ) {
        c.x = x;
        c.y = y;
        placed.push(c);
        break;
      }
    }
  }
}

function boundsOf(circles: readonly Circle[]) {
  if (circles.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of circles) {
    x0 = Math.min(x0, c.x - c.r);
    y0 = Math.min(y0, c.y - c.r);
    x1 = Math.max(x1, c.x + c.r);
    y1 = Math.max(y1, c.y + c.r);
  }
  return {
    x: x0 - MARGIN,
    y: y0 - MARGIN - LABEL_ROOM_Y,
    w: x1 - x0 + 2 * MARGIN,
    h: y1 - y0 + 2 * MARGIN + LABEL_ROOM_Y,
  };
}
