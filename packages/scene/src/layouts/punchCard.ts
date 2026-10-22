// Commit Timing's Punch card (docs/atlas-views.md › Commit Timing): days down
// (Monday first, the weekend last), hours across, each cell a day and hour's
// commits in their authors' local time, shaded from the cell colour by how
// many (log scale, so a few 2am commits still show beside a busy afternoon).
// Off-hours cells (late night 11pm–5am, or the weekend) take the risk colour,
// over a faint band marking where off-hours are.
//
// Selecting a package (a `dir:`, or `repo` for the root's files) or a file
// redraws the grid from its own commits, its off-hours in the accent: "this
// module changes at 2am". A cell's tooltip names who committed in it.
// Cells and bands are layout-only (`punch:`, `punch-band:`), so a
// click on one selects nothing.

import {
  DAY_NAMES,
  DAY_ORDER,
  hourName,
  isOffHours,
  type DayHourGrid,
  type SelectionHours,
} from '../timing/punchCard';
import type { ColorRole, Mark, Paint, Scene, Viewport } from '../model';

const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const plural = (v: number, word: string) =>
  `${n(v)} ${word}${v === 1 ? '' : 's'}`;
const pct = (v: number, of: number) =>
  of === 0 ? '0%' : `${Math.round((v / of) * 100)}%`;

export interface PunchCardInput {
  grid: DayHourGrid;
  /**
   * The selection's own hours, its name, and what its hours count (a
   * package's leave out sweeping and bot commits; a person's are everything
   * they committed).
   */
  selection?: { name: string; hours: SelectionHours; note: string } | null;
  /**
   * Who committed in a cell, for its tooltip ("by Ann 3, Joe 1"), or
   * null to leave the line out (no commits loaded, or a person's own hours).
   */
  who?: ((day: number, hour: number) => string | null) | null;
}

export function punchCardScene(
  { grid, selection = null, who = null }: PunchCardInput,
  viewport: Viewport,
): Scene {
  const total = grid.flat().reduce((s, v) => s + v, 0);
  if (total === 0) {
    return {
      marks: [
        {
          id: 'punch-empty',
          shape: 'card',
          paint: '--muted',
          x: viewport.width / 2,
          y: viewport.height / 2,
          ...zero,
          alpha: 1,
          label: 'No commits in the window',
          labelAnchor: 'center',
          labelPriority: 1000,
        },
      ],
      links: [],
      guides: [],
      bounds: { x: 0, y: 0, w: viewport.width, h: viewport.height },
    };
  }

  const left = 110;
  const top = 120;
  const colW = Math.floor((viewport.width - left - 30) / 24);
  const rowH = 60;
  const x = (hour: number) => left + hour * colW + colW / 2;
  const y = (row: number) => top + row * rowH + rowH / 2;
  const right = left + 24 * colW;
  const bottom = top + 7 * rowH;

  const sel = selection?.hours ?? null;
  const shown = sel ? sel.grid : grid;
  const max = Math.max(1, ...shown.flat());
  const t = (v: number) => (v === 0 ? 0 : Math.log1p(v) / Math.log1p(max));

  const marks: Mark[] = [];
  const band = (id: string, cx: number, cy: number, w: number, h: number) =>
    marks.push({
      id,
      shape: 'bar',
      paint: '--risk-2',
      x: cx,
      y: cy,
      ...zero,
      w,
      h,
      alpha: 0.08,
      z: 0,
    });
  // Where off-hours are: the weekend's rows and the late-night columns.
  band(
    'punch-band:weekend',
    (left + right) / 2,
    top + 6 * rowH,
    right - left + 8,
    2 * rowH + 4,
  );
  band(
    'punch-band:early',
    left + (5 * colW) / 2,
    (top + bottom) / 2,
    5 * colW + 4,
    bottom - top + 8,
  );
  band(
    'punch-band:late',
    right - colW / 2,
    (top + bottom) / 2,
    colW + 4,
    bottom - top + 8,
  );

  DAY_ORDER.forEach((day, row) => {
    for (let hour = 0; hour < 24; hour++) {
      const v = shown[day][hour];
      const off = isOffHours(day, hour);
      // Off-hours stand out in both states: the risk colour for the repo,
      // the accent for a selection (its working hours stay grey).
      const hue: ColorRole = off ? (sel ? '--accent' : '--risk-2') : '--soft';
      const paint: Paint =
        v === 0
          ? '--cell-base'
          : { mix: ['--cell-base', hue], t: 0.25 + 0.75 * t(v) };
      const repo = grid[day][hour];
      marks.push({
        id: `punch:${day}:${hour}`,
        shape: 'bar',
        paint,
        x: x(hour),
        y: y(row),
        ...zero,
        w: colW - 4,
        h: rowH - 6,
        alpha: v === 0 ? 0.55 : 1,
        z: 1,
        tip: [
          `${DAY_NAMES[day]} ${hourName(hour)}${off ? ' · off-hours' : ''}`,
          `${plural(repo, 'commit')} (${pct(repo, total)} of the repo’s)`,
          ...(sel && selection
            ? [
                `${plural(sel.grid[day][hour], 'commit')} touching ${selection.name}`,
              ]
            : []),
          ...(who?.(day, hour) ? [who(day, hour)!] : []),
        ],
      });
    }
    marks.push(
      card(`punch-day:${day}`, left - 14, y(row), DAY_NAMES[day], 'left', 2),
    );
  });
  for (let hour = 0; hour < 24; hour += 3)
    marks.push(
      card(
        `punch-hour:${hour}`,
        x(hour),
        top - 16,
        hourName(hour),
        'center',
        1,
      ),
    );

  marks.push({
    ...card(
      'punch-head',
      left,
      top - 56,
      sel && selection
        ? `${selection.name}: ${plural(sel.commits, 'commit')}, ${pct(sel.offHours, sel.commits)} off-hours`
        : `${plural(total, 'commit')}, each in its author’s local time`,
      'right',
      3,
    ),
    labelSub:
      sel && selection
        ? selection.note
        : 'shaded rows and columns are off-hours: the weekend, and 11pm–5am',
  });

  return {
    marks,
    links: [],
    guides: [],
    bounds: { x: 0, y: top - 90, w: viewport.width, h: bottom - top + 110 },
  };
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
