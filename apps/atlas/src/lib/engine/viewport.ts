// Pan/zoom as plain math on a transform: screen = world × scale + offset.
// The input handlers (wheel, pinch, drag, keys) live with the stage and only
// call these, so the behaviour is testable without a pointer.

import type { Bounds } from '@gitrelic/scene';

export interface ViewTransform {
  scale: number;
  tx: number;
  ty: number;
}

export interface ScreenSize {
  width: number;
  height: number;
}

export const MIN_SCALE = 0.1;
export const MAX_SCALE = 8;
/** One `+`/`-` press, and the base of wheel zoom. */
export const ZOOM_STEP = 1.25;
/** Room left around the scene when fitting it, px. */
export const FIT_PADDING = 24;

export const IDENTITY: ViewTransform = { scale: 1, tx: 0, ty: 0 };

export function worldToScreen(
  v: ViewTransform,
  x: number,
  y: number,
): [number, number] {
  return [x * v.scale + v.tx, y * v.scale + v.ty];
}

export function screenToWorld(
  v: ViewTransform,
  sx: number,
  sy: number,
): [number, number] {
  return [(sx - v.tx) / v.scale, (sy - v.ty) / v.scale];
}

/** Zooms by `factor`, keeping the world point under (sx, sy) fixed. */
export function zoomAt(
  v: ViewTransform,
  sx: number,
  sy: number,
  factor: number,
): ViewTransform {
  const scale = clampScale(v.scale * factor);
  const [wx, wy] = screenToWorld(v, sx, sy);
  return { scale, tx: sx - wx * scale, ty: sy - wy * scale };
}

export function pan(v: ViewTransform, dx: number, dy: number): ViewTransform {
  return { scale: v.scale, tx: v.tx + dx, ty: v.ty + dy };
}

/**
 * Frames `bounds` in the middle of the screen, as large as fits with
 * `padding` to spare — but never past 1:1, so a tiny scene isn't blown up.
 */
export function fit(
  bounds: Bounds,
  screen: ScreenSize,
  padding = FIT_PADDING,
): ViewTransform {
  const availW = Math.max(1, screen.width - padding * 2);
  const availH = Math.max(1, screen.height - padding * 2);
  const scale =
    bounds.w > 0 && bounds.h > 0
      ? clampScale(Math.min(1, availW / bounds.w, availH / bounds.h))
      : 1;
  return {
    scale,
    tx: screen.width / 2 - (bounds.x + bounds.w / 2) * scale,
    ty: screen.height / 2 - (bounds.y + bounds.h / 2) * scale,
  };
}

/** Wheel delta (px, as normalised by the browser) → zoom factor. */
export function wheelFactor(deltaY: number): number {
  return ZOOM_STEP ** (-deltaY / 100);
}

export type KeyAction = 'zoom-in' | 'zoom-out' | 'fit';

/** The stage's keyboard shortcuts; null for keys it leaves alone. */
export function keyAction(key: string): KeyAction | null {
  if (key === '+' || key === '=') return 'zoom-in';
  if (key === '-' || key === '_') return 'zoom-out';
  if (key === '0') return 'fit';
  return null;
}

/** Device pixel ratio for the canvas: sharp on HiDPI, capped for fill rate. */
export function canvasResolution(devicePixelRatio: number): number {
  return Math.min(2, Math.max(1, devicePixelRatio || 1));
}

function clampScale(s: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}
