// Parallel Dev's Pairs form (docs/atlas-views.md › Parallel Dev): people
// around an ellipse (wider than tall: the stage's shape), spaced evenly by
// height so every name has room beside its dot, a chord between two people as wide as the weeks they
// committed to the same file, bowed toward the centre. People are `person:`
// marks sized by how much they collide and coloured by status, so they travel
// to and from Contributors.
//
// Hovering a person lights their chords and fades the rest (drawn by the
// stage alone, `Scene.hoverLinks`); selecting one keeps them lit, dims the
// people they never met, and names the weeks beside each partner.

import { ids, type EntityId } from '../ids';
import { STATUS_TEXT } from './flow';
import type { PersonStatus } from '../contributors/flow';
import type { ColorRole, Link, Mark, Scene, Viewport } from '../model';
import type { PairsData } from '../parallel/pairs';

const STATUS_PAINT: Record<PersonStatus, ColorRole> = {
  active: '--soft',
  quiet: '--risk-1',
  ghost: '--risk-2',
};
/** A chord's control point sits this share of the way to the centre. */
const PULL = 0.55;
/** Faint, but over the label layer's floor (0.5): dimmed people keep names. */
const DIM = 0.55;
const LABEL_ROOM = 230;
const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const plural = (v: number, word: string) =>
  `${n(v)} ${word}${v === 1 ? '' : 's'}`;
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export interface PairsOptions {
  /** The selection, when it's a drawn person. */
  focus?: EntityId | null;
}

export function pairsScene(
  data: PairsData,
  viewport: Viewport,
  { focus = null }: PairsOptions = {},
): Scene {
  const bounds = { x: 0, y: 0, w: viewport.width, h: viewport.height };
  const { people, pairs } = data;
  if (pairs.length === 0) {
    const { sweepingCommits, botCommits } = data.leftOut;
    const left = sweepingCommits + botCommits;
    return {
      marks: [
        {
          id: 'pairs-empty',
          shape: 'card',
          paint: '--muted',
          x: viewport.width / 2,
          y: viewport.height / 2,
          ...zero,
          alpha: 1,
          label: 'No two people committed to the same file in the same week',
          labelSub:
            left > 0
              ? `${plural(sweepingCommits, 'sweeping commit')} and ${plural(botCommits, 'bot commit')} were left out.`
              : 'Each file had one person at a time.',
          labelAnchor: 'center',
          labelPriority: 1000,
        },
      ],
      links: [],
      guides: [],
      bounds,
    };
  }

  const cx = viewport.width / 2;
  const cy = viewport.height / 2 + 10;
  // Wider than tall: names sit beside their dots, and a circle's top and
  // bottom crowd them; the stage is about twice as wide as it is tall.
  const ry = viewport.height / 2 - 100;
  const rx = ry * 1.45;
  const maxWeeks = Math.max(...people.map((p) => p.weeks));
  const maxPair = Math.max(...pairs.map((p) => p.weeks));
  // Seats spaced evenly by height, not angle: down the right half, then back
  // up the left, in circle order. Even angles bunch people near the top and
  // bottom, where their side labels then collide.
  const right = Math.ceil(people.length / 2);
  const leftCount = people.length - right;
  const at = new Map<string, { x: number; y: number; side: 1 | -1 }>();
  people.forEach((p, i) => {
    const side = i < right ? 1 : -1;
    const k = side === 1 ? i : people.length - 1 - i;
    const count = side === 1 ? right : leftCount;
    const y = cy - ry + (2 * ry * (k + 0.5)) / Math.max(1, count);
    const x = cx + side * rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
    at.set(p.email, { x, y, side });
  });

  const focusPerson = focus
    ? people.find((p) => ids.person(p.email) === focus)
    : undefined;
  const withFocus = new Map<string, number>();
  if (focusPerson)
    for (const p of pairs) {
      if (p.a === focusPerson.email) withFocus.set(p.b, p.weeks);
      if (p.b === focusPerson.email) withFocus.set(p.a, p.weeks);
    }
  const nameOf = new Map(people.map((p) => [p.email, p.name]));

  const marks: Mark[] = people.map((p, i) => {
    const { x, y, side } = at.get(p.email)!;
    const anchor: Mark['labelAnchor'] = side === 1 ? 'right' : 'left';
    const isFocus = focusPerson === p;
    const met = withFocus.get(p.email);
    const dim = focusPerson !== undefined && !isFocus && met === undefined;
    return {
      id: ids.person(p.email),
      shape: 'dot',
      paint: isFocus ? '--accent' : STATUS_PAINT[p.status],
      x,
      y,
      ...zero,
      r: 4 + 10 * Math.sqrt(p.weeks / maxWeeks),
      alpha: dim ? DIM : 0.95,
      z: 2,
      label: p.name,
      labelSub:
        met !== undefined
          ? `${plural(met, 'week')} with ${focusPerson!.name}`
          : `${plural(p.partners, 'partner')} · ${STATUS_TEXT[p.status]}`,
      labelAnchor: anchor,
      labelPriority: 500 - i,
      tip: personTip(p, pairs, nameOf),
    };
  });

  const links: Link[] = pairs.map((p) => {
    const a = at.get(p.a)!;
    const b = at.get(p.b)!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // Bow toward the centre: the arc bows to its chord's left by `bow` ×
    // length, so the sign comes from which side of the chord the centre is.
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const toCentre = nx * (cx - mx) + ny * (cy - my);
    const on =
      focusPerson === undefined
        ? null
        : p.a === focusPerson.email || p.b === focusPerson.email;
    return {
      id: `pair:${p.a}:${p.b}`,
      source: ids.person(p.a),
      target: ids.person(p.b),
      curve: 'arc',
      bow: (toCentre * PULL) / len,
      width: 1.5 + 9 * (p.weeks / maxPair),
      paint: on ? '--accent' : '--soft',
      alpha: on === null ? 0.32 : on ? 0.8 : 0.05,
      tip: [
        `${nameOf.get(p.a)} + ${nameOf.get(p.b)}`,
        `${plural(p.weeks, 'week')} on the same files`,
        p.files.slice(0, 3).map(baseName).join(', ') +
          (p.files.length > 3 ? ` and ${n(p.files.length - 3)} more` : ''),
      ],
    };
  });

  const span = rx + LABEL_ROOM;
  return {
    marks,
    links,
    guides: [],
    hoverLinks: true,
    bounds: {
      x: cx - span,
      y: cy - ry - 70,
      w: 2 * span,
      h: 2 * ry + 140,
    },
  };
}

function personTip(
  p: PairsData['people'][number],
  pairs: PairsData['pairs'],
  nameOf: ReadonlyMap<string, string>,
): string[] {
  const mine = pairs
    .filter((q) => q.a === p.email || q.b === p.email)
    .sort((x, y) => y.weeks - x.weeks);
  const with3 = mine
    .slice(0, 3)
    .map((q) => {
      const other = q.a === p.email ? q.b : q.a;
      return `${nameOf.get(other) ?? other} (${n(q.weeks)})`;
    })
    .join(', ');
  return [
    p.name,
    `${plural(p.partners, 'partner')} · ${STATUS_TEXT[p.status]}`,
    ...(with3 ? [`Weeks on the same files: ${with3}`] : []),
  ];
}
