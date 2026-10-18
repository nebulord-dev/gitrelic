import {
  COLOR_ROLES,
  type ColorRole,
  type MarkGeom,
  type Paint,
} from '../model';

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

const TAU = Math.PI * 2;

/**
 * Interpolates an arc's angles without spinning the long way round: `to` is
 * shifted by whole turns so its midpoint is within half a turn of `from`'s.
 * Both ends shift together, so the arc's length tweens linearly.
 */
export function lerpArc(
  fromA0: number,
  fromA1: number,
  toA0: number,
  toA1: number,
  t: number,
): [number, number] {
  const delta = (toA0 + toA1) / 2 - (fromA0 + fromA1) / 2;
  const shift = -Math.round(delta / TAU) * TAU;
  return [lerp(fromA0, toA0 + shift, t), lerp(fromA1, toA1 + shift, t)];
}

/** Writes the interpolated geometry into `out` (allocation-free per frame). */
export function lerpGeom(
  from: MarkGeom,
  to: MarkGeom,
  t: number,
  out: MarkGeom,
): MarkGeom {
  out.x = lerp(from.x, to.x, t);
  out.y = lerp(from.y, to.y, t);
  out.r = lerp(from.r, to.r, t);
  out.w = lerp(from.w, to.w, t);
  out.h = lerp(from.h, to.h, t);
  const [a0, a1] = lerpArc(from.a0, from.a1, to.a0, to.a1, t);
  out.a0 = a0;
  out.a1 = a1;
  out.alpha = lerp(from.alpha, to.alpha, t);
  return out;
}

/** sRGB channels and alpha, each 0..1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const FUNC =
  /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

/**
 * Parses the colour forms the theme tokens use (`#rgb`, `#rrggbb`, `rgb()`,
 * `rgba()`), or returns null. Tokens are literals by contract (see
 * tokens.css), so there's no `var()` or `color-mix()` to resolve.
 */
export function parseColor(css: string): Rgba | null {
  const s = css.trim();
  const hex = s.match(HEX);
  if (hex) {
    const h =
      hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
      a: 1,
    };
  }
  const fn = s.match(FUNC);
  if (fn) {
    const [r, g, b] = [fn[1], fn[2], fn[3]].map(
      (v) => Math.min(255, Number(v)) / 255,
    );
    const a = fn[4] === undefined ? 1 : Math.min(1, Number(fn[4]));
    return { r, g, b, a };
  }
  return null;
}

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function toSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

/**
 * Mixes two colours in linear light. Mixing sRGB values directly dips through
 * a muddy, too-dark middle (amber → teal goes grey-brown); linear keeps the
 * midpoint as bright as the ends.
 */
export function mixColor(a: Rgba, b: Rgba, t: number): Rgba {
  return {
    r: toSrgb(lerp(toLinear(a.r), toLinear(b.r), t)),
    g: toSrgb(lerp(toLinear(a.g), toLinear(b.g), t)),
    b: toSrgb(lerp(toLinear(a.b), toLinear(b.b), t)),
    a: lerp(a.a, b.a, t),
  };
}

export type Palette = Readonly<Record<ColorRole, Rgba>>;

/** Every role mixed from `a` to `b`: a theme switch part-way through. */
export function mixPalette(a: Palette, b: Palette, t: number): Palette {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const out = {} as Record<ColorRole, Rgba>;
  for (const role of COLOR_ROLES) out[role] = mixColor(a[role], b[role], t);
  return out;
}

export function resolvePaint(paint: Paint, palette: Palette): Rgba {
  if (typeof paint === 'string') return palette[paint];
  return mixColor(palette[paint.mix[0]], palette[paint.mix[1]], paint.t);
}
