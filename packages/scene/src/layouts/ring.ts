// The Overview ring (docs/atlas-views.md › Overview): the repo at the centre,
// every lens on an ellipse around it, grouped by view and sized and heated by
// how far outside normal it reads. Focusing a lens fans its top entities out
// beyond it on an arc and dims the rest — the preview of opening that lens,
// with the same entity ids the lens's own view will draw.

import { PRESET_GROUPS } from '../catalog';
import { ids, REPO_ID } from '../ids';
import {
  anchorFor,
  DOT_R,
  fanOut,
  LABEL_CLASS,
  labelledBounds,
  RAMP,
  ZERO,
} from './overviewParts';
import type { Guide, Link, Mark, Scene, Viewport } from '../model';
import type { LensReading, RepoReading } from '../overview/readings';
import type { FannedEntity } from '../overview/topEntities';

export interface RingFocus {
  preset: string;
  entities: readonly FannedEntity[];
}

/**
 * Wide enough to hold the repo's name and size ("7,009 files · 999K lines")
 * at full zoom; the size line drops out when the stage zooms out further.
 */
const REPO_R = 104;

/**
 * How far a side label leans away from the ring's horizontal axis, as a
 * fraction of its height at the very top or bottom. Near there the ellipse
 * stacks neighbouring lenses closer than a two-line label is tall.
 */
const LEAN = 0.5;
/** How far a fanned lens's label moves off its spoke, as a fraction of its height. */
const SPOKE_CLEAR = 0.6;

/** Side labels lean apart near the top and bottom; others don't lean. */
function leanFor(dx: number, dy: number): number | undefined {
  const anchor = anchorFor(dx, dy);
  if (anchor !== 'left' && anchor !== 'right') return undefined;
  return (dy / (Math.hypot(dx, dy) || 1)) * LEAN;
}

/**
 * A fanned lens's label, clear of both its fan (which spreads outward,
 * nearly a half-circle) and its spoke (which runs inward). On the ring's
 * sides it turns inward and moves up off a spoke heading down, or down off
 * one heading up. At the very top or bottom the inward side is the spoke
 * itself, so it goes to the outer side, dropped toward the centre: below
 * the fan, beside the spoke.
 */
function fannedLabel(
  dx: number,
  dy: number,
): Pick<Mark, 'labelAnchor' | 'labelLean'> {
  const inward = anchorFor(-dx, -dy);
  // Above the middle (or level with it), the spoke heads down to the centre.
  const above = dy <= 0;
  if (inward === 'above' || inward === 'below')
    return {
      labelAnchor: dx < 0 ? 'left' : 'right',
      // Toward the centre: below a fan that spreads upward, and vice versa.
      labelLean: above ? SPOKE_CLEAR : -SPOKE_CLEAR,
    };
  // Away from the centre: up off a spoke heading down, and vice versa.
  return { labelAnchor: inward, labelLean: above ? -SPOKE_CLEAR : SPOKE_CLEAR };
}

export function ringScene(
  repo: RepoReading,
  readings: readonly LensReading[],
  focus: RingFocus | null,
  viewport: Viewport,
): Scene {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const rx = viewport.width * 0.28;
  const ry = viewport.height * 0.34;
  const at = (deg: number, ex: number, ey: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + ex * Math.sin(a), cy - ey * Math.cos(a)];
  };

  const marks: Mark[] = [];
  const links: Link[] = [];
  const guides: Guide[] = [];
  const focused = focus?.preset ?? null;
  // The lens whose entities fan out beyond it: its label turns inward, so
  // the fan's curves don't run through it.
  const fanned = focus && focus.entities.length > 0 ? focus.preset : null;
  const dim = (id: string) => (focused && id !== focused ? 0.3 : 1);

  marks.push({
    id: REPO_ID,
    shape: 'outline',
    paint: '--accent',
    x: cx,
    y: cy,
    r: REPO_R,
    ...ZERO,
    alpha: focused ? 0.5 : 1,
    label: repo.label,
    labelSub: repo.sub,
    labelClass: 'atlas-label--repo',
    labelPriority: 100,
    labelAnchor: 'center',
    z: 1,
  });

  // Each lens gets an equal slice; views keep their lenses together, with
  // the first view centred on 12 o'clock.
  const groups = PRESET_GROUPS.filter((g) => g.id !== 'overview')
    .map((g) => ({
      ...g,
      lenses: readings.filter((r) => r.group === g.id),
    }))
    .filter((g) => g.lenses.length > 0);
  const total = groups.reduce((s, g) => s + g.lenses.length, 0);
  const step = total > 0 ? 360 / total : 0;
  let deg = groups.length > 0 ? -(groups[0].lenses.length * step) / 2 : 0;
  const angleOf = new Map<string, number>();

  for (const group of groups) {
    const start = deg;
    const [gx, gy] = at(
      start + (group.lenses.length * step) / 2,
      rx * 0.58,
      ry * 0.58,
    );
    // The view's name: a label-only mark (cards draw nothing on the canvas),
    // since the canvas draws no text and labels are DOM. It carries the
    // view's id, so the fan's view node travels to it when the form
    // changes; a 0×0 card can't be hit, so clicking near it selects nothing.
    marks.push({
      id: ids.view(group.id),
      shape: 'card',
      paint: '--muted',
      x: gx,
      y: gy,
      r: 0,
      ...ZERO,
      alpha: focused ? 0 : 1,
      label: group.label.toUpperCase(),
      labelPriority: 5,
      labelAnchor: 'center',
    });

    group.lenses.forEach((lens, i) => {
      const d = start + (i + 0.5) * step;
      angleOf.set(lens.preset, d);
      const [x, y] = at(d, rx, ry);
      const id = ids.analyzer(lens.preset);
      marks.push({
        id,
        shape: 'dot',
        paint: RAMP[lens.grade],
        x,
        y,
        r: DOT_R[lens.grade],
        ...ZERO,
        alpha: dim(lens.preset),
        label: lens.label,
        labelSub: lens.value,
        labelClass: LABEL_CLASS[lens.grade],
        labelPriority: lens.grade * 10 + (lens.preset === focused ? 50 : 0),
        ...(lens.preset === fanned
          ? fannedLabel(x - cx, y - cy)
          : {
              labelAnchor: anchorFor(x - cx, y - cy),
              labelLean: leanFor(x - cx, y - cy),
            }),
        z: lens.grade,
        tip: [lens.label, lens.value, ...(lens.reason ? [lens.reason] : [])],
      });
      links.push({
        id: `spoke:${lens.preset}`,
        source: REPO_ID,
        target: id,
        curve: 'straight',
        width: lens.grade >= 2 ? 1.5 : 1,
        paint: lens.grade >= 2 ? '--link-hot' : '--link',
        alpha: (lens.grade >= 2 ? 0.6 : 0.35) * dim(lens.preset),
      });
    });
    deg += group.lenses.length * step;
  }

  // The fan: the focused lens's entities on an arc beyond it, pointing away
  // from the centre, so they never cross the ring.
  if (focus && angleOf.has(focus.preset) && focus.entities.length > 0) {
    const [lx, ly] = at(angleOf.get(focus.preset)!, rx, ry);
    const fan = fanOut(
      focus.preset,
      lx,
      ly,
      Math.atan2(ly - cy, lx - cx),
      Math.min(viewport.width, viewport.height) * 0.26,
      focus.entities,
    );
    marks.push(...fan.marks);
    links.push(...fan.links);
  }

  return { marks, links, guides, bounds: labelledBounds(marks) };
}
