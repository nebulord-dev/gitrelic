import {
  emptyScene,
  TIMING,
  type Mark,
  type Palette,
  type Rgba,
  type Scene,
} from '@gitrelic/scene';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AtlasStage } from './atlasStage';
import { HitTester } from './hitTest';
import { REPAINT_MS, type FrameClock } from './tweenEngine';
import type { StageFrame, StageRenderer } from './stageRenderer';

const grey: Rgba = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
const palette = new Proxy({} as Palette, { get: () => grey });

function fakeClock() {
  let time = 0;
  const queue = new Map<number, (t: number) => void>();
  let next = 1;
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
    /** Advances time and runs every frame that was waiting. */
    frame(ms = 16) {
      time += ms;
      const due = [...queue.values()];
      queue.clear();
      for (const cb of due) cb(time);
    },
    get waiting() {
      return queue.size;
    },
  };
}

function fakeRenderer(webgl = true) {
  const frames: StageFrame[] = [];
  const renderer: StageRenderer = {
    init: vi.fn(async () => webgl),
    resize: vi.fn(),
    render: vi.fn((f: StageFrame) => {
      frames.push({ ...f });
    }),
    destroy: vi.fn(),
  };
  return { renderer, frames };
}

function dot(
  id: string,
  x: number,
  y: number,
  extra: Partial<Mark> = {},
): Mark {
  return {
    id,
    shape: 'dot',
    paint: '--person',
    x,
    y,
    r: 10,
    w: 0,
    h: 0,
    a0: 0,
    a1: 0,
    alpha: 1,
    ...extra,
  };
}

const scene = (...marks: Mark[]): Scene => ({
  ...emptyScene({ width: 400, height: 200 }),
  marks,
});

async function setup(webgl = true) {
  const host = document.createElement('div');
  host.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 400, height: 200 }) as DOMRect;
  const labelHost = document.createElement('div');
  document.body.append(host, labelHost);
  const fc = fakeClock();
  const { renderer, frames } = fakeRenderer(webgl);
  const onSelect = vi.fn();
  const onHover = vi.fn();
  const stage = await AtlasStage.create(
    host,
    labelHost,
    { width: 400, height: 200 },
    {
      renderer,
      readPalette: () => palette,
      glow: false,
      reducedMotion: () => false,
      clock: fc.clock,
      onSelect,
      onHover,
    },
  );
  return { host, labelHost, fc, renderer, frames, stage, onSelect, onHover };
}

const settle = (fc: ReturnType<typeof fakeClock>) => {
  for (let i = 0; i < 100 && fc.waiting; i++) fc.frame(50);
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('AtlasStage', () => {
  it('returns null without WebGL', async () => {
    const { stage } = await setup(false);
    expect(stage).toBeNull();
  });

  it('animates a scene in, rebuilding geometry while it moves, then sleeps', async () => {
    const { stage, fc, frames } = await setup();
    stage!.show(scene(dot('person:a', 100, 100)));
    settle(fc);
    expect(stage!.store.geom(0)).toMatchObject({ x: 100, alpha: 1 });
    expect(frames.length).toBeGreaterThan(5);
    expect(frames.every((f) => f.dirty)).toBe(true);
    const drawn = frames.length;
    fc.frame(1000);
    expect(frames.length).toBe(drawn);
  });

  it('frames the first scene', async () => {
    const { stage } = await setup();
    stage!.show({ ...scene(), bounds: { x: 0, y: 0, w: 800, h: 400 } });
    expect(stage!.transform.scale).toBeCloseTo((200 - 48) / 400, 9);
  });

  it('redraws on pan without rebuilding geometry', async () => {
    const { stage, fc, frames, host } = await setup();
    stage!.show(scene(dot('person:a', 100, 100)));
    settle(fc);
    const before = frames.length;
    host.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    host.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 30,
        clientY: 0,
      }),
    );
    fc.frame();
    expect(frames.length).toBe(before + 1);
    expect(frames.at(-1)?.dirty).toBe(false);
    expect(frames.at(-1)?.view.tx).toBeGreaterThan(0);
  });

  it('selects the mark under a click and reports hover', async () => {
    const { stage, fc, host, onSelect, onHover } = await setup();
    stage!.show(scene(dot('person:a', 200, 100)));
    settle(fc);
    const [sx, sy] = [
      200 * stage!.transform.scale + stage!.transform.tx,
      100 * stage!.transform.scale + stage!.transform.ty,
    ];
    host.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: sx,
        clientY: sy,
      }),
    );
    expect(onHover).toHaveBeenCalledWith('person:a');
    expect(host.style.cursor).toBe('pointer');
    host.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        clientX: sx,
        clientY: sy,
      }),
    );
    host.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 1, clientX: sx, clientY: sy }),
    );
    expect(onSelect).toHaveBeenCalledWith('person:a');
    host.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 5, clientY: 5 }),
    );
    host.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 1, clientX: 5, clientY: 5 }),
    );
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('pins the hovered mark’s label', async () => {
    const { stage, fc, host, labelHost } = await setup();
    stage!.show(
      scene(
        dot('person:a', 200, 100, { label: 'Ann' }),
        dot('person:b', 200, 112, { label: 'Bo', labelPriority: 9 }),
      ),
    );
    settle(fc);
    const shown = () =>
      [...labelHost.querySelectorAll('span')]
        .filter((s) => !s.hidden)
        .map((s) => s.textContent);
    expect(shown()).toEqual(['Bo']);
    const t = stage!.transform;
    host.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 200 * t.scale + t.tx,
        clientY: 90 * t.scale + t.ty,
      }),
    );
    fc.frame();
    expect(shown()[0]).toBe('Ann');
  });

  it('re-tints on a theme change', async () => {
    const { stage, fc, frames } = await setup();
    stage!.show(scene(dot('person:a', 100, 100)));
    settle(fc);
    const red: Rgba = { r: 1, g: 0, b: 0, a: 1 };
    stage!.setTheme(new Proxy({} as Palette, { get: () => red }), true);
    settle(fc);
    expect(stage!.store.color(0)).toEqual(red);
    expect(frames.at(-1)?.glow).toBe(true);
  });

  it('fades links and guides to the new theme alongside the marks', async () => {
    const { stage, fc, frames } = await setup();
    stage!.show(scene(dot('person:a', 100, 100)));
    settle(fc);
    const red: Rgba = { r: 1, g: 0, b: 0, a: 1 };
    stage!.setTheme(new Proxy({} as Palette, { get: () => red }), false);
    fc.frame(REPAINT_MS / 2);
    const mid = frames.at(-1)!;
    expect(mid.dirty).toBe(true);
    expect(mid.palette['--link'].r).toBeGreaterThan(grey.r);
    expect(mid.palette['--link'].r).toBeLessThan(1);
    settle(fc);
    expect(frames.at(-1)!.palette['--link']).toEqual(red);
    expect(frames.at(-1)!.dirty).toBe(true);
    expect(fc.waiting).toBe(0);
  });

  it('rebuilds guides on zoom (they are hairlines) but not on pan', async () => {
    const { stage, fc, frames, host } = await setup();
    stage!.show(scene(dot('person:a', 100, 100)));
    settle(fc);
    host.dispatchEvent(
      new PointerEvent('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 }),
    );
    host.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 30,
        clientY: 0,
      }),
    );
    host.dispatchEvent(
      new PointerEvent('pointerup', { pointerId: 1, clientX: 30, clientY: 0 }),
    );
    fc.frame();
    expect(frames.at(-1)).toMatchObject({ dirty: false, guidesDirty: false });
    host.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    fc.frame();
    expect(frames.at(-1)).toMatchObject({ dirty: false, guidesDirty: true });
  });

  it('refits on resize until the viewer pans or zooms', async () => {
    const { stage, fc, host } = await setup();
    stage!.show({ ...scene(), bounds: { x: 0, y: 0, w: 800, h: 400 } });
    settle(fc);
    stage!.resize({ width: 1000, height: 600 });
    expect(stage!.transform.scale).toBeCloseTo(
      Math.min(952 / 800, 552 / 400, 1),
      9,
    );
    host.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    const zoomed = stage!.transform;
    stage!.resize({ width: 400, height: 200 });
    expect(stage!.transform).toEqual(zoomed);
    stage!.fitView();
    stage!.resize({ width: 1000, height: 600 });
    expect(stage!.transform.scale).toBeCloseTo(1, 9);
  });

  it('rebuilds the hit grid at most once per frame while marks move', async () => {
    const { stage, fc, host } = await setup();
    stage!.show(scene(dot('person:a', 100, 100)));
    fc.frame();
    const build = vi.spyOn(HitTester.prototype, 'build');
    for (let i = 0; i < 5; i++) {
      host.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerId: 1,
          clientX: 10 + i,
          clientY: 10,
        }),
      );
    }
    expect(build).toHaveBeenCalledTimes(1);
    fc.frame();
    host.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerId: 1,
        clientX: 20,
        clientY: 10,
      }),
    );
    expect(build).toHaveBeenCalledTimes(2);
    build.mockRestore();
  });

  it('destroys the renderer if its own setup throws', async () => {
    const { renderer } = fakeRenderer();
    renderer.init = vi.fn(async () => {
      throw new Error('no 2D canvas');
    });
    await expect(
      AtlasStage.create(
        document.createElement('div'),
        document.createElement('div'),
        { width: 1, height: 1 },
        {
          renderer,
          readPalette: () => palette,
          glow: false,
          reducedMotion: () => false,
        },
      ),
    ).rejects.toThrow('no 2D canvas');
    expect(renderer.destroy).toHaveBeenCalled();
  });

  it('destroys the renderer if it cannot finish starting', async () => {
    const { renderer } = fakeRenderer();
    await expect(
      AtlasStage.create(
        document.createElement('div'),
        document.createElement('div'),
        { width: 1, height: 1 },
        {
          renderer,
          readPalette: () => {
            throw new Error('bad token');
          },
          glow: false,
          reducedMotion: () => false,
        },
      ),
    ).rejects.toThrow('bad token');
    expect(renderer.destroy).toHaveBeenCalled();
  });

  it('ignores calls after it has been destroyed', async () => {
    const { stage, fc, frames } = await setup();
    stage!.destroy();
    const drawn = frames.length;
    stage!.show(scene(dot('person:a', 1, 1)));
    stage!.setTheme(palette, true);
    stage!.resize({ width: 10, height: 10 });
    settle(fc);
    expect(frames.length).toBe(drawn);
  });

  it('tears everything down', async () => {
    const { stage, renderer, fc } = await setup();
    stage!.show(scene(dot('person:a', 100, 100)));
    stage!.destroy();
    expect(renderer.destroy).toHaveBeenCalled();
    expect(fc.waiting).toBe(0);
  });

  it('runs a reduced-motion transition as a short fade', async () => {
    const host = document.createElement('div');
    const fc = fakeClock();
    const { renderer } = fakeRenderer();
    const stage = await AtlasStage.create(
      host,
      document.createElement('div'),
      { width: 400, height: 200 },
      {
        renderer,
        readPalette: () => palette,
        glow: false,
        reducedMotion: () => true,
        clock: fc.clock,
      },
    );
    stage!.show(scene(dot('person:a', 100, 100)));
    fc.frame(TIMING.fade);
    expect(stage!.store.alpha[0]).toBe(1);
  });
});
