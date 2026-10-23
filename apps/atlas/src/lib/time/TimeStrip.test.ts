import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import TimeStrip from './TimeStrip.svelte';

const activity = {
  start: Date.UTC(2026, 2, 2),
  totals: [3, 0, 2, 4],
  hits: [0, 0, 1, 1],
};

describe('TimeStrip', () => {
  it('says it is loading, or that history failed', async () => {
    const { rerender } = render(TimeStrip, {});
    expect(screen.getByText('Loading history…')).toBeTruthy();
    await rerender({ failed: true });
    expect(screen.getByText('Commit history unavailable.')).toBeTruthy();
  });

  it('summarises the window, and the selection when there is one', async () => {
    const { rerender } = render(TimeStrip, { activity });
    expect(
      screen.getByRole('img', { name: '9 commits over 4 weeks' }),
    ).toBeTruthy();
    await rerender({ activity, selected: true });
    expect(
      screen.getByRole('img', {
        name: 'Selection changed in 2 weeks · 2 of 2 commits in the recent half',
      }),
    ).toBeTruthy();
    await rerender({
      activity: { ...activity, hits: [0, 0, 0, 1] },
      selected: true,
    });
    expect(
      screen.getByRole('img', { name: /^Selection changed in 1 week · / }),
    ).toBeTruthy();
    await rerender({
      activity: { ...activity, hits: [0, 0, 0, 0] },
      selected: true,
    });
    expect(
      screen.getByRole('img', {
        name: 'No commits touch this selection',
      }),
    ).toBeTruthy();
  });

  it('fits a long history into its box instead of overflowing', () => {
    const long = {
      start: Date.UTC(2014, 0, 6),
      totals: Array.from({ length: 600 }, () => 2),
      hits: Array.from({ length: 600 }, () => 0),
    };
    const { container } = render(TimeStrip, { activity: long });
    const bars = container.querySelectorAll('[role="img"] span');
    expect(bars.length).toBeLessThanOrEqual(300);
    expect(
      screen.getByRole('img', { name: '1,200 commits over 600 weeks' }),
    ).toBeTruthy();
  });

  it('shades a lens’s part of each week and counts it in the caption', async () => {
    const { container, rerender } = render(TimeStrip, {
      activity,
      split: [1, 0, 2, 0],
      splitLabel: 'with AI',
    });
    expect(
      screen.getByRole('img', { name: '9 commits over 4 weeks · 3 with AI' }),
    ).toBeTruthy();
    const parts = [
      ...container.querySelectorAll('[data-split]'),
    ] as HTMLElement[];
    expect(parts.map((p) => p.style.height)).toEqual([
      `${(1 / 3) * 100}%`,
      '100%',
    ]);
    await rerender({
      activity,
      selected: true,
      split: [0, 0, 1, 0],
      splitLabel: 'with AI',
    });
    expect(screen.getByRole('img', { name: /· 1 with AI$/ })).toBeTruthy();
  });
});
