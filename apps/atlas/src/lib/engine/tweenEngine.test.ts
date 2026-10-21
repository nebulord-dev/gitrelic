import {
  EMPTY_LIVE,
  emptyScene,
  planTransition,
  TIMING,
  type Guide,
  type Link,
  type Mark,
  type Palette,
  type Rgba,
  type Scene,
} from '@gitrelic/scene';
import { describe, expect, it } from 'vitest';

import { MarkStore } from './markStore';
import { REPAINT_MS, TweenEngine, type FrameClock } from './tweenEngine';

/**
 * A clock the test advances by hand; frames run only when asked. Like the
 * browser, it keeps every outstanding request, so a second frame loop shows.
 */
function fakeClock() {
  let time = 0;
  let next = 1;
  const queue = new Map<number, (t: number) => void>();
  const clock: FrameClock = {
    now: () => time,
    request: (cb) => {
      queue.set(next, cb);
      return next++;
    },
    cancel: (h) => {
      queue.delete(h);
    },
  };
  return {
    clock,
    /** Moves time forward and runs the frames that were requested. */
    advance(ms: number) {
      time += ms;
      const due = [...queue.values()];
      queue.clear();
      for (const cb of due) cb(time);
    },
    get scheduled() {
      return queue.size > 0;
    },
    get outstanding() {
      return queue.size;
    },
  };
}

const rgba = (r: number, g: number, b: number): Rgba => ({ r, g, b, a: 1 });
const paletteOf = (file: Rgba, person: Rgba): Palette =>
  new Proxy({} as Palette, {
    get: (_, role) => (role === '--person' ? person : file),
  });
const PALETTE = paletteOf(rgba(1, 0, 0), rgba(0, 0, 1));

function mark(id: string, x: number, extra: Partial<Mark> = {}): Mark {
  return {
    id,
    shape: 'dot',
    paint: '--file',
    x,
    y: 0,
    r: 4,
    w: 0,
    h: 0,
    a0: 0,
    a1: 0,
    alpha: 1,
    ...extra,
  };
}

const scene = (
  marks: Mark[],
  links: Link[] = [],
  guides: Guide[] = [],
): Scene => ({
  ...emptyScene({ width: 1000, height: 1000 }),
  marks,
  links,
  guides,
});

function setup() {
  const fc = fakeClock();
  let frames = 0;
  const engine = new TweenEngine(new MarkStore(), fc.clock, () => frames++);
  const go = (next: Scene, opts = {}) =>
    engine.play(planTransition(next, engine.live(), opts), PALETTE);
  return { fc, engine, store: engine.store, go, frames: () => frames };
}

describe('TweenEngine', () => {
  it('grows marks in and settles exactly on target, then sleeps', () => {
    const { fc, engine, store, go } = setup();
    go(scene([mark('person:a', 100)]));
    expect(store.alpha[0]).toBe(0);
    fc.advance(TIMING.move / 2);
    expect(store.alpha[0]).toBeGreaterThan(0.5); // ease-out: front-loaded
    expect(store.alpha[0]).toBeLessThan(1);
    fc.advance(TIMING.move);
    expect(store.geom(0)).toMatchObject({ x: 100, r: 4, alpha: 1 });
    expect(engine.running).toBe(false);
    expect(fc.scheduled).toBe(false);
  });

  it('takes colour from the palette', () => {
    const { fc, store, go } = setup();
    go(scene([mark('person:a', 0, { paint: '--person' })]));
    fc.advance(TIMING.move);
    expect(store.color(0)).toEqual(rgba(0, 0, 1));
  });

  it('removes exited marks once the transition ends', () => {
    const { fc, store, go } = setup();
    go(scene([mark('person:a', 0), mark('person:b', 10)]));
    fc.advance(TIMING.move);
    go(scene([mark('person:a', 0)]));
    fc.advance(TIMING.exit);
    // Shrunk, but kept until the whole transition (the kept mark's move) ends.
    expect(store.count).toBe(2);
    fc.advance(TIMING.move - TIMING.exit);
    expect(store.count).toBe(1);
    expect(store.has('person:b')).toBe(false);
  });

  it('continues smoothly when interrupted: no jump at the hand-off', () => {
    const { fc, store, go } = setup();
    go(scene([mark('person:a', 0)]));
    fc.advance(TIMING.move);
    go(scene([mark('person:a', 1000)]));
    fc.advance(200);
    const midway = store.x[0];
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(1000);

    // Re-target back to 0 mid-flight: the first frame starts where it was.
    go(scene([mark('person:a', 0)]));
    expect(store.x[0]).toBeCloseTo(midway, 3);
    fc.advance(TIMING.move);
    expect(store.x[0]).toBe(0);
  });

  it('keeps a single frame loop when re-targeted or repainted mid-flight', () => {
    const { fc, engine, go, frames } = setup();
    go(scene([mark('person:a', 0)]));
    fc.advance(100);
    go(scene([mark('person:a', 500)]));
    engine.repaint(PALETTE);
    expect(fc.outstanding).toBe(1);
    const before = frames();
    fc.advance(16);
    expect(frames() - before).toBe(1);
    expect(fc.outstanding).toBe(1);
  });

  it('brings back a mark that was mid-exit instead of duplicating it', () => {
    const { fc, store, go } = setup();
    go(scene([mark('person:a', 0), mark('person:b', 50)]));
    fc.advance(TIMING.move);
    go(scene([mark('person:a', 0)]));
    fc.advance(100);
    go(scene([mark('person:a', 0), mark('person:b', 50)]));
    fc.advance(TIMING.move);
    expect(store.count).toBe(2);
    expect(store.geom(store.indexOf('person:b'))).toMatchObject({
      x: 50,
      alpha: 1,
    });
  });

  it('hands a slot over: the new mark starts where and how the old one is drawn, which goes at once', () => {
    const { fc, engine, store, go } = setup();
    const link = (id: string, target: string): Link => ({
      id,
      source: 'person:root',
      target,
      curve: 'straight',
      width: 1,
      paint: '--link',
      alpha: 1,
      slot: 'fan:0',
    });
    go(
      scene(
        [mark('person:root', 0), mark('file:a', 100, { slot: 'fan:0' })],
        [link('fan:a', 'file:a')],
      ),
    );
    fc.advance(TIMING.move + TIMING.draw);
    go(
      scene(
        [
          mark('person:root', 0),
          mark('person:b', 300, { slot: 'fan:0', paint: '--person' }),
        ],
        [link('fan:b', 'person:b')],
      ),
    );
    // One mark in the slot from the first frame: no shrink, no second dot.
    expect(store.has('file:a')).toBe(false);
    expect(store.count).toBe(2);
    const b = store.indexOf('person:b');
    expect(store.geom(b)).toMatchObject({ x: 100, r: 4, alpha: 1 });
    expect(store.color(b)).toEqual(rgba(1, 0, 0));
    // The link carries on drawn, with nothing left of the old one.
    expect(engine.links.has('fan:a')).toBe(false);
    expect(engine.links.get('fan:b')?.progress).toBe(1);
    fc.advance(TIMING.move);
    expect(store.geom(store.indexOf('person:b'))).toMatchObject({ x: 300 });
    expect(store.color(store.indexOf('person:b'))).toEqual(rgba(0, 0, 1));
  });

  it('draws links in as the marks settle and retracts them on the way out', () => {
    const { fc, engine, go } = setup();
    const ab: Link = {
      id: 'ab',
      source: 'person:a',
      target: 'person:b',
      curve: 'straight',
      width: 1,
      paint: '--link',
      alpha: 1,
    };
    go(scene([mark('person:a', 0), mark('person:b', 9)], [ab]));
    fc.advance(TIMING.drawAfter);
    expect(engine.links.get('ab')?.progress).toBe(0);
    fc.advance(TIMING.draw);
    expect(engine.links.get('ab')?.progress).toBe(1);

    go(scene([mark('person:a', 0), mark('person:b', 9)]));
    fc.advance(TIMING.retract);
    expect(engine.links.get('ab')?.progress).toBe(0);
    fc.advance(TIMING.move);
    expect(engine.links.has('ab')).toBe(false);
  });

  it('moves a guide that stays with the marks, not ahead of them', () => {
    const { fc, engine, go } = setup();
    const grid: Guide = {
      id: 'grid',
      kind: 'line',
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 100,
      paint: '--muted',
      alpha: 0.2,
    };
    go(scene([], [], [grid]));
    fc.advance(TIMING.move);
    go(scene([], [], [{ ...grid, x1: 400, x2: 400 }]));
    const line = () => engine.guides.get('grid') as Guide & { x1: number };
    expect(line().x1).toBe(0);
    fc.advance(TIMING.move / 2);
    expect(line().x1).toBeGreaterThan(200); // ease-out, like the marks
    expect(line().x1).toBeLessThan(400);
    fc.advance(TIMING.move);
    expect(line().x1).toBe(400);
  });

  it('re-tints on a theme switch without moving anything', () => {
    const { fc, store, engine, go } = setup();
    go(scene([mark('person:a', 42)]));
    fc.advance(TIMING.move);
    engine.repaint(paletteOf(rgba(0, 1, 0), rgba(0, 0, 1)));
    fc.advance(REPAINT_MS / 2);
    expect(store.green[0]).toBeGreaterThan(0);
    expect(store.green[0]).toBeLessThan(1);
    fc.advance(REPAINT_MS);
    expect(store.color(0)).toEqual(rgba(0, 1, 0));
    expect(store.x[0]).toBe(42);
    expect(engine.running).toBe(false);
  });

  it('repaints mid-morph from the colour on screen, without a jump', () => {
    const { fc, store, engine, go } = setup();
    go(scene([mark('person:a', 0)]));
    fc.advance(TIMING.move);
    // Morph to a new paint, and switch theme halfway through.
    go(scene([mark('person:a', 100, { paint: '--person' })]));
    fc.advance(TIMING.move / 2);
    const before = store.color(0);
    engine.repaint(paletteOf(rgba(0, 1, 0), rgba(1, 1, 0)));
    const after = store.color(0);
    expect(after.r).toBeCloseTo(before.r, 5);
    expect(after.g).toBeCloseTo(before.g, 5);
    expect(after.b).toBeCloseTo(before.b, 5);
    fc.advance(TIMING.move);
    expect(store.color(0)).toEqual(rgba(1, 1, 0));
    expect(store.x[0]).toBe(100);
  });

  it('settles leaving marks on the new palette when a plan cuts a repaint short', () => {
    const { fc, store, engine, go } = setup();
    go(scene([mark('person:a', 0), mark('person:b', 50)]));
    fc.advance(TIMING.move);
    const green = paletteOf(rgba(0, 1, 0), rgba(0, 0, 1));
    engine.repaint(green);
    fc.advance(REPAINT_MS / 3);
    // person:b leaves; the new plan replaces the repaint runs.
    engine.play(
      planTransition(scene([mark('person:a', 0)]), engine.live()),
      green,
    );
    fc.advance(TIMING.exit * 0.9);
    const b = store.indexOf('person:b');
    expect(b).not.toBe(-1);
    expect(store.green[b]).toBeGreaterThan(0.9);
  });

  it('renders once per frame and stops asking for frames when idle', () => {
    const { fc, go, frames } = setup();
    go(scene([mark('person:a', 0)]), { reducedMotion: true });
    fc.advance(TIMING.fade);
    const settled = frames();
    fc.advance(1000);
    expect(frames()).toBe(settled);
  });

  it('plans from an empty screen', () => {
    const { engine } = setup();
    expect(engine.live().marks.size).toBe(EMPTY_LIVE.marks.size);
  });
});
