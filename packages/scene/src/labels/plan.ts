// Decides which labels to draw this frame. Greedy: the most important label
// claims its space first, and anything that would overlap a placed label is
// dropped. A uniform grid keeps each overlap test to the handful of labels
// nearby, so a few thousand candidates stay cheap enough to re-plan on zoom.

export interface LabelCandidate {
  id: string;
  /** Top-left corner and size of the label box, in screen pixels. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Higher wins. Ties go to the lower id, so the result is stable. */
  priority: number;
}

export interface LabelOptions {
  /** Most labels shown at once, pinned ones aside. */
  cap?: number;
  /** Always shown (hovered or selected), even over others or past the cap. */
  pinned?: ReadonlySet<string>;
  /** Screen size; labels entirely off it are skipped. */
  view?: { width: number; height: number };
  /** Minimum gap between two labels, px. */
  gap?: number;
}

export const DEFAULT_LABEL_CAP = 150;
const CELL = 64;

/** Ids of the labels to draw, in placement order. */
export function planLabels(
  candidates: readonly LabelCandidate[],
  options: LabelOptions = {},
): string[] {
  const cap = options.cap ?? DEFAULT_LABEL_CAP;
  const pinned = options.pinned ?? new Set<string>();
  const gap = options.gap ?? 2;
  const view = options.view;

  const ordered = candidates
    .filter(
      (c) =>
        [c.x, c.y, c.w, c.h].every(Number.isFinite) &&
        (!view ||
          (c.x + c.w > 0 &&
            c.y + c.h > 0 &&
            c.x < view.width &&
            c.y < view.height)),
    )
    .sort(
      (a, b) =>
        Number(pinned.has(b.id)) - Number(pinned.has(a.id)) ||
        b.priority - a.priority ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );

  const grid = new Map<string, LabelCandidate[]>();
  const placed: string[] = [];
  let unpinned = 0;

  for (const c of ordered) {
    const isPinned = pinned.has(c.id);
    if (!isPinned && unpinned >= cap) break;
    const x0 = Math.floor((c.x - gap) / CELL);
    const x1 = Math.floor((c.x + c.w + gap) / CELL);
    const y0 = Math.floor((c.y - gap) / CELL);
    const y1 = Math.floor((c.y + c.h + gap) / CELL);

    if (!isPinned && collides(c, grid, x0, x1, y0, y1, gap)) continue;

    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const key = `${gx},${gy}`;
        const bucket = grid.get(key);
        if (bucket) bucket.push(c);
        else grid.set(key, [c]);
      }
    }
    placed.push(c.id);
    if (!isPinned) unpinned++;
  }
  return placed;
}

function collides(
  c: LabelCandidate,
  grid: ReadonlyMap<string, LabelCandidate[]>,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  gap: number,
): boolean {
  for (let gx = x0; gx <= x1; gx++) {
    for (let gy = y0; gy <= y1; gy++) {
      for (const o of grid.get(`${gx},${gy}`) ?? []) {
        if (
          c.x < o.x + o.w + gap &&
          o.x < c.x + c.w + gap &&
          c.y < o.y + o.h + gap &&
          o.y < c.y + c.h + gap
        ) {
          return true;
        }
      }
    }
  }
  return false;
}
