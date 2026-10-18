// Plans the move from what is on screen to the next scene, matching marks by
// entity id. Pure: the engine (apps/atlas) runs the tracks; this decides who
// moves where, and when.
//
// Timeline, in order:
//   1. links that are going away retract, and marks that fold on exit (a
//      fan closing) shrink into their ancestor where it is now
//   2. marks move; new marks grow out of their nearest ancestor on screen, and
//      other leaving marks shrink into their nearest ancestor in the next scene
//   3. new links draw in, staggered, starting while the move settles
//
// Every track starts from the live (possibly mid-flight) state, so a
// transition interrupted by another picks up where things actually are.

import { parentOf, type EntityId } from '../ids';
import type { Guide, Link, Mark, MarkGeom, MarkShape, Scene } from '../model';

/** A mark as currently drawn: its data, with geometry at this instant. */
export type LiveMark = Mark;
/** A link as currently drawn, `progress` 0..1 of its length. */
export type LiveLink = Link & { progress: number };
/** A guide as currently drawn (its `alpha` is the current one). */
export type LiveGuide = Guide;

export interface LiveState {
  marks: ReadonlyMap<EntityId, LiveMark>;
  links: ReadonlyMap<string, LiveLink>;
  guides: ReadonlyMap<string, LiveGuide>;
}

export type Phase = 'enter' | 'update' | 'exit';
export type EaseName = 'out-cubic' | 'linear';

export interface MarkTrack {
  id: EntityId;
  phase: Phase;
  /** The next scene's mark; for an exit, the live mark it leaves as. */
  mark: Mark;
  from: MarkGeom;
  to: MarkGeom;
  delay: number;
  duration: number;
  ease: EaseName;
}

export interface LinkTrack {
  id: string;
  phase: Phase;
  link: Link;
  from: { progress: number; alpha: number };
  to: { progress: number; alpha: number };
  delay: number;
  duration: number;
  ease: EaseName;
}

export interface GuideTrack {
  id: string;
  phase: Phase;
  guide: Guide;
  fromAlpha: number;
  toAlpha: number;
  delay: number;
  duration: number;
  ease: EaseName;
}

export interface TransitionPlan {
  marks: MarkTrack[];
  links: LinkTrack[];
  guides: GuideTrack[];
  /** When the last track finishes, ms from the start. */
  duration: number;
}

export interface PlanOptions {
  /** OS "reduce motion": nothing travels; marks and links only fade. */
  reducedMotion?: boolean;
}

export const TIMING = {
  retract: 200,
  move: 600,
  exit: 400,
  draw: 300,
  /** New links start drawing this far into the move: out-cubic has covered
   * most of the distance, and a pause between arriving and connecting reads
   * as a stall. */
  drawAfter: 300,
  /** Marks that fold on exit, before anything moves. */
  fold: 300,
  /** Gap between successive new links… */
  stagger: 40,
  /** …compressed so the whole cascade never spans more than this. */
  maxStagger: 600,
  /** Reduced-motion fades. */
  fade: 200,
} as const;

export const EMPTY_LIVE: LiveState = {
  marks: new Map(),
  links: new Map(),
  guides: new Map(),
};

export function planTransition(
  next: Scene,
  live: LiveState,
  options: PlanOptions = {},
): TransitionPlan {
  const reduced = options.reducedMotion ?? false;
  const nextMarks = new Map(next.marks.map((m) => [m.id, m]));
  const nextLinks = new Set(next.links.map((l) => l.id));
  const nextGuides = new Set(next.guides.map((g) => g.id));

  const marks: MarkTrack[] = [];
  const links: LinkTrack[] = [];
  const guides: GuideTrack[] = [];

  // 1. Retract links that won't survive.
  for (const link of live.links.values()) {
    if (nextLinks.has(link.id)) continue;
    links.push({
      id: link.id,
      phase: 'exit',
      link,
      from: { progress: link.progress, alpha: link.alpha },
      to: reduced
        ? { progress: link.progress, alpha: 0 }
        : { progress: 0, alpha: link.alpha },
      delay: 0,
      duration: reduced ? TIMING.fade : TIMING.retract * link.progress,
      ease: reduced ? 'linear' : 'out-cubic',
    });
  }
  const folding = (m: Mark) => !reduced && m.foldOnExit === true;
  let moveAt = 0;
  if (!reduced) {
    if (links.length > 0) moveAt = TIMING.retract;
    for (const m of live.marks.values())
      if (!nextMarks.has(m.id) && folding(m)) {
        moveAt = Math.max(moveAt, TIMING.fold);
        break;
      }
  }

  // 2. Marks.
  for (const mark of next.marks) {
    const current = live.marks.get(mark.id);
    const to = geomOf(mark);
    if (current) {
      marks.push({
        id: mark.id,
        phase: 'update',
        mark,
        from: geomOf(current),
        to,
        delay: moveAt,
        duration: reduced ? 0 : TIMING.move,
        ease: 'out-cubic',
      });
      continue;
    }
    const origin = reduced
      ? null
      : nearestAncestor(mark, nextMarks, live.marks, live.marks);
    marks.push({
      id: mark.id,
      phase: 'enter',
      mark,
      from: collapsed(to, mark.shape, origin),
      to,
      delay: moveAt,
      duration: reduced ? TIMING.fade : TIMING.move,
      ease: reduced ? 'linear' : 'out-cubic',
    });
  }
  for (const current of live.marks.values()) {
    if (nextMarks.has(current.id)) continue;
    const from = geomOf(current);
    const folds = folding(current);
    // A folding mark closes into its ancestor where that is now, before the
    // ancestor moves on; any other goes where its ancestor is going.
    const target = reduced
      ? null
      : nearestAncestor(
          current,
          nextMarks,
          live.marks,
          folds ? live.marks : nextMarks,
        );
    marks.push({
      id: current.id,
      phase: 'exit',
      mark: current,
      from,
      to: reduced
        ? { ...from, alpha: 0 }
        : collapsed(from, current.shape, target),
      delay: folds ? 0 : moveAt,
      duration: reduced ? TIMING.fade : folds ? TIMING.fold : TIMING.exit,
      ease: reduced ? 'linear' : 'out-cubic',
    });
  }

  // 3. Links that stay finish drawing; new ones cascade in as the move settles.
  const drawAt = reduced ? 0 : moveAt + TIMING.drawAfter;
  const entering = next.links.filter((l) => !live.links.has(l.id));
  const step =
    entering.length > 1
      ? Math.min(TIMING.stagger, TIMING.maxStagger / (entering.length - 1))
      : 0;
  let order = 0;
  for (const link of next.links) {
    const current = live.links.get(link.id);
    if (current) {
      links.push({
        id: link.id,
        phase: 'update',
        link,
        from: { progress: current.progress, alpha: current.alpha },
        to: { progress: 1, alpha: link.alpha },
        delay: moveAt,
        duration: reduced ? 0 : TIMING.draw,
        ease: 'out-cubic',
      });
      continue;
    }
    links.push({
      id: link.id,
      phase: 'enter',
      link,
      from: reduced
        ? { progress: 1, alpha: 0 }
        : { progress: 0, alpha: link.alpha },
      to: { progress: 1, alpha: link.alpha },
      delay: reduced ? 0 : drawAt + order++ * step,
      duration: reduced ? TIMING.fade : TIMING.draw,
      ease: reduced ? 'linear' : 'out-cubic',
    });
  }

  // Guides only ever fade.
  for (const guide of live.guides.values()) {
    if (nextGuides.has(guide.id)) continue;
    guides.push({
      id: guide.id,
      phase: 'exit',
      guide,
      fromAlpha: guide.alpha,
      toAlpha: 0,
      delay: 0,
      duration: reduced ? TIMING.fade : TIMING.retract,
      ease: 'linear',
    });
  }
  for (const guide of next.guides) {
    const current = live.guides.get(guide.id);
    guides.push({
      id: guide.id,
      phase: current ? 'update' : 'enter',
      guide,
      fromAlpha: current?.alpha ?? 0,
      toAlpha: guide.alpha,
      delay: moveAt,
      duration: reduced ? TIMING.fade : TIMING.move,
      ease: 'linear',
    });
  }

  let duration = 0;
  for (const t of [...marks, ...links, ...guides]) {
    duration = Math.max(duration, t.delay + t.duration);
  }
  return { marks, links, guides, duration };
}

export function geomOf(m: MarkGeom): MarkGeom {
  return {
    x: m.x,
    y: m.y,
    r: m.r,
    w: m.w,
    h: m.h,
    a0: m.a0,
    a1: m.a1,
    alpha: m.alpha,
  };
}

/**
 * `g` shrunk to nothing — at `at` when given, otherwise in place. Arcs ignore
 * `at` and keep their centre, radius and angles, losing only thickness, so a
 * ring of cells grows outward rather than flying in from a point.
 */
function collapsed(
  g: MarkGeom,
  shape: MarkShape,
  at: { x: number; y: number } | null,
): MarkGeom {
  if (shape === 'arc') return { ...g, h: 0, alpha: 0 };
  return {
    ...g,
    x: at?.x ?? g.x,
    y: at?.y ?? g.y,
    r: 0,
    w: 0,
    h: 0,
    alpha: 0,
  };
}

/**
 * Walks `mark`'s ancestry (explicit `parent` first, else the id's structure)
 * and returns the position of the first ancestor present in `among`. Parent
 * links are looked up in both scenes, since the ancestor itself may only be
 * drawn in one of them. Explicit parents could form a cycle; the walk stops
 * if it revisits an id.
 */
function nearestAncestor(
  mark: Mark,
  nextMarks: ReadonlyMap<EntityId, Mark>,
  liveMarks: ReadonlyMap<EntityId, Mark>,
  among: ReadonlyMap<EntityId, Mark>,
): { x: number; y: number } | null {
  const seen = new Set<EntityId>([mark.id]);
  let id: EntityId | null = mark.parent ?? parentOf(mark.id);
  while (id !== null && !seen.has(id)) {
    const found = among.get(id);
    if (found) return { x: found.x, y: found.y };
    seen.add(id);
    id = nextMarks.get(id)?.parent ?? liveMarks.get(id)?.parent ?? parentOf(id);
  }
  return null;
}
