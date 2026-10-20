// Risk's score stacks (docs/atlas-views.md › Risk): one row per file, its
// score split by reason as a stacked bar, the cursed line drawn in so near
// misses show how close they came. Cursed files come first, then — under a
// separator, on thinner bars — the near misses.
//
// Each reason takes a theme role that already means something: churn the
// accent (heat), ownership the person colour, many authors the same colour
// fainter (the other branch of the same check), an abandoned file ghost grey,
// fix commits the dark end of the risk ramp (its hot end is the accent
// itself), parallel edits the directory colour. A legend above the stacks
// names them.
//
// The axis runs to 100, or past it when a file's reasons add up to more (the
// score caps at 100; the bar doesn't, so a 115 doesn't read as a 100).
//
// A row is its file's `file:` mark: a faint track the full width of the axis,
// so the file travels here from Hotspots and Churn and a click anywhere on
// the row selects it. Segments (`seg:`), names, scores, ticks and the legend
// are layout-only ids; a segment's click selects its file (`selects`).

import { distinctNames } from '../format/distinctNames';
import { ids } from '../ids';
import {
  REASON_KINDS,
  REASON_NAMES,
  segmentTip,
  signalText,
  stackRowTip,
  type RiskStacks,
  type StackRow,
} from '../risk/stacks';
import type { Guide, Mark, Paint, Scene, Viewport } from '../model';
import type { CurseReasonKind } from '@gitrelic/core';

const ROW_MAX_H = 44;
/**
 * Near misses are drawn thinner and a little fainter than cursed files. Not
 * much fainter: the reasons are told apart partly by strength (many authors
 * is a faint ownership), so a faded ownership would read as many authors.
 */
export const NEAR_ALPHA = 0.8;
export const NEAR_THIN = 0.55;
const GAP = 1.5;

/** A reason's colour, and how strongly it's drawn. */
export const REASON_PAINT: Record<
  CurseReasonKind,
  { paint: Paint; alpha: number }
> = {
  churn: { paint: '--accent', alpha: 0.95 },
  ownership: { paint: '--person', alpha: 0.95 },
  authors: { paint: '--person', alpha: 0.5 },
  abandoned: { paint: '--ghost', alpha: 0.95 },
  fixes: { paint: '--risk-1', alpha: 0.95 },
  parallel: { paint: '--dir', alpha: 0.95 },
};

const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export function stacksScene(stacks: RiskStacks, viewport: Viewport): Scene {
  const bounds = { x: 0, y: 0, w: viewport.width, h: viewport.height };
  const { rows, threshold } = stacks;
  if (rows.length === 0) {
    return {
      marks: [
        {
          ...card(
            'empty',
            viewport.width / 2,
            viewport.height / 2,
            'No file scores 40 or more',
            'center',
            0,
          ),
          labelSub:
            'Healthy repos show none: no file adds up enough churn, ownership, fix commits or parallel edits.',
        },
      ],
      links: [],
      guides: [],
      bounds,
    };
  }

  const cursed = rows.filter((r) => r.cursed);
  const near = rows.filter((r) => !r.cursed);
  const left = 280;
  const right = viewport.width - 220;
  const top = 96;
  // The separator takes one row's height when both kinds are drawn.
  const slots = rows.length + (cursed.length > 0 && near.length > 0 ? 1 : 0);
  const rowH = Math.min(ROW_MAX_H, (viewport.height - 56 - top) / slots);
  const barH = Math.min(22, rowH * 0.62);
  const bottom = top + rowH * slots;

  const axisMax = Math.max(100, ...rows.map((r) => r.sum));
  const X = (v: number) => left + (v / axisMax) * (right - left);

  const marks: Mark[] = [];
  const guides: Guide[] = [];

  // Legend: a swatch and a name for each reason, above the stacks.
  let lx = left;
  for (const kind of REASON_KINDS) {
    const { paint, alpha } = REASON_PAINT[kind];
    marks.push({
      id: `legend:${kind}`,
      shape: 'bar',
      paint,
      x: lx + 7,
      y: 32,
      ...zero,
      w: 14,
      h: 10,
      alpha,
      z: 1,
    });
    marks.push(
      card(`legend-label:${kind}`, lx + 18, 32, REASON_NAMES[kind], 'right', 4),
    );
    lx += 30 + REASON_NAMES[kind].length * 7;
  }

  // Ticks every 25, and 100 drawn firmer when the axis runs past it.
  for (let v = 0; v <= axisMax; v += 25) {
    const x = X(v);
    guides.push({
      id: `grid:x:${v}`,
      kind: 'line',
      x1: x,
      y1: top - 8,
      x2: x,
      y2: bottom,
      paint: '--muted',
      alpha: v === 100 && axisMax > 100 ? 0.35 : 0.12,
    });
    marks.push(card(`tick:x:${v}`, x, bottom + 14, String(v), 'center', 1));
  }
  marks.push(card('axis:x', right, bottom + 34, 'risk score', 'left', 0));

  // The cursed line.
  const tx = X(threshold);
  guides.push({
    id: 'threshold',
    kind: 'line',
    x1: tx,
    y1: top - 20,
    x2: tx,
    y2: bottom,
    paint: '--accent',
    alpha: 0.7,
  });
  marks.push(
    card(
      'threshold-label',
      tx,
      top - 30,
      `cursed at ${threshold}`,
      'center',
      5,
    ),
  );

  const names = distinctNames(rows.map((r) => r.file));
  let slot = 0;
  const drawRow = (row: StackRow) => {
    const y = top + rowH * (slot + 0.5);
    slot++;
    const name = names.get(row.file) ?? baseName(row.file);
    const fileId = ids.file(row.file);
    const dim = row.cursed ? 1 : NEAR_ALPHA;

    marks.push({
      id: fileId,
      shape: 'bar',
      paint: '--cell-base',
      x: (left + right) / 2,
      y,
      ...zero,
      w: right - left,
      h: rowH - 4,
      alpha: 1,
      z: 0,
      tip: stackRowTip(row, name),
    });
    marks.push(card(`risk-name:${row.file}`, left - 12, y, name, 'left', 3));

    // The split; one unknown segment for a report made before it.
    const parts =
      row.breakdown.length > 0
        ? row.breakdown.map((r) => ({
            key: r.kind,
            points: r.points,
            ...REASON_PAINT[r.kind],
            tip: segmentTip(r),
          }))
        : [
            {
              key: 'unknown',
              points: row.score,
              paint: '--ghost' as Paint,
              alpha: 0.6,
              tip: [
                `${row.score} pts`,
                'The split by reason isn’t in this report',
              ],
            },
          ];
    let at = 0;
    for (const p of parts) {
      const x0 = X(at);
      const x1 = X(at + p.points);
      at += p.points;
      marks.push({
        id: `seg:${row.file}:${p.key}`,
        shape: 'bar',
        paint: p.paint,
        x: (x0 + x1) / 2,
        y,
        ...zero,
        w: Math.max(1, x1 - x0 - GAP),
        h: row.cursed ? barH : barH * NEAR_THIN,
        alpha: p.alpha * dim,
        z: 2,
        parent: fileId,
        selects: fileId,
        tip: p.tip,
      });
    }

    const signals = signalText(row);
    marks.push(
      card(
        `risk-score:${row.file}`,
        X(row.sum) + 8,
        y,
        signals ? `${row.score}   ${signals}` : String(row.score),
        'right',
        2,
      ),
    );
  };

  cursed.forEach(drawRow);
  if (cursed.length > 0 && near.length > 0) {
    const y = top + rowH * (slot + 0.5);
    slot++;
    guides.push({
      id: 'near:rule',
      kind: 'line',
      x1: left,
      y1: y,
      x2: right,
      y2: y,
      paint: '--muted',
      alpha: 0.3,
    });
    marks.push(
      card(
        'near-label',
        left - 12,
        y,
        `near misses, under ${threshold}`,
        'left',
        6,
      ),
    );
  }
  near.forEach(drawRow);

  return { marks, links: [], guides, bounds };
}

function card(
  id: string,
  x: number,
  y: number,
  label: string,
  labelAnchor: Mark['labelAnchor'],
  labelPriority: number,
): Mark {
  return {
    id,
    shape: 'card',
    paint: '--muted',
    x,
    y,
    ...zero,
    alpha: 1,
    label,
    labelPriority: labelPriority + 1000,
    labelAnchor,
  };
}
