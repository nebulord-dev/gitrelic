// Plans the move from what is on screen to the next scene, matching marks by
// entity id. Pure: the engine (apps/atlas) runs the tracks; this decides who
// moves where, and when.
//
// Timeline, in order:
//   1. links that are going away retract, and marks that fold on exit (a
//      fan closing) shrink into their ancestor where it is now
//   2. once those are mostly done, marks (and guides that stay) move; new marks grow out of their nearest ancestor on screen, and
//      other leaving marks shrink into their nearest ancestor in the next scene
//   3. new links draw in, staggered, starting while the move settles
//
// A mark or link entering in the slot of one leaving (`Mark.slot`) skips all
// that: it takes the other's place on screen and moves (or finishes drawing)
// from there, and the one it replaces goes at once.
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
  /** An update that starts from the leaving mark it takes the slot of. */
  takesOver?: EntityId;
  /** An exit with no animation: this mark's slot went to that one. */
  takenBy?: EntityId;
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
  /** An update that starts from the leaving link it takes the slot of. */
  takesOver?: string;
  /** An exit with no animation: this link's slot went to that one. */
  takenBy?: string;
}

export interface GuideTrack {
  id: string;
  phase: Phase;
  guide: Guide;
  /** Where a staying guide is drawn now, to move it from; null when it only fades. */
  from: Guide | null;
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
  drawAfter: 250,
  /** Marks that fold on exit, before anything moves. */
  fold: 300,
  /**
   * When the move starts after retracting links, or after a fold. Out-cubic
   * has done most of either by then; waiting for the tail leaves the stage
   * still for a beat after the click, which reads as a stall.
   */
  retractLead: 80,
  foldLead: 120,
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

  // Who takes over whose slot. Reduced motion only fades, so nothing does.
  const markSlots = reduced
    ? NO_SLOTS
    : pairSlots(
        next.marks.filter((m) => !live.marks.has(m.id)),
        [...live.marks.values()].filter((m) => !nextMarks.has(m.id)),
      );
  const linkSlots = reduced
    ? NO_SLOTS
    : pairSlots(
        next.links.filter((l) => !live.links.has(l.id)),
        [...live.links.values()].filter((l) => !nextLinks.has(l.id)),
      );

  // 1. Retract links that won't survive; those whose slot is taken just go.
  let retracting = 0;
  for (const link of live.links.values()) {
    if (nextLinks.has(link.id)) continue;
    const takenBy = linkSlots.takenBy.get(link.id);
    if (takenBy !== undefined) {
      links.push({
        id: link.id,
        phase: 'exit',
        link,
        from: { progress: link.progress, alpha: link.alpha },
        to: { progress: link.progress, alpha: 0 },
        delay: 0,
        duration: 0,
        ease: 'linear',
        takenBy,
      });
      continue;
    }
    retracting++;
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
  const folding = (m: Mark) =>
    !reduced && m.foldOnExit === true && !markSlots.takenBy.has(m.id);
  let moveAt = 0;
  if (!reduced) {
    if (retracting > 0) moveAt = TIMING.retractLead;
    for (const m of live.marks.values())
      if (!nextMarks.has(m.id) && folding(m)) {
        moveAt = Math.max(moveAt, TIMING.foldLead);
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
    const donor = markSlots.takes.get(mark.id);
    if (donor !== undefined) {
      marks.push({
        id: mark.id,
        phase: 'update',
        mark,
        from: geomOf(live.marks.get(donor)!),
        to,
        delay: moveAt,
        duration: TIMING.move,
        ease: 'out-cubic',
        takesOver: donor,
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
    const takenBy = markSlots.takenBy.get(current.id);
    if (takenBy !== undefined) {
      marks.push({
        id: current.id,
        phase: 'exit',
        mark: current,
        from,
        to: { ...from, alpha: 0 },
        delay: 0,
        duration: 0,
        ease: 'linear',
        takenBy,
      });
      continue;
    }
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
  const entering = next.links.filter(
    (l) => !live.links.has(l.id) && !linkSlots.takes.has(l.id),
  );
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
    const donor = linkSlots.takes.get(link.id);
    if (donor !== undefined) {
      const was = live.links.get(donor)!;
      links.push({
        id: link.id,
        phase: 'update',
        link,
        from: { progress: was.progress, alpha: was.alpha },
        to: { progress: 1, alpha: link.alpha },
        delay: moveAt,
        duration: TIMING.draw,
        ease: 'out-cubic',
        takesOver: donor,
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

  // Guides fade in and out; those that stay move with the marks, so a plot's
  // grid shrinks with its dots instead of jumping ahead of them.
  for (const guide of live.guides.values()) {
    if (nextGuides.has(guide.id)) continue;
    guides.push({
      id: guide.id,
      phase: 'exit',
      guide,
      from: null,
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
      from: current && !reduced && current.kind === guide.kind ? current : null,
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

interface SlotPairs {
  /** Entering id → the leaving id whose slot it takes. */
  takes: ReadonlyMap<string, string>;
  /** Leaving id → the entering id that takes its slot. */
  takenBy: ReadonlyMap<string, string>;
}

const NO_SLOTS: SlotPairs = { takes: new Map(), takenBy: new Map() };

/** A slot's group: the part before its last `:` (the whole slot without one). */
const groupOf = (slot: string) => {
  const k = slot.lastIndexOf(':');
  return k === -1 ? slot : slot.slice(0, k);
};

/**
 * Pairs entering items with leaving ones by `slot`: each entering one, in
 * order, takes the first free leaving one in the same slot; those left over
 * then take the first free one in the same group. Each is paired once.
 */
function pairSlots(
  entering: readonly { id: string; slot?: string }[],
  leaving: readonly { id: string; slot?: string }[],
): SlotPairs {
  const takes = new Map<string, string>();
  const takenBy = new Map<string, string>();
  const free = leaving.filter((l) => l.slot !== undefined);
  if (free.length === 0) return NO_SLOTS;
  const wanting = entering.filter((e) => e.slot !== undefined);
  for (const same of [
    (a: string, b: string) => a === b,
    (a: string, b: string) => groupOf(a) === groupOf(b),
  ])
    for (const e of wanting) {
      if (takes.has(e.id)) continue;
      const donor = free.find(
        (l) => !takenBy.has(l.id) && same(e.slot!, l.slot!),
      );
      if (!donor) continue;
      takes.set(e.id, donor.id);
      takenBy.set(donor.id, e.id);
    }
  return { takes, takenBy };
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
