import { describe, expect, it, vi } from 'vitest';

import { prefersReducedMotion, watchReducedMotion } from './reducedMotion';

function fakeMedia(matches: boolean) {
  let listener: ((e: MediaQueryListEvent) => void) | null = null;
  const list = {
    matches,
    addEventListener: (_: string, l: (e: MediaQueryListEvent) => void) => {
      listener = l;
    },
    removeEventListener: () => {
      listener = null;
    },
  } as unknown as MediaQueryList;
  return {
    matchMedia: vi.fn(() => list),
    flip: (to: boolean) => listener?.({ matches: to } as MediaQueryListEvent),
    get listening() {
      return listener !== null;
    },
  };
}

describe('reduced motion', () => {
  it('reads the media query', () => {
    expect(prefersReducedMotion(fakeMedia(true).matchMedia)).toBe(true);
    expect(prefersReducedMotion(fakeMedia(false).matchMedia)).toBe(false);
    expect(fakeMedia(true).matchMedia).not.toHaveBeenCalled();
  });

  it('defaults to motion when matchMedia is unavailable', () => {
    expect(prefersReducedMotion(undefined)).toBe(false);
    expect(() => watchReducedMotion(() => {}, undefined)()).not.toThrow();
  });

  it('reports changes until unsubscribed', () => {
    const media = fakeMedia(false);
    const seen: boolean[] = [];
    const stop = watchReducedMotion((r) => seen.push(r), media.matchMedia);
    media.flip(true);
    stop();
    expect(seen).toEqual([true]);
    expect(media.listening).toBe(false);
  });
});
