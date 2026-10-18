import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import Rail from './Rail.svelte';
import type { Badge } from '@gitrelic/scene';

const noBadges = new Map<string, Badge>();

describe('Rail', () => {
  it('starts collapsed, showing one button per group, and toggles open', async () => {
    render(Rail, { badges: noBadges });
    const toggle = screen.getByRole('button', { name: 'Expand navigation' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('button', { name: 'Code Health' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Churn/ })).toBeNull();

    await fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Collapse navigation');
  });

  it('expands when a group icon is clicked', async () => {
    render(Rail, { badges: noBadges });
    await fireEvent.click(
      screen.getByRole('button', { name: 'Team & Activity' }),
    );
    expect(screen.getByRole('link', { name: /Contributors/ })).toBeTruthy();
  });

  it('links analyzers without an Atlas view to classic, deep-linked', async () => {
    render(Rail, { badges: noBadges });
    await fireEvent.click(
      screen.getByRole('button', { name: 'Expand navigation' }),
    );
    const link = screen.getByRole('link', { name: /Stale Files/ });
    expect(link.getAttribute('href')).toBe('/classic/#preset=dead-code');
    expect(screen.getAllByRole('link')).toHaveLength(23);
  });

  it('shows badges with their reason, and flags the group while collapsed', async () => {
    const badges = new Map<string, Badge>([
      [
        'ghost-files',
        {
          preset: 'ghost-files',
          count: 12,
          reason: '30% of files are owned by inactive people',
        },
      ],
    ]);
    render(Rail, { badges });
    expect(
      screen.getByRole('button', { name: 'Ownership & Risk (has outliers)' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Structure' })).toBeTruthy();

    await fireEvent.click(
      screen.getByRole('button', { name: 'Expand navigation' }),
    );
    const badge = screen.getByTitle(
      '30% of files are owned by inactive people',
    );
    expect(badge.textContent).toBe('12');
  });
});
