// What the Overview's two forms (fan.ts, ring.ts) share: how a lens looks for
// its outlier grade, how a lens fans its top entities out, and the room their
// labels need. A lens previews the same way in either form.

import { ids, type EntityId } from '../ids';
import type { Link, Mark, Paint } from '../model';
import type { FannedEntity } from '../overview/topEntities';

export const DOT_R = [5, 7, 10, 14] as const;
export const RAMP = ['--risk-0', '--risk-1', '--risk-2', '--risk-3'] as const;
/** Lenses graded 2+ (the ones that badge) get a label the CSS can heat. */
export const LABEL_CLASS = [
  undefined,
  undefined,
  'atlas-label--hot',
  'atlas-label--hot',
] as const;
export const ZERO = { w: 0, h: 0, a0: 0, a1: 0 };

const FAN_DOT = 5;
/**
 * Room beside the outermost marks for their DOM labels, world units. Labels
 * are screen pixels, so at the ~0.65 zoom a 1440px window fits this world at,
 * a two-line label 20 characters wide needs about 220 units across and 55
 * down.
 */
const LABEL_ROOM = 240;
const LABEL_ROOM_Y = 64;
const MARGIN = 32;

/** Labels point away from the centre, so they never cross the ring. */
export function anchorFor(dx: number, dy: number): Mark['labelAnchor'] {
  const len = Math.hypot(dx, dy) || 1;
  if (dx / len > 0.35) return 'right';
  if (dx / len < -0.35) return 'left';
  return dy < 0 ? 'above' : 'below';
}

function entityPaint(id: EntityId): Paint {
  if (id.startsWith('person:')) return '--person';
  if (id.startsWith('dir:')) return '--dir';
  return '--file';
}

/**
 * A lens's top entities on an arc of `radius` around the lens at (x, y),
 * centred on the `outward` angle (radians, 0 = right), each parented to the
 * lens so it grows out of it. Each entity and its link take the slot
 * `fan:<i>`, so previewing another lens morphs one fan into the next instead
 * of folding it and growing the other.
 */
export function fanOut(
  preset: string,
  x: number,
  y: number,
  outward: number,
  radius: number,
  entities: readonly FannedEntity[],
): { marks: Mark[]; links: Link[] } {
  const marks: Mark[] = [];
  const links: Link[] = [];
  const source = ids.analyzer(preset);
  const span = Math.min(Math.PI * 0.9, 0.32 * entities.length);
  entities.forEach((e, i) => {
    const t = entities.length === 1 ? 0 : i / (entities.length - 1) - 0.5;
    const a = outward + t * span;
    const fx = x + radius * Math.cos(a);
    const fy = y + radius * Math.sin(a);
    marks.push({
      id: e.id,
      shape: 'dot',
      paint: entityPaint(e.id),
      x: fx,
      y: fy,
      r: FAN_DOT,
      ...ZERO,
      alpha: 1,
      parent: source,
      slot: `fan:${i}`,
      // The name only: the inspector lists each one's value beside it.
      label: e.label,
      labelPriority: 40 - i,
      labelAnchor: anchorFor(fx - x, fy - y),
      z: 4,
      tip: [e.label, e.value],
    });
    links.push({
      id: `fan:${e.id}`,
      source,
      target: e.id,
      curve: 'arc',
      width: 1.2,
      paint: '--link-hot',
      alpha: 0.7,
      slot: `fan:${i}`,
    });
  });
  return { marks, links };
}

/** Every mark (a card by its box), plus margin and room for the labels drawn beside them. */
export function labelledBounds(marks: readonly Mark[]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of marks) {
    // A card's half-size, or a dot's radius (the other is 0).
    const hw = Math.max(m.r, m.w / 2);
    const hh = Math.max(m.r, m.h / 2);
    x0 = Math.min(x0, m.x - hw);
    y0 = Math.min(y0, m.y - hh);
    x1 = Math.max(x1, m.x + hw);
    y1 = Math.max(y1, m.y + hh);
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return {
    x: x0 - MARGIN - LABEL_ROOM,
    y: y0 - MARGIN - LABEL_ROOM_Y,
    w: x1 - x0 + 2 * (MARGIN + LABEL_ROOM),
    h: y1 - y0 + 2 * (MARGIN + LABEL_ROOM_Y),
  };
}
