/** Fast start, gentle landing — the default for every mark tween. */
export function easeOutCubic(t: number): number {
  const u = 1 - clamp01(t);
  return 1 - u * u * u;
}

/** Linear, clamped. For alpha-only (reduced-motion) fades. */
export function linear(t: number): number {
  return clamp01(t);
}

export function clamp01(t: number): number {
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/**
 * Progress of a track at time `now`, eased: 0 before `delay`, 1 once
 * `delay + duration` has passed. A zero-length track jumps straight to 1.
 */
export function trackProgress(
  now: number,
  delay: number,
  duration: number,
  ease: (t: number) => number = easeOutCubic,
): number {
  if (now < delay) return 0;
  if (duration <= 0) return 1;
  return ease((now - delay) / duration);
}
