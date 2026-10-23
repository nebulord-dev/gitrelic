import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import LensBar from './LensBar.svelte';
import type { Badge } from '@gitrelic/scene';

describe('LensBar', () => {
  it("lists the view's lenses in order, each without a view linking to classic", () => {
    render(LensBar, { view: 'code-health', badges: new Map() });
    expect(
      screen.getByRole('navigation', { name: 'Code Health lenses' }),
    ).toBeTruthy();
    // Hotspots, Churn, Risk, Age and Fix rate have Atlas views: tabs, not links.
    expect(screen.getByRole('button', { name: /^Hotspots/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Churn/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Risk/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Age/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Fix rate/ })).toBeTruthy();
    // Blast Radius is Code Health's one lens still in classic.
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toMatch(/^Blast Radius/);
    expect(links[0].getAttribute('href')).toBe('/classic/#preset=blast-radius');
    expect(links[0].textContent).toContain('opens the classic dashboard');
  });

  it('marks badged lenses, with the reason for screen readers', () => {
    const badges = new Map<string, Badge>([
      [
        'cursed-files',
        { preset: 'cursed-files', count: 8, reason: '8 cursed files' },
      ],
    ]);
    render(LensBar, { view: 'code-health', badges });
    expect(screen.getByRole('button', { name: /^Risk/ }).textContent).toContain(
      '(8 cursed files)',
    );
  });
});
