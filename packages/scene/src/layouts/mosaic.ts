// Ownership's Mosaic (docs/atlas-views.md › Ownership): one column per
// package on the map, as wide as its commits, split from the bottom by each
// person's share. The six people with a color get their own segment;
// everyone else stacks as one grey block on top. A dashed outline marks a
// top contributor who went quiet, as on the map.
//
// "What if X left" is selecting a person: their segments fade out, a strip
// in the accent marks each package nobody else knows (10%+ and 3+ commits),
// and a line above the chart counts them. Clicking a segment selects its
// person; the column's plinth (and its name under it) selects the package.

import { ids, type EntityId } from '../ids';
import {
  ownershipMapOf,
  strandedBy,
  type MapPackage,
  type OwnershipMap,
} from '../ownership/map';
import { ringNames } from './boundaries';
import { emptyStage, noteMark, ownershipTip } from './organicMap';
import type {
  ColorRole,
  Guide,
  Mark,
  Scene,
  ViewInput,
  Viewport,
} from '../model';

/** The chart's size in world units; the camera fits it to the stage. */
const W = 1000;
const H = 420;
const GAP = 2;
const PLINTH = 10;
const STRAND = 6;
const TOP = 46;
const zero = { r: 0, a0: 0, a1: 0 };
/** A rectangle as `poly` points, for the dashed quiet outline. */
const RECT = [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5];
const pct = (k: number, n: number) => Math.round((100 * k) / n);

interface Segment {
  email: string | null; // null: everyone without a color
  commits: number;
}

/** Colored people bottom up, in share order, then the grey rest on top. */
function segments(
  map: OwnershipMap,
  p: MapPackage,
  leaver: string | null,
): Segment[] {
  const out: Segment[] = [];
  let rest = 0;
  for (const s of p.shares) {
    if (map.people.get(s.email)?.slot != null || s.email === leaver)
      out.push({ email: s.email, commits: s.commits });
    else rest += s.commits;
  }
  if (rest > 0) out.push({ email: null, commits: rest });
  return out;
}

export function mosaicScene(input: ViewInput, viewport: Viewport): Scene {
  const map = ownershipMapOf(input.report);
  if (map.noData)
    return emptyStage('Rerun gitrelic to see who owns what.', viewport);
  if (map.drawn.length === 0)
    return emptyStage(
      'No package has 10 or more commits in this window.',
      viewport,
    );

  const focus: EntityId | null = input.focus ?? null;
  const leaver =
    focus?.startsWith('person:') &&
    map.people.has(focus.slice('person:'.length))
      ? focus.slice('person:'.length)
      : null;
  const stranded = new Set(
    leaver ? strandedBy(map, leaver).map((p) => p.dir) : [],
  );
  const names = ringNames(map.drawn.map((p) => p.dir));

  // Widths by commits, with every column at least 2 units so none vanishes.
  const total = map.drawn.reduce((a, p) => a + p.commits, 0);
  const usable = W - GAP * (map.drawn.length - 1);
  const raw = map.drawn.map((p) => (p.commits / total) * usable);
  const thin = raw.filter((w) => w < 2).length;
  const scale =
    (usable - 2 * thin) /
    Math.max(
      1,
      raw.filter((w) => w >= 2).reduce((a, w) => a + w, 0),
    );
  const widths = raw.map((w) => (w < 2 ? 2 : w * scale));

  const marks: Mark[] = [];
  let x = 0;
  map.drawn.forEach((p, i) => {
    const w = widths[i];
    const cx = x + w / 2;
    const tip = ownershipTip(map, p);

    // The package itself: a plinth under the column, holding its name.
    marks.push({
      id: p.id,
      shape: 'bar',
      paint: '--cell-base',
      x: cx,
      y: TOP + H + PLINTH / 2 + 2,
      w,
      h: PLINTH,
      ...zero,
      alpha: 1,
      tip,
      label: names.get(p.dir)!,
      labelAnchor: 'below',
      labelPriority: p.commits,
    });

    let y = TOP + H;
    const segs = segments(map, p, leaver);
    const othersCount = p.shares.length - segs.filter((s) => s.email).length;
    for (const seg of segs) {
      const h = (seg.commits / p.commits) * H;
      const who = seg.email ? map.people.get(seg.email) : undefined;
      const slot = who?.slot;
      const gone = seg.email !== null && seg.email === leaver;
      const paint: ColorRole =
        slot != null ? (`--owner-${slot}` as ColorRole) : '--ghost';
      marks.push({
        id: `share:${p.dir}:${seg.email ?? '*'}`,
        shape: 'bar',
        paint,
        x: cx,
        y: y - h / 2,
        w,
        h: Math.max(0.5, h - GAP / 2),
        ...zero,
        // The leaver's share fades out; with a leaver, everyone else dims a
        // little so the stranded strips read first.
        alpha: gone ? 0.15 : leaver ? 0.7 : 0.9,
        parent: p.id,
        ...(seg.email && { selects: ids.person(seg.email) }),
        tip: [
          p.dir,
          seg.email
            ? `${who?.name ?? seg.email}${who?.quiet ? ' (quiet)' : ''}: ${pct(seg.commits, p.commits)}% (${seg.commits} commits)`
            : `${othersCount} ${othersCount === 1 ? 'other' : 'others'}: ${pct(seg.commits, p.commits)}%`,
        ],
      });
      y -= h;
    }

    if (p.topQuiet)
      marks.push({
        id: `quiet:${p.dir}`,
        shape: 'poly',
        edge: 'dashed',
        paint: '--text',
        x: cx,
        y: TOP + H / 2,
        w,
        h: H,
        ...zero,
        alpha: 0.9,
        pts: RECT,
        selects: p.id,
        parent: p.id,
        z: 1,
        tip,
      });

    if (stranded.has(p.dir))
      marks.push({
        id: `strand:${p.dir}`,
        shape: 'bar',
        paint: '--accent',
        x: cx,
        y: TOP + H + PLINTH + 4 + STRAND / 2,
        w,
        h: STRAND,
        ...zero,
        alpha: 1,
        selects: p.id,
        parent: p.id,
        z: 1,
        tip: [
          p.dir,
          `Nobody else knows it: ${map.people.get(leaver!)?.name ?? leaver} is its only knower.`,
        ],
      });
    x += w + GAP;
  });

  const leaverName = leaver ? (map.people.get(leaver)?.name ?? leaver) : '';
  const headline = !leaver
    ? 'Select a person to see which packages nobody else would know if they left.'
    : stranded.size === 0
      ? `If ${leaverName} left, every package they work on still has someone who knows it.`
      : `If ${leaverName} left, ${stranded.size} package${stranded.size === 1 ? '' : 's'} would have nobody left who knows ${stranded.size === 1 ? 'it' : 'them'}.`;
  const note = noteMark('what-if', headline, W / 2, 16);
  if (leaver && stranded.size > 0) note.labelClass = 'atlas-label--accent';
  marks.push(note);
  const guides: Guide[] = [
    {
      id: 'axis-0',
      kind: 'line',
      x1: 0,
      y1: TOP + H,
      x2: W,
      y2: TOP + H,
      paint: '--muted',
      alpha: 0.3,
    },
    {
      id: 'axis-50',
      kind: 'line',
      x1: 0,
      y1: TOP + H / 2,
      x2: W,
      y2: TOP + H / 2,
      paint: '--muted',
      alpha: 0.15,
    },
    {
      id: 'axis-100',
      kind: 'line',
      x1: 0,
      y1: TOP,
      x2: W,
      y2: TOP,
      paint: '--muted',
      alpha: 0.15,
    },
  ];
  return {
    marks,
    links: [],
    guides,
    bounds: { x: -10, y: 0, w: W + 20, h: TOP + H + PLINTH + STRAND + 60 },
  };
}
