// AI & Co-authors' Adoption lanes (docs/atlas-views.md › AI & Co-authors):
// one row per person, their commits bin by bin over the time strip's weeks
// on one square-root height scale, the part with AI in it in the accent
// (a lighter shade for an agent's own commits), drawn from the baseline up
// so a row's AI reads as a floor rising under its weeks. At the right, each
// row says what share of its commits had AI in them and since when; names
// stay one line (React's 14 rows culled every other two-line label).
//
// Each person keeps their `person:` mark (the bar at the start of the row),
// so people travel from Contributors and Parallel Dev. Rows and bars use ids
// outside the entity kinds (`adopt-row:`, `adopt:`, `adopt-ai:`) and select
// their person. A selected person's row stays at full strength and the
// others fade.

import { AUTHORED_PAINT } from './aiPackages';
import type { AdoptionLanes, AdoptionRow } from '../ai/adoption';
import type { EntityId } from '../ids';
import type { Guide, Mark, Scene, Viewport } from '../model';

const ROW_MAX_H = 44;
/** The picture's width over its height: about the stage's shape. */
const WIDE = 2.1;
const BAR_W = 8;
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const plural = (k: number, one: string) =>
  `${n(k)} ${one}${k === 1 ? '' : 's'}`;
const pct = (v: number, of: number) =>
  of === 0 ? '0%' : `${Math.round((v / of) * 100)}%`;

/** A row's tooltip line: "11 of 111 with AI · since Jun 29, 2026". */
export function adoptionLine(row: AdoptionRow): string {
  if (row.agent) return `${plural(row.commits, 'commit')} of its own`;
  if (row.ai === 0) return `${plural(row.commits, 'commit')} · none with AI`;
  return `${n(row.ai)} of ${n(row.commits)} with AI · since ${dayLabel(row.firstAi!)}`;
}

/** A row's note at the right: "10% · since Jun 29". */
export function adoptionShare(row: AdoptionRow): string {
  if (row.agent) return 'agent';
  if (row.ai === 0) return 'none';
  return `${pct(row.ai, row.commits)} · since ${shortDay(row.firstAi!)}`;
}

export function adoptionLanesScene(
  lanes: AdoptionLanes,
  viewport: Viewport,
  { focus = null }: { focus?: EntityId | null } = {},
): Scene {
  const { rows, binStarts, unit } = lanes;
  const binCount = binStarts.length;
  if (rows.length === 0 || binCount === 0) {
    return {
      marks: [
        card(
          'adopt-empty',
          viewport.width / 2,
          viewport.height / 2,
          'No commits in the window',
          'center',
          1000,
        ),
      ],
      links: [],
      guides: [],
      bounds: { x: 0, y: 0, w: viewport.width, h: viewport.height },
    };
  }

  const top = 96;
  const rowH = Math.min(
    ROW_MAX_H,
    (viewport.height - 70 - top) / Math.max(1, rows.length),
  );
  const bottom = top + rowH * rows.length;
  const height = bottom + 70;
  const width = Math.max(viewport.width, Math.round(height * WIDE));
  // Room for a long name ("Sebastian “Sebbie” Silbermann") left of the row.
  const headX = 280;
  const left = 300;
  const right = width - 210;
  const colW = (right - left) / binCount;
  let maxBin = 1;
  for (const row of rows) for (const v of row.bins) if (v > maxBin) maxBin = v;
  const focusRow = focus ? rows.find((r) => r.id === focus) : undefined;

  const marks: Mark[] = [];
  const guides: Guide[] = [];

  // Quarter starts (years, past two years of weeks) along the top.
  let lastMonth = -1;
  for (let b = 0; b < binCount; b++) {
    const d = new Date(binStarts[b]);
    const month = d.getUTCMonth();
    if (month === lastMonth) continue;
    const first = lastMonth === -1;
    lastMonth = month;
    if (!first && month % (unit === 'month' ? 12 : 3) !== 0) continue;
    const x = left + b * colW;
    guides.push({
      id: `adopt-grid:${b}`,
      kind: 'line',
      x1: x,
      y1: top - 6,
      x2: x,
      y2: bottom,
      paint: '--muted',
      alpha: 0.12,
    });
    marks.push(
      card(
        `adopt-tick:${b}`,
        x,
        top - 16,
        `${MONTHS[month]} ${String(d.getUTCFullYear()).slice(2)}`,
        'right',
        1,
      ),
    );
  }

  rows.forEach((row, k) => {
    const { id } = row;
    const y = top + rowH * (k + 0.5);
    const dim = focusRow !== undefined && focusRow !== row;
    const lit = focusRow === row;
    const line = adoptionLine(row);
    const tip = [row.name, line];
    const aiPaint = row.agent ? AUTHORED_PAINT : '--accent';

    marks.push({
      id: `adopt-row:${id}`,
      parent: id,
      selects: id,
      shape: 'bar',
      paint: '--cell-base',
      x: (headX + right) / 2,
      y,
      ...zero,
      w: right - headX + 8,
      h: rowH - 4,
      alpha: lit ? 1 : 0.6,
      z: 0,
      tip,
    });
    marks.push({
      id,
      shape: 'bar',
      paint: row.ai > 0 ? aiPaint : '--ghost',
      x: headX,
      y,
      ...zero,
      w: BAR_W,
      h: rowH - 8,
      alpha: dim ? 0.55 : 0.95,
      z: 3,
      label: row.name,
      labelAnchor: 'left',
      labelPriority: 900 - k,
      tip,
    });

    const floor = y + (rowH - 4) / 2 - 3;
    const room = rowH - 12;
    row.bins.forEach((v, b) => {
      if (v === 0) return;
      const h = Math.max(2, room * Math.sqrt(v / maxBin));
      const a = row.aiBins[b];
      const aH = a === v ? h : (h * a) / v;
      const x = left + b * colW + colW / 2;
      const w = Math.max(1, colW - 1.5);
      const when =
        unit === 'week'
          ? `Week of ${dayLabel(binStarts[b])}`
          : monthLabel(binStarts[b]);
      const barTip = [
        row.name,
        `${when} · ${plural(v, 'commit')}`,
        a > 0
          ? `${n(a)} with AI in ${a === 1 ? 'it' : 'them'}`
          : 'none with AI',
      ];
      if (aH < h)
        marks.push({
          id: `adopt:${id}:${b}`,
          parent: id,
          selects: id,
          shape: 'bar',
          paint: '--ghost',
          x,
          y: floor - aH - (h - aH) / 2,
          ...zero,
          w,
          h: h - aH,
          alpha: dim ? 0.25 : 0.9,
          z: 1,
          tip: barTip,
        });
      if (aH > 0)
        marks.push({
          id: `adopt-ai:${id}:${b}`,
          parent: id,
          selects: id,
          shape: 'bar',
          paint: aiPaint,
          x,
          y: floor - aH / 2,
          ...zero,
          w,
          h: aH,
          alpha: dim ? 0.3 : 1,
          z: 2,
          tip: barTip,
        });
    });

    marks.push({
      ...card(
        `adopt-share:${id}`,
        right + 14,
        y,
        adoptionShare(row),
        'right',
        800 - k,
      ),
      selects: id,
      alpha: dim ? 0.55 : row.ai === 0 ? 0.6 : 1,
    });
  });

  if (lanes.others > 0)
    marks.push(
      card(
        'adopt-others',
        left,
        bottom + 18,
        `+${n(lanes.others)} other ${lanes.others === 1 ? 'person' : 'people'} not drawn` +
          (lanes.othersWithAi > 0
            ? `, ${n(lanes.othersWithAi)} of them with AI commits`
            : ''),
        'right',
        700,
      ),
    );

  marks.push({
    ...card(
      'adopt-head',
      left,
      top - 60,
      'Who used AI, and since when',
      'right',
      1000,
    ),
    labelSub:
      'each week’s commits; the part with AI in it in the accent, from the baseline up; at the right, the share with AI and since when',
  });

  return {
    marks,
    links: [],
    guides,
    bounds: { x: 0, y: top - 90, w: width, h: bottom - top + 90 + 50 },
  };
}

function shortDay(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function monthLabel(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function dayLabel(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
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
