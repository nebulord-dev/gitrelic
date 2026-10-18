import { describe, expect, it } from 'vitest';

import {
  canvasResolution,
  fit,
  IDENTITY,
  keyAction,
  MAX_SCALE,
  MIN_SCALE,
  pan,
  screenToWorld,
  wheelFactor,
  worldToScreen,
  zoomAt,
  ZOOM_STEP,
} from './viewport';

describe('viewport', () => {
  it('round-trips world and screen coordinates', () => {
    const v = { scale: 2, tx: 30, ty: -10 };
    expect(worldToScreen(v, 5, 5)).toEqual([40, 0]);
    expect(screenToWorld(v, 40, 0)).toEqual([5, 5]);
  });

  it('keeps the point under the cursor fixed while zooming', () => {
    const v = zoomAt({ scale: 1.5, tx: 12, ty: 7 }, 200, 150, ZOOM_STEP);
    const before = screenToWorld({ scale: 1.5, tx: 12, ty: 7 }, 200, 150);
    const after = screenToWorld(v, 200, 150);
    expect(after[0]).toBeCloseTo(before[0], 9);
    expect(after[1]).toBeCloseTo(before[1], 9);
    expect(v.scale).toBeCloseTo(1.5 * ZOOM_STEP, 9);
  });

  it('clamps zoom to its limits', () => {
    expect(zoomAt(IDENTITY, 0, 0, 1000).scale).toBe(MAX_SCALE);
    expect(zoomAt(IDENTITY, 0, 0, 0.0001).scale).toBe(MIN_SCALE);
  });

  it('pans by screen pixels', () => {
    expect(pan({ scale: 3, tx: 1, ty: 2 }, 10, -5)).toEqual({
      scale: 3,
      tx: 11,
      ty: -3,
    });
  });

  it('fits a large scene into the screen, centred, with padding', () => {
    const v = fit(
      { x: 0, y: 0, w: 2000, h: 1000 },
      { width: 1048, height: 800 },
      24,
    );
    expect(v.scale).toBeCloseTo(0.5, 9);
    // Centre of the scene lands at the centre of the screen.
    expect(worldToScreen(v, 1000, 500)).toEqual([524, 400]);
  });

  it('does not blow a small scene up past 1:1', () => {
    const v = fit(
      { x: 10, y: 10, w: 100, h: 100 },
      { width: 1000, height: 800 },
    );
    expect(v.scale).toBe(1);
    expect(worldToScreen(v, 60, 60)).toEqual([500, 400]);
  });

  it('keeps a fitted scene clear of controls along the top and bottom', () => {
    const screen = { width: 1000, height: 600 };
    const bounds = { x: 0, y: 0, w: 1000, h: 600 };
    const plain = fit(bounds, screen, 24);
    const inset = fit(bounds, screen, 24, { top: 44, bottom: 28 });
    // Shrinks to the band between the controls…
    expect(inset.scale).toBeLessThan(plain.scale);
    expect(inset.scale).toBeCloseTo((600 - 48 - 72) / 600, 9);
    // …and sits in it: the top edge is below the top inset plus padding.
    const [, top] = worldToScreen(inset, 0, 0);
    const [, bottom] = worldToScreen(inset, 0, 600);
    expect(top).toBeGreaterThanOrEqual(44 + 24 - 1e-9);
    expect(bottom).toBeLessThanOrEqual(600 - 28 - 24 + 1e-9);
  });

  it('survives an empty scene', () => {
    const v = fit({ x: 0, y: 0, w: 0, h: 0 }, { width: 100, height: 100 });
    expect(Object.values(v).every(Number.isFinite)).toBe(true);
  });

  it('turns wheel deltas into zoom: up zooms in, a notch is one step', () => {
    expect(wheelFactor(-100)).toBeCloseTo(ZOOM_STEP, 9);
    expect(wheelFactor(100)).toBeCloseTo(1 / ZOOM_STEP, 9);
    expect(wheelFactor(0)).toBe(1);
  });

  it('maps the zoom keys', () => {
    expect(keyAction('+')).toBe('zoom-in');
    expect(keyAction('=')).toBe('zoom-in');
    expect(keyAction('-')).toBe('zoom-out');
    expect(keyAction('0')).toBe('fit');
    expect(keyAction('k')).toBeNull();
  });

  it('caps the canvas resolution at 2', () => {
    expect(canvasResolution(3)).toBe(2);
    expect(canvasResolution(1.5)).toBe(1.5);
    expect(canvasResolution(0)).toBe(1);
  });
});
