import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it } from 'vitest';

import GuideSheet from './GuideSheet.svelte';

describe('GuideSheet', () => {
  it('opens on ?, focused on search, and pins the open lens', async () => {
    render(GuideSheet, { lens: 'churn' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await fireEvent.keyDown(document.body, { key: '?', shiftKey: true });
    await tick();
    expect(screen.getByRole('dialog', { name: 'Guide' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    expect(screen.getByText("You're here")).toBeTruthy();
    // Every analyzer is listed by view, each with its classic link.
    expect(
      screen.getByRole('region', { name: 'Ownership & Risk' }),
    ).toBeTruthy();
    // Repo map and Hotspots have Atlas views (Open); the rest link classic.
    expect(screen.getAllByRole('link', { name: 'Classic ↗' }).length).toBe(21);
    expect(screen.getAllByRole('button', { name: 'Open' })).toHaveLength(2);
  });

  it('filters by label or explanation, and says when nothing matches', async () => {
    render(GuideSheet, { open: true });
    await tick();
    const search = screen.getByRole('searchbox');
    await fireEvent.input(search, {
      target: { value: 'single points of failure' },
    });
    expect(screen.getByText('Bus Factor')).toBeTruthy();
    expect(screen.queryByText('Churn')).toBeNull();
    await fireEvent.input(search, { target: { value: 'zzzz' } });
    expect(screen.getByText('Nothing matches.')).toBeTruthy();
  });

  it('closes on Escape, marked handled so the selection behind survives', async () => {
    render(GuideSheet, { open: true });
    await tick();
    const behind: boolean[] = [];
    const listener = (e: KeyboardEvent) => behind.push(e.defaultPrevented);
    window.addEventListener('keydown', listener);
    await fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    window.removeEventListener('keydown', listener);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(behind).toEqual([true]);
  });

  it('keeps Tab inside the sheet, wrapping at both ends', async () => {
    render(GuideSheet, { open: true });
    await tick();
    const dialog = screen.getByRole('dialog');
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement>('a[href], button, input'),
    ];
    const last = focusable[focusable.length - 1];
    last.focus();
    await fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(focusable[0]);
    await fireEvent.keyDown(focusable[0], { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('does not open over another modal', async () => {
    const palette = document.createElement('div');
    palette.setAttribute('aria-modal', 'true');
    document.body.append(palette);
    render(GuideSheet, {});
    await fireEvent.keyDown(document.body, { key: '?', shiftKey: true });
    expect(screen.queryByRole('dialog', { name: 'Guide' })).toBeNull();
    palette.remove();
  });
});
