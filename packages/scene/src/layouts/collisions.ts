// Parallel Dev's Collision lanes form (docs/atlas-views.md › Parallel Dev):
// the files people collided on as rows, weeks across, and each week two or
// more people committed to one a stack of dots, one per person, in their
// status colour. Where Pairs answers who meets whom, this answers where and
// when.
//
// Each row is its file's `file:` mark (a lockstep family's busiest member,
// the others standing in on it), so a file travels to and from the other
// lenses and a table row lights its lane. Dots are layout-only and select
// their person; a selected person's dots take the accent and the rest fade.

import { distinctNames } from '../format/distinctNames';
import { packageOf } from '../hotspots/points';
import { entityKind, ids, type EntityId } from '../ids';
import { STATUS_TEXT } from './flow';
import type { PersonStatus } from '../contributors/flow';
import type { ColorRole, Guide, Mark, Scene, Viewport } from '../model';
import type { CollisionRow, Collisions } from '../parallel/collisions';

const STATUS_PAINT: Record<PersonStatus, ColorRole> = {
  active: '--soft',
  quiet: '--risk-1',
  ghost: '--risk-2',
};
const ROW_MAX_H = 52;
/** The picture's width over its height: about the stage's shape. */
const WIDE = 2.1;
const DOT_R = 4.5;
/** A family's tooltip names this many of its files. */
const TIP_FILES = 8;
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const plural = (v: number, word: string) =>
  `${n(v)} ${word}${v === 1 ? '' : 's'}`;
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export interface CollisionsOptions {
  /** The selection: a person whose dots light, or a drawn file. */
  focus?: EntityId | null;
}

/** A row's name: its family's, or its file's. */
export const rowName = (row: CollisionRow) => row.family ?? baseName(row.file);

export function collisionsScene(
  data: Collisions,
  viewport: Viewport,
  { focus = null }: CollisionsOptions = {},
): Scene {
  const { rows, binStarts, unit } = data;
  const binCount = binStarts.length;
  if (rows.length === 0 || binCount === 0) {
    return {
      marks: [
        {
          id: 'collisions-empty',
          shape: 'card',
          paint: '--muted',
          x: viewport.width / 2,
          y: viewport.height / 2,
          ...zero,
          alpha: 1,
          label: 'No file had two or more people in two weeks',
          labelSub: 'One overlap on a file is chance, so it isn’t listed.',
          labelAnchor: 'center',
          labelPriority: 1000,
        },
      ],
      links: [],
      guides: [],
      bounds: { x: 0, y: 0, w: viewport.width, h: viewport.height },
    };
  }

  const top = 64;
  // Floored, so a short stage squeezes rows rather than turning them over.
  const rowH = Math.max(
    8,
    Math.min(
      ROW_MAX_H,
      (viewport.height - 64 - top) / Math.max(1, rows.length),
    ),
  );
  const bottom = top + rowH * rows.length;
  const height = bottom + (data.hidden > 0 ? 48 : 24);
  const width = Math.max(viewport.width, Math.round(height * WIDE));
  const headX = 300;
  const left = 320;
  const right = width - 40;
  const colW = (right - left) / binCount;

  const focusRow = focus
    ? rows.find((r) => r.members.some((m) => ids.file(m) === focus))
    : undefined;
  const marks: Mark[] = [];
  const guides: Guide[] = [];
  const standIns = new Map<EntityId, string>();

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
      id: `collisions-grid:${b}`,
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
        `collisions-tick:${b}`,
        x,
        top - 16,
        `${MONTHS[month]} ${String(d.getUTCFullYear()).slice(2)}`,
        'right',
        1,
      ),
    );
  }

  rows.forEach((row, k) => {
    const id = ids.file(row.file);
    for (const m of row.members.slice(1)) standIns.set(ids.file(m), id);
    const y = top + rowH * (k + 0.5);
    const name = rowName(row);
    const lit = focusRow === row;
    const where = packageOf(row.file) || '(root)';
    // A family's tooltip names its files, one per line (paths shortened
    // only as far as they stay distinct), past TIP_FILES as "and N more".
    const names = distinctNames(row.members);
    const listed = row.family
      ? [
          ...row.members
            .slice(0, TIP_FILES)
            .map((m) => names.get(m) ?? baseName(m)),
          ...(row.members.length > TIP_FILES
            ? [`and ${n(row.members.length - TIP_FILES)} more`]
            : []),
        ]
      : [];
    const tip = [
      name,
      row.family
        ? `${n(row.members.length)} files that change together:`
        : where,
      ...listed,
      `${plural(row.weeks, 'week')} with two or more people`,
    ];

    // The row: hovering anywhere shows its file, a click selects it.
    marks.push({
      id: `collisions-row:${row.file}`,
      parent: id,
      selects: id,
      shape: 'bar',
      paint: '--cell-base',
      x: (headX + right) / 2,
      y,
      ...zero,
      w: right - headX + 12,
      h: rowH - 4,
      alpha: lit ? 1 : 0.6,
      z: 0,
      tip,
    });
    marks.push({
      id,
      shape: 'dot',
      paint: lit ? '--accent' : '--muted',
      x: headX,
      y,
      ...zero,
      r: 4,
      alpha: 0.95,
      z: 3,
      label: name,
      labelSub: row.family
        ? `${n(row.members.length)} files · ${plural(row.weeks, 'week')}`
        : `${where} · ${plural(row.weeks, 'week')}`,
      labelAnchor: 'left',
      labelPriority: 900 - k,
      tip,
    });

    // Each collision: its people stacked, centred on the row.
    const room = rowH - 8;
    for (const mark of row.marks) {
      const x = left + mark.bin * colW + colW / 2;
      const step = Math.min(2 * DOT_R + 2, room / mark.people.length);
      const r = Math.max(1, Math.min(DOT_R, step / 2 - 0.5));
      const top0 = y - (step * (mark.people.length - 1)) / 2;
      const when =
        unit === 'week'
          ? `Week of ${dayLabel(binStarts[mark.bin])}`
          : monthLabel(binStarts[mark.bin]);
      mark.people.forEach((p, i) => {
        const others = mark.people
          .filter((q) => q !== p)
          .map((q) => q.name)
          .join(', ');
        const pid = ids.person(p.email);
        const mine = focus === pid;
        // Fade for a selected person (everyone else's dots), or a drawn
        // file (other rows'); a file past the drawn rows fades nothing, as
        // nothing here would be lit.
        const faded =
          focus !== null &&
          !mine &&
          (focusRow !== undefined ? !lit : entityKind(focus) === 'person');
        marks.push({
          id: `collisions-dot:${row.file}:${mark.bin}:${p.email}`,
          parent: id,
          selects: pid,
          shape: 'dot',
          paint: mine ? '--accent' : STATUS_PAINT[p.status],
          x,
          y: top0 + i * step,
          ...zero,
          r,
          alpha: faded ? 0.3 : 0.95,
          z: mine ? 2 : 1,
          tip: [
            p.name,
            `${when} · ${STATUS_TEXT[p.status]}`,
            `with ${others} on ${name}`,
          ],
        });
      });
    }
  });

  if (data.hidden > 0)
    marks.push(
      card(
        'collisions-more',
        headX,
        bottom + 18,
        `+${n(data.hidden)} more in the table (T)`,
        'left',
        2,
      ),
    );
  marks.push(
    card(
      'collisions-head',
      left,
      top - 36,
      unit === 'week'
        ? 'weeks with two or more people on a file'
        : 'months with two or more people on a file',
      'right',
      2,
    ),
  );
  return {
    marks,
    links: [],
    guides,
    standIns,
    bounds: { x: 0, y: 0, w: width, h: height },
  };
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
