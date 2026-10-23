// Age's Warm and cold (docs/atlas-views.md › Age): a bar per package split at
// a centre axis, lines changed within a year to the left and cold lines to
// the right, by band, the oldest outermost; the orphaned lines in the accent
// at the far end. One scale for every row, so sizes read across packages:
// this is the form that says how much, which the strata can't sum by eye.
//
// A row is its package's `dir:` mark (the root's is the repo), drawn under
// the band parts (`age-part:<dir>:<band>`) and the orphaned part
// (`age-orphan:<dir>`), which select their package; so do the names and
// totals. A dormant package's total says so in the accent. The Tests switch
// is Strata's, so the two forms always agree.

import {
  ageRowName,
  ageRowTip,
  ageStrataOf,
  ageSummaryOf,
  sinceText,
  type AgeBand,
  type AgeRow,
} from '../age/strata';
import { ids, REPO_ID } from '../ids';
import {
  AGE_TESTS_PANEL,
  BAND_PAINT,
  STRATA_ROWS,
  testsSwitch,
} from './strata';
import type { Guide, Mark, Scene, ViewInput, Viewport } from '../model';

const WARM_OUTWARD: readonly AgeBand[] = [1, 0];
const COLD_OUTWARD: readonly AgeBand[] = [2, 3, 4];
const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const shortName = (dir: string) => ageRowName(dir.replace(/^packages\//, ''));

/** A row's total at the right: its cold and orphaned lines. */
function totalText(row: AgeRow): string {
  if (row.cold === 0) return 'nothing cold';
  return row.orphaned > 0
    ? `${n(row.cold)} cold · ${n(row.orphaned)} orphaned`
    : `${n(row.cold)} cold`;
}

export function warmColdScene(input: ViewInput, viewport: Viewport): Scene {
  const tests = input.open?.has(AGE_TESTS_PANEL) ?? false;
  const all = ageStrataOf(input.report, tests);
  const rows = all.slice(0, STRATA_ROWS);
  const summary = ageSummaryOf(input.report);
  const bounds = { x: 0, y: 0, w: viewport.width, h: viewport.height };
  const marks: Mark[] = [testsSwitch(tests, viewport)];
  const guides: Guide[] = [];

  const left = 250;
  const right = viewport.width - 200;
  const top = 130;
  marks.push({
    ...card(
      'age-head',
      left,
      top - 80,
      summary.lines === 0
        ? 'No source lines to age'
        : `${Math.round((100 * summary.coldLines) / summary.lines)}% of source lines unchanged for a year or more`,
      'right',
      4,
    ),
    labelSub: 'bars are lines by package; orphaned lines in the accent',
  });
  if (rows.length === 0) return { marks, links: [], guides, bounds };

  const rowH = Math.max(
    18,
    Math.min(34, (viewport.height - top - 70) / rows.length),
  );
  const barH = Math.max(8, rowH - 10);
  const bottom = top + rowH * rows.length;
  const x0 = (left + right) / 2;
  const half = (right - left) / 2 - 6;
  const max = Math.max(1, ...rows.map((r) => Math.max(r.warm, r.cold)));
  const len = (lines: number) => (lines / max) * half;

  guides.push({
    id: 'age-axis',
    kind: 'line',
    x1: x0,
    y1: top - 10,
    x2: x0,
    y2: bottom,
    paint: '--muted',
    alpha: 0.5,
  });
  marks.push(
    card(
      'age-warm-label',
      x0 - 8,
      top - 22,
      'changed within a year',
      'left',
      2,
    ),
  );
  marks.push(
    card(
      'age-cold-label',
      x0 + 8,
      top - 22,
      'cold: a year or more',
      'right',
      2,
    ),
  );

  rows.forEach((row, k) => {
    const y = top + rowH * (k + 0.5);
    const rowId = row.dir === '' ? REPO_ID : ids.dir(row.dir);
    const tip = ageRowTip(row);
    const from = x0 - len(row.warm);
    const to = x0 + len(row.cold);
    marks.push({
      id: rowId,
      shape: 'bar',
      paint: '--cell-base',
      x: (from + to) / 2,
      y,
      ...zero,
      w: Math.max(2, to - from),
      h: barH,
      alpha: 1,
      z: 1,
      tip,
    });
    let x = x0;
    for (const band of WARM_OUTWARD) {
      const w = len(row.lines[band]);
      if (w > 0)
        marks.push(part(`age-part:${row.dir}:${band}`, rowId, x - w, w));
      x -= w;
    }
    x = x0;
    for (const band of COLD_OUTWARD) {
      const w = len(row.lines[band]);
      if (w > 0) marks.push(part(`age-part:${row.dir}:${band}`, rowId, x, w));
      x += w;
    }
    if (row.orphaned > 0) {
      const w = Math.max(2, len(row.orphaned));
      marks.push({
        id: `age-orphan:${row.dir}`,
        shape: 'bar',
        paint: '--accent',
        x: to - w / 2,
        y,
        ...zero,
        w,
        h: barH / 2,
        alpha: 1,
        z: 3,
        selects: rowId,
        tip,
      });
    }
    marks.push({
      ...card(
        `age-name:${row.dir}`,
        left - 14,
        y,
        shortName(row.dir),
        'left',
        3,
      ),
      selects: rowId,
    });
    marks.push({
      ...card(
        `age-total:${row.dir}`,
        right + 14,
        y,
        totalText(row),
        'right',
        2,
      ),
      selects: rowId,
      // Only a label's second line takes the accent (`atlas-label--hot`).
      ...(row.dormant
        ? {
            labelSub: `dormant · ${sinceText(row.newestSource)}`,
            labelClass: 'atlas-label--hot',
          }
        : {}),
    });

    function part(id: string, selects: typeof rowId, x1: number, w: number) {
      const band = Number(id.slice(id.lastIndexOf(':') + 1)) as AgeBand;
      return {
        id,
        shape: 'bar' as const,
        paint: BAND_PAINT[band],
        x: x1 + w / 2,
        y,
        ...zero,
        w,
        h: barH,
        alpha: 1,
        z: 2,
        selects,
        tip,
      };
    }
  });

  const hidden = all.length - rows.length;
  if (hidden > 0)
    marks.push(
      card(
        'more',
        left,
        bottom + 20,
        `+${n(hidden)} more package${hidden === 1 ? '' : 's'} in the table (T)`,
        'right',
        0,
      ),
    );

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
