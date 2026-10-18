import { describe, expect, it } from 'vitest';

import { COLOR_ROLES } from '../model';
import { easeOutCubic, trackProgress } from './ease';
import {
  lerpArc,
  lerpGeom,
  lerpGuide,
  mixColor,
  mixPalette,
  parseColor,
  resolvePaint,
  type Palette,
  type Rgba,
} from './interp';
import type { MarkGeom } from '../model';

const geom = (g: Partial<MarkGeom>): MarkGeom => ({
  x: 0,
  y: 0,
  r: 0,
  w: 0,
  h: 0,
  a0: 0,
  a1: 0,
  alpha: 1,
  ...g,
});

describe('easing', () => {
  it('runs 0 → 1, clamped, front-loaded', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it('holds at 0 through the delay and jumps for zero duration', () => {
    expect(trackProgress(50, 100, 200)).toBe(0);
    expect(trackProgress(300, 100, 200)).toBe(1);
    expect(trackProgress(100, 100, 0)).toBe(1);
  });
});

describe('lerpArc', () => {
  it('interpolates plainly when no wrap is involved', () => {
    expect(lerpArc(0, 1, 2, 3, 0.5)).toEqual([1, 2]);
  });

  it('takes the short way across 12 o’clock', () => {
    const TAU = Math.PI * 2;
    // From just before 12 to just after it: should pass through 12, not 6.
    const [a0, a1] = lerpArc(TAU - 0.2, TAU - 0.1, 0.1, 0.2, 0.5);
    expect((a0 + a1) / 2).toBeCloseTo(TAU, 6);
    expect(a1 - a0).toBeCloseTo(0.1, 6);
  });
});

describe('lerpGeom', () => {
  it('writes every field into out and returns it', () => {
    const out = geom({});
    const res = lerpGeom(
      geom({ x: 0, y: 10, r: 2, w: 4, h: 6, alpha: 0 }),
      geom({ x: 10, y: 20, r: 4, w: 8, h: 12, alpha: 1 }),
      0.5,
      out,
    );
    expect(res).toBe(out);
    expect(out).toEqual(geom({ x: 5, y: 15, r: 3, w: 6, h: 9, alpha: 0.5 }));
  });
});

describe('parseColor', () => {
  it('reads hex, short hex, rgb and rgba', () => {
    expect(parseColor('#ff0000')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(parseColor('#0f0')).toEqual({ r: 0, g: 1, b: 0, a: 1 });
    expect(parseColor(' rgb(0, 0, 255) ')).toEqual({ r: 0, g: 0, b: 1, a: 1 });
    expect(parseColor('rgba(255, 255, 255, 0.035)')).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 0.035,
    });
  });

  it('rejects anything else', () => {
    for (const s of [
      '',
      'red',
      '#ff00',
      'var(--x)',
      'hsl(0 0% 0%)',
      'rgb(1,2)',
    ]) {
      expect(parseColor(s)).toBeNull();
    }
  });
});

describe('mixColor', () => {
  const black: Rgba = { r: 0, g: 0, b: 0, a: 1 };
  const white: Rgba = { r: 1, g: 1, b: 1, a: 0 };

  it('returns the ends at 0 and 1', () => {
    expect(mixColor(black, white, 0)).toEqual(black);
    const end = mixColor(black, white, 1);
    expect(end.r).toBeCloseTo(1, 6);
    expect(end.a).toBe(0);
  });

  it('mixes in linear light: the midpoint is brighter than the sRGB average', () => {
    expect(mixColor(black, white, 0.5).r).toBeGreaterThan(0.7);
    expect(mixColor(black, white, 0.5).a).toBe(0.5);
  });
});

describe('mixPalette', () => {
  const solid = (c: Rgba) => new Proxy({} as Palette, { get: () => c });
  const dark = solid({ r: 0, g: 0, b: 0, a: 1 });
  const light = solid({ r: 1, g: 1, b: 1, a: 1 });

  it('returns the end palettes themselves outside 0..1', () => {
    expect(mixPalette(dark, light, 0)).toBe(dark);
    expect(mixPalette(dark, light, 1.2)).toBe(light);
  });

  it('mixes every colour role the way mixColor does', () => {
    const mid = mixPalette(dark, light, 0.5);
    expect(Object.keys(mid)).toEqual([...COLOR_ROLES]);
    expect(mid['--accent']).toEqual(
      mixColor(dark['--accent'], light['--accent'], 0.5),
    );
  });
});

describe('resolvePaint', () => {
  const red: Rgba = { r: 1, g: 0, b: 0, a: 1 };
  const blue: Rgba = { r: 0, g: 0, b: 1, a: 1 };
  const palette = new Proxy({} as Palette, {
    get: (_, role) => (role === '--accent' ? red : blue),
  });

  it('looks up a role', () => {
    expect(resolvePaint('--accent', palette)).toBe(red);
  });

  it('blends two roles', () => {
    const mid = resolvePaint(
      { mix: ['--accent', '--person'], t: 0.5 },
      palette,
    );
    expect(mid.r).toBeCloseTo(mid.b, 6);
    expect(mid.r).toBeGreaterThan(0.5);
  });
});

describe('lerpGuide', () => {
  it('moves a line by its ends and leaves alpha alone', () => {
    const from = {
      id: 'g',
      kind: 'line',
      x1: 0,
      y1: 0,
      x2: 10,
      y2: 10,
      paint: '--muted',
      alpha: 0.2,
    } as const;
    const to = { ...from, x1: 100, y2: 30, alpha: 0.8 };
    const out = { ...to, alpha: 0.5 };
    lerpGuide(from, to, 0.5, out);
    expect(out).toMatchObject({ x1: 50, y1: 0, x2: 10, y2: 20, alpha: 0.5 });
  });

  it('moves a circle by its centre and radius', () => {
    const from = {
      id: 'g',
      kind: 'circle',
      x: 0,
      y: 0,
      r: 10,
      paint: '--muted',
      alpha: 1,
    } as const;
    const to = { ...from, x: 20, r: 30 };
    const out = { ...to };
    lerpGuide(from, to, 0.25, out);
    expect(out).toMatchObject({ x: 5, y: 0, r: 15 });
  });

  it('leaves a guide that changed kind where it is going', () => {
    const from = {
      id: 'g',
      kind: 'circle',
      x: 0,
      y: 0,
      r: 10,
      paint: '--muted',
      alpha: 1,
    } as const;
    const to = {
      id: 'g',
      kind: 'line',
      x1: 1,
      y1: 2,
      x2: 3,
      y2: 4,
      paint: '--muted',
      alpha: 1,
    } as const;
    const out = { ...to };
    lerpGuide(from, to, 0.5, out);
    expect(out).toEqual(to);
  });
});
