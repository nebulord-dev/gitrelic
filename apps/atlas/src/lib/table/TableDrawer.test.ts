import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import TableDrawer from './TableDrawer.svelte';
import type { LensTable } from '@gitrelic/scene';

const row = (file: string, score: number, tier: 0 | 1 | 2 | 3) => ({
  id: `file:${file}`,
  tier,
  search: file.toLowerCase(),
  cells: { file, score },
});

const table: LensTable = {
  columns: [
    { id: 'file', label: 'File' },
    { id: 'score', label: 'Score', numeric: true },
  ],
  rows: [
    row('src/api.ts', 90, 3),
    row('src/util.ts', 40, 1),
    row('README.md', 5, 0),
  ],
  tierNames: ['Low', 'Moderate', 'Warning', 'Critical'],
  sort: { column: 'score', descending: true },
};

const fileButtons = () =>
  screen
    .getAllByRole('button')
    .filter((b) => /\.(ts|md)$/.test(b.textContent?.trim() ?? ''))
    .map((b) => b.textContent?.trim());

describe('TableDrawer', () => {
  it('lists every row in the lens’s default sort, and focuses the filter', async () => {
    render(TableDrawer, { table, label: 'Hotspots', open: true });
    await tick();
    await tick();
    expect(screen.getByRole('region', { name: 'Hotspots table' })).toBeTruthy();
    expect(fileButtons()).toEqual(['src/api.ts', 'src/util.ts', 'README.md']);
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
  });

  it('filters by text and tier, and re-sorts from a header', async () => {
    render(TableDrawer, { table, label: 'Hotspots', open: true });
    await fireEvent.input(screen.getByRole('searchbox'), {
      target: { value: 'SRC' },
    });
    expect(fileButtons()).toEqual(['src/api.ts', 'src/util.ts']);
    await fireEvent.click(screen.getByRole('button', { name: /Moderate/ }));
    expect(fileButtons()).toEqual(['src/util.ts']);
    await fireEvent.click(screen.getByRole('button', { name: /Moderate/ }));
    await fireEvent.click(screen.getByRole('button', { name: /^Score/ }));
    expect(fileButtons()).toEqual(['src/util.ts', 'src/api.ts']);
  });

  it('lights a row’s mark on hover and selects it on click', async () => {
    const onhover = vi.fn();
    const onselect = vi.fn();
    render(TableDrawer, {
      table,
      label: 'Hotspots',
      open: true,
      onhover,
      onselect,
    });
    const api = screen.getByRole('button', { name: 'src/api.ts' });
    await fireEvent.mouseEnter(api.closest('tr')!);
    expect(onhover).toHaveBeenLastCalledWith('file:src/api.ts');
    await fireEvent.mouseLeave(api.closest('tr')!);
    expect(onhover).toHaveBeenLastCalledWith(null);
    await fireEvent.click(api);
    expect(onselect).toHaveBeenCalledWith('file:src/api.ts');
  });

  it('closes on Escape before anything else hears it', async () => {
    const heard = vi.fn();
    window.addEventListener('keydown', heard);
    render(TableDrawer, { table, label: 'Hotspots', open: true });
    await fireEvent.keyDown(window, { key: 'Escape' });
    await tick();
    expect(screen.queryByRole('region', { name: 'Hotspots table' })).toBeNull();
    expect(heard).not.toHaveBeenCalled();
    window.removeEventListener('keydown', heard);
  });
});
