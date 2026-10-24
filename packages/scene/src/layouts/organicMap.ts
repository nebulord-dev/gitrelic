// Ownership's Organic map (docs/atlas-views.md › Ownership): the packages as
// a Voronoi treemap in a circle, one cell per package, its area by commits,
// colored by its top contributor and as strongly as their share (greyed
// toward --ghost when the package is shared, full at 75%+). A dashed outline
// marks a top contributor who went quiet. Cells are `dir:` marks, so they
// travel from Coupling, Churn and AI & Co-authors.
//
// The layout is seeded, so a repo's map keeps its shape between visits.
// Labels sit at each cell's centroid and are left off where they wouldn't fit
// across it; the tooltip names every package.
//
// Selecting a person dims the packages they don't top.

import {
  ownershipMapOf,
  surname,
  type MapPackage,
  type OwnershipMap,
} from '../ownership/map';
import { ringNames } from './boundaries';
import {
  circlePolygon,
  insetPolygon,
  polygonCentroid,
  voronoiTreemap,
  type Point,
} from './voronoiTreemap';
import type { EntityId } from '../ids';
import type {
  ColorRole,
  Guide,
  Mark,
  Paint,
  Scene,
  ViewInput,
  Viewport,
} from '../model';

export const MAP_SEED = 11;
/** The gap between cells, world units. */
const GAP = 1.5;
/** Faint, but over the label layer's floor (0.5): dimmed cells keep names. */
const DIM = 0.55;
const LABEL_PX = 7; // a label character's width, roughly, at 12px
const SUB_PX = 6;
const zero = { r: 0, a0: 0, a1: 0 };

/** Color strength by the top contributor's share: 30% and under faint, 75%+ full. */
export function strength(topShare: number): number {
  return Math.max(0.3, Math.min(1, 0.3 + ((topShare - 25) / 50) * 0.7));
}

export function ownerPaint(map: OwnershipMap, p: MapPackage): Paint {
  const slot = map.people.get(p.shares[0].email)?.slot;
  if (slot == null) return '--ghost';
  return {
    mix: ['--ghost', `--owner-${slot}` as ColorRole],
    t: strength(p.topShare),
  };
}

/** The tooltip: path, size, the top four shares, and its flags. */
export function ownershipTip(map: OwnershipMap, p: MapPackage): string[] {
  const lines = [
    p.dir,
    `${p.commits.toLocaleString('en-US')} commits · ${p.shares.length} ${p.shares.length === 1 ? 'person' : 'people'}`,
  ];
  for (const s of p.shares.slice(0, 4)) {
    const who = map.people.get(s.email);
    lines.push(
      `${who?.name ?? s.email}${who?.quiet ? ' (quiet)' : ''}: ${Math.round((100 * s.commits) / p.commits)}%`,
    );
  }
  if (p.onePerson) lines.push('Rests on one person');
  if (!p.owner) lines.push('Shared: nobody above 30%');
  if (p.topQuiet) lines.push('Top contributor quiet 90+ days');
  return lines;
}

/** The map's cells in a unit circle at the origin, once per report. */
const UNIT_CLIP = circlePolygon(0, 0, 1, 96);
const unitCells = new WeakMap<OwnershipMap, Point[][]>();

/**
 * The cells for a circle of radius `r` at (`cx`, `cy`). The treemap depends
 * only on the weights and the clip, and scales with it, so it's computed once
 * in a unit circle and scaled: a resize or a person's click (which rebuilds
 * the scene) doesn't rerun its iterations, which are slow for hundreds of
 * packages.
 */
function mapCells(
  map: OwnershipMap,
  cx: number,
  cy: number,
  r: number,
): Point[][] {
  let unit = unitCells.get(map);
  if (!unit) {
    unit = voronoiTreemap(
      map.drawn.map((p) => p.commits),
      UNIT_CLIP,
      { seed: MAP_SEED },
    );
    unitCells.set(map, unit);
  }
  return unit.map((cell) =>
    cell.map(([x, y]) => [cx + r * x, cy + r * y] as const),
  );
}

/** Width of the cell across `y`, the room a label has there. */
function chordAt(cell: readonly Point[], y: number): number {
  const xs: number[] = [];
  for (let i = 0; i < cell.length; i++) {
    const [x1, y1] = cell[i];
    const [x2, y2] = cell[(i + 1) % cell.length];
    if ((y1 - y) * (y2 - y) < 0)
      xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
  }
  return xs.length >= 2 ? Math.max(...xs) - Math.min(...xs) : 0;
}

function emptyMap(message: string, viewport: Viewport): Scene {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const guides: Guide[] = [
    {
      id: 'empty',
      kind: 'text',
      x: cx,
      y: cy,
      text: message,
      paint: '--muted',
      alpha: 1,
    },
  ];
  return {
    marks: [],
    links: [],
    guides,
    bounds: { x: cx - 240, y: cy - 40, w: 480, h: 80 },
  };
}

export function organicMapScene(input: ViewInput, viewport: Viewport): Scene {
  const map = ownershipMapOf(input.report);
  if (map.noData)
    return emptyMap('Rerun gitrelic to see who owns what.', viewport);
  if (map.packages.length === 0)
    return emptyMap(
      'No package has 10 or more commits in this window.',
      viewport,
    );

  const R = Math.max(120, Math.min(viewport.width, viewport.height) / 2 - 40);
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const cells = mapCells(map, cx, cy, R);
  const names = ringNames(map.drawn.map((p) => p.dir));
  const focus: EntityId | null = input.focus ?? null;
  const focusEmail = focus?.startsWith('person:')
    ? focus.slice('person:'.length)
    : null;

  const marks: Mark[] = [];
  map.drawn.forEach((p, i) => {
    const raw = cells[i];
    if (!raw || raw.length < 3) return;
    const cell = insetPolygon(raw, GAP);
    const poly = cell.length >= 3 ? cell : raw;
    const [x, y] = polygonCentroid(poly);
    const w = 2 * Math.max(...poly.map((q) => Math.abs(q[0] - x)), 0.5);
    const h = 2 * Math.max(...poly.map((q) => Math.abs(q[1] - y)), 0.5);
    const pts = poly.flatMap((q) => [(q[0] - x) / w, (q[1] - y) / h]);
    const top = map.people.get(p.shares[0].email);
    const dim = focusEmail !== null && p.shares[0].email !== focusEmail;
    const alpha = dim ? DIM : 1;
    const tip = ownershipTip(map, p);

    const name = names.get(p.dir)!;
    const sub = `${surname(top?.name ?? '')} ${p.topShare}%`;
    const room = Math.min(chordAt(poly, y - 8), chordAt(poly, y + 10)) - 10;
    const ys = poly.map((q) => q[1]);
    // Room down the cell: twice the distance from the centroid to the nearer of its top and bottom.
    const tall = 2 * Math.min(y - Math.min(...ys), Math.max(...ys) - y);
    const fits = name.length * LABEL_PX <= room && tall >= 20;

    marks.push({
      id: p.id,
      shape: 'poly',
      paint: ownerPaint(map, p),
      x,
      y,
      w,
      h,
      ...zero,
      alpha,
      pts,
      tip,
      ...(fits && {
        label: name,
        labelAnchor: 'center' as const,
        labelClass: 'atlas-label--on-cell',
        labelPriority: p.commits,
        ...(sub.length * SUB_PX <= room && tall >= 40 && { labelSub: sub }),
      }),
    });
    if (p.topQuiet)
      marks.push({
        id: `quiet:${p.dir}`,
        shape: 'poly',
        edge: 'dashed',
        paint: '--text',
        x,
        y,
        w,
        h,
        ...zero,
        alpha: alpha * 0.9,
        pts,
        tip,
        selects: p.id,
        parent: p.id,
        z: 1,
      });
  });

  const guides: Guide[] = [
    {
      id: 'map-rim',
      kind: 'circle',
      x: cx,
      y: cy,
      r: R + 4,
      paint: '--muted',
      alpha: 0.25,
    },
  ];
  return {
    marks,
    links: [],
    guides,
    bounds: { x: cx - R - 10, y: cy - R - 10, w: 2 * R + 20, h: 2 * R + 20 },
  };
}
