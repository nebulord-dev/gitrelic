// Hotspots by package (docs/atlas-views.md › Hotspots, alternate form): each
// package is a circle, its files dots in a sunflower with the hottest at the
// centre, so where heat concentrates reads at a glance — a small package full
// of hot files against a big one with none.
//
// Packages are the directories `packageOf` names; files at the root gather in
// the repo's own circle. The biggest packages are drawn, plus any smaller
// one with several hot files; the rest are summed up in a note below, and
// their files stay in the table. Circles stand in columns, biggest first,
// each under its two-line heading (name, then files and how many score 25+)
// and each column at least as wide as its headings, so no heading can land
// on a neighbour. The scene's bounds wrap whatever that produces (the stage
// fits it). A selected package is outlined.

import { distinctNames } from '../format/distinctNames';
import { hotspotTip, packageOf, type HotspotPoint } from '../hotspots/points';
import { ids, REPO_ID, type EntityId } from '../ids';
import type { Guide, Mark, Scene, Viewport } from '../model';

const RAMP = ['--risk-0', '--risk-1', '--risk-2', '--risk-3'] as const;
const DOT_R = [1.8, 2.8, 3.6, 4.6] as const;
/** Distance between neighbouring dots in a sunflower, world units. */
const SPACING = 7;
const MARGIN = 32;
/** Room above each circle for its two-line heading, world units. */
const HEAD_H = 44;
/**
 * A heading character's width in world units: a little over its width on
 * screen (enough for a stage zoomed out to 0.6), so headings still clear
 * each other when the stage zooms out to fit.
 */
const NAME_CHAR = 13;
const STATS_CHAR = 11;
const COL_GAP = 32;
const ROW_GAP = 20;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
/**
 * Most a small repo's packing is spread out to fill the stage. The stage
 * never zooms past 1:1 (dots would balloon), so the layout uses the room
 * itself; dots grow only by the square root, so they stay dots.
 */
export const PACKAGES_MAX_GROW = 3;
/**
 * Most file dots drawn. Past it, every package keeps its warm files and a
 * proportional share of its hottest cool files; circles
 * stay sized by the true count, so the picture's proportions don't change.
 */
export const PACKAGES_DOT_CAP = 3000;
/** Packages drawn by size; smaller ones join only when they run hot. */
export const PACKAGES_SHOWN = 10;
/** A smaller package with this many files at 25+ is drawn anyway. */
export const PACKAGES_HOT_MIN = 3;

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

interface Circle {
  pkg: string;
  files: HotspotPoint[];
  hot: number;
  r: number;
  x: number;
  y: number;
}

const n = (v: number) => v.toLocaleString('en-US');
const plural = (k: number, one: string) =>
  `${n(k)} ${one}${k === 1 ? '' : 's'}`;

export function packagesScene(
  allPoints: readonly HotspotPoint[],
  viewport: Viewport,
  focus?: EntityId | null,
): Scene {
  const byPkg = new Map<string, HotspotPoint[]>();
  // Points arrive hottest first, so each package's list is too.
  for (const p of allPoints) {
    const pkg = packageOf(p.file);
    const list = byPkg.get(pkg);
    if (list) list.push(p);
    else byPkg.set(pkg, [p]);
  }

  const all: Circle[] = [...byPkg]
    .map(([pkg, files]) => ({
      pkg,
      files,
      hot: files.filter((f) => f.tier > 0).length,
      r: SPACING * Math.sqrt(files.length) + 8,
      x: 0,
      y: 0,
    }))
    .sort((a, b) => b.r - a.r || (a.pkg < b.pkg ? -1 : 1));
  const circles = all.filter(
    (c, i) => i < PACKAGES_SHOWN || c.hot >= PACKAGES_HOT_MIN,
  );
  const hidden = all.filter((c) => !circles.includes(c));
  const points = circles.flatMap((c) => c.files);
  arrange(circles, viewport.width / viewport.height);

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

  // Which files get a dot: all of them, or under the cap every warm file
  // and the same share of each package's cool ones.
  const warmTotal = points.filter((p) => p.tier > 0).length;
  const coolTotal = points.length - warmTotal;
  const coolShare =
    points.length <= PACKAGES_DOT_CAP || coolTotal === 0
      ? 1
      : Math.max(0, (PACKAGES_DOT_CAP - warmTotal) / coolTotal);
  const drawnOf = (c: Circle) => {
    const cool = c.files.length - c.hot;
    // Files are hottest first, so the warm ones lead the list.
    return c.files.slice(0, c.hot + Math.ceil(cool * coolShare));
  };
  const names = distinctNames(
    points.filter((p) => p.tier > 0).map((p) => p.file),
  );

  const marks: Mark[] = [];
  const guides: Guide[] = [];
  // A file without a dot is held by its package's disc.
  const standIns = new Map<EntityId, string>();
  for (const c of circles) {
    const id: EntityId = c.pkg ? ids.dir(c.pkg) : REPO_ID;
    const { name, stats } = headingOf(c);
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
      tip: [
        c.pkg ? `${c.pkg}/` : '(root files)',
        stats,
        `Hottest: ${baseName(c.files[0].file)} (${c.files[0].score})`,
      ],
    });
    // The heading rides on a label-only card above the disc (the label
    // layer skips marks as faint as the disc): the name, with the stats as
    // its second line, so the two are never split by culling. `package:`
    // isn't an entity kind, so clicking a heading selects nothing; clicking
    // the disc selects the dir. Headings outrank every file name.
    marks.push(
      heading(`package:${c.pkg}`, id, c.x, c.y - c.r - 6, name, stats),
    );
    if (focus === id)
      guides.push({
        id: `selected:${c.pkg}`,
        kind: 'circle',
        x: c.x,
        y: c.y,
        r: c.r + 3,
        paint: '--accent',
        alpha: 1,
      });
    const drawn = drawnOf(c);
    for (const f of c.files.slice(drawn.length))
      standIns.set(ids.file(f.file), id);
    // Fewer dots than files spread out to fill the same circle.
    const step =
      spacing * Math.sqrt(c.files.length / Math.max(1, drawn.length));
    drawn.forEach((f, k) => {
      const d = step * Math.sqrt(k);
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
          ? {
              label: names.get(f.file) ?? baseName(f.file),
              labelPriority: f.score,
            }
          : {}),
        z: f.tier + 1,
        tip: hotspotTip(f, names.get(f.file) ?? baseName(f.file)),
      });
    });
  }

  const bounds = boundsOf(circles, true);
  if (hidden.length > 0) {
    // What the note can't leave out: critical files in the packages it hides.
    const critical = hidden.filter((c) => c.files.some((f) => f.tier === 3));
    const files = hidden.reduce((sum, c) => sum + c.files.length, 0);
    let note = `+${plural(hidden.length, 'more package')} · ${plural(files, 'file')}`;
    if (critical.length > 0) {
      const count = critical.reduce(
        (sum, c) => sum + c.files.filter((f) => f.tier === 3).length,
        0,
      );
      const named = critical
        .slice(0, 2)
        .map((c) => c.pkg.replace(/^packages\//, '') || '(root files)');
      note += ` · ${n(count)} critical (${named.join(', ')}${critical.length > 2 ? '…' : ''})`;
    }
    note += ' · in the table (T)';
    bounds.h += 28;
    marks.push({
      id: 'package-more',
      shape: 'card',
      paint: '--muted',
      x: bounds.x + MARGIN,
      y: bounds.y + bounds.h - 20,
      r: 0,
      w: 0,
      h: 0,
      a0: 0,
      a1: 0,
      alpha: 1,
      label: note,
      labelPriority: 1999,
    });
  }

  return { marks, links: [], guides, bounds, standIns };
}

function heading(
  id: string,
  parent: EntityId,
  x: number,
  y: number,
  label: string,
  labelSub: string,
): Mark {
  return {
    id,
    shape: 'card',
    paint: '--muted',
    x,
    y,
    r: 0,
    w: 0,
    h: 0,
    a0: 0,
    a1: 0,
    alpha: 1,
    parent,
    label,
    labelSub,
    labelPriority: 2000,
    labelAnchor: 'above',
  };
}

function headingOf(c: Circle): { name: string; stats: string } {
  return {
    name: c.pkg ? c.pkg.replace(/^packages\//, '') : '(root files)',
    stats: `${plural(c.files.length, 'file')} · ${c.hot > 0 ? n(c.hot) : 'none'} at 25+`,
  };
}

/**
 * Stands the circles (biggest first) in columns, filling each top to bottom
 * up to a height that gives the whole roughly the stage's `aspect`; a column
 * is as wide as its widest circle or heading, and its stack is centred
 * vertically. Linear and deterministic: same input, same picture.
 */
function arrange(circles: Circle[], aspect: number): void {
  const items = circles.map((c) => ({
    c,
    w: Math.max(2 * c.r, headingWidth(c)),
    h: HEAD_H + 2 * c.r,
  }));
  if (items.length === 0) return;
  let area = 0;
  for (const it of items) area += (it.w + COL_GAP) * (it.h + ROW_GAP);
  const height = Math.max(items[0].h, Math.sqrt(area / aspect));

  const columns: { items: typeof items; w: number; h: number }[] = [];
  for (const it of items) {
    const col = columns[columns.length - 1];
    if (col && col.h + ROW_GAP + it.h <= height) {
      col.items.push(it);
      col.h += ROW_GAP + it.h;
      col.w = Math.max(col.w, it.w);
    } else columns.push({ items: [it], w: it.w, h: it.h });
  }
  let x = 0;
  for (const col of columns) {
    let y = (height - col.h) / 2;
    for (const it of col.items) {
      it.c.x = x + col.w / 2;
      it.c.y = y + HEAD_H + it.c.r;
      y += it.h + ROW_GAP;
    }
    x += col.w + COL_GAP;
  }
}

/** A heading's width in world units, allowing for the stage at 0.6. */
function headingWidth(c: Circle): number {
  const { name, stats } = headingOf(c);
  return Math.max(name.length * NAME_CHAR, stats.length * STATS_CHAR);
}

/**
 * The circles' extent plus the margin and heading room. With `headings`,
 * also each heading's width (centred on its circle): an edge column's
 * heading can be wider than its circle, and the stage fits these bounds.
 * Headings are screen-sized, so they don't count toward the grow factor.
 */
function boundsOf(circles: readonly Circle[], headings = false) {
  if (circles.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of circles) {
    const half = headings ? Math.max(c.r, headingWidth(c) / 2) : c.r;
    x0 = Math.min(x0, c.x - half);
    y0 = Math.min(y0, c.y - c.r);
    x1 = Math.max(x1, c.x + half);
    y1 = Math.max(y1, c.y + c.r);
  }
  return {
    x: x0 - MARGIN,
    y: y0 - MARGIN - HEAD_H,
    w: x1 - x0 + 2 * MARGIN,
    h: y1 - y0 + 2 * MARGIN + HEAD_H,
  };
}
