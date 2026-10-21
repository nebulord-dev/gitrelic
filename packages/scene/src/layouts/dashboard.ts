// The Overview dashboard (docs/atlas-views.md › Overview), on trial beside the
// fan and the ring: the repo's vitals in a strip, then each view's lenses as
// tiles in a grid, a loud lens wider and in the accent. Previewing a lens
// opens its tile in place, two columns wide and as tall as it needs, over the list of what it points at;
// those rows are the fanned entities, with the ids the other forms give them,
// so they travel when the form or the lens changes.

import { PRESET_GROUPS } from '../catalog';
import { ids } from '../ids';
import { FAN_VIEWS, splitReading } from '../overview/viewHeadlines';
import { LABEL_CLASS, RAMP, ZERO } from './overviewParts';
import type { Mark, Scene } from '../model';
import type { LensReading } from '../overview/readings';
import type { FannedEntity } from '../overview/topEntities';
import type { Vital } from '../overview/vitals';

export interface DashboardFocus {
  /** The lens whose tile is open, and what it fans out. */
  preset: string;
  entities: readonly FannedEntity[];
}

/** Columns of tiles per view. */
export const COLS = 5;
/**
 * A tile's card, world units: wide enough for a number beside a two-line
 * name and reading at the ~0.7 zoom the world fits at (the label layer
 * shrinks a card's text that would outgrow it).
 */
const TILE_W = 230;
const TILE_H = 84;
/** The bars under a closed tile: its top entities, relative to the first. */
const SPARK_H = 20;
const SPARK_GAP = 6;
const SPARK_PAD = 18;
const CELL_H = TILE_H + SPARK_GAP + SPARK_H;
const GAP = 12;
/** The column of view names left of the tiles. */
const HEAD_W = 160;
const VITAL_H = 64;
/** Between the vitals and the first view, and between views. */
const SECTION_GAP = 28;
/** An open tile's rows: one per fanned entity, under its card. */
const ROW_H = 24;
const ROW_STEP = 28;
const MARGIN = 24;
/** Other tiles while one is open: dimmed, still labelled (the cutoff is 0.5). */
const DIM = 0.55;
const OPEN_LABEL = 110;
const ROW_LABEL = 100;
const SECTION_LABEL = 80;
const TILE_LABEL = 60;
const VITAL_LABEL = 50;

const SHARE = /^(\d+) of (\d+)/;
const NUMBER = /\d+(?:\.\d+)?/g;

/** Grid rows an open tile takes: two at least, more for a long list. */
export const openRows = (entities: number) =>
  Math.max(2, Math.ceil((TILE_H + GAP + entities * ROW_STEP) / (CELL_H + GAP)));

const viewLabel = (id: string) =>
  PRESET_GROUPS.find((g) => g.id === id)?.label ?? id;

/**
 * Places tiles of the given spans (in cells) on a grid `cols` wide, each in
 * the first free spot reading row by row, so a small tile fills the hole a
 * wide one leaves (CSS grid's `dense` flow).
 */
export function packTiles(
  spans: readonly { w: number; h: number }[],
  cols: number,
): { col: number; row: number }[] {
  const taken: boolean[][] = [];
  const free = (row: number, col: number, w: number, h: number) => {
    for (let r = row; r < row + h; r++)
      for (let c = col; c < col + w; c++) if (taken[r]?.[c]) return false;
    return true;
  };
  return spans.map(({ w, h }) => {
    const width = Math.min(w, cols);
    for (let row = 0; ; row++)
      for (let col = 0; col + width <= cols; col++)
        if (free(row, col, width, h)) {
          for (let r = row; r < row + h; r++)
            for (let c = col; c < col + width; c++) (taken[r] ??= [])[c] = true;
          return { col, row };
        }
  });
}

/**
 * A fanned entity's reading as a number, for the bars: "3 of 8 fixed" is a
 * share, anything else its last number ("+3,695 lines a month" is 3695).
 */
export function readingWeight(value: string): number {
  const share = value.match(SHARE);
  if (share) {
    const of = Number(share[2]);
    return of > 0 ? Number(share[1]) / of : 0;
  }
  const nums = value.replace(/,/g, '').match(NUMBER);
  return nums ? Number(nums[nums.length - 1]) : 0;
}

/** Each entity's weight as a share of the heaviest. */
function relativeWeights(entities: readonly FannedEntity[]): number[] {
  const ws = entities.map((e) => readingWeight(e.value));
  const top = Math.max(0, ...ws);
  return ws.map((w) => (top > 0 ? w / top : 0));
}

export function dashboardScene(
  vitals: readonly Vital[],
  readings: readonly LensReading[],
  /** A lens's top entities: its bars when closed, its rows when open. */
  topOf: (preset: string) => readonly FannedEntity[],
  focus: DashboardFocus | null,
): Scene {
  const marks: Mark[] = [];
  const gridW = COLS * TILE_W + (COLS - 1) * GAP;
  const width = HEAD_W + gridW;

  // The vitals, across the whole width.
  const vitalW = (width - (vitals.length - 1) * GAP) / vitals.length;
  vitals.forEach((v, i) => {
    marks.push({
      id: `vital:${v.key}`,
      shape: 'card',
      paint: '--muted',
      x: i * (vitalW + GAP) + vitalW / 2,
      y: VITAL_H / 2,
      r: 0,
      ...ZERO,
      w: vitalW,
      h: VITAL_H,
      alpha: 1,
      labelLead: v.lead,
      label: v.label,
      labelSub: v.sub,
      labelPriority: VITAL_LABEL,
      labelAnchor: 'center',
      z: 1,
    });
  });

  let top = VITAL_H + SECTION_GAP;
  for (const view of FAN_VIEWS) {
    const lenses = readings.filter((r) => r.group === view);
    const loud = lenses.filter((r) => r.grade >= 2).length;
    // The view's name, top left of its tiles; it selects nothing.
    marks.push({
      id: `section:${view}`,
      shape: 'dot',
      paint: '--muted',
      x: 0,
      y: top + 14,
      r: 0,
      ...ZERO,
      alpha: 1,
      label: viewLabel(view),
      labelSub: loud ? `${loud} outside normal` : 'all within normal',
      labelClass: loud ? 'atlas-label--hot' : undefined,
      labelPriority: SECTION_LABEL,
      labelAnchor: 'right',
      z: 1,
    });

    const spans = lenses.map((r) =>
      r.preset === focus?.preset
        ? { w: 2, h: openRows(focus.entities.length) }
        : { w: r.grade === 3 ? 2 : 1, h: 1 },
    );
    const places = packTiles(spans, COLS);
    let rows = 1;
    lenses.forEach((lens, i) => {
      const { col, row } = places[i];
      const span = spans[i];
      rows = Math.max(rows, row + span.h);
      const open = lens.preset === focus?.preset;
      const w = span.w * TILE_W + (span.w - 1) * GAP;
      const left = HEAD_W + col * (TILE_W + GAP);
      const cellTop = top + row * (CELL_H + GAP);
      const id = ids.analyzer(lens.preset);
      const hot = lens.grade >= 2;
      const { lead, rest } = splitReading(lens.value);
      marks.push({
        id,
        shape: 'card',
        paint: RAMP[lens.grade],
        x: left + w / 2,
        y: cellTop + TILE_H / 2,
        r: 0,
        ...ZERO,
        w,
        h: TILE_H,
        alpha: focus && !open ? DIM : 1,
        labelLead: lead || undefined,
        label: lens.label,
        labelSub: rest || undefined,
        labelClass: open ? 'atlas-label--open' : LABEL_CLASS[lens.grade],
        labelPriority: open ? OPEN_LABEL : TILE_LABEL + lens.grade,
        labelAnchor: 'center',
        z: 2,
        tip: [lens.label, lens.value, ...(lens.reason ? [lens.reason] : [])],
      });

      if (open) {
        // The rows: each a fanned entity, by name and reading, in rank order.
        focus!.entities.forEach((e, j) => {
          marks.push({
            id: e.id,
            shape: 'card',
            paint: '--file',
            x: left + w / 2,
            y: cellTop + TILE_H + GAP + j * ROW_STEP + ROW_H / 2,
            r: 0,
            ...ZERO,
            w,
            h: ROW_H,
            alpha: 1,
            parent: id,
            slot: `fan:${j}`,
            label: e.label,
            labelSub: e.value,
            labelClass: 'atlas-label--row',
            labelPriority: ROW_LABEL - j,
            labelAnchor: 'center',
            z: 3,
            tip: [e.label, e.value],
          });
        });
        return;
      }
      // Closed: a bar per top entity under the card, the heaviest full height.
      const weights = relativeWeights(topOf(lens.preset));
      const n = weights.length;
      const bw = n > 0 ? (w - 2 * SPARK_PAD - (n - 1) * 3) / n : 0;
      weights.forEach((wt, j) => {
        const h = Math.max(2, SPARK_H * wt);
        marks.push({
          id: `spark:${lens.preset}:${j}`,
          shape: 'bar',
          paint: hot ? '--accent' : '--muted',
          x: left + SPARK_PAD + j * (bw + 3) + bw / 2,
          y: cellTop + CELL_H - h / 2,
          r: 0,
          ...ZERO,
          w: bw,
          h,
          alpha: (focus ? DIM : 1) * 0.8,
          parent: id,
          // A bar is part of its tile: a click on it picks the lens.
          selects: id,
          z: 1,
        });
      });
    });
    top += rows * CELL_H + (rows - 1) * GAP + SECTION_GAP;
  }

  const bottom = top - SECTION_GAP;
  return {
    marks,
    links: [],
    guides: [],
    bounds: {
      x: -MARGIN,
      y: -MARGIN,
      w: width + 2 * MARGIN,
      h: bottom + 2 * MARGIN,
    },
  };
}
