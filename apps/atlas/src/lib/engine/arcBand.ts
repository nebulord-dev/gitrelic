// Clock cells and other ring segments, flattened for the Graphics fill.

/** Radians per segment when flattening an arc band. */
const ARC_STEP = Math.PI / 48;

/**
 * An annular sector as a closed polygon: the outer edge clockwise, then the
 * inner edge back. Angles run clockwise from 12 o'clock (y points down).
 */
export function arcBand(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  a0: number,
  a1: number,
): number[] {
  const steps = Math.max(1, Math.ceil(Math.abs(a1 - a0) / ARC_STEP));
  const points: number[] = [];
  for (let k = 0; k <= steps; k++) {
    const a = a0 + ((a1 - a0) * k) / steps;
    points.push(cx + Math.sin(a) * outer, cy - Math.cos(a) * outer);
  }
  for (let k = steps; k >= 0; k--) {
    const a = a0 + ((a1 - a0) * k) / steps;
    points.push(cx + Math.sin(a) * inner, cy - Math.cos(a) * inner);
  }
  return points;
}
