// Churn's Rhythm form (docs/atlas-views.md › Churn): the files with the most
// commits as rows of week-by-week bars, with lines added against deleted and
// a character tag at the right. A line splits the window in half, so a file
// speeding up or slowing down reads off its bars. Files that change in
// lockstep are tied together by a line down the left margin.
//
// Each file keeps its `file:` dot (at the start of its row, coloured by churn
// category), so switching from the swarm, the busiest files travel into the
// column rather than popping in. Everything else uses ids outside the entity
// kinds (`row:`, `wk:`, `added:`, `deleted:`, `trait:`, `lock:`, `tick:`…),
// so hovering a row shows its file's tooltip and clicking it selects nothing;
// the dot selects the file.

import { distinctNames } from '../format/distinctNames';
import { ids } from '../ids';
import type { Rhythm, RhythmRow } from '../churn/rhythm';
import type { Guide, Link, Mark, Scene, Viewport } from '../model';

const RAMP = ['--risk-0', '--risk-1', '--risk-2', '--risk-3'] as const;
const DOT_R = [3, 3.5, 4.5, 5.5] as const;
const ROW_MAX_H = 44;
const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const plural = (k: number, one: string) =>
  `${n(k)} ${one}${k === 1 ? '' : 's'}`;

/** A Rhythm row's tooltip: name, commits and recent half, lines, character. */
export function rhythmTip(row: RhythmRow, name: string): string[] {
  const f = row.file;
  const tip = [
    name,
    `${plural(f.commits, 'commit')} · ${n(row.recent)} in the recent half`,
  ];
  if (f.insertions > 0 || f.deletions > 0)
    tip.push(`+${n(f.insertions)} −${n(f.deletions)} lines`);
  if (f.character) tip.push(f.character);
  return tip;
}

export function rhythmScene(rhythm: Rhythm, viewport: Viewport): Scene {
  const { rows, binStarts, unit } = rhythm;
  const binCount = binStarts.length;
  const left = 250;
  const right = viewport.width - 250;
  const axis = viewport.width - 160;
  const half = 56;
  const traitX = viewport.width - 96;
  // Rows start right of the lockstep margin, so the links there show.
  const rowLeft = 34;
  const rowRight = viewport.width - 16;
  const top = 56;
  const rowH = Math.min(
    ROW_MAX_H,
    (viewport.height - 64 - top) / Math.max(1, rows.length),
  );
  const bottom = top + rowH * rows.length;
  const colW = (right - left) / Math.max(1, binCount);
  const wx = (w: number) => left + w * colW;

  let maxWeek = 1;
  let maxLines = 1;
  for (const row of rows) {
    for (const v of row.bins) if (v > maxWeek) maxWeek = v;
    maxLines = Math.max(maxLines, row.file.insertions, row.file.deletions);
  }
  const lineW = (v: number) => half * Math.sqrt(v / maxLines);

  const marks: Mark[] = [];
  const links: Link[] = [];
  const guides: Guide[] = [];

  // Quarter starts along the bottom (years, when the bins are months), and
  // the line between the halves.
  let lastMonth = -1;
  for (let w = 0; w < binCount; w++) {
    const d = new Date(binStarts[w]);
    const month = d.getUTCMonth();
    if (month === lastMonth) continue;
    const first = lastMonth === -1;
    lastMonth = month;
    if (!first && month % (unit === 'month' ? 12 : 3) !== 0) continue;
    const x = wx(w);
    guides.push({
      id: `grid:w:${w}`,
      kind: 'line',
      x1: x,
      y1: top,
      x2: x,
      y2: bottom,
      paint: '--muted',
      alpha: 0.12,
    });
    marks.push(
      card(
        `tick:w:${w}`,
        x,
        bottom + 14,
        `${MONTHS[month]} ${String(d.getUTCFullYear()).slice(2)}`,
        'right',
        1,
      ),
    );
  }
  if (binCount > 1) {
    const x = wx(Math.floor(binCount / 2));
    guides.push({
      id: 'halves',
      kind: 'line',
      x1: x,
      y1: top - 12,
      x2: x,
      y2: bottom,
      paint: '--soft',
      alpha: 0.5,
    });
    marks.push(card('halves-label', x, top - 20, 'recent half', 'right', 2));
  }
  marks.push(
    card('head:weeks', left, top - 20, `commits per ${unit}`, 'right', 1),
    card('head:deleted', axis - 4, top - 20, 'deleted', 'left', 1),
    card('head:added', axis + 4, top - 20, 'added', 'right', 1),
  );
  guides.push({
    id: 'lines-axis',
    kind: 'line',
    x1: axis,
    y1: top,
    x2: axis,
    y2: bottom,
    paint: '--muted',
    alpha: 0.3,
  });

  const names = distinctNames(rows.map((r) => r.file.file));
  const lockY = new Map<string, number>();
  rows.forEach((row, k) => {
    const f = row.file;
    const id = ids.file(f.file);
    const y = top + rowH * (k + 0.5);
    const name = names.get(f.file) ?? baseName(f.file);
    const tip = rhythmTip(row, name);

    marks.push({
      id: `row:${f.file}`,
      parent: id,
      shape: 'bar',
      paint: '--cell-base',
      x: (rowLeft + rowRight) / 2,
      y,
      ...zero,
      w: rowRight - rowLeft,
      h: rowH - 4,
      alpha: 1,
      z: 0,
      tip,
    });
    marks.push({
      id,
      shape: 'dot',
      paint: RAMP[f.tier],
      x: 50,
      y,
      ...zero,
      r: DOT_R[f.tier],
      alpha: 1,
      z: 3,
      tip,
      label: name,
      labelPriority: 900 - k,
    });

    const floor = y + (rowH - 4) / 2 - 3;
    const room = rowH - 12;
    row.bins.forEach((v, w) => {
      if (v === 0) return;
      const h = Math.max(2, (room * v) / maxWeek);
      marks.push({
        id: `wk:${f.file}:${w}`,
        parent: id,
        shape: 'bar',
        paint: '--soft',
        x: wx(w) + colW / 2,
        y: floor - h / 2,
        ...zero,
        w: Math.max(1, colW - 1.5),
        h,
        alpha: 0.85,
        z: 1,
        tip: [
          name,
          unit === 'week'
            ? `${plural(v, 'commit')} in the week of ${dayLabel(binStarts[w])}`
            : `${plural(v, 'commit')} in ${monthLabel(binStarts[w])}`,
        ],
      });
    });

    const barH = Math.min(10, rowH - 14);
    if (f.deletions > 0)
      marks.push(
        lineBar(`deleted:${f.file}`, id, axis - lineW(f.deletions) / 2, y, {
          w: lineW(f.deletions),
          h: barH,
          paint: '--muted',
          tip: [name, `${plural(f.deletions, 'line')} deleted`],
        }),
      );
    if (f.insertions > 0)
      marks.push(
        lineBar(`added:${f.file}`, id, axis + lineW(f.insertions) / 2, y, {
          w: lineW(f.insertions),
          h: barH,
          paint: '--accent',
          tip: [name, `${plural(f.insertions, 'line')} added`],
        }),
      );
    if (f.character)
      marks.push(card(`trait:${f.file}`, traitX, y, f.character, 'right', 0));

    if (row.group !== null) {
      lockY.set(f.file, y);
      marks.push({
        id: `lock:${f.file}`,
        parent: id,
        shape: 'ring',
        paint: '--accent',
        x: 18,
        y,
        ...zero,
        r: 4.5,
        alpha: 1,
        z: 2,
        tip: [name, 'changes in lockstep with the files tied to it'],
      });
    }
  });

  // Tie each group's rows together, top to bottom.
  for (const group of rhythm.groups) {
    for (let i = 1; i < group.length; i++) {
      links.push({
        id: `lock-link:${group[i - 1]}:${group[i]}`,
        source: `lock:${group[i - 1]}`,
        target: `lock:${group[i]}`,
        curve: 'straight',
        width: 2,
        paint: '--link-hot',
        alpha: 0.8,
      });
    }
  }

  return {
    marks,
    links,
    guides,
    bounds: { x: 0, y: 0, w: viewport.width, h: viewport.height },
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

function lineBar(
  id: string,
  parent: string,
  x: number,
  y: number,
  o: { w: number; h: number; paint: Mark['paint']; tip: string[] },
): Mark {
  return {
    id,
    parent,
    shape: 'bar',
    paint: o.paint,
    x,
    y,
    ...zero,
    w: o.w,
    h: o.h,
    alpha: 0.9,
    z: 1,
    tip: o.tip,
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
