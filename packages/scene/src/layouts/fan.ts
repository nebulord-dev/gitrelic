// The Overview fan (docs/atlas-views.md › Overview), the view's landing form:
// the repo, the four other views as nodes headed by their loudest lens, and
// the open view's lenses on an arc. Previewing a lens slides the picture left
// and fans that lens's top entities out of it, exactly as the ring does and
// with the same ids, so either form previews a lens the same way.

import { PRESET_GROUPS } from '../catalog';
import { ids, REPO_ID } from '../ids';
import {
  FAN_VIEWS,
  viewHeadline,
  type FanView,
} from '../overview/viewHeadlines';
import {
  DOT_R,
  fanOut,
  LABEL_CLASS,
  labelledBounds,
  RAMP,
  ZERO,
} from './overviewParts';
import type { Link, Mark, Scene, Viewport } from '../model';
import type { LensReading, RepoReading } from '../overview/readings';
import type { FannedEntity } from '../overview/topEntities';

export interface FanFocus {
  /** The view whose lenses are on the arc. */
  view: FanView;
  /** The lens being previewed and what it fans out, or null. */
  lens: { preset: string; entities: readonly FannedEntity[] } | null;
}

/** Smaller than the ring's centre: here the repo is a root, not a hub. */
const REPO_R = 72;
/** The repo while a lens is previewed: smaller, at the edge. */
const REPO_R_TUCKED = 44;
/** How far the open view's node outgrows the others. */
const OPEN_R = 3;
/** Lenses not previewed: below the labels' cutoff, as on the ring. */
const DIM_LENS = 0.3;
/** Other views while a lens is previewed: still labelled. */
const DIM_VIEW = 0.5;
const MAX_SPAN = (140 * Math.PI) / 180;
const SPAN_PER_LENS = (26 * Math.PI) / 180;

const labelOf = (view: FanView) =>
  PRESET_GROUPS.find((g) => g.id === view)?.label ?? view;

export function fanScene(
  repo: RepoReading,
  readings: readonly LensReading[],
  focus: FanFocus,
  viewport: Viewport,
): Scene {
  const { width: w, height: h } = viewport;
  const cy = h / 2;
  const marks: Mark[] = [];
  const links: Link[] = [];
  const lenses = readings.filter((r) => r.group === focus.view);
  const previewed = focus.lens
    ? lenses.find((r) => r.preset === focus.lens!.preset)
    : undefined;
  // Previewing slides everything left to make room for the lens's fan.
  const shift = previewed ? -w * 0.17 : 0;

  marks.push({
    id: REPO_ID,
    shape: 'outline',
    paint: '--accent',
    x: previewed ? w * 0.06 : w * 0.11,
    y: cy,
    r: previewed ? REPO_R_TUCKED : REPO_R,
    ...ZERO,
    alpha: previewed ? 0.5 : 1,
    label: repo.label,
    labelSub: repo.sub,
    labelClass: 'atlas-label--repo',
    labelPriority: 100,
    labelAnchor: 'center',
    z: 1,
  });

  // The views in rail order, a column; each headed by its loudest lens.
  const viewX = w * 0.36 + shift;
  const gap = h * 0.15;
  FAN_VIEWS.forEach((view, i) => {
    const id = ids.view(view);
    const head = viewHeadline(view, readings);
    const grade = head?.grade ?? 0;
    const open = view === focus.view;
    marks.push({
      id,
      shape: 'dot',
      paint: RAMP[grade],
      x: viewX,
      y: cy + (i - (FAN_VIEWS.length - 1) / 2) * gap,
      r: DOT_R[grade] + (open ? OPEN_R : 0),
      ...ZERO,
      alpha: previewed && !open ? DIM_VIEW : 1,
      label: labelOf(view),
      labelSub: head?.value,
      labelClass: LABEL_CLASS[grade],
      labelPriority: 60 + grade,
      // Above: trunks arrive from the left and branches leave to the right.
      labelAnchor: 'above',
      z: 2,
      tip: [
        labelOf(view),
        ...(head ? [`${head.label}: ${head.value}`] : []),
        ...(head?.reason ? [head.reason] : []),
      ],
    });
    links.push({
      id: `trunk:${view}`,
      source: REPO_ID,
      target: id,
      curve: 'straight',
      width: open ? 1.5 : 1,
      paint: open ? '--link-hot' : '--link',
      alpha: open ? 0.6 : 0.35,
    });
  });

  // The open view's lenses on an arc to its right, centred on the stage's
  // middle rather than on the view, so a view at the bottom keeps its lenses
  // on screen.
  const source = ids.view(focus.view);
  const radius = h * 0.36;
  const span = Math.min(
    MAX_SPAN,
    SPAN_PER_LENS * Math.max(lenses.length - 1, 0),
  );
  lenses.forEach((lens, i) => {
    const t = lenses.length === 1 ? 0 : i / (lenses.length - 1) - 0.5;
    const x = viewX + radius * Math.cos(t * span);
    const y = cy + radius * Math.sin(t * span);
    const id = ids.analyzer(lens.preset);
    const isPreviewed = lens === previewed;
    const dim = previewed && !isPreviewed ? DIM_LENS : 1;
    marks.push({
      id,
      shape: 'dot',
      paint: RAMP[lens.grade],
      x,
      y,
      r: DOT_R[lens.grade],
      ...ZERO,
      alpha: dim,
      // Grows out of its view, and folds back into it when another opens.
      parent: source,
      foldOnExit: true,
      label: lens.label,
      labelSub: lens.value,
      labelClass: LABEL_CLASS[lens.grade],
      labelPriority: lens.grade * 10 + (isPreviewed ? 50 : 0),
      // The previewed lens's fan spreads to the right; its label goes under.
      labelAnchor: isPreviewed ? 'below' : 'right',
      z: lens.grade,
      tip: [lens.label, lens.value, ...(lens.reason ? [lens.reason] : [])],
    });
    links.push({
      id: `branch:${lens.preset}`,
      source,
      target: id,
      curve: 'arc',
      width: lens.grade >= 2 ? 1.5 : 1,
      paint: lens.grade >= 2 ? '--link-hot' : '--link',
      alpha: (lens.grade >= 2 ? 0.6 : 0.35) * dim,
    });
    if (isPreviewed && focus.lens!.entities.length > 0) {
      const fan = fanOut(lens.preset, x, y, 0, h * 0.26, focus.lens!.entities);
      marks.push(...fan.marks);
      links.push(...fan.links);
    }
  });

  return { marks, links, guides: [], bounds: labelledBounds(marks) };
}
