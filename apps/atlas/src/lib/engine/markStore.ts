// Marks as structure-of-arrays: one Float32Array per animated field, indexed
// by slot. The tween engine writes these every frame and the renderer reads
// them, without allocating an object per mark per frame.

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
    return i;
  }

  /** Removes a mark by moving the last slot into its place. */
  remove(id: EntityId): void {
    const i = this.slots.get(id);
    if (i === undefined) return;
    const last = --this.count;
    if (i !== last) {
      for (const k of GEOM_FIELDS) this[k][i] = this[k][last];
      this.red[i] = this.red[last];
      this.green[i] = this.green[last];
      this.blue[i] = this.blue[last];
      this.opacity[i] = this.opacity[last];
      this.shape[i] = this.shape[last];
      this.marks[i] = this.marks[last];
      this.slots.set(this.marks[i].id, i);
    }
    this.marks.length = last;
    this.slots.delete(id);
    this.version++;
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
