// Where each mark sprite sits in the one atlas canvas pixiStage draws them
// into. Pure, so the layout is testable without WebGL.

/** Dot and ring sprite size, px. */
export const SPRITE = 64;
export const HALO = 128;
/**
 * Transparent pixels between sprites. Linear filtering reads a texel past a
 * frame's edge, so frames that touch bleed into each other: the bar square
 * once drew a sliver at the repo ring's top-right.
 */
export const SPRITE_GUTTER = 2;

export interface SpriteFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Left to right: dot, ring, bar square, halo, a gutter between each. */
export const SPRITE_FRAMES = (() => {
  const g = SPRITE_GUTTER;
  const dot = { x: 0, y: 0, w: SPRITE, h: SPRITE };
  const ring = { x: dot.x + SPRITE + g, y: 0, w: SPRITE, h: SPRITE };
  const square = { x: ring.x + SPRITE + g, y: 0, w: 8, h: 8 };
  const halo = { x: square.x + square.w + g, y: 0, w: HALO, h: HALO };
  return {
    dot,
    ring,
    square,
    halo,
    width: halo.x + HALO,
    height: HALO,
  };
})();
