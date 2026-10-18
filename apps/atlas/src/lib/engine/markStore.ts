// Marks as structure-of-arrays: one Float32Array per animated field, indexed
// by slot. The tween engine writes these every frame and the renderer reads
// them, without allocating an object per mark per frame.
//
// Slots keep insertion order (removal compacts, it never swaps), and
// `drawOrder` is the one paint order the renderer draws in and the hit test
// picks by, so what's clicked is always what's on top.

import type {
  EntityId,
  LiveMark,
  Mark,
  MarkGeom,
  MarkShape,
  Rgba,
} from '@gitrelic/scene';

export const GEOM_FIELDS = [
  'x',
  'y',
  'r',
  'w',
  'h',
  'a0',
  'a1',
  'alpha',
] as const;
export type GeomField = (typeof GEOM_FIELDS)[number];

export const SHAPE_CODES: Record<MarkShape, number> = {
  dot: 0,
  ring: 1,
  arc: 2,
  bar: 3,
  card: 4,
};

const INITIAL_CAPACITY = 256;

/**
 * The renderer's layers, back to front: arcs are one Graphics under the
 * particle layer that holds every other shape.
 */
export function drawLayer(shape: number): number {
  return shape === SHAPE_CODES.arc ? 0 : 1;
}

export class MarkStore {
  count = 0;
  /** Bumped whenever marks are added or removed (not when they move). */
  version = 0;

  x = new Float32Array(INITIAL_CAPACITY);
  y = new Float32Array(INITIAL_CAPACITY);
  r = new Float32Array(INITIAL_CAPACITY);
  w = new Float32Array(INITIAL_CAPACITY);
  h = new Float32Array(INITIAL_CAPACITY);
  a0 = new Float32Array(INITIAL_CAPACITY);
  a1 = new Float32Array(INITIAL_CAPACITY);
  alpha = new Float32Array(INITIAL_CAPACITY);
  /** The colour currently shown, sRGB 0..1 (tweened, so not always a paint). */
  red = new Float32Array(INITIAL_CAPACITY);
  green = new Float32Array(INITIAL_CAPACITY);
  blue = new Float32Array(INITIAL_CAPACITY);
  opacity = new Float32Array(INITIAL_CAPACITY);
  shape = new Uint8Array(INITIAL_CAPACITY);

  /** The mark data per slot: id, paint, label, parent, z. */
  marks: Mark[] = [];
  private readonly slots = new Map<EntityId, number>();
  private order = new Int32Array(0);
  private rank = new Int32Array(0);
  private orderStale = true;

  get capacity(): number {
    return this.x.length;
  }

  indexOf(id: EntityId): number {
    return this.slots.get(id) ?? -1;
  }

  has(id: EntityId): boolean {
    return this.slots.has(id);
  }

  /**
   * Adds `mark` with geometry `geom`, or, if its id is already here, replaces
   * its data and leaves its geometry and colour alone (a tween moves those).
   */
  upsert(mark: Mark, geom: MarkGeom, color: Rgba): number {
    const existing = this.slots.get(mark.id);
    if (existing !== undefined) {
      const before = this.marks[existing];
      if ((before.z ?? 0) !== (mark.z ?? 0) || before.shape !== mark.shape)
        this.orderStale = true;
      this.marks[existing] = mark;
      this.shape[existing] = SHAPE_CODES[mark.shape];
      return existing;
    }
    if (this.count === this.capacity) this.grow();
    const i = this.count++;
    this.slots.set(mark.id, i);
    this.marks[i] = mark;
    this.shape[i] = SHAPE_CODES[mark.shape];
    this.setGeom(i, geom);
    this.setColor(i, color);
    this.version++;
    this.orderStale = true;
    return i;
  }

  remove(id: EntityId): void {
    this.removeAll([id]);
  }

  /**
   * Removes marks in one compacting pass, keeping the others in order (a
   * swap would reorder overlapping marks and make them pop).
   */
  removeAll(ids: Iterable<EntityId>): void {
    const gone = new Set<EntityId>();
    for (const id of ids) if (this.slots.has(id)) gone.add(id);
    if (gone.size === 0) return;
    let to = 0;
    for (let from = 0; from < this.count; from++) {
      const id = this.marks[from].id;
      if (gone.has(id)) {
        this.slots.delete(id);
        continue;
      }
      if (to !== from) {
        for (const k of GEOM_FIELDS) this[k][to] = this[k][from];
        this.red[to] = this.red[from];
        this.green[to] = this.green[from];
        this.blue[to] = this.blue[from];
        this.opacity[to] = this.opacity[from];
        this.shape[to] = this.shape[from];
        this.marks[to] = this.marks[from];
        this.slots.set(id, to);
      }
      to++;
    }
    this.count = to;
    this.marks.length = to;
    this.version++;
    this.orderStale = true;
  }

  /**
   * Slots back to front: by layer (arcs under the rest), then `z`, then
   * slot. Cached until marks are added, removed or change `z` or shape.
   */
  drawOrder(): Int32Array {
    if (this.orderStale) this.sortOrder();
    return this.order;
  }

  /** Where slot `i` sits in `drawOrder`; higher is drawn later, on top. */
  paintRank(i: number): number {
    if (this.orderStale) this.sortOrder();
    return this.rank[i];
  }

  setGeom(i: number, g: MarkGeom): void {
    for (const k of GEOM_FIELDS) this[k][i] = g[k];
  }

  geom(i: number): MarkGeom {
    return {
      x: this.x[i],
      y: this.y[i],
      r: this.r[i],
      w: this.w[i],
      h: this.h[i],
      a0: this.a0[i],
      a1: this.a1[i],
      alpha: this.alpha[i],
    };
  }

  setColor(i: number, c: Rgba): void {
    this.red[i] = c.r;
    this.green[i] = c.g;
    this.blue[i] = c.b;
    this.opacity[i] = c.a;
  }

  color(i: number): Rgba {
    return {
      r: this.red[i],
      g: this.green[i],
      b: this.blue[i],
      a: this.opacity[i],
    };
  }

  /** Every mark as currently drawn — the `live.marks` a transition plans from. */
  live(): Map<EntityId, LiveMark> {
    const out = new Map<EntityId, LiveMark>();
    for (let i = 0; i < this.count; i++) {
      out.set(this.marks[i].id, { ...this.marks[i], ...this.geom(i) });
    }
    return out;
  }

  private sortOrder(): void {
    const n = this.count;
    const slots = Array.from({ length: n }, (_, i) => i);
    const z = (i: number) => this.marks[i].z ?? 0;
    slots.sort(
      (a, b) =>
        drawLayer(this.shape[a]) - drawLayer(this.shape[b]) ||
        z(a) - z(b) ||
        a - b,
    );
    this.order = Int32Array.from(slots);
    this.rank = new Int32Array(n);
    for (let k = 0; k < n; k++) this.rank[this.order[k]] = k;
    this.orderStale = false;
  }

  private grow(): void {
    const size = this.capacity * 2;
    const grown = <T extends Float32Array | Uint8Array>(a: T): T => {
      const b = new (a.constructor as new (n: number) => T)(size);
      b.set(a);
      return b;
    };
    for (const k of GEOM_FIELDS) this[k] = grown(this[k]);
    this.red = grown(this.red);
    this.green = grown(this.green);
    this.blue = grown(this.blue);
    this.opacity = grown(this.opacity);
    this.shape = grown(this.shape);
  }
}
