// Coupling's Boundaries (docs/atlas-views.md › Coupling): the busiest
// packages around an ellipse, seated evenly by height like Parallel Dev's
// pairs so every name has room, a chord between two packages as wide as the
// commits that changed both and as strong as their share of the smaller
// package's commits. Packages are `dir:` marks, so they travel from Commit
// Timing, AI & Co-authors and Churn. Hovering a package lights its chords
// (`hoverLinks`); hovering a chord names the file pairs behind it.
//
// Selecting a package keeps its chords lit and names, beside each partner,
// the commits they share. Selecting a file draws its ripple instead: the file
// in the middle, each partner nearer the more often it changes with it,
// grouped by package, the ones in another package in the accent. The ring
// stays, faint and unnamed, so partners grow out of their own package's dot.

import {
  boundariesOf,
  rippleOf,
  type Boundaries,
  type Ripple,
} from '../coupling/boundaries';
import { ids, type EntityId } from '../ids';
import type { Link, Mark, Scene, ViewInput, Viewport } from '../model';

/** A chord's control point sits this share of the way to the centre. */
const PULL = 0.55;
/** Faint, but over the label layer's floor (0.5): dimmed packages keep names. */
const DIM = 0.55;
const LABEL_ROOM = 230;
const zero = { r: 0, w: 0, h: 0, a0: 0, a1: 0 };
const n = (v: number) => v.toLocaleString('en-US');
const plural = (v: number, word: string) =>
  `${n(v)} ${word}${v === 1 ? '' : 's'}`;
const baseName = (path: string) => path.slice(path.lastIndexOf('/') + 1);
/** A package's name in findings: `packages/` goes without saying. */
export const shortPackage = (dir: string) => dir.replace(/^packages\//, '');

/**
 * Each package's name on the ring: its last folder, so a nested root like
 * `compiler/packages/babel-plugin-react-compiler` fits beside its dot; the
 * shortened path where two would share a name.
 */
export function ringNames(dirs: readonly string[]): Map<string, string> {
  const last = (d: string) => d.slice(d.lastIndexOf('/') + 1);
  const counts = new Map<string, number>();
  for (const d of dirs) counts.set(last(d), (counts.get(last(d)) ?? 0) + 1);
  return new Map(
    dirs.map((d) => [d, counts.get(last(d))! > 1 ? shortPackage(d) : last(d)]),
  );
}

interface Seat {
  x: number;
  y: number;
  side: 1 | -1;
}

export function boundariesScene(input: ViewInput, viewport: Viewport): Scene {
  const ring = boundariesOf(input.report);
  const cx = viewport.width / 2;
  const cy = viewport.height / 2 + 10;
  const ry = viewport.height / 2 - 100;
  const rx = ry * 1.45;
  const span = rx + LABEL_ROOM;
  const bounds = {
    x: cx - span,
    y: cy - ry - 70,
    w: 2 * span,
    h: 2 * ry + 140,
  };

  // Seats in name order, so a family of packages (react-server-dom-*) sits
  // together and its chords stay short; a long chord is coupling across
  // families. Spaced evenly by height, not angle: down the right half, then
  // back up the left. Even angles bunch packages at the top and bottom.
  const names = ringNames(ring.packages.map((p) => p.dir));
  const seated = [...ring.packages].sort((a, b) =>
    names.get(a.dir)! < names.get(b.dir)! ? -1 : 1,
  );
  const right = Math.ceil(seated.length / 2);
  const leftCount = seated.length - right;
  const seats = new Map<string, Seat>();
  seated.forEach((p, i) => {
    const side = i < right ? 1 : -1;
    const k = side === 1 ? i : seated.length - 1 - i;
    const count = side === 1 ? right : leftCount;
    const y = cy - ry + (2 * ry * (k + 0.5)) / Math.max(1, count);
    const x = cx + side * rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
    seats.set(p.dir, { x, y, side });
  });

  const focus = input.focus ?? null;
  if (focus?.startsWith('file:')) {
    const ripple = rippleOf(input.report, focus.slice('file:'.length));
    if (ripple) return rippleScene(ripple, ring, seats, { cx, cy, ry }, bounds);
  }
  return ringScene(ring, seats, names, { cx, cy }, focus, bounds);
}

function ringScene(
  ring: Boundaries,
  seats: ReadonlyMap<string, Seat>,
  names: ReadonlyMap<string, string>,
  { cx, cy }: { cx: number; cy: number },
  focus: EntityId | null,
  bounds: Scene['bounds'],
): Scene {
  const maxCommits = Math.max(1, ...ring.packages.map((p) => p.commits));
  const maxLink = Math.max(1, ...ring.links.map((l) => l.commits));
  const focusDir = ring.packages.find((p) => p.id === focus)?.dir;
  const withFocus = new Map<string, number>();
  if (focusDir)
    for (const l of ring.links) {
      if (l.a === focusDir) withFocus.set(l.b, l.commits);
      if (l.b === focusDir) withFocus.set(l.a, l.commits);
    }

  const marks: Mark[] = ring.packages.map((p, i) => {
    const { x, y, side } = seats.get(p.dir)!;
    const isFocus = p.dir === focusDir;
    const shared = withFocus.get(p.dir);
    const dim = focusDir !== undefined && !isFocus && shared === undefined;
    return {
      id: p.id,
      shape: 'dot',
      paint: isFocus ? '--accent' : '--dir',
      x,
      y,
      ...zero,
      r: 4 + 12 * Math.sqrt(p.commits / maxCommits),
      alpha: dim ? DIM : 0.95,
      z: 2,
      label: names.get(p.dir),
      labelSub:
        shared !== undefined
          ? `${plural(shared, 'commit')} with ${names.get(focusDir!)}`
          : `${plural(p.links, 'link')} · ${plural(p.commits, 'commit')}`,
      labelAnchor: side === 1 ? 'right' : 'left',
      labelPriority: 500 - i,
      tip: [
        p.dir,
        `${plural(p.commits, 'commit')} · changes with ${plural(p.links, 'package')} here`,
      ],
    };
  });

  const links: Link[] = ring.links.map((l) => {
    const a = seats.get(l.a)!;
    const b = seats.get(l.b)!;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // Bow toward the centre, as Parallel Dev's pairs do.
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const toCentre = nx * (cx - (a.x + b.x) / 2) + ny * (cy - (a.y + b.y) / 2);
    const on =
      focusDir === undefined ? null : l.a === focusDir || l.b === focusDir;
    return {
      id: `couple:${l.a}:${l.b}`,
      source: ids.dir(l.a),
      target: ids.dir(l.b),
      curve: 'arc',
      bow: (toCentre * PULL) / len,
      width: 1.5 + 9 * (l.commits / maxLink),
      paint: on ? '--accent' : '--person',
      alpha: on === null ? 0.2 + 0.6 * Math.min(1, l.share) : on ? 0.85 : 0.05,
      tip: [
        `${names.get(l.a)} ↔ ${names.get(l.b)}`,
        `${plural(l.commits, 'commit')} changed both (${Math.round(100 * l.share)}% of the smaller package's)`,
        ...(l.filePairs.length > 0
          ? l.filePairs.map(
              (p) =>
                `${baseName(p.fileA)} ↔ ${baseName(p.fileB)} · ${n(p.coCommits)}`,
            )
          : ['no single pair of files changed together 3 or more times']),
      ],
    };
  });

  if (ring.links.length === 0)
    marks.push({
      id: 'boundaries-empty',
      shape: 'card',
      paint: '--muted',
      x: cx,
      y: cy,
      ...zero,
      alpha: 1,
      label:
        ring.packages.length < 2
          ? 'One package: no change crosses a boundary'
          : 'No two packages changed together 3 or more times',
      labelSub:
        ring.leftOut > 0
          ? `${plural(ring.leftOut, 'link')} to root-level files or dot-folders left off`
          : undefined,
      labelAnchor: 'center',
      labelPriority: 1000,
    });

  return { marks, links, guides: [], hoverLinks: true, bounds };
}

function rippleScene(
  ripple: Ripple,
  ring: Boundaries,
  seats: ReadonlyMap<string, Seat>,
  { cx, cy, ry }: { cx: number; cy: number; ry: number },
  bounds: Scene['bounds'],
): Scene {
  // The ring, faint and unnamed: where the partners come from.
  const marks: Mark[] = ring.packages.map((p) => {
    const { x, y } = seats.get(p.dir)!;
    return {
      id: p.id,
      shape: 'dot',
      paint: '--dir',
      x,
      y,
      ...zero,
      r: 4,
      alpha: 0.25,
      z: 1,
      tip: [p.dir],
    };
  });

  const centreId = ids.file(ripple.file);
  marks.push({
    id: centreId,
    shape: 'dot',
    paint: '--text',
    x: cx,
    y: cy,
    ...zero,
    r: 9,
    alpha: 1,
    z: 3,
    label: baseName(ripple.file),
    labelSub: ripple.blast
      ? `${shortPackage(ripple.package) || '(root)'} · usually ${plural(ripple.blast.median, 'other file')} per change`
      : `${shortPackage(ripple.package) || '(root)'} · ${plural(ripple.commits, 'commit')}`,
    labelAnchor: 'above',
    labelPriority: 1000,
    tip: [
      ripple.file,
      `${plural(ripple.commits, 'commit')} · ${plural(ripple.partners.length, 'partner')}`,
    ],
  });

  const links: Link[] = [];
  if (ripple.partners.length === 0) {
    marks.push({
      id: 'ripple-alone',
      shape: 'card',
      paint: '--muted',
      x: cx,
      y: cy + 60,
      ...zero,
      alpha: 1,
      label: `${baseName(ripple.file)} changes alone: no file shares 3 or more commits with it`,
      labelAnchor: 'center',
      labelPriority: 900,
    });
    return { marks, links, guides: [], bounds };
  }

  // Partners on rings around the file, nearer the more they share; its own
  // package's first (from the top, clockwise), then the others by package.
  const ordered = [...ripple.partners].sort(
    (a, b) =>
      Number(a.other) - Number(b.other) ||
      (a.package < b.package ? -1 : a.package > b.package ? 1 : 0) ||
      b.shared - a.shared,
  );
  const inner = ry * 0.28;
  const outer = ry * 0.85;
  const maxShared = Math.max(...ordered.map((p) => p.shared));
  ordered.forEach((p, i) => {
    const angle = -Math.PI / 2 + ((i + 0.5) / ordered.length) * 2 * Math.PI;
    const d = inner + (1 - Math.min(1, p.share)) * (outer - inner);
    const x = cx + d * Math.cos(angle) * 1.3;
    const y = cy + d * Math.sin(angle);
    const id = ids.file(p.file);
    marks.push({
      id,
      shape: 'dot',
      paint: p.other ? '--accent' : '--person',
      x,
      y,
      ...zero,
      r: 3 + 5 * Math.sqrt(p.shared / maxShared),
      alpha: 0.95,
      z: 2,
      label: baseName(p.file),
      labelSub: `${n(p.shared)} of ${plural(ripple.commits, 'commit')}`,
      labelAnchor: Math.cos(angle) >= 0 ? 'right' : 'left',
      labelPriority: 700 - i,
      tip: [
        p.file,
        `changed with ${baseName(ripple.file)} in ${n(p.shared)} of its ${plural(ripple.commits, 'commit')} (${Math.round(100 * p.share)}%)`,
        p.other
          ? `another package: ${shortPackage(p.package) || '(root)'}`
          : 'same package',
      ],
    });
    links.push({
      id: `ripple:${p.file}`,
      source: centreId,
      target: id,
      curve: 'straight',
      width: 1 + 3 * Math.min(1, p.share),
      paint: p.other ? '--accent' : '--soft',
      alpha: 0.45,
    });
  });
  return { marks, links, guides: [], bounds };
}
