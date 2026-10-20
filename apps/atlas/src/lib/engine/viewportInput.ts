// Wires pointer, wheel and keyboard input on the stage element to the pure
// viewport math. Wheel or trackpad pinch zooms about the cursor, one finger
// or the mouse drags, two fingers pinch, double-click and `0` fit, `+`/`-`
// zoom about the centre. A press that barely moves is a click.

import {
  keyAction,
  pan,
  wheelFactor,
  zoomAt,
  ZOOM_STEP,
  type ViewTransform,
} from './viewport';

export interface ViewportInputOptions {
  get(): ViewTransform;
  set(view: ViewTransform): void;
  fit(): void;
  /** Pointer moved with no button down (hover), in element coordinates. */
  hover?(sx: number, sy: number): void;
  /** Pointer left the element. */
  leave?(): void;
  /** A press and release without dragging, in element coordinates. */
  click?(sx: number, sy: number): void;
}

/** Movement under this many px between press and release is still a click. */
export const CLICK_SLOP = 4;

/** Attaches the listeners; returns a function that removes them. */
export function attachViewportInput(
  el: HTMLElement,
  opts: ViewportInputOptions,
): () => void {
  const pointers = new Map<number, { x: number; y: number }>();
  let travelled = 0;

  const local = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = el.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    // deltaMode 1 is lines (Firefox with a mouse wheel); treat a line as 16px.
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const [sx, sy] = local(e);
    opts.set(zoomAt(opts.get(), sx, sy, wheelFactor(dy)));
  };

  const onDown = (e: PointerEvent) => {
    // Primary button only (touch and a pen tip report 0): a right-click opens
    // the context menu, and neither it, a middle-click nor a pen's barrel
    // button should select or pan.
    if (e.button !== 0) return;
    el.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) travelled = 0;
  };

  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (pointers.size === 0) opts.hover?.(...local(e));
      return;
    }
    if (pointers.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      // Until the press passes the click slop, nothing pans: a click that
      // wiggles a pixel would otherwise take the camera from the stage, and
      // the next fan opening would no longer be framed. The pointer's press
      // position is kept until then, so the first pan covers the whole way.
      if (travelled < CLICK_SLOP) {
        if (Math.abs(dx) + Math.abs(dy) < CLICK_SLOP) return;
        travelled = Infinity; // a drag now, never a click
      }
      opts.set(pan(opts.get(), dx, dy));
    } else if (pointers.size === 2) {
      const other = [...pointers.entries()].find(
        ([id]) => id !== e.pointerId,
      )?.[1];
      if (other) {
        const before = Math.hypot(prev.x - other.x, prev.y - other.y);
        const after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        const [mx, my] = local({
          clientX: (e.clientX + other.x) / 2,
          clientY: (e.clientY + other.y) / 2,
        });
        travelled = Infinity; // a pinch is never a click
        if (before > 0) opts.set(zoomAt(opts.get(), mx, my, after / before));
      }
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onUp = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return;
    if (pointers.size === 0 && travelled < CLICK_SLOP)
      opts.click?.(...local(e));
  };

  // The browser took the gesture (or the pointer vanished): forget it, and
  // never treat it as a click on something the user didn't tap.
  const onCancel = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
  };

  const onLeave = () => {
    if (pointers.size === 0) opts.leave?.();
  };

  const onDblClick = () => opts.fit();

  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const action = keyAction(e.key);
    if (!action) return;
    e.preventDefault();
    if (action === 'fit') {
      opts.fit();
      return;
    }
    const rect = el.getBoundingClientRect();
    const factor = action === 'zoom-in' ? ZOOM_STEP : 1 / ZOOM_STEP;
    opts.set(zoomAt(opts.get(), rect.width / 2, rect.height / 2, factor));
  };

  el.addEventListener('wheel', onWheel, { passive: false });
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('pointerleave', onLeave);
  el.addEventListener('dblclick', onDblClick);
  el.addEventListener('keydown', onKey);
  return () => {
    el.removeEventListener('wheel', onWheel);
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onCancel);
    el.removeEventListener('pointerleave', onLeave);
    el.removeEventListener('dblclick', onDblClick);
    el.removeEventListener('keydown', onKey);
  };
}
