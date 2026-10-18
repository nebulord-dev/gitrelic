// The OS "reduce motion" setting, read live: the planner turns every
// transition into a fade when it's on (and app.css already stills CSS motion).

const QUERY = '(prefers-reduced-motion: reduce)';

type MatchMedia = (query: string) => MediaQueryList;

export function prefersReducedMotion(
  matchMedia: MatchMedia | undefined = globalThis.matchMedia,
): boolean {
  return matchMedia?.(QUERY).matches ?? false;
}

/** Calls `onChange` whenever the setting flips; returns an unsubscribe. */
export function watchReducedMotion(
  onChange: (reduced: boolean) => void,
  matchMedia: MatchMedia | undefined = globalThis.matchMedia,
): () => void {
  const list = matchMedia?.(QUERY);
  if (!list) return () => {};
  const listener = (e: MediaQueryListEvent) => onChange(e.matches);
  list.addEventListener('change', listener);
  return () => list.removeEventListener('change', listener);
}
