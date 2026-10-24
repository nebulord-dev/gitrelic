import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import Rail from './Rail.svelte';
import type { Badge } from '@gitrelic/scene';

const noBadges = new Map<string, Badge>();

describe('Rail', () => {
  it('lists the five views, marking the open one, and opens on click', async () => {
    const onopen = vi.fn();
    render(Rail, { badges: noBadges, view: 'overview', onopen });
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Overview',
      'Code Health',
      'Ownership & Knowledge',
      'Team & Activity',
      'Structure',
    ]);
    expect(buttons[0].getAttribute('aria-current')).toBe('page');
    expect(buttons[1].getAttribute('aria-current')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Structure' }));
    expect(onopen).toHaveBeenCalledWith('structure');
  });

  it('flags a view when any of its lenses has a badge', () => {
    const badges = new Map<string, Badge>([
      [
        'bus-factor',
        {
          preset: 'bus-factor',
          count: 2,
          reason: '2 packages whose top contributor went quiet',
        },
      ],
    ]);
    render(Rail, { badges, view: 'overview' });
    expect(
      screen.getByRole('button', {
        name: 'Ownership & Knowledge (has outliers)',
      }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Structure' })).toBeTruthy();
  });
});
