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
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(9);
    expect(links[0].textContent).toMatch(/^Hotspots/);
    expect(links[0].getAttribute('href')).toBe('/classic/#preset=hotspots');
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
    expect(
      screen.getByRole('link', { name: /Cursed Files/ }).textContent,
    ).toContain('(8 cursed files)');
  });
});
