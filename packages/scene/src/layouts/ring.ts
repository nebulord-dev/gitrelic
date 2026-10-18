// The Overview ring (docs/atlas-views.md › Overview): the repo at the centre,
// every lens on an ellipse around it, grouped by view and sized and heated by
// how far outside normal it reads. Focusing a lens fans its top entities out
// beyond it on an arc and dims the rest — the preview of opening that lens,
// with the same entity ids the lens's own view will draw.

import { PRESET_GROUPS } from '../catalog';
import { ids, REPO_ID, type EntityId } from '../ids';
import type { Guide, Link, Mark, Paint, Scene, Viewport } from '../model';
import type { LensReading } from '../overview/readings';
import type { FannedEntity } from '../overview/topEntities';

export interface RingFocus {
  preset: string;
  entities: readonly FannedEntity[];
}

const DOT_R = [5, 7, 10, 14] as const;
const RAMP = ['--risk-0', '--risk-1', '--risk-2', '--risk-3'] as const;
const REPO_R = 44;
const FAN_DOT = 5;
/** Room right of the rightmost mark for its DOM label, world units. */
const LABEL_ROOM = 240;
const MARGIN = 32;

const zero = { w: 0, h: 0, a0: 0, a1: 0 };

function entityPaint(id: EntityId): Paint {
  if (id.startsWith('person:')) return '--person';
  if (id.startsWith('dir:')) return '--dir';
  return '--file';
}

export function ringScene(
  repoName: string,
  readings: readonly LensReading[],
  focus: RingFocus | null,
  viewport: Viewport,
): Scene {
  const cx = viewport.width / 2;
  const cy = viewport.height / 2;
  const rx = viewport.width * 0.3;
  const ry = viewport.height * 0.34;
  const at = (deg: number, ex: number, ey: number): [number, number] => {
    const a = (deg * Math.PI) / 180;
    return [cx + ex * Math.sin(a), cy - ey * Math.cos(a)];
  };

  const marks: Mark[] = [];
  const links: Link[] = [];
  const guides: Guide[] = [];
  const focused = focus?.preset ?? null;
  const dim = (id: string) => (focused && id !== focused ? 0.3 : 1);

  marks.push({
    id: REPO_ID,
    shape: 'ring',
    paint: '--accent',
    x: cx,
    y: cy,
    r: REPO_R,
    ...zero,
    alpha: focused ? 0.5 : 1,
    label: repoName,
    labelPriority: 100,
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
      rx * 0.55,
      ry * 0.55,
    );
    guides.push({
      id: `group:${group.id}`,
      kind: 'text',
      x: gx,
      y: gy,
      text: group.label.toUpperCase(),
      paint: '--muted',
      alpha: focused ? 0.4 : 1,
    });
    const [s1x, s1y] = at(start, rx * 0.68, ry * 0.68);
    const [s2x, s2y] = at(start, rx * 1.08, ry * 1.08);
    guides.push({
      id: `sep:${group.id}`,
      kind: 'line',
      x1: s1x,
      y1: s1y,
      x2: s2x,
      y2: s2y,
      paint: '--link',
      alpha: 1,
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
        ...zero,
        alpha: dim(lens.preset),
        label: `${lens.label} · ${lens.value}`,
        labelPriority: lens.grade * 10 + (lens.preset === focused ? 50 : 0),
        z: lens.grade,
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
    const d = angleOf.get(focus.preset)!;
    const [lx, ly] = at(d, rx, ry);
    const outward = Math.atan2(ly - cy, lx - cx);
    const span = Math.min(Math.PI * 0.9, 0.32 * focus.entities.length);
    const radius = Math.min(viewport.width, viewport.height) * 0.26;
    const source = ids.analyzer(focus.preset);
    focus.entities.forEach((e, i) => {
      const t =
        focus.entities.length === 1 ? 0 : i / (focus.entities.length - 1) - 0.5;
      const a = outward + t * span;
      marks.push({
        id: e.id,
        shape: 'dot',
        paint: entityPaint(e.id),
        x: lx + radius * Math.cos(a),
        y: ly + radius * Math.sin(a),
        r: FAN_DOT,
        ...zero,
        alpha: 1,
        parent: source,
        label: `${e.label} · ${e.value}`,
        labelPriority: 40 - i,
        z: 4,
      });
      links.push({
        id: `fan:${e.id}`,
        source,
        target: e.id,
        curve: 'arc',
        width: 1.2,
        paint: '--link-hot',
        alpha: 0.7,
      });
    });
  }

  return { marks, links, guides, bounds: boundsOf(marks) };
}

/** Every mark, plus margin and room for the labels drawn to their right. */
function boundsOf(marks: readonly Mark[]) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const m of marks) {
    x0 = Math.min(x0, m.x - m.r);
    y0 = Math.min(y0, m.y - m.r);
    x1 = Math.max(x1, m.x + m.r);
    y1 = Math.max(y1, m.y + m.r);
  }
  if (!Number.isFinite(x0)) return { x: 0, y: 0, w: 0, h: 0 };
  return {
    x: x0 - MARGIN,
    y: y0 - MARGIN,
    w: x1 - x0 + 2 * MARGIN + LABEL_ROOM,
    h: y1 - y0 + 2 * MARGIN,
  };
}
