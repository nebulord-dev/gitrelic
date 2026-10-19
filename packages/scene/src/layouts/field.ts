// The Hotspots field (docs/atlas-views.md › Hotspots): commits across, lines
// up, both log scale, with the equal-score curves at 25 / 50 / 75 so a file's
// position reads as its score. Files scoring 25+ are dots on the risk ramp;
// the long tail is drawn as density, not thousands of dots. The hottest files
// are named in a column beside the plot, with leaders to their dots, because
// they crowd the top-right corner.
//
// Selecting a file fans it out: the plot slides into the left of the stage,
// the file travels to a root beside it (a faint ring keeps its place in the
// plot) and its facets fan out on an arc to the right, so the field stays
// there to pick the next file from.
//
// Ticks, axis names, curve names and callouts are label-only card marks (the
// canvas draws no text). Their ids — `tick:`, `axis:`, `curve-label:`, `callout:`,
// `bin:`, and the fan's `facet:` and `home:` — aren't entity kinds, so the
// index never resolves them and clicking one selects nothing.

import { distinctNames } from '../format/distinctNames';
import {
  commitsForScore,
  HOTSPOT_TIERS,
  hotspotTip,
  type HotspotPoint,
} from '../hotspots/points';
import { ids, type EntityId } from '../ids';
import type { FileFacet } from '../hotspots/facets';
import type { Guide, Link, Mark, Scene, Viewport } from '../model';

const RAMP = ['--risk-0', '--risk-1', '--risk-2', '--risk-3'] as const;
const DOT_R = [2.5, 4, 5.5, 7.5] as const;
/** Most files drawn as dots; the rest join the density. */
export const FIELD_DOT_CAP = 400;
export const FIELD_CALLOUTS = 8;
/** The plot's right edge, as a share of the width: alone, and beside a fan. */
const PLOT_RIGHT = 0.7;
const PLOT_RIGHT_FANNED = 0.36;
const ROOT_R = 12;
const FACET_R = 5;
const BINS_X = 24;
const BINS_Y = 16;

const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };

const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);

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

function ticks10(max: number): number[] {
  const out: number[] = [];
  for (let v = 1; v <= max; v *= 10) out.push(v);
  return out;
}

const range = (lo: number, hi: number) =>
  lo === hi
    ? lo.toLocaleString('en-US')
    : `${lo.toLocaleString('en-US')}–${hi.toLocaleString('en-US')}`;

const lineLabel = (v: number) => (v >= 1000 ? `${v / 1000}k` : String(v));

export interface FieldInput {
  points: readonly HotspotPoint[];
  /** From hotspotScale; null draws no curves. */
  scale: number | null;
  /** Drawn as a dot even when it scores under 25. */
  focus?: EntityId | null;
  /** The focused file's facets (fileFacets): given, the file fans them out. */
  facets?: readonly FileFacet[];
}

export function fieldScene(input: FieldInput, viewport: Viewport): Scene {
  const { points, scale } = input;
  const focusFile = input.focus?.startsWith('file:')
    ? input.focus.slice(5)
    : null;
  const focusPoint = focusFile
    ? points.find((p) => p.file === focusFile)
    : undefined;
  const fan = focusPoint && input.facets?.length ? input.facets : null;
  const left = 80;
  const top = 48;
  const right = viewport.width * (fan ? PLOT_RIGHT_FANNED : PLOT_RIGHT);
  const bottom = viewport.height - 64;
  const colX = right + 40;

  let maxC = 2;
  let maxL = 10;
  for (const p of points) {
    if (p.commits > maxC) maxC = p.commits;
    if (p.lines > maxL) maxL = p.lines;
  }
  const cMax = niceCeil(maxC);
  const lMax = niceCeil(maxL);
  const X = (c: number) =>
    left + (Math.log(Math.max(1, c)) / Math.log(cMax)) * (right - left);
  const Y = (l: number) =>
    bottom - (Math.log(Math.max(1, l)) / Math.log(lMax)) * (bottom - top);

  const marks: Mark[] = [];
  const links: Link[] = [];
  const guides: Guide[] = [];

  // Axes: hairline grid at the ticks, labels as card marks.
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
      alpha: 0.15,
    });
    marks.push(card(`tick:x:${c}`, x, bottom + 14, String(c), 'center', 1));
  }
  for (const l of ticks10(lMax)) {
    const y = Y(l);
    guides.push({
      id: `grid:y:${l}`,
      kind: 'line',
      x1: left,
      y1: y,
      x2: right,
      y2: y,
      paint: '--muted',
      alpha: 0.15,
    });
    marks.push(card(`tick:y:${l}`, left - 10, y, lineLabel(l), 'left', 1));
  }
  marks.push(
    card('axis:x', (left + right) / 2, bottom + 38, 'commits →', 'center', 2),
    card('axis:y', left, top - 26, 'lines ↑', 'center', 2),
  );

  // Equal-score curves: commits = S·k / log₂(lines), from where the curve
  // enters the plot (at the most commits) up to the largest size.
  if (scale !== null) {
    for (const [i, s] of HOTSPOT_TIERS.entries()) {
      const lFrom = Math.max(2, 2 ** ((s * scale) / cMax));
      if (lFrom >= lMax) continue;
      const steps = 32;
      let px = X(commitsForScore(s, lFrom, scale));
      let py = Y(lFrom);
      for (let k = 1; k <= steps; k++) {
        const l = lFrom * (lMax / lFrom) ** (k / steps);
        const x = X(commitsForScore(s, l, scale));
        const y = Y(l);
        guides.push({
          id: `curve:${s}:${k}`,
          kind: 'line',
          x1: px,
          y1: py,
          x2: x,
          y2: y,
          paint: RAMP[i + 1],
          alpha: 0.6,
        });
        px = x;
        py = y;
      }
      // Named where it leaves the top of the plot.
      if (px >= left && px <= right)
        marks.push(
          card(`curve-label:${s}`, px, top - 10, String(s), 'center', 3),
        );
    }
  }

  // Dots: everything 25+ (hottest first, capped), plus the focused file.
  const dotted = new Set<string>();
  for (const p of points) {
    if (p.tier === 0 || dotted.size >= FIELD_DOT_CAP) break;
    dotted.add(p.file);
  }
  if (focusPoint) dotted.add(focusPoint.file);
  const names = distinctNames([...dotted]);
  const nameOf = (file: string) => names.get(file) ?? baseName(file);
  // Beside a fan the plot is too narrow for the column.
  const callouts = fan
    ? []
    : points.filter((p) => p.tier > 0).slice(0, FIELD_CALLOUTS);
  const calledOut = new Set(callouts.map((p) => p.file));

  // Density: the files not drawn as dots, binned in log space.
  interface Bin {
    i: number;
    j: number;
    n: number;
    /** Files at 25+ that fell past the dot cap into the density. */
    warm: number;
    c0: number;
    c1: number;
    l0: number;
    l1: number;
  }
  const bins = new Map<string, Bin>();
  const standIns = new Map<EntityId, string>();
  for (const p of points) {
    if (dotted.has(p.file)) continue;
    const fx = (X(p.commits) - left) / (right - left);
    const fy = (bottom - Y(p.lines)) / (bottom - top);
    const i = Math.min(BINS_X - 1, Math.floor(fx * BINS_X));
    const j = Math.min(BINS_Y - 1, Math.floor(fy * BINS_Y));
    const key = `${i}:${j}`;
    standIns.set(ids.file(p.file), `bin:${key}`);
    const bin = bins.get(key);
    if (bin) {
      bin.n++;
      if (p.tier > 0) bin.warm++;
      bin.c0 = Math.min(bin.c0, p.commits);
      bin.c1 = Math.max(bin.c1, p.commits);
      bin.l0 = Math.min(bin.l0, p.lines);
      bin.l1 = Math.max(bin.l1, p.lines);
    } else {
      const { commits: c, lines: l } = p;
      bins.set(key, {
        i,
        j,
        n: 1,
        warm: p.tier > 0 ? 1 : 0,
        c0: c,
        c1: c,
        l0: l,
        l1: l,
      });
    }
  }
  let maxBin = 1;
  for (const b of bins.values()) if (b.n > maxBin) maxBin = b.n;
  const cw = (right - left) / BINS_X;
  const ch = (bottom - top) / BINS_Y;
  for (const b of [...bins.values()].sort((a, b) => a.i - b.i || a.j - b.j)) {
    marks.push({
      id: `bin:${b.i}:${b.j}`,
      shape: 'bar',
      paint: '--muted',
      x: left + (b.i + 0.5) * cw,
      y: bottom - (b.j + 0.5) * ch,
      r: 0,
      w: cw - 2,
      h: ch - 2,
      a0: 0,
      a1: 0,
      alpha: 0.05 + 0.35 * Math.sqrt(b.n / maxBin),
      z: -1,
      tip: [
        // Usually all cool; past the dot cap a cell holds warm files too.
        b.warm === 0
          ? `${b.n.toLocaleString('en-US')} file${b.n === 1 ? '' : 's'} scoring under 25`
          : `${b.n.toLocaleString('en-US')} file${b.n === 1 ? '' : 's'}, ${b.warm.toLocaleString('en-US')} at 25+`,
        `${range(b.c0, b.c1)} commits · ${range(b.l0, b.l1)} lines`,
      ],
    });
  }

  for (const p of points) {
    if (!dotted.has(p.file) || (fan && p === focusPoint)) continue;
    marks.push({
      id: ids.file(p.file),
      shape: 'dot',
      paint: RAMP[p.tier],
      x: X(p.commits),
      y: Y(p.lines),
      r: DOT_R[p.tier],
      w: 0,
      h: 0,
      a0: 0,
      a1: 0,
      alpha: 1,
      // Called-out files are named in the column instead.
      ...(calledOut.has(p.file)
        ? {}
        : { label: nameOf(p.file), labelPriority: p.score }),
      z: p.tier + 1,
      tip: hotspotTip(p, nameOf(p.file)),
    });
  }

  // The column, ordered by the dots' height so the leaders cross little.
  const rows = [...callouts].sort((a, b) => b.lines - a.lines);
  const step = Math.min(30, (bottom - top) / Math.max(1, rows.length));
  rows.forEach((p, i) => {
    const id = `callout:${p.file}`;
    marks.push(
      card(
        id,
        colX,
        top + 12 + i * step,
        `${p.score}  ${nameOf(p.file)}`,
        'right',
        200 - i,
      ),
    );
    links.push({
      id: `leader:${p.file}`,
      source: id,
      target: ids.file(p.file),
      curve: 'straight',
      width: 1,
      paint: '--link',
      alpha: 0.8,
    });
  });

  if (fan && focusPoint) {
    fanOut(
      focusPoint,
      fan,
      nameOf(focusPoint.file),
      X,
      Y,
      viewport,
      marks,
      links,
    );
  }

  return {
    marks,
    links,
    guides,
    bounds: { x: 0, y: 0, w: viewport.width, h: viewport.height },
    standIns,
  };
}

/** The fan's hub: the spokes' fixed end, under whichever file is out. */
export const FAN_HUB = 'facet-hub';

/**
 * The fan: the file at a root right of the plot, a faint ring and a leader
 * back to where it sits in the plot, and its facets on an arc beyond the
 * root, growing out of it.
 *
 * The spokes run from an invisible hub at the root, not from the file: picking
 * another file while the fan is out only swaps which file sits on the hub.
 * Tied to the file, every spoke would jump to the new file's dot in the plot
 * and ride out with it, which reads as a whole new fan.
 */
function fanOut(
  p: HotspotPoint,
  facets: readonly FileFacet[],
  name: string,
  X: (c: number) => number,
  Y: (l: number) => number,
  viewport: Viewport,
  marks: Mark[],
  links: Link[],
): void {
  const root = ids.file(p.file);
  const rx = viewport.width * 0.47;
  const ry = viewport.height / 2;
  // Label-only card with no label: draws nothing, can't be hit. Its parent is
  // the file, so a first fan grows out of the dot that was clicked.
  marks.push({
    id: FAN_HUB,
    shape: 'card',
    paint: '--muted',
    x: rx,
    y: ry,
    ...zero,
    alpha: 1,
    parent: root,
  });
  marks.push({
    id: root,
    shape: 'dot',
    paint: RAMP[p.tier],
    x: rx,
    y: ry,
    ...zero,
    r: ROOT_R,
    alpha: 1,
    label: name,
    labelPriority: 3000,
    labelAnchor: 'above',
    z: 6,
    tip: hotspotTip(p, name),
  });
  const home = `home:${p.file}`;
  marks.push({
    id: home,
    shape: 'ring',
    paint: RAMP[p.tier],
    x: X(p.commits),
    y: Y(p.lines),
    ...zero,
    r: DOT_R[p.tier] + 3,
    alpha: 0.6,
    // Shrinks toward where its file is going, which is home: it fades in
    // place rather than streaking to the root.
    parent: root,
    z: 5,
  });
  links.push({
    id: `home-leader:${p.file}`,
    source: root,
    target: home,
    curve: 'straight',
    width: 1,
    paint: '--link',
    alpha: 0.5,
  });

  // Pointing right, spread wider the more facets there are.
  const radius = Math.min(viewport.width, viewport.height) * 0.32;
  const span = Math.min(Math.PI * 0.8, 0.3 * (facets.length - 1));
  facets.forEach((f, i) => {
    const t = facets.length === 1 ? 0 : i / (facets.length - 1) - 0.5;
    const a = t * span;
    // Keyed by facet, not by file, on purpose: picking another file while
    // the fan is out keeps the spokes in place and only their readings
    // change. Re-folding and re-growing the whole fan per pick felt needless.
    const id = `facet:${f.id}`;
    marks.push({
      id,
      shape: 'dot',
      paint: f.hot ? '--accent' : '--soft',
      x: rx + radius * Math.cos(a),
      y: ry + radius * Math.sin(a),
      ...zero,
      r: FACET_R,
      alpha: 1,
      parent: FAN_HUB,
      foldOnExit: true,
      label: `${f.name}  ${f.value}`,
      labelPriority: 2000 + facets.length - i,
      labelAnchor: 'right',
      z: 5,
      tip: [f.name, f.value, f.hint],
    });
    links.push({
      id: `facet-link:${f.id}`,
      source: FAN_HUB,
      target: id,
      curve: 'arc',
      width: 1.2,
      paint: f.hot ? '--link-hot' : '--link',
      alpha: 0.7,
    });
  });
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
