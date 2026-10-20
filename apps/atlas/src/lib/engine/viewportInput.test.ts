import { afterEach, describe, expect, it, vi } from 'vitest';

import { IDENTITY, ZOOM_STEP, type ViewTransform } from './viewport';
import { attachViewportInput } from './viewportInput';

function setup() {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({ left: 10, top: 20, width: 400, height: 200 }) as DOMRect;
  document.body.append(el);
  let view: ViewTransform = IDENTITY;
  const opts = {
    get: () => view,
    set: vi.fn((v: ViewTransform) => {
      view = v;
    }),
    fit: vi.fn(),
    hover: vi.fn(),
    click: vi.fn(),
    leave: vi.fn(),
  };
  const detach = attachViewportInput(el, opts);
  const pointer = (type: string, id: number, x: number, y: number) =>
    el.dispatchEvent(
      new PointerEvent(type, {
        pointerId: id,
        clientX: x,
        clientY: y,
        bubbles: true,
      }),
    );
  return { el, opts, detach, view: () => view, pointer };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('attachViewportInput', () => {
  it('zooms about the cursor on wheel, and stops the page scrolling', () => {
    const { el, view } = setup();
    const e = new WheelEvent('wheel', { deltaY: -100, cancelable: true });
    // happy-dom's WheelEvent drops the MouseEvent fields; browsers set them.
    Object.defineProperties(e, {
      clientX: { value: 110 },
      clientY: { value: 120 },
    });
    el.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(view().scale).toBeCloseTo(ZOOM_STEP, 9);
    // The point under the cursor (100, 100 locally) stays put.
    expect(100 * view().scale + view().tx).toBeCloseTo(100, 9);
  });

  it('pans with a drag and does not call it a click', () => {
    const { pointer, view, opts } = setup();
    pointer('pointerdown', 1, 50, 50);
    pointer('pointermove', 1, 80, 40);
    pointer('pointerup', 1, 80, 40);
    expect(view()).toEqual({ scale: 1, tx: 30, ty: -10 });
    expect(opts.click).not.toHaveBeenCalled();
  });

  it('never pans for a click that wiggles under the slop', () => {
    // A pan marks the camera as the viewer's, and the stage then stops
    // framing a fan when it opens: a click must not take the camera.
    const { pointer, opts } = setup();
    pointer('pointerdown', 1, 50, 50);
    pointer('pointermove', 1, 51, 51);
    pointer('pointermove', 1, 52, 50);
    pointer('pointerup', 1, 52, 50);
    expect(opts.set).not.toHaveBeenCalled();
    expect(opts.click).toHaveBeenCalledOnce();
  });

  it('pans the whole way from the press once a drag passes the slop', () => {
    const { pointer, view, opts } = setup();
    pointer('pointerdown', 1, 50, 50);
    pointer('pointermove', 1, 52, 50);
    pointer('pointermove', 1, 55, 50);
    pointer('pointermove', 1, 60, 50);
    pointer('pointerup', 1, 60, 50);
    expect(view()).toEqual({ scale: 1, tx: 10, ty: 0 });
    expect(opts.click).not.toHaveBeenCalled();
  });

  it('treats a press without movement as a click, in element coordinates', () => {
    const { pointer, opts } = setup();
    pointer('pointerdown', 1, 50, 50);
    pointer('pointerup', 1, 51, 50);
    expect(opts.click).toHaveBeenCalledWith(41, 30);
  });

  it("ignores a pen's barrel button", () => {
    const { el, opts } = setup();
    for (const type of ['pointerdown', 'pointerup'])
      el.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          pointerType: 'pen',
          button: 2,
          clientX: 50,
          clientY: 50,
        }),
      );
    expect(opts.click).not.toHaveBeenCalled();
  });

  it('ignores mouse buttons other than the primary one', () => {
    const { el, opts, view } = setup();
    const press = (type: string, x: number, button: number) =>
      el.dispatchEvent(
        new PointerEvent(type, {
          pointerId: 1,
          pointerType: 'mouse',
          button,
          clientX: x,
          clientY: 50,
        }),
      );
    press('pointerdown', 50, 2);
    press('pointermove', 90, 2);
    press('pointerup', 90, 2);
    expect(opts.click).not.toHaveBeenCalled();
    expect(view().tx).toBe(0);
    press('pointerdown', 50, 0);
    press('pointerup', 50, 0);
    expect(opts.click).toHaveBeenCalledOnce();
  });

  it('never treats a cancelled gesture as a click', () => {
    const { pointer, opts } = setup();
    pointer('pointerdown', 1, 50, 50);
    pointer('pointercancel', 1, 50, 50);
    pointer('pointerup', 1, 50, 50);
    expect(opts.click).not.toHaveBeenCalled();
  });

  it('pinches to zoom with two pointers', () => {
    const { pointer, view, opts } = setup();
    pointer('pointerdown', 1, 100, 100);
    pointer('pointerdown', 2, 200, 100);
    pointer('pointermove', 2, 300, 100);
    expect(view().scale).toBeCloseTo(2, 9);
    pointer('pointerup', 2, 300, 100);
    pointer('pointerup', 1, 100, 100);
    expect(opts.click).not.toHaveBeenCalled();
  });

  it('reports hover only while no button is down', () => {
    const { pointer, opts } = setup();
    pointer('pointermove', 1, 30, 40);
    expect(opts.hover).toHaveBeenCalledWith(20, 20);
    pointer('pointerdown', 1, 30, 40);
    pointer('pointermove', 1, 35, 40);
    expect(opts.hover).toHaveBeenCalledTimes(1);
  });

  it('fits on double-click and on 0; zooms about the centre on + and -', () => {
    const { el, opts, view } = setup();
    el.dispatchEvent(new MouseEvent('dblclick'));
    el.dispatchEvent(new KeyboardEvent('keydown', { key: '0' }));
    expect(opts.fit).toHaveBeenCalledTimes(2);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: '+' }));
    expect(view().scale).toBeCloseTo(ZOOM_STEP, 9);
    expect(200 * view().scale + view().tx).toBeCloseTo(200, 9);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: '-' }));
    expect(view().scale).toBeCloseTo(1, 9);
  });

  it('leaves browser shortcuts alone', () => {
    const { el, opts } = setup();
    el.dispatchEvent(new KeyboardEvent('keydown', { key: '0', metaKey: true }));
    expect(opts.fit).not.toHaveBeenCalled();
  });

  it('stops listening once detached', () => {
    const { el, opts, detach } = setup();
    detach();
    el.dispatchEvent(new MouseEvent('dblclick'));
    expect(opts.fit).not.toHaveBeenCalled();
  });
});
