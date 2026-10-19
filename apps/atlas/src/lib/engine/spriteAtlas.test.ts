import { describe, expect, it } from 'vitest';

import { SPRITE_FRAMES, SPRITE_GUTTER, type SpriteFrame } from './spriteAtlas';

describe('SPRITE_FRAMES', () => {
  const { width, height, ...frames } = SPRITE_FRAMES;
  const list: [string, SpriteFrame][] = Object.entries(frames);

  it('keeps a gutter between every pair of sprites, so none bleeds', () => {
    for (const [a, f] of list)
      for (const [b, o] of list) {
        if (a === b) continue;
        const apart =
          f.x + f.w + SPRITE_GUTTER <= o.x ||
          o.x + o.w + SPRITE_GUTTER <= f.x ||
          f.y + f.h + SPRITE_GUTTER <= o.y ||
          o.y + o.h + SPRITE_GUTTER <= f.y;
        expect(apart, `${a} touches ${b}`).toBe(true);
      }
  });

  it('fits every sprite in the canvas', () => {
    for (const [, f] of list) {
      expect(f.x).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w).toBeLessThanOrEqual(width);
      expect(f.y + f.h).toBeLessThanOrEqual(height);
    }
  });
});
