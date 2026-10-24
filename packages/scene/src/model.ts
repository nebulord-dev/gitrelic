// The scene model: what a layout produces and the renderer draws. Layouts are
// pure functions of (input, viewport) → Scene; nothing here knows about Pixi,
// the DOM, or which theme is active.

import type { CommitLike } from './commits/commitLike';
import type { EntityIndex } from './entities';
import type { EntityId, EntityKind } from './ids';
import type { ThemeToken } from './theme/tokens';
import type { GitrelicReport } from '@gitrelic/core';

/** Theme roles a mark, link or guide may be painted with. */
export const COLOR_ROLES = [
  '--accent',
  '--text',
  '--soft',
  '--muted',
  '--person',
  '--file',
  '--dir',
  '--ghost',
  '--link',
  '--link-hot',
  '--cell-base',
  '--risk-0',
  '--risk-1',
  '--risk-2',
  '--risk-3',
  '--owner-0',
  '--owner-1',
  '--owner-2',
  '--owner-3',
  '--owner-4',
  '--owner-5',
] as const satisfies readonly ThemeToken[];
export type ColorRole = (typeof COLOR_ROLES)[number];

/**
 * A role, or a blend of two (`t` = 0 is all `mix[0]`). Resolved to RGB by the
 * renderer, so a theme switch re-tints without rebuilding the scene.
 */
export type Paint =
  | ColorRole
  | { mix: readonly [ColorRole, ColorRole]; t: number };

/**
 * `ring`'s stroke scales with its radius (a small marker ring); `outline` is
 * the same circle with a thin stroke, for a large one (the Overview's repo).
 * `poly` is a convex polygon (`Mark.pts`) stretched over its `w × h` box: a
 * Voronoi cell.
 */
export type MarkShape =
  | 'dot'
  | 'ring'
  | 'outline'
  | 'arc'
  | 'bar'
  | 'card'
  | 'poly';

/**
 * Every animatable number a mark has. One flat record for all shapes, so the
 * tween engine interpolates any mark the same way; each shape reads the
 * fields it needs:
 *
 * - dot, ring: centre `x,y`, radius `r`
 * - bar, card: centre `x,y`, size `w × h`
 * - poly: centre `x,y`, box `w × h`, which its `pts` are drawn into
 * - arc: circle centre `x,y`, inner radius `r`, thickness `h`, angles
 *   `a0 → a1` in radians, clockwise from 12 o'clock
 *
 * Unused fields are 0. Coordinates are world units (CSS pixels at zoom 1).
 */
export interface MarkGeom {
  x: number;
  y: number;
  r: number;
  w: number;
  h: number;
  a0: number;
  a1: number;
  alpha: number;
}

export interface Mark extends MarkGeom {
  id: EntityId;
  shape: MarkShape;
  paint: Paint;
  /** Overrides `parentOf(id)` for enter/exit motion. */
  parent?: EntityId;
  /**
   * What clicking this mark selects, when that isn't its own id: a part of an
   * entity drawn as its own mark (a score stack's segment selects its file).
   */
  selects?: EntityId;
  /**
   * A layout-only switch: clicking this mark flips this key in the input's
   * `open` set instead of selecting anything (a dashboard's collapsible
   * panel). The shell keeps the set; the layout draws from it.
   */
  toggles?: string;
  /**
   * Leaving, fold into its ancestor where that is now, before anything moves
   * (a fan closing into its root), instead of into the ancestor's place in
   * the next scene.
   */
  foldOnExit?: boolean;
  /**
   * A place in the picture that outlives whichever entity holds it (`fan:3`,
   * the fourth entity a lens fans out). In a transition, a mark entering
   * takes over a leaving mark in the same slot (or, failing that, any free
   * one in its group, the part before the last `:`): it starts from where
   * that mark is drawn now and moves to its own place, and the leaving mark
   * goes at once, without shrinking or folding, so a fan swapped for another
   * morphs instead of closing and regrowing. Pairs go in scene order against
   * what is on screen; ids still win (a mark in both scenes just moves).
   * Ignored under reduced motion.
   */
  slot?: string;
  /**
   * A `poly`'s vertices as flat x,y pairs in its box, each from −0.5 to 0.5
   * (the box's centre is 0,0), in order around the polygon. They don't
   * animate: the box does, so a cell grows, moves and shrinks like a bar.
   */
  pts?: readonly number[];
  /** A `poly` drawn as its dashed outline only, no fill (a quiet owner's cell). */
  edge?: 'dashed';
  label?: string;
  /**
   * A quieter second line under the label (a package's file count under its
   * name). Laid out with the label, so the two are shown or culled together.
   */
  labelSub?: string;
  /**
   * A short lead set apart from the label, before it (a fan card's number:
   * "8" beside "Code Health" over "files"). Shown with the label, so the
   * parts are shown or culled together.
   */
  labelLead?: string;
  /**
   * A class for the label's element, naming a role the dashboard's CSS styles
   * (the ring's flagged lenses), never a color. A single class token: it's
   * added with `classList.add`, which throws on whitespace.
   */
  labelClass?: string;
  /**
   * Shifts a label down by this fraction of its height (negative: up), so
   * crowded side labels can lean apart (the ring's, near its top and bottom).
   */
  labelLean?: number;
  /** Higher labels win when they collide. Defaults to 0. */
  labelPriority?: number;
  /**
   * Which side of the mark its label sits: right (the default), left, above,
   * below, or centred on it (a label-only mark, like a ring's group name).
   */
  labelAnchor?: 'right' | 'left' | 'above' | 'below' | 'center';
  /** Draw order; higher on top. Defaults to 0. */
  z?: number;
  /**
   * The hover tooltip: plain-text lines, the first one the title. What each
   * layout says here is decided at its lens's design checkpoint.
   */
  tip?: readonly string[];
}

/**
 * A connection between two marks. Endpoints are ids, not coordinates, so a
 * link follows its marks while they tween.
 */
export interface Link {
  id: string;
  source: EntityId;
  target: EntityId;
  /**
   * `s-curve` leaves its source and meets its target horizontally (a tree's
   * edges, from port to port); `arc` bows off its chord (see `bow`). `band`
   * is an s-curve whose width is measured vertically rather than across the
   * curve, so bands stacked along a node (with `ends`) meet edge to edge all
   * the way across (a flow).
   */
  curve: 'straight' | 'arc' | 'ribbon' | 's-curve' | 'band';
  /** Stroke width (ribbon: width at the source end), world units. */
  width: number;
  paint: Paint;
  alpha: number;
  /**
   * How far an `arc` bows out, as a fraction of its length (the engine's
   * default when absent), to the chord's left; negative bows it to the
   * right. A layout sets it to keep short arcs readable.
   */
  bow?: number;
  /**
   * How far each end sits below its mark's centre (negative: above), world
   * units, so links stack along a node instead of meeting at its middle (a
   * flow's bands). Absent: both ends at the centres.
   */
  ends?: readonly [source: number, target: number];
  /**
   * The hover tooltip, as a mark's `tip`: plain-text lines, the first one the
   * title. Shown when the pointer is on the link and on no mark.
   */
  tip?: readonly string[];
  /**
   * As a mark's `slot`: a link entering takes over a leaving link in the
   * same slot, carrying on from how far it is drawn instead of retracting
   * and drawing in again.
   */
  slot?: string;
}

/**
 * Scenery — rings, axes, cutoff lines, lane headings. Fades in and out; one
 * that stays (same id) moves with the marks.
 */
export type Guide =
  | {
      id: string;
      kind: 'line';
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      paint: Paint;
      alpha: number;
    }
  | {
      id: string;
      kind: 'circle';
      x: number;
      y: number;
      r: number;
      paint: Paint;
      alpha: number;
      /** Dashed, with dashes (and gaps) this many screen px long. */
      dash?: number;
    }
  | {
      id: string;
      kind: 'text';
      x: number;
      y: number;
      text: string;
      paint: Paint;
      alpha: number;
    };

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Scene {
  marks: Mark[];
  links: Link[];
  guides: Guide[];
  /** The area every mark is drawn within; what "fit to screen" frames. */
  bounds: Bounds;
  /**
   * Entities the layout scored but didn't draw a mark for, each mapped to the
   * mark that holds it (a density cell, a package's disc, a dashboard card
   * keyed by its slot). Hovering one from outside — a detail-table row —
   * lights its stand-in instead of nothing, and selecting one marks it.
   */
  standIns?: ReadonlyMap<EntityId, string>;
  /**
   * Hovering a mark lights its links and fades the rest, until the pointer
   * leaves it (a flow, where one person's bands are lost among everyone's).
   * Drawn by the stage alone: the scene isn't rebuilt per hover.
   */
  hoverLinks?: boolean;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface ViewInput {
  report: GitrelicReport;
  /** Loaded on demand; null until a view that needs commits asks for them. */
  commits: CommitLike[] | null;
  /**
   * What the viewer has selected, already resolved through the entity index.
   * A layout may re-form around it (the Overview ring fans out a selected
   * lens); one that ignores it draws the same scene either way.
   */
  focus?: EntityId | null;
  /** The entity index, for layouts that only draw selectable entities. */
  index?: EntityIndex;
  /** The panels the viewer has opened, by the keys their marks toggle. */
  open?: ReadonlySet<string>;
}

/** Text with entity chips: a chip selects its entity when clicked. */
export type FindingSegment = string | { ref: EntityId; text: string };

export interface Finding {
  id: string;
  tone: 'neutral' | 'notable' | 'warning';
  segments: FindingSegment[];
}

export interface Layout {
  id: string;
  label: string;
  /**
   * One line under the stage: how to read this picture. Plain text, from the
   * view's design checkpoint.
   */
  caption?: string;
  /**
   * The entity kinds `build` re-forms around when they're the focus (the
   * field: a selected `file`). Any other selection gives it no focus, so it
   * isn't rebuilt (and re-planned) for a click it can't show.
   */
  focusKinds?: readonly EntityKind[];
  /** Whether `build` needs `input.commits`. */
  needsCommits: boolean;
  build: (input: ViewInput, viewport: Viewport) => Scene;
}

/** One column of a lens's detail table. */
export interface TableColumn {
  id: string;
  label: string;
  /** Right-aligned, and sorted largest first on the first click. */
  numeric?: boolean;
}

/** A detail-table row is an entity: hovering lights its mark, a click selects it. */
export interface TableRow {
  id: EntityId;
  /** Risk tier, 0 (low) to 3, for the tier toggles and the row's color. */
  tier: 0 | 1 | 2 | 3;
  /** Lower-cased text the filter matches (the full path, a name…). */
  search: string;
  cells: Record<string, string | number>;
}

/**
 * The lens's "exactly which ones?" (docs/atlas-views.md › Alternate forms):
 * every entity it scores, sortable, in the full-width table drawer.
 */
export interface LensTable {
  columns: readonly TableColumn[];
  rows: readonly TableRow[];
  /** What tiers 0–3 are called in this lens, for the toggles. */
  tierNames: readonly [string, string, string, string];
  sort: { column: string; descending: boolean };
}

/**
 * One analyzer's Atlas view. `layouts[0]` is the primary; the rest are the
 * alternates the view's design checkpoint decided to keep. The inspector panel
 * contract lands with the inspector cards (PR 3.1).
 */
export interface AnalyzerView {
  id: string;
  layouts: [Layout, ...Layout[]];
  findings: (input: ViewInput) => Finding[];
  /** Its detail table, when it has one (the drawer opens with `T`). */
  table?: (input: ViewInput) => LensTable;
  /**
   * A part of each week the time strip shades in this lens (AI & Co-authors:
   * the commits with AI in them), of the selection's commits when there is
   * one. `label` names the part in the strip's caption.
   */
  strip?: { split: (c: CommitLike) => boolean; label: string };
}

export function emptyScene(viewport: Viewport): Scene {
  return {
    marks: [],
    links: [],
    guides: [],
    bounds: { x: 0, y: 0, w: viewport.width, h: viewport.height },
  };
}

const GEOM_KEYS = ['x', 'y', 'r', 'w', 'h', 'a0', 'a1', 'alpha'] as const;

/**
 * Structural problems in a scene, as readable strings; empty when sound.
 * Every layout test runs this: finite numbers, unique ids, links between
 * marks that exist, and marks inside `bounds` (with `slack` for strokes).
 */
export function checkScene(scene: Scene, slack = 0.5): string[] {
  const problems: string[] = [];
  const { x: bx, y: by, w: bw, h: bh } = scene.bounds;
  if (![bx, by, bw, bh].every(Number.isFinite) || bw < 0 || bh < 0) {
    problems.push(`bounds are not a finite rectangle`);
  }

  const markIds = new Set<string>();
  for (const m of scene.marks) {
    if (markIds.has(m.id)) problems.push(`duplicate mark id ${m.id}`);
    markIds.add(m.id);
    for (const k of GEOM_KEYS) {
      if (!Number.isFinite(m[k]))
        problems.push(`mark ${m.id}: ${k} is ${m[k]}`);
    }
    if (m.alpha < 0 || m.alpha > 1)
      problems.push(`mark ${m.id}: alpha ${m.alpha} outside 0..1`);
    if (m.shape === 'poly') {
      const pts = m.pts ?? [];
      if (pts.length < 6 || pts.length % 2 !== 0)
        problems.push(`mark ${m.id}: a poly needs 3+ x,y pairs`);
      else if (
        !pts.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.5 + 1e-6)
      )
        problems.push(`mark ${m.id}: pts must be finite, within −0.5..0.5`);
    }
    const [x0, x1, y0, y1] = extent(m);
    if (
      m.x + x0 < bx - slack ||
      m.x + x1 > bx + bw + slack ||
      m.y + y0 < by - slack ||
      m.y + y1 > by + bh + slack
    ) {
      problems.push(`mark ${m.id} falls outside the scene bounds`);
    }
  }

  const linkIds = new Set<string>();
  for (const l of scene.links) {
    if (linkIds.has(l.id)) problems.push(`duplicate link id ${l.id}`);
    linkIds.add(l.id);
    if (!markIds.has(l.source))
      problems.push(`link ${l.id}: no mark ${l.source}`);
    if (!markIds.has(l.target))
      problems.push(`link ${l.id}: no mark ${l.target}`);
    if (!Number.isFinite(l.width) || !Number.isFinite(l.alpha)) {
      problems.push(`link ${l.id}: width or alpha is not finite`);
    }
  }

  const guideIds = new Set<string>();
  for (const g of scene.guides) {
    if (guideIds.has(g.id)) problems.push(`duplicate guide id ${g.id}`);
    guideIds.add(g.id);
  }

  for (const [id, holder] of scene.standIns ?? []) {
    if (markIds.has(id)) problems.push(`stand-in for ${id}, which is drawn`);
    if (!markIds.has(holder))
      problems.push(`stand-in for ${id}: no mark ${holder}`);
  }
  return problems;
}

/**
 * The box a mark covers, as offsets from its centre: left, right, top,
 * bottom. A poly's is its points', which its `w × h` box can over-cover (the
 * box is centred on the cell's centroid, not its middle).
 */
function extent(m: Mark): [number, number, number, number] {
  switch (m.shape) {
    case 'dot':
    case 'ring':
    case 'outline':
      return [-m.r, m.r, -m.r, m.r];
    case 'arc':
      return [-(m.r + m.h), m.r + m.h, -(m.r + m.h), m.r + m.h];
    case 'bar':
    case 'card':
      return [-m.w / 2, m.w / 2, -m.h / 2, m.h / 2];
    case 'poly': {
      const pts = m.pts ?? [];
      const xs = pts.filter((_, k) => k % 2 === 0).map((u) => u * m.w);
      const ys = pts.filter((_, k) => k % 2 === 1).map((v) => v * m.h);
      if (xs.length === 0) return [-m.w / 2, m.w / 2, -m.h / 2, m.h / 2];
      return [
        Math.min(...xs),
        Math.max(...xs),
        Math.min(...ys),
        Math.max(...ys),
      ];
    }
  }
}
