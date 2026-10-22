// Commit Timing's alternate form, packages against chance (docs/atlas-views.md
// › Commit Timing): tested packages by commits (across, log scale) and the
// share of them off-hours (up). The shaded band is what chance alone gives
// at the repo's off-hours rate, narrowing as packages grow; the accent line
// is the rate itself. Packages above the band take the risk colour and are
// named first; the rest are named as room allows.
//
// Fix rate's funnel is the same test on files (`layouts/funnel.ts`); this
// one has no lane, and its dots are packages (`dir:`, or `repo` for the
// root's files). Ticks, axis names and the band's bars (`band:`) aren't
// entity kinds, so clicking one selects nothing.

import { chanceAllows, ratePct } from '../fixRate/points';
import { niceCeil, ticksBetween } from './funnel';
import type { EntityId } from '../ids';
import type { Guide, Mark, Scene, Viewport } from '../model';

const RAMP = ['--risk-0', '--risk-1', '--risk-2', '--risk-3'] as const;
const DOT_R = [4, 5, 6.5, 8] as const;
/** Band bars drawn at most; past this many sizes they're sampled. */
const BAND_STEPS = 80;

const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');

/** A tested package, as the funnel draws it. */
export interface OffHoursPoint {
  id: EntityId;
  name: string;
  commits: number;
  offHours: number;
  /** Off-hours commits chance allows at its size. */
  allowed: number;
  aboveChance: boolean;
  /** 0–3: below the rate, above it within chance, above chance, twice the rate. */
  tier: 0 | 1 | 2 | 3;
}

export interface OffHoursFunnelInput {
  points: readonly OffHoursPoint[];
  /** The repo's off-hours rate (sweeping and bot commits left out). */
  rate: number;
  /** Fewest commits a package needs to be tested. */
  minCommits: number;
  focus?: EntityId | null;
}

export function offHoursFunnelScene(
  { points, rate, minCommits, focus = null }: OffHoursFunnelInput,
  viewport: Viewport,
): Scene {
  if (points.length === 0)
    return message(
      `No package has ${n(minCommits)} commits to test yet.`,
      viewport,
    );

  const left = 90;
  const top = 60;
  const right = viewport.width * 0.75;
  const bottom = viewport.height - 160;

  let nLo = Infinity;
  let nMax = 0;
  let sMax = 0;
  for (const pt of points) {
    nLo = Math.min(nLo, pt.commits);
    nMax = Math.max(nMax, pt.commits);
    sMax = Math.max(sMax, pt.offHours / pt.commits);
  }
  const nHi = Math.max(niceCeil(nMax), nLo * 2);
  const bandTop = chanceAllows(nLo, rate) / nLo;
  const yMax = Math.min(
    1,
    Math.max(0.1, Math.ceil(Math.max(sMax, bandTop) * 10 + 0.001) / 10),
  );
  const X = (c: number) =>
    left + (Math.log(c / nLo) / Math.log(nHi / nLo)) * (right - left);
  const Y = (s: number) => bottom - (s / yMax) * (bottom - top);

  const marks: Mark[] = [];
  const guides: Guide[] = [];

  // y grid: every 10% (20% on a tall scale).
  const yStep = yMax > 0.5 ? 0.2 : 0.1;
  for (let k = 0; k * yStep <= yMax + 1e-9; k++) {
    const y = Y(k * yStep);
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
      card(
        `tick:y:${k}`,
        left - 12,
        y,
        `${Math.round(k * yStep * 100)}%`,
        'left',
        1,
      ),
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
    const allowed = chanceAllows(c, rate);
    const [x0, x1] = edges[i];
    const yTop = Y(Math.min(yMax, allowed / c));
    if (x1 - x0 > 0 && bottom - yTop > 0)
      marks.push({
        id: `band:${c}`,
        shape: 'bar',
        paint: '--muted',
        x: (x0 + x1) / 2,
        y: (yTop + bottom) / 2,
        ...zero,
        w: x1 - x0,
        h: bottom - yTop,
        alpha: 0.14,
        z: -2,
        tip: [
          `What chance gives at the repo’s ${ratePct(rate)}`,
          `Up to ${n(allowed)} of ${n(c)} commits off-hours`,
        ],
      });
    // Its edge, as steps: the boundary is a whole number of commits.
    if (prevTop !== null && prevTop !== yTop)
      guides.push(line(`band-edge:v:${c}`, x0, prevTop, x0, yTop));
    guides.push(line(`band-edge:h:${c}`, x0, yTop, x1, yTop));
    prevTop = yTop;
  });
  marks.push(
    card(
      'band-label',
      edges.at(-1)![1] + 8,
      prevTop ?? bottom,
      `chance at ${ratePct(rate)}`,
      'right',
      4,
    ),
  );

  // The repo's rate, a line across the plot.
  guides.push({
    id: 'rate',
    kind: 'line',
    x1: left,
    y1: Y(rate),
    x2: right,
    y2: Y(rate),
    paint: '--accent',
    alpha: 0.6,
  });
  // Named at its left end, just above it: the right end is where the
  // biggest packages are named. Over ordinary package names, under those
  // above chance.
  marks.push(
    card(
      'rate-label',
      left + 6,
      Y(rate) - 10,
      `repo ${ratePct(rate)}`,
      'right',
      1000, // card adds 1000: 2000, the top of the ordinary tier
    ),
  );

  // Packages. Same size and count sit side by side.
  const placed = new Map<string, number>();
  for (const pt of points) {
    const share = pt.offHours / pt.commits;
    const key = `${pt.commits}:${pt.offHours}`;
    const k = placed.get(key) ?? 0;
    placed.set(key, k + 1);
    const x =
      X(pt.commits) +
      (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * 2 * DOT_R[pt.tier];
    const y = Y(share);
    const focused = pt.id === focus;
    marks.push({
      id: pt.id,
      shape: 'dot',
      paint: RAMP[pt.tier],
      x,
      y,
      ...zero,
      r: DOT_R[pt.tier],
      alpha: pt.tier === 0 ? 0.75 : 1,
      label: pt.name,
      // Tiers of 1000: the selection, then above chance, then the rest,
      // bigger first within a tier (capped, so a tier never overruns).
      labelPriority: focused
        ? 3000
        : (pt.aboveChance ? 2000 : 1000) + Math.min(pt.commits, 999),
      z: pt.tier + 1,
      tip: [
        pt.name,
        `${n(pt.offHours)} of ${n(pt.commits)} commits off-hours (${Math.round(share * 100)}%)`,
        `Chance allows up to ${n(pt.allowed)} at this size${pt.aboveChance ? ': above chance' : ''}`,
      ],
    });
    if (focused)
      marks.push({
        id: `home:${pt.id}`,
        shape: 'ring',
        paint: RAMP[pt.tier],
        x,
        y,
        ...zero,
        r: DOT_R[pt.tier] + 4,
        alpha: 0.7,
        parent: pt.id,
        z: pt.tier,
      });
  }

  // x ticks and axis names.
  const tickY = bottom + 22;
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
  const xAxis = card(
    'axis:x',
    (left + right) / 2,
    tickY + 24,
    'commits →',
    'center',
    2,
  );
  xAxis.labelSub = `packages with ${n(minCommits)} or more commits; sweeping and bot commits left out`;
  marks.push(xAxis, card('axis:y', left, top - 44, 'off-hours ↑', 'right', 2));

  return { marks, links: [], guides, bounds: fit(marks, viewport) };
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
        'ohf-empty',
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

/** Bounds around what's drawn, with room for labels to the right. */
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
  const w = Math.max(x1 + 200, viewport.width * 0.6) - x;
  return { x, y, w, h: y1 + 40 - y };
}
