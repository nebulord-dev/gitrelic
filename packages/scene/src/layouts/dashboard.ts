// The Overview dashboard (docs/atlas-views.md › Overview), on trial beside the
// fan and the ring: a bento. The repo's vitals in a strip; then the lead, the
// loudest lens (or the one picked) as a large card over the list of what it
// points at, with the other outliers in a column beside it; then every calm
// lens as a chip. Picking a tile or chip puts that lens in the lead. Every
// lens keeps its `analyzer:` id wherever it sits, so a chip grows into the
// lead and the old lead settles back into its place; the lead's rows are the
// fanned entities, with the ids the other forms give them.

import { ids } from '../ids';
import { splitReading } from '../overview/viewHeadlines';
import { LABEL_CLASS, RAMP, ZERO } from './overviewParts';
import type { Mark, Scene } from '../model';
import type { LensReading } from '../overview/readings';
import type { FannedEntity } from '../overview/topEntities';
import type { Vital } from '../overview/vitals';

/** The world's width; the stage fits it. */
const WIDTH = 1400;
const GAP = 16;
const MARGIN = 24;
const VITAL_H = 64;
/** The lead takes the left of the bento, the other outliers the right. */
const LEAD_W = 780;
const LEAD_H = 110;
/** The lead's rows: a fanned entity each, a bar of its weight under it. */
const ROW_H = 24;
const ROW_STEP = 36;
const BAR_H = 4;
/** Room inside the lead's frame, round its card and rows. */
const FRAME_PAD = 14;
const FRAME_ALPHA = 0.08;
const OUTLIER_H = 84;
/** The calm lenses' heading, and their chips. */
const CALM_HEAD_H = 52;
const CHIP_H = 30;
const CHIP_GAP = 10;
/**
 * A chip's width from its text, world units: the `--row` card style's name
 * (13px) and reading (12px) advances, its padding and the gap between.
 */
const CHIP_NAME_CHAR = 7.8;
const CHIP_VALUE_CHAR = 7;
const CHIP_PAD = 24 + 12 + 8;
const LEAD_LABEL = 120;
const ROW_LABEL = 110;
const OUTLIER_LABEL = 90;
const CALM_LABEL = 60;
const VITAL_LABEL = 50;

/** The lead when nothing is picked: the highest grade, ties in lens-bar order. */
export function loudestLens(
  readings: readonly LensReading[],
): LensReading | undefined {
  let best: LensReading | undefined;
  for (const r of readings) if (!best || r.grade > best.grade) best = r;
  return best;
}

const SHARE = /^(\d+) of (\d+)/;
const NUMBER = /\d+(?:\.\d+)?/g;

/**
 * A fanned entity's reading as a number, for its bar: "3 of 8 fixed" is a
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

/**
 * The outliers beside the lead, loudest first when the loudest leads. A
 * picked outlier and the loudest swap places: the loudest takes the picked
 * one's slot, so the rest of the column stays put and only the two move. A
 * picked calm lens leaves no slot, so the loudest heads the column.
 */
export function outlierColumn(
  readings: readonly LensReading[],
  lead: LensReading | undefined,
): LensReading[] {
  const loudest = loudestLens(readings);
  const column = readings
    .filter((r) => r.grade >= 2 && r !== loudest)
    .sort((a, b) => b.grade - a.grade);
  if (!lead || !loudest || lead === loudest) return column;
  const slot = column.indexOf(lead);
  if (slot >= 0) {
    column[slot] = loudest;
    return column;
  }
  return loudest.grade >= 2 ? [loudest, ...column] : column;
}

/** A chip's width for its name and reading. */
export const chipWidth = (r: LensReading) =>
  Math.round(
    CHIP_PAD +
      r.label.length * CHIP_NAME_CHAR +
      r.value.length * CHIP_VALUE_CHAR,
  );

export function dashboardScene(
  vitals: readonly Vital[],
  readings: readonly LensReading[],
  /** A lens's top entities: the lead's rows. */
  topOf: (preset: string) => readonly FannedEntity[],
  /** The lens picked to lead; the loudest leads when it's null. */
  picked: string | null,
): Scene {
  const marks: Mark[] = [];
  const lead =
    readings.find((r) => r.preset === picked) ?? loudestLens(readings);

  // The vitals, across the whole width: plain cards, context rather than
  // findings, so the lead is what the eye lands on.
  const vitalW = (WIDTH - (vitals.length - 1) * GAP) / vitals.length;
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

  const top = VITAL_H + GAP * 2;
  let leadBottom = top;
  if (lead) {
    const id = ids.analyzer(lead.preset);
    const hot = lead.grade >= 2;
    const { lead: num, rest } = splitReading(lead.value);
    const cardTop = top + FRAME_PAD;
    const innerW = LEAD_W - 2 * FRAME_PAD;
    marks.push({
      id,
      shape: 'card',
      paint: RAMP[lead.grade],
      x: LEAD_W / 2,
      y: cardTop + LEAD_H / 2,
      r: 0,
      ...ZERO,
      w: innerW,
      h: LEAD_H,
      alpha: 1,
      labelLead: num || undefined,
      label: lead.label,
      // Why it leads, when a rule graded it; else what the number counts.
      labelSub: lead.reason ?? (rest || lead.value),
      labelClass: hot ? 'atlas-label--lead-hot' : 'atlas-label--lead',
      labelPriority: LEAD_LABEL,
      labelAnchor: 'center',
      z: 3,
      tip: [lead.label, lead.value, ...(lead.reason ? [lead.reason] : [])],
    });

    // Its rows: each a fanned entity by name and reading, in rank order,
    // in the fan's slots so a fan in another form morphs into them.
    const entities = topOf(lead.preset);
    const weights = relativeWeights(entities);
    const rowsTop = cardTop + LEAD_H + GAP;
    entities.forEach((e, j) => {
      const y = rowsTop + j * ROW_STEP;
      marks.push({
        id: e.id,
        shape: 'card',
        paint: '--file',
        x: LEAD_W / 2,
        y: y + ROW_H / 2,
        r: 0,
        ...ZERO,
        w: innerW,
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
      const bw = Math.max(2, innerW * weights[j]);
      marks.push({
        id: `weight:${j}`,
        shape: 'bar',
        paint: hot ? '--accent' : '--muted',
        x: FRAME_PAD + bw / 2,
        y: y + ROW_H + 3 + BAR_H / 2,
        r: 0,
        ...ZERO,
        w: bw,
        h: BAR_H,
        alpha: 0.9,
        parent: e.id,
        // Part of its row: a click on it picks the entity.
        selects: e.id,
        z: 2,
      });
    });
    // The last row's bar, or the card when there are none, then the padding.
    leadBottom =
      (entities.length > 0
        ? rowsTop + (entities.length - 1) * ROW_STEP + ROW_H + 3 + BAR_H
        : cardTop + LEAD_H) + FRAME_PAD;

    // The lead's frame, under its card and rows, tinted by its grade: the
    // big section the eye goes to.
    marks.push({
      id: 'frame:lead',
      shape: 'bar',
      paint: RAMP[lead.grade],
      x: LEAD_W / 2,
      y: (top + leadBottom) / 2,
      r: 0,
      ...ZERO,
      w: LEAD_W,
      h: leadBottom - top,
      alpha: FRAME_ALPHA,
      z: 0,
    });
  }

  // The other outliers, a column beside the lead.
  const outliers = outlierColumn(readings, lead);
  const colX = LEAD_W + GAP;
  const colW = WIDTH - colX;
  outliers.forEach((r, i) => {
    const { lead: num, rest } = splitReading(r.value);
    marks.push({
      id: ids.analyzer(r.preset),
      shape: 'card',
      paint: RAMP[r.grade],
      x: colX + colW / 2,
      y: top + i * (OUTLIER_H + GAP) + OUTLIER_H / 2,
      r: 0,
      ...ZERO,
      w: colW,
      h: OUTLIER_H,
      alpha: 1,
      labelLead: num || undefined,
      label: r.label,
      labelSub: r.reason ?? (rest || r.value),
      labelClass: LABEL_CLASS[r.grade],
      labelPriority: OUTLIER_LABEL + r.grade,
      labelAnchor: 'center',
      z: 2,
      tip: [r.label, r.value, ...(r.reason ? [r.reason] : [])],
    });
  });
  const colBottom = top + outliers.length * (OUTLIER_H + GAP) - GAP;

  // Every calm lens as a chip, by name and reading, flowing in lens-bar order.
  const calm = readings.filter((r) => r.grade < 2 && r !== lead);
  const calmTop = Math.max(leadBottom, colBottom) + GAP * 2;
  marks.push({
    id: 'heading:calm',
    shape: 'card',
    paint: '--muted',
    x: 150,
    y: calmTop + CALM_HEAD_H / 2,
    r: 0,
    ...ZERO,
    w: 300,
    h: CALM_HEAD_H,
    alpha: 1,
    label: 'Within normal',
    labelSub: `${calm.length} ${calm.length === 1 ? 'lens' : 'lenses'}`,
    labelClass: 'atlas-label--section',
    labelPriority: CALM_LABEL + 1,
    labelAnchor: 'center',
    z: 1,
  });
  let x = 0;
  let y = calmTop + CALM_HEAD_H + GAP / 2;
  for (const r of calm) {
    const w = Math.min(chipWidth(r), WIDTH);
    if (x > 0 && x + w > WIDTH) {
      x = 0;
      y += CHIP_H + CHIP_GAP;
    }
    marks.push({
      id: ids.analyzer(r.preset),
      shape: 'card',
      paint: RAMP[r.grade],
      x: x + w / 2,
      y: y + CHIP_H / 2,
      r: 0,
      ...ZERO,
      w,
      h: CHIP_H,
      alpha: 1,
      label: r.label,
      labelSub: r.value,
      labelClass: 'atlas-label--row',
      labelPriority: CALM_LABEL,
      labelAnchor: 'center',
      z: 2,
      tip: [r.label, r.value, ...(r.reason ? [r.reason] : [])],
    });
    x += w + CHIP_GAP;
  }
  const bottom = calm.length > 0 ? y + CHIP_H : calmTop + CALM_HEAD_H;

  return {
    marks,
    links: [],
    guides: [],
    bounds: {
      x: -MARGIN,
      y: -MARGIN,
      w: WIDTH + 2 * MARGIN,
      h: bottom + 2 * MARGIN,
    },
  };
}
