import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import LensBar from './LensBar.svelte';

// No preset has an Atlas view yet; pretend Hotspots does.
vi.mock('@gitrelic/scene', async (importOriginal) => {
  const scene = await importOriginal<typeof import('@gitrelic/scene')>();
  return {
    ...scene,
    lensesOf: (group: Parameters<typeof scene.lensesOf>[0]) =>
      scene.lensesOf(group).map((e) => ({ ...e, atlas: e.id === 'hotspots' })),
  };
});

describe('LensBar with an Atlas lens', () => {
  it('makes Atlas lenses buttons, marking the open one', async () => {
    const onopen = vi.fn();
    render(LensBar, {
      view: 'code-health',
      lens: 'hotspots',
      badges: new Map(),
      onopen,
    });
    const hotspots = screen.getByRole('button', { name: 'Hotspots' });
    expect(hotspots.getAttribute('aria-current')).toBe('page');
    expect(screen.getAllByRole('link')).toHaveLength(7);
    await fireEvent.click(hotspots);
    expect(onopen).toHaveBeenCalledWith('hotspots');
  });
});
