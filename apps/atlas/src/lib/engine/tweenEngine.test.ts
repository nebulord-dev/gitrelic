import {
  EMPTY_LIVE,
  emptyScene,
  planTransition,
  TIMING,
  type Link,
  type Mark,
  type Palette,
  type Rgba,
  type Scene,
} from '@gitrelic/scene';
import { describe, expect, it } from 'vitest';

import { MarkStore } from './markStore';
import { REPAINT_MS, TweenEngine, type FrameClock } from './tweenEngine';

/** A clock the test advances by hand; frames run only when asked. */
function fakeClock() {
  let time = 0;
  let pending: ((t: number) => void) | null = null;
  const clock: FrameClock = {
    now: () => time,
    request: (cb) => {
      pending = cb;
      return 1;
    },
    cancel: () => {
      pending = null;
    },
  };
  return {
    clock,
    /** Moves time forward and runs the frame that was requested, if any. */
    advance(ms: number) {
      time += ms;
      const cb = pending;
      pending = null;
      cb?.(time);
    },
    get scheduled() {
      return pending !== null;
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

const scene = (marks: Mark[], links: Link[] = []): Scene => ({
  ...emptyScene({ width: 1000, height: 1000 }),
  marks,
  links,
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

  it('draws links in after the marks and retracts them on the way out', () => {
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
    fc.advance(TIMING.move);
    expect(engine.links.get('ab')?.progress).toBe(0);
    fc.advance(TIMING.draw);
    expect(engine.links.get('ab')?.progress).toBe(1);

    go(scene([mark('person:a', 0), mark('person:b', 9)]));
    fc.advance(TIMING.retract);
    expect(engine.links.get('ab')?.progress).toBe(0);
    fc.advance(TIMING.move);
    expect(engine.links.has('ab')).toBe(false);
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
