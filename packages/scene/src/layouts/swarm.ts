// The Churn swarm (docs/atlas-views.md › Churn): one row per package, one dot
// per file, placed across on a log scale of commits. The same total can hide
// opposite shapes — a wide low cloud of files each changed a little, or a few
// files stacked far right — and the swarm shows both at once. Each row is
// shaded by its package's total behind the dots, so the busiest packages
// still read first.
//
// Commits are whole numbers, so a file's dot is spread across [c, c + 1) and
// up and down its row by a hash of its path: the same file lands in the same
// place on every build, and a thousand files with one commit become a band
// instead of one dot. Files with one or two commits sit in a grey band at the
// left, drawn in the ghost colour.
//
// Row names, ticks and the band's name are label-only card marks; their ids
// (`row-label:`, `tick:`, `band-label`, `more`) aren't entity kinds, so
// clicking one selects nothing. A row is its package's `dir:` mark (the root's
// is the repo), so clicking the row selects the package.

import {
  QUIET_COMMITS,
  rowName,
  swarmFileTip,
  swarmRowTip,
  type SwarmRow,
} from '../churn/swarm';
import { distinctNames } from '../format/distinctNames';
import { ids, REPO_ID } from '../ids';
import type { Guide, Mark, Scene, Viewport } from '../model';

/** Most rows drawn; the rest are in the table. */
export const SWARM_ROWS = 12;
const RAMP = ['--risk-0', '--risk-1', '--risk-2', '--risk-3'] as const;
const DOT_R = [2.2, 2.8, 3.6, 4.6] as const;
const QUIET_R = 2;
const ROW_MAX_H = 88;
/** Strongest a row's shading gets, for the package with the biggest total. */
const SHADE_MAX = 0.07;

const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
/** A row's name beside it: `packages/` goes without saying. */
const shortName = (dir: string) => rowName(dir.replace(/^packages\//, ''));

/** The smallest 1-2-5 step at or above `v`. */
function niceCeil(v: number): number {
  let step = 1;
  for (;;) {
    for (const m of [1, 2, 5]) if (step * m >= v) return step * m;
    step *= 10;
  }
}

function ticks125(max: number): number[] {
  const out: number[] = [];
  for (let step = 1; step <= max; step *= 10)
    for (const m of [1, 2, 5]) if (step * m <= max) out.push(step * m);
  return out;
}

/** Two stable numbers in [0, 1) from a path (FNV-1a, then a second mix). */
export function jitter(path: string): [number, number] {
  let h = 0x811c9dc5;
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const a = (h >>> 0) / 2 ** 32;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return [a, (h >>> 0) / 2 ** 32];
}

export function swarmScene(
  allRows: readonly SwarmRow[],
  viewport: Viewport,
): Scene {
  const rows = allRows.slice(0, SWARM_ROWS);
  const left = 240;
  const right = viewport.width - 48;
  const top = 48;
  const rowH = Math.min(
    ROW_MAX_H,
    (viewport.height - 64 - top) / Math.max(1, rows.length),
  );
  const bottom = top + rowH * rows.length;

  let maxC = QUIET_COMMITS + 1;
  let maxTotal = 1;
  for (const row of rows) {
    if (row.total > maxTotal) maxTotal = row.total;
    const c = row.files[0]?.commits ?? 0;
    if (c > maxC) maxC = c;
  }
  const cMax = niceCeil(maxC + 1);
  const X = (c: number) =>
    left + (Math.log(Math.max(1, c)) / Math.log(cMax)) * (right - left);

  const marks: Mark[] = [];
  const guides: Guide[] = [];

  for (const c of ticks125(cMax)) {
    const x = X(c);
    guides.push({
      id: `grid:x:${c}`,
      kind: 'line',
      x1: x,
      y1: top,
      x2: x,
      y2: bottom,
      paint: '--muted',
      alpha: 0.12,
    });
    marks.push(card(`tick:x:${c}`, x, bottom + 14, String(c), 'center', 1));
  }
  marks.push(
    card('axis:x', right, bottom + 34, 'commits per file (log)', 'left', 0),
  );

  // The grey band: files with one or two commits spread over [1, 3).
  const bandRight = X(QUIET_COMMITS + 1);
  guides.push({
    id: 'band:edge',
    kind: 'line',
    x1: bandRight,
    y1: top - 8,
    x2: bandRight,
    y2: bottom,
    paint: '--ghost',
    alpha: 0.6,
  });
  marks.push(
    card(
      'band-label',
      (left + bandRight) / 2,
      top - 16,
      'one or two commits',
      'center',
      2,
    ),
  );

  rows.forEach((row, k) => {
    const y = top + rowH * (k + 0.5);
    marks.push({
      id: row.dir === '' ? REPO_ID : ids.dir(row.dir),
      shape: 'bar',
      paint: {
        mix: ['--cell-base', '--accent'],
        t: (SHADE_MAX * row.total) / maxTotal,
      },
      x: (left + right) / 2,
      y,
      ...zero,
      w: right - left,
      h: rowH - 4,
      alpha: 1,
      z: 0,
      tip: swarmRowTip(row),
    });
    marks.push(
      card(
        `row-label:${row.dir}`,
        left - 12,
        y,
        `${shortName(row.dir)}  ${n(row.total)}`,
        'left',
        3,
      ),
    );

    const names = distinctNames(row.files.slice(0, 1).map((f) => f.file));
    row.files.forEach((f, i) => {
      const [u, v] = jitter(f.file);
      const quiet = f.commits <= QUIET_COMMITS;
      const name = names.get(f.file) ?? baseName(f.file);
      marks.push({
        id: ids.file(f.file),
        shape: 'dot',
        paint: quiet ? '--ghost' : RAMP[f.tier],
        x: X(f.commits + u * 0.9),
        y: y + (v - 0.5) * (rowH - 4) * 0.8,
        ...zero,
        r: quiet ? QUIET_R : DOT_R[f.tier],
        alpha: quiet ? 0.7 : 0.95,
        z: quiet ? 1 : 2 + f.tier,
        tip: swarmFileTip(f, name),
        // Each row names its busiest file.
        ...(i === 0 && !quiet
          ? { label: name, labelAnchor: 'above' as const, labelPriority: 500 }
          : {}),
      });
    });
  });

  const hidden = allRows.length - rows.length;
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

  return {
    marks,
    links: [],
    guides,
    bounds: { x: 0, y: 0, w: viewport.width, h: viewport.height },
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
