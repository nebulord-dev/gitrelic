// The Overview fan (docs/atlas-views.md › Overview), the view's landing form:
// the repo, the four other views as cards headed by their loudest lens, and
// the open view's lenses on an arc. Previewing a lens slides the picture left
// (and, near the arc's ends, up or down) and fans that lens's top entities out
// of it, away from the arc's centre, exactly as the ring does and with the
// same ids, so either form previews a lens the same way.

import { PRESET_GROUPS } from '../catalog';
import { ids, REPO_ID } from '../ids';
import {
  FAN_VIEWS,
  splitReading,
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
import type { Guide, Link, Mark, Scene, Viewport } from '../model';
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
/**
 * Tucked, the repo sits this far left of the cards' left edges (from its
 * own edge), placed from the shifted column rather than the stage: room for
 * its orbit (0.7 × its radius past its edge) to clear the cards by over 24,
 * and for the trunks to curve into them instead of hugging their edges.
 */
const TUCK_RUN = 64;
/**
 * A view's card, world units: wide enough for a number beside a two-line
 * name and caption at the ~0.7 zoom the world fits at (the label layer
 * scales the card's text with it).
 */
const CARD_W = 260;
const CARD_H = 84;
/** The repo's dashed orbit, as a multiple of its radius. */
const ORBIT = 1.7;
/** The orbit's dashes, screen px. */
const ORBIT_DASH = 4;
/** Lenses not previewed: below the labels' cutoff, as on the ring. */
const DIM_LENS = 0.3;
/** Other views while a lens is previewed: still labelled (the cutoff is 0.5). */
const DIM_VIEW = 0.6;
const MAX_SPAN = (140 * Math.PI) / 180;
const SPAN_PER_LENS = (26 * Math.PI) / 180;
/** The views' labels: above the lenses', below the previewed one's. */
const VIEW_LABEL = 60;
/** The previewed lens's label outranks every view's and the repo's. */
const PREVIEWED_LABEL = 110;
/** The tucked repo's centred label gives way to the views beside it. */
const REPO_LABEL_TUCKED = 50;
/** The previewed lens's fan, as a share of the stage's height. */
const FAN_RADIUS = 0.26;
/** Room between a fan's outermost entity and the world's top or bottom. */
const FAN_MARGIN = 16;

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
  const viewX = w * 0.38 + shift;
  // Where branches leave the open card: its right edge.
  const outX = viewX + CARD_W / 2;

  // The open view's lenses on an arc to the right of the cards' right edges,
  // centred on the stage's middle rather than on the view, so a view at the
  // bottom keeps its lenses on screen. They step evenly down the arc's
  // height, not its angle, so the ends, where the arc turns back, don't
  // stack them closer than a label.
  const radius = h * 0.36;
  const span = Math.min(
    MAX_SPAN,
    SPAN_PER_LENS * Math.max(lenses.length - 1, 0),
  );
  const reach = radius * Math.sin(span / 2);
  const placed = lenses.map((lens, i) => {
    const t = lenses.length === 1 ? 0 : i / (lenses.length - 1) - 0.5;
    const dy = 2 * t * reach;
    return { lens, dy, dx: Math.sqrt(radius * radius - dy * dy) };
  });

  // Previewing also slides the picture up or down, if it must, so the
  // previewed lens's fan stays in the world. The repo stays put: tucked at
  // the edge, it needn't follow.
  const fanRadius = h * FAN_RADIUS;
  const previewedDy = placed.find((p) => p.lens === previewed)?.dy ?? 0;
  const lift = previewed
    ? Math.min(
        Math.max(cy + previewedDy, fanRadius + FAN_MARGIN),
        h - fanRadius - FAN_MARGIN,
      ) -
      (cy + previewedDy)
    : 0;

  const repoR = previewed ? REPO_R_TUCKED : REPO_R;
  const repoX = previewed
    ? viewX - CARD_W / 2 - TUCK_RUN - REPO_R_TUCKED
    : w * 0.11;
  marks.push({
    id: REPO_ID,
    shape: 'outline',
    paint: '--accent',
    x: repoX,
    y: cy,
    r: repoR,
    ...ZERO,
    alpha: previewed ? 0.5 : 1,
    label: repo.label,
    labelSub: repo.sub,
    labelClass: 'atlas-label--repo',
    labelPriority: previewed ? REPO_LABEL_TUCKED : 100,
    labelAnchor: 'center',
    z: 1,
  });
  // Links run between ports, invisible marks on the repo's and the cards'
  // edges, so they meet a card at its side rather than its centre.
  const port = (id: string, x: number, y: number, parent: string): Mark => ({
    id,
    shape: 'dot',
    paint: '--link',
    x,
    y,
    r: 0,
    ...ZERO,
    alpha: 0,
    parent,
  });
  marks.push(port('port:repo:out', repoX + repoR, cy, REPO_ID));
  const guides: Guide[] = [
    {
      id: 'orbit:repo',
      kind: 'circle',
      x: repoX,
      y: cy,
      r: repoR * ORBIT,
      paint: '--muted',
      alpha: previewed ? 0.2 : 0.35,
      dash: ORBIT_DASH,
    },
  ];

  // The views in rail order, a column of cards; each headed by its loudest
  // lens, its number set large beside the view's name over that lens's name
  // and the rest of its reading. The open view's card is filled; a loud one keeps an accent touch.
  const gap = h * 0.15;
  FAN_VIEWS.forEach((view, i) => {
    const id = ids.view(view);
    const head = viewHeadline(view, readings);
    const grade = head?.grade ?? 0;
    const open = view === focus.view;
    const y = cy + lift + (i - (FAN_VIEWS.length - 1) / 2) * gap;
    const { lead, rest } = splitReading(head?.value ?? '');
    marks.push({
      id,
      shape: 'card',
      paint: RAMP[grade],
      x: viewX,
      y,
      r: 0,
      ...ZERO,
      w: CARD_W,
      h: CARD_H,
      alpha: previewed && !open ? DIM_VIEW : 1,
      labelLead: lead || undefined,
      label: labelOf(view),
      // The lens the number comes from, then the rest of its reading.
      labelSub: head
        ? [head.label, rest].filter(Boolean).join(' · ')
        : undefined,
      labelClass: open ? 'atlas-label--open' : LABEL_CLASS[grade],
      labelPriority: VIEW_LABEL + grade,
      labelAnchor: 'center',
      z: 2,
      tip: [
        labelOf(view),
        ...(head ? [`${head.label}: ${head.value}`] : []),
        ...(head?.reason ? [head.reason] : []),
      ],
    });
    const inPort = `port:${view}:in`;
    marks.push(port(inPort, viewX - CARD_W / 2, y, id));
    // One port out, whichever card is open: it glides to a newly opened one,
    // carrying the branches with it.
    if (open)
      marks.push({
        ...port(`port:${view}:out`, outX, y, id),
        slot: 'port:out',
      });
    links.push({
      id: `trunk:${view}`,
      source: 'port:repo:out',
      target: inPort,
      curve: 's-curve',
      width: open ? 1.5 : 1,
      paint: open ? '--link-hot' : '--link',
      alpha: open ? 0.6 : 0.35,
    });
  });

  const parent = ids.view(focus.view);
  const source = `port:${focus.view}:out`;
  placed.forEach(({ lens, dx, dy }, i) => {
    const x = outX + dx;
    const y = cy + lift + dy;
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
      // Opening another view slides its lenses into these places; any it has
      // over grow out of it, and any short fold back into this one.
      parent,
      foldOnExit: true,
      slot: `lens:${i}`,
      label: lens.label,
      labelSub: lens.value,
      labelClass: LABEL_CLASS[lens.grade],
      labelPriority: isPreviewed ? PREVIEWED_LABEL : lens.grade * 10,
      // The previewed lens's fan spreads outward; its label takes the side
      // the fan leaves free: under one that spreads up, over one that spreads
      // down.
      labelAnchor: isPreviewed ? (dy > 0 ? 'above' : 'below') : 'right',
      z: lens.grade,
      tip: [lens.label, lens.value, ...(lens.reason ? [lens.reason] : [])],
    });
    links.push({
      id: `branch:${lens.preset}`,
      source,
      target: id,
      // Out of the card's side and into the lens level: it stays right of
      // the column, so it never crosses another card.
      curve: 's-curve',
      width: lens.grade >= 2 ? 1.5 : 1,
      paint: lens.grade >= 2 ? '--link-hot' : '--link',
      alpha: (lens.grade >= 2 ? 0.6 : 0.35) * dim,
      slot: `branch:${i}`,
    });
    if (isPreviewed && focus.lens!.entities.length > 0) {
      // Away from the arc's centre, as the ring's fan points away from its
      // own, so it never crosses the other lenses.
      const fan = fanOut(
        lens.preset,
        x,
        y,
        Math.atan2(dy, dx),
        fanRadius,
        focus.lens!.entities,
      );
      marks.push(...fan.marks);
      links.push(...fan.links);
    }
  });

  return { marks, links, guides, bounds: labelledBounds(marks) };
}
