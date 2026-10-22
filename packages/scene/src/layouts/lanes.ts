// Contributors' Lanes form (docs/atlas-views.md › Contributors): one row per
// person (the Flow's people, then everyone else), their commits bin by bin
// over the time strip's weeks, on one square-root height scale and in their
// status's colour. Two lines mark where the statuses split: a last commit
// right of "active" keeps someone active; one left of "gone" makes them gone.
// At the right, each row says its status and when its last commit was.
//
// Each person keeps their `person:` mark (the bar at the start of the row),
// so switching from the Flow, people travel into the column. Rows and bars
// use ids outside the entity kinds (`lane-row:`, `lane:`), and select their
// person (`selects`), so a click anywhere on a row picks them. A selected
// person's bars take the accent and the other rows fade.

import { formatRelative } from '../format/relativeTime';
import { ids, type EntityId } from '../ids';
import { OTHER_PEOPLE_ID, packageName, STATUS_TEXT } from './flow';
import type { PersonStatus } from '../contributors/flow';
import type { LaneRow, Lanes } from '../contributors/lanes';
import type { ColorRole, Guide, Mark, Scene, Viewport } from '../model';

const STATUS_PAINT: Record<PersonStatus, ColorRole> = {
  active: '--soft',
  quiet: '--risk-1',
  ghost: '--risk-2',
};
const ROW_MAX_H = 44;
/** The picture's width over its height: about the stage's shape. */
const WIDE = 2.1;
const BAR_W = 8;
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const DAY = 86_400_000;

const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const plural = (k: number, one: string) =>
  `${n(k)} ${one}${k === 1 ? '' : 's'}`;

export interface LanesOptions {
  /** The selection, when it's a drawn person. */
  focus?: EntityId | null;
  /** "Now" for last-commit ages: the report's last commit (ms). */
  now?: number;
}

const rowId = (row: LaneRow) =>
  row.person ? ids.person(row.person.email) : OTHER_PEOPLE_ID;
const rowName = (row: LaneRow, others: number) =>
  row.person ? row.person.name : `${n(others)} others`;

export function lanesScene(
  lanes: Lanes,
  viewport: Viewport,
  { focus = null, now = Number.NaN }: LanesOptions = {},
): Scene {
  const { rows, binStarts, unit } = lanes;
  const binCount = binStarts.length;
  const bounds = { x: 0, y: 0, w: viewport.width, h: viewport.height };
  if (rows.length === 0 || binCount === 0) {
    return {
      marks: [
        {
          id: 'lanes-empty',
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
      bounds,
    };
  }

  const top = 64;
  const rowH = Math.min(
    ROW_MAX_H,
    (viewport.height - 56 - top) / Math.max(1, rows.length),
  );
  const bottom = top + rowH * rows.length;
  // As wide as the stage is (about twice its height), not the world: the
  // weeks get the room, and a fit fills the stage across, as the Flow does.
  const width = Math.max(viewport.width, Math.round((bottom + 40) * WIDE));
  const headX = 230;
  const left = 250;
  const right = width - 170;
  const statusX = right + 16;
  const colW = (right - left) / binCount;
  const span = binStarts[binCount - 1] - binStarts[0];
  // A cutoff's place: by time across the bins' span (the last bin's start
  // is its right edge, less one bin).
  const xOfTime = (ms: number) =>
    span > 0
      ? left + ((ms - binStarts[0]) / span) * (right - left - colW)
      : left;
  let maxBin = 1;
  for (const row of rows) for (const v of row.bins) if (v > maxBin) maxBin = v;

  const focusRow = focus
    ? rows.find((r) => r.person && ids.person(r.person.email) === focus)
    : undefined;

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
      id: `lanes-grid:${b}`,
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
        `lanes-tick:${b}`,
        x,
        top - 16,
        `${MONTHS[month]} ${String(d.getUTCFullYear()).slice(2)}`,
        'right',
        1,
      ),
    );
  }

  // The status cutoffs, where they fall inside the window.
  const cutoff = (
    id: string,
    ms: number,
    label: string,
    anchor: 'left' | 'right',
    paint: ColorRole,
  ) => {
    if (!Number.isFinite(ms) || ms <= binStarts[0]) return;
    const x = xOfTime(ms);
    guides.push({
      id,
      kind: 'line',
      x1: x,
      y1: top - 4,
      x2: x,
      y2: bottom + 4,
      paint,
      alpha: 0.7,
    });
    marks.push(card(`${id}-label`, x, bottom + 16, label, anchor, 3));
  };
  cutoff('lanes-active', lanes.activeSince, 'active →', 'right', '--soft');
  cutoff('lanes-gone', lanes.goneBefore, '← gone', 'left', '--risk-2');

  rows.forEach((row, k) => {
    const id = rowId(row);
    const name = rowName(row, lanes.others);
    const status = row.person?.status ?? null;
    const paint: ColorRole = status ? STATUS_PAINT[status] : '--ghost';
    const y = top + rowH * (k + 0.5);
    const dim = focusRow !== undefined && focusRow !== row;
    const lit = focusRow === row;
    const total = row.bins.reduce((s, v) => s + v, 0);
    const tip = row.person
      ? [
          name,
          `${plural(row.person.commits, 'commit')} · ${STATUS_TEXT[row.person.status]}`,
          lastCommitLine(row.person.lastCommit, now),
        ]
      : [name, `${plural(total, 'commit')} between them`];

    // The row: hovering anywhere shows its person, a click selects them.
    marks.push({
      id: `lane-row:${id}`,
      parent: id,
      ...(row.person ? { selects: id } : {}),
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
      paint: lit ? '--accent' : paint,
      x: headX,
      y,
      ...zero,
      w: BAR_W,
      h: rowH - 8,
      alpha: dim ? 0.55 : 0.95,
      z: 3,
      label: name,
      labelSub: row.person
        ? plural(row.person.commits, 'commit')
        : 'everyone else, together',
      labelAnchor: 'left',
      labelPriority: 900 - k,
      tip,
    });

    const floor = y + (rowH - 4) / 2 - 3;
    const room = rowH - 12;
    row.bins.forEach((v, b) => {
      if (v === 0) return;
      const h = Math.max(2, room * Math.sqrt(v / maxBin));
      const pkg = row.topPackage[b];
      marks.push({
        id: `lane:${id}:${b}`,
        parent: id,
        ...(row.person ? { selects: id } : {}),
        shape: 'bar',
        paint: lit ? '--accent' : paint,
        x: left + b * colW + colW / 2,
        y: floor - h / 2,
        ...zero,
        w: Math.max(1, colW - 1.5),
        h,
        alpha: dim ? 0.25 : 0.9,
        z: 1,
        tip: [
          name,
          unit === 'week'
            ? `Week of ${dayLabel(binStarts[b])} · ${plural(v, 'commit')}`
            : `${monthLabel(binStarts[b])} · ${plural(v, 'commit')}`,
          ...(pkg !== null ? [`mostly ${packageName(pkg)}`] : []),
        ],
      });
    });

    if (row.person) {
      marks.push({
        ...card(
          `lane-status:${id}`,
          statusX,
          y,
          STATUS_TEXT[row.person.status],
          'right',
          2,
        ),
        labelSub: lastCommitLine(row.person.lastCommit, now),
        labelClass:
          row.person.status === 'ghost' ? 'atlas-label--hot' : undefined,
      });
    }
  });

  marks.push(
    card('lanes-head', left, top - 36, `commits per ${unit}`, 'right', 2),
  );
  return {
    marks,
    links: [],
    guides,
    // Hugging the rows, their ticks and the cutoffs' names.
    bounds: { x: 0, y: 0, w: width, h: bottom + 40 },
  };
}

function lastCommitLine(iso: string, now: number): string {
  const last = Date.parse(iso);
  const days =
    Number.isFinite(last) && Number.isFinite(now)
      ? Math.max(0, Math.round((now - last) / DAY))
      : null;
  const age = formatRelative(days);
  return age === 'today' ? 'last commit today' : `last commit ${age}`;
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
