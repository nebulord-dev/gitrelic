// Fix rate's funnel field (docs/atlas-views.md › Fix rate): rated files by
// changes (across, log scale) and the share fixed within the window (up). The
// shaded band is what chance alone gives at the repo rate, narrowing as
// changes grow; files above it take the accent and are named. Files with no
// fix settle on a floor along the axis.
//
// Selecting a rated file narrows the plot and opens its fix chain to the
// right: the file's commits over time, with an arc from each listed fix back
// to the changes it repaired. Changes too recent to rate are faint.
//
// Ticks, axis names, notes and the lane's dates are label-only card marks;
// the band's bars (`band:`), the lane's commits (`change:`) and the cards'
// ids aren't entity kinds, so clicking one selects nothing.

import {
  chanceAllows,
  fixedOf,
  ratePct,
  type FixPoint,
  type FixRateData,
} from '../fixRate/points';
import { distinctNames } from '../format/distinctNames';
import { ids, type EntityId } from '../ids';
import type { CommitLike } from '../commits/commitLike';
import type { Guide, Link, Mark, Scene, Viewport } from '../model';

const RAMP = ['--risk-0', '--risk-1', '--risk-2', '--risk-3'] as const;
const DOT_R = [3, 4.5, 5.5, 7] as const;
/** The plot's right edge, as a share of the width: alone, and beside a lane. */
const PLOT_RIGHT = 0.72;
const PLOT_RIGHT_LANE = 0.4;
/** Band bars drawn at most; past this many sizes they're sampled. */
const BAND_STEPS = 80;
/** Floor dots per column before a column widens. */
const FLOOR_ROWS = 6;
const FLOOR_GAP = 7;
const DAY_MS = 86_400_000;

const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const short = (hash: string) => hash.slice(0, 12);

export interface FunnelInput {
  data: FixRateData;
  focus?: EntityId | null;
  /** The repo's commits; given with a focused rated file, its lane opens. */
  commits?: readonly CommitLike[] | null;
}

/** The smallest of 1, 2, 3, 5 × 10ᵏ at or above `v`. */
function niceCeil(v: number): number {
  for (let step = 1; ; step *= 10)
    for (const m of [1, 2, 3, 5]) if (step * m >= v) return step * m;
}

function ticksBetween(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let step = 1; step <= hi; step *= 10)
    for (const m of [1, 2, 3, 5]) {
      const v = step * m;
      if (v >= lo && v <= hi) out.push(v);
    }
  return out;
}

export function funnelScene(input: FunnelInput, viewport: Viewport): Scene {
  const { data } = input;
  if (!data.available)
    return message('This report predates fix rate; re-run gitrelic.', viewport);
  if (data.points.length === 0 || data.repoRate === null)
    return message(
      `No file has ${n(data.minChanges)} changes older than ${n(data.windowDays)} days yet.`,
      viewport,
    );
  const p = data.repoRate;
  const points = data.points;

  const focusFile = input.focus?.startsWith('file:')
    ? input.focus.slice(5)
    : null;
  const focusPoint = focusFile
    ? points.find((pt) => pt.file === focusFile)
    : undefined;
  const laneCommits =
    focusPoint && input.commits && input.commits.length > 0
      ? input.commits
      : null;
  const lane = focusPoint && laneCommits ? focusPoint : undefined;

  const left = 90;
  const top = 60;
  const right = viewport.width * (lane ? PLOT_RIGHT_LANE : PLOT_RIGHT);
  const bottom = viewport.height - 190;

  let nLo = Infinity;
  let nMax = 0;
  let rMax = 0;
  for (const pt of points) {
    nLo = Math.min(nLo, pt.changes);
    nMax = Math.max(nMax, pt.changes);
    rMax = Math.max(rMax, pt.rate);
  }
  const nHi = Math.max(niceCeil(nMax), nLo * 2);
  const bandTop = chanceAllows(nLo, p) / nLo;
  const yMax = Math.min(
    1,
    Math.max(0.1, Math.ceil(Math.max(rMax, bandTop) * 10 + 0.001) / 10),
  );
  const X = (c: number) =>
    left + (Math.log(c / nLo) / Math.log(nHi / nLo)) * (right - left);
  const Y = (r: number) => bottom - (r / yMax) * (bottom - top);

  const marks: Mark[] = [];
  const links: Link[] = [];
  const guides: Guide[] = [];

  // y grid: every 10% (20% on a tall scale).
  const yStep = yMax > 0.5 ? 0.2 : 0.1;
  for (let k = 0; k * yStep <= yMax + 1e-9; k++) {
    const r = k * yStep;
    const y = Y(r);
    guides.push({
      id: `grid:y:${k}`,
      kind: 'line',
      x1: left,
      y1: y,
      x2: right,
      y2: y,
      paint: '--muted',
      alpha: k === 0 ? 0.5 : 0.15,
    });
    marks.push(
      card(`tick:y:${k}`, left - 12, y, `${Math.round(r * 100)}%`, 'left', 1),
    );
  }

  // The band: per size, a bar up to what chance allows.
  const sizes: number[] = [];
  if (nHi - nLo <= BAND_STEPS) for (let c = nLo; c <= nHi; c++) sizes.push(c);
  else
    for (let i = 0; i <= BAND_STEPS; i++) {
      const c = Math.round(nLo * (nHi / nLo) ** (i / BAND_STEPS));
      if (c !== sizes.at(-1)) sizes.push(c);
    }
  const edges = sizes.map((c, i) => {
    const prev = i === 0 ? c : sizes[i - 1];
    const next = i === sizes.length - 1 ? c : sizes[i + 1];
    return [X(Math.sqrt(prev * c)), X(Math.sqrt(c * next))] as const;
  });
  let prevTop: number | null = null;
  sizes.forEach((c, i) => {
    const allowed = chanceAllows(c, p);
    const [x0, x1] = edges[i];
    const yTop = Y(Math.min(yMax, allowed / c));
    if (x1 - x0 > 0 && bottom - yTop > 0)
      marks.push({
        id: `band:${c}`,
        shape: 'bar',
        paint: '--muted',
        x: (x0 + x1) / 2,
        y: (yTop + bottom) / 2,
        r: 0,
        w: x1 - x0,
        h: bottom - yTop,
        a0: 0,
        a1: 0,
        alpha: 0.14,
        z: -2,
        tip: [
          `What chance gives at a ${ratePct(p)} repo rate`,
          `Up to ${n(allowed)} of ${n(c)} changes fixed`,
        ],
      });
    // Its edge, as steps: the boundary is a whole number of fixes.
    if (prevTop !== null && prevTop !== yTop)
      guides.push(line(`band-edge:v:${c}`, x0, prevTop, x0, yTop));
    guides.push(line(`band-edge:h:${c}`, x0, yTop, x1, yTop));
    prevTop = yTop;
  });
  const lastTop = prevTop ?? bottom;
  marks.push(
    card(
      'band-label',
      edges.at(-1)![1] + 8,
      lastTop,
      `chance at ${ratePct(p)}`,
      'right',
      4,
    ),
  );

  // Dots. The floor (no fix) packs into small columns along the axis.
  const shown = points.map((pt) => pt.file);
  const names = distinctNames(shown);
  const nameOf = (file: string) => names.get(file) ?? baseName(file);
  const floor = new Map<number, number>();
  const raised = new Map<string, number>();
  let floorDepth = 0;
  for (const pt of points) {
    let x = X(pt.changes);
    let y = Y(pt.rate);
    if (pt.fixedAfter === 0) {
      const k = floor.get(pt.changes) ?? 0;
      floor.set(pt.changes, k + 1);
      const col = Math.floor(k / FLOOR_ROWS);
      const row = k % FLOOR_ROWS;
      x += (col % 2 === 0 ? 1 : -1) * Math.ceil(col / 2) * FLOOR_GAP;
      y = bottom + 8 + row * FLOOR_GAP;
      floorDepth = Math.max(floorDepth, 8 + row * FLOOR_GAP);
    } else {
      // Same size, same count: side by side.
      const key = `${pt.changes}:${pt.fixedAfter}`;
      const k = raised.get(key) ?? 0;
      raised.set(key, k + 1);
      x += (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * 2 * DOT_R[pt.tier];
    }
    const focused = pt === focusPoint;
    marks.push({
      id: ids.file(pt.file),
      shape: 'dot',
      paint: RAMP[pt.tier],
      x,
      y,
      ...zero,
      r: DOT_R[pt.tier],
      alpha: pt.tier === 0 ? 0.75 : 1,
      ...(pt.aboveChance || focused
        ? {
            label: nameOf(pt.file),
            labelPriority: focused ? 3000 : 1000 + Math.round(pt.rate * 100),
          }
        : {}),
      z: pt.tier + 1,
      tip: fixTip(pt, nameOf(pt.file), data.windowDays),
    });
    if (focused)
      marks.push({
        id: `home:${pt.file}`,
        shape: 'ring',
        paint: RAMP[pt.tier],
        x,
        y,
        ...zero,
        r: DOT_R[pt.tier] + 4,
        alpha: 0.7,
        parent: ids.file(pt.file),
        z: pt.tier,
      });
  }

  // x ticks and axis names, under the floor.
  const tickY = bottom + floorDepth + 22;
  for (const c of ticksBetween(nLo, nHi)) {
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
    marks.push(card(`tick:x:${c}`, x, tickY, n(c), 'center', 1));
  }
  // The unrated count reads as the x axis's second line, centred with it.
  const xAxis = card(
    'axis:x',
    (left + right) / 2,
    tickY + 24,
    'changes old enough to rate →',
    'center',
    2,
  );
  if (data.unratedFiles > 0)
    xAxis.labelSub = `${n(data.unratedFiles)} ${data.unratedFiles === 1 ? 'file has' : 'files have'} fewer than ${n(data.minChanges)} changes old enough to rate`;
  marks.push(
    xAxis,
    // Starts at the plot's left edge, over the axis it names.
    card(
      'axis:y',
      left,
      top - 44,
      `fixed within ${n(data.windowDays)} days ↑`,
      'right',
      2,
    ),
  );

  if (lane && laneCommits)
    fixChain(
      lane,
      nameOf(lane.file),
      laneCommits,
      data.windowDays,
      viewport,
      marks,
      links,
      guides,
    );

  return { marks, links, guides, bounds: fit(marks, viewport) };
}

/**
 * The selected file's lane: its commits along a time axis spanning the
 * repo's window, fixes as rings, the changes they repaired on the risk
 * colour, and an arc from each fix to each of its causes.
 */
function fixChain(
  pt: FixPoint,
  name: string,
  commits: readonly CommitLike[],
  windowDays: number,
  viewport: Viewport,
  marks: Mark[],
  links: Link[],
  guides: Guide[],
): void {
  let t0 = Infinity;
  let t1 = -Infinity;
  for (const c of commits) {
    t0 = Math.min(t0, c.timeMs);
    t1 = Math.max(t1, c.timeMs);
  }
  const x0 = viewport.width * 0.5;
  const x1 = viewport.width - 60;
  const y = viewport.height * 0.42;
  const T = (t: number) =>
    t1 === t0 ? (x0 + x1) / 2 : x0 + ((t - t0) / (t1 - t0)) * (x1 - x0);

  const fixes = new Map(pt.fixes.map((f) => [short(f.hash), f]));
  const fixedBy = new Map<string, string>();
  for (const f of pt.fixes)
    for (const c of f.causes)
      if (!fixedBy.has(short(c))) fixedBy.set(short(c), f.message);
  const own = commits.filter((c) => c.files.includes(pt.file));
  const at = new Map<string, number>();
  const ratedUntil = t1 - windowDays * DAY_MS;

  guides.push(line('lane:axis', x0, y, x1, y));
  marks.push(
    card(
      'lane:title',
      x0,
      y - 70,
      `${name} — ${fixedOf(pt, windowDays)}`,
      'right',
      2500,
    ),
    card('lane:start', x0, y + 22, day(t0), 'center', 5),
    card('lane:end', x1, y + 22, day(t1), 'center', 5),
  );

  own.forEach((c, i) => {
    // Twelve hex digits practically never collide; if two do, both still draw.
    const key = c.hash && !at.has(c.hash) ? c.hash : `#${i}`;
    const id = `change:${key}`;
    const x = T(c.timeMs);
    at.set(key, c.timeMs);
    const fix = c.hash ? fixes.get(c.hash) : undefined;
    const cause = c.hash ? fixedBy.get(c.hash) : undefined;
    const recent = c.timeMs > ratedUntil;
    const when = day(c.timeMs);
    let tip: string[];
    if (fix) {
      const repaired = fix.causes.map(short).filter((h) => h !== c.hash);
      tip = [
        fix.message,
        `${fix.revert ? 'Revert' : 'Fix'} · ${when}`,
        `Repaired ${repaired.length === 1 ? 'the change' : `${n(repaired.length)} changes`} of ${repaired.map((h) => day(commitTime(own, h) ?? 0)).join(', ')}`,
      ];
    } else if (cause) {
      tip = ['A change a fix repaired', when, `Fixed by: ${cause}`];
    } else {
      tip = [
        'A change',
        when,
        recent ? 'Too recent to rate' : 'No fix traced to it',
      ];
    }
    marks.push({
      id,
      shape: fix ? 'ring' : 'dot',
      paint: fix ? '--accent' : cause ? '--risk-3' : '--soft',
      x,
      y,
      ...zero,
      r: fix ? 6 : cause ? 5 : 3.5,
      alpha: recent ? 0.35 : 1,
      parent: ids.file(pt.file),
      z: fix ? 4 : 3,
      tip,
    });
  });

  for (const f of pt.fixes) {
    const from = short(f.hash);
    if (!at.has(from)) continue;
    for (const c of f.causes) {
      const to = short(c);
      if (!at.has(to) || to === from) continue;
      links.push({
        id: `repair:${from}:${to}`,
        source: `change:${from}`,
        target: `change:${to}`,
        curve: 'arc',
        width: 1.5,
        paint: '--accent',
        alpha: 0.8,
      });
    }
  }
}

function commitTime(
  commits: readonly CommitLike[],
  hash: string,
): number | undefined {
  return commits.find((c) => c.hash === hash)?.timeMs;
}

/** A rated file's tooltip: what it scored and what chance allows. */
export function fixTip(
  pt: FixPoint,
  name: string,
  windowDays: number,
): string[] {
  const lines = [
    name,
    fixedOf(pt, windowDays),
    `Chance allows up to ${n(pt.allowed)} at this size${pt.aboveChance ? ': above chance' : ''}`,
  ];
  if (pt.fixes[0]) lines.push(`Latest fix: ${pt.fixes[0].message}`);
  return lines;
}

function line(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Guide {
  return { id, kind: 'line', x1, y1, x2, y2, paint: '--soft', alpha: 0.5 };
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

function message(text: string, viewport: Viewport): Scene {
  return {
    marks: [
      card(
        'fr-empty',
        viewport.width / 2,
        viewport.height / 2,
        text,
        'center',
        0,
      ),
    ],
    links: [],
    guides: [],
    bounds: { x: 0, y: 0, w: viewport.width, h: viewport.height },
  };
}

/**
 * Bounds around what's drawn, with room for labels to the right: the stage
 * fits them, so the picture opens as large as it can.
 */
function fit(marks: readonly Mark[], viewport: Viewport) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const m of marks) {
    const hw = m.shape === 'bar' ? m.w / 2 : m.r;
    const hh = m.shape === 'bar' ? m.h / 2 : m.r;
    x0 = Math.min(x0, m.x - hw);
    x1 = Math.max(x1, m.x + hw);
    y0 = Math.min(y0, m.y - hh);
    y1 = Math.max(y1, m.y + hh);
  }
  const x = Math.min(x0 - 60, 0);
  const y = y0 - 40;
  const w = Math.max(x1 + 240, viewport.width * 0.6) - x;
  return { x, y, w, h: y1 + 40 - y };
}
