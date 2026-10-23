// Age's Strata (docs/atlas-views.md › Age): one row per package, one dot per
// file, placed across by time since its last change on a square-root scale
// (so the last year gets room and a decade still fits), sized by lines and
// painted by calendar band, older brighter. The side past a year is shaded:
// that's cold. A package's cold is a few old files or a whole layer of them,
// and the strata show which.
//
// Orphaned files (cold, nobody who changed them still around) wear an accent
// ring, a layout-only mark (`orphan:`) that selects its file. A dormant
// package says so under its name in the accent. Like the Churn swarm, a dot
// is spread up and down its row by a hash of its path, and a row is its
// package's `dir:` mark (the root's is the repo).
//
// Tests are left out until the stage's switch (`age-tests`, a `toggles`
// mark) adds them; fixtures and generated files never appear.

import {
  ageFileTip,
  ageRowName,
  ageRowTip,
  ageStrataOf,
  COLD_DAYS,
  sinceText,
  type AgeBand,
} from '../age/strata';
import { ids, REPO_ID } from '../ids';
import { jitter } from './swarm';
import type { Guide, Mark, Paint, Scene, ViewInput, Viewport } from '../model';

/** Most rows drawn; the rest are in the table. */
export const STRATA_ROWS = 14;
/** The `open` key of the stage's Tests switch, shared by both forms. */
export const AGE_TESTS_PANEL = 'age-tests';

/**
 * Each band mixed from the cell colour toward `--person`, the oldest
 * brightest: no new theme tokens (Commit Timing mixes its cells the same way).
 */
export const BAND_PAINT: Readonly<Record<AgeBand, Paint>> = {
  0: { mix: ['--cell-base', '--person'], t: 0.3 },
  1: { mix: ['--cell-base', '--person'], t: 0.45 },
  2: { mix: ['--cell-base', '--person'], t: 0.65 },
  3: { mix: ['--cell-base', '--person'], t: 0.85 },
  4: '--person',
};

const TICKS: readonly [number, string][] = [
  [90, '3 mo'],
  [COLD_DAYS, '1 yr'],
  [730, '2 yr'],
  [1460, '4 yr'],
  [2922, '8 yr'],
  [5844, '16 yr'],
];
const ROW_MAX_H = 64;
const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
/** A row's name beside it: `packages/` goes without saying. */
const shortName = (dir: string) => ageRowName(dir.replace(/^packages\//, ''));

export function strataScene(input: ViewInput, viewport: Viewport): Scene {
  const tests = input.open?.has(AGE_TESTS_PANEL) ?? false;
  const all = ageStrataOf(input.report, tests);
  const rows = all.slice(0, STRATA_ROWS);
  const bounds = { x: 0, y: 0, w: viewport.width, h: viewport.height };
  const marks: Mark[] = [testsSwitch(tests, viewport)];
  const guides: Guide[] = [];
  if (rows.length === 0) {
    marks.push(
      card(
        'age-empty',
        viewport.width / 2,
        viewport.height / 2,
        'No file has a recorded change',
        'center',
        2,
      ),
    );
    return { marks, links: [], guides, bounds };
  }

  const left = 250;
  const right = viewport.width - 60;
  const top = 84;
  const rowH = Math.min(
    ROW_MAX_H,
    (viewport.height - 70 - top) / Math.max(1, rows.length),
  );
  const bottom = top + rowH * rows.length;

  let maxAge = COLD_DAYS + 35;
  let maxLines = 1;
  for (const row of rows)
    for (const f of row.files) {
      if (f.ageInDays > maxAge) maxAge = f.ageInDays;
      if (f.lines > maxLines) maxLines = f.lines;
    }
  const X = (days: number) =>
    left + Math.sqrt(Math.max(0, days) / maxAge) * (right - left);
  const radius = (lines: number) =>
    Math.min(8.6, 1.6 + Math.sqrt(lines / maxLines) * 7);

  // The cold side, shaded behind the rows, named above them.
  const coldX = X(COLD_DAYS);
  marks.push({
    id: 'age-cold-zone',
    shape: 'bar',
    paint: { mix: ['--cell-base', '--person'], t: 0.08 },
    x: (coldX + right) / 2,
    y: (top + bottom) / 2,
    ...zero,
    w: right - coldX,
    h: bottom - top,
    alpha: 1,
    z: 0,
  });
  marks.push(
    card(
      'age-cold-label',
      (coldX + right) / 2,
      top - 16,
      'cold: unchanged for a year or more',
      'center',
      2,
    ),
  );
  for (const [days, label] of TICKS) {
    if (days > maxAge) break;
    const x = X(days);
    guides.push({
      id: `grid:x:${days}`,
      kind: 'line',
      x1: x,
      y1: top,
      x2: x,
      y2: bottom,
      paint: '--muted',
      alpha: days === COLD_DAYS ? 0.4 : 0.14,
    });
    marks.push(card(`tick:x:${days}`, x, bottom + 14, label, 'center', 1));
  }
  marks.push(card('tick:now', left, bottom + 14, 'now', 'center', 1));
  marks.push(
    card(
      'axis:x',
      right,
      bottom + 34,
      'time since last change (square root)',
      'left',
      0,
    ),
  );

  rows.forEach((row, k) => {
    const y = top + rowH * (k + 0.5);
    const rowId = row.dir === '' ? REPO_ID : ids.dir(row.dir);
    marks.push({
      id: rowId,
      shape: 'bar',
      paint: row.dormant
        ? { mix: ['--cell-base', '--accent'], t: 0.12 }
        : '--cell-base',
      x: (left + right) / 2,
      y,
      ...zero,
      w: right - left,
      h: rowH - 4,
      alpha: 0.45,
      z: 1,
      tip: ageRowTip(row),
    });
    marks.push({
      ...card(
        `row-label:${row.dir}`,
        left - 12,
        y,
        shortName(row.dir),
        'left',
        3,
      ),
      selects: rowId,
      labelSub: row.dormant
        ? `dormant · ${sinceText(row.newestSource)}`
        : row.cold > 0
          ? `${n(row.cold)} cold lines`
          : 'nothing cold',
      ...(row.dormant ? { labelClass: 'atlas-label--hot' } : {}),
    });

    row.files.forEach((f, i) => {
      const [u, v] = jitter(f.file);
      const fileId = ids.file(f.file);
      const r = radius(f.lines);
      // A day's spread across, so files changed the same day don't stack.
      const x = X(f.ageInDays + u);
      const fy = y + (v - 0.5) * (rowH - 4) * 0.8;
      const tip = ageFileTip(f);
      marks.push({
        id: fileId,
        shape: 'dot',
        paint: BAND_PAINT[f.band],
        x,
        y: fy,
        ...zero,
        r,
        alpha: f.test ? 0.6 : 0.92,
        z: 2 + f.band / 10,
        tip,
        // Each row names its oldest file.
        ...(i === 0
          ? {
              label: baseName(f.file),
              labelAnchor: 'above' as const,
              labelPriority: 500,
            }
          : {}),
      });
      if (f.orphaned)
        marks.push({
          id: `orphan:${f.file}`,
          shape: 'ring',
          paint: '--accent',
          x,
          y: fy,
          ...zero,
          r: r + 2.4,
          alpha: 1,
          z: 3,
          selects: fileId,
          tip,
        });
    });
  });

  const hidden = all.length - rows.length;
  if (hidden > 0)
    marks.push(
      card(
        'more',
        left,
        bottom + 34,
        `+${n(hidden)} more package${hidden === 1 ? '' : 's'} in the table (T)`,
        'right',
        0,
      ),
    );

  return { marks, links: [], guides, bounds };
}

/** The stage's Tests switch: a card that flips `AGE_TESTS_PANEL`. */
export function testsSwitch(tests: boolean, viewport: Viewport): Mark {
  return {
    id: 'age-tests',
    shape: 'card',
    paint: '--muted',
    x: viewport.width - 60 - 70,
    y: 30,
    ...zero,
    w: 140,
    h: 30,
    alpha: 1,
    toggles: AGE_TESTS_PANEL,
    label: tests ? 'Tests shown' : 'Tests hidden',
    labelSub: tests ? 'Hide ▴' : 'Show ▾',
    labelClass: 'atlas-label--row',
    labelAnchor: 'center',
    labelPriority: 1003,
    z: 4,
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
