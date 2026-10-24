import { buildEntityIndex } from '@gitrelic/scene';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import reportJson from '../../../../../packages/scene/test/fixtures/report.small.json';
import CommandPalette from './CommandPalette.svelte';
import type { GitrelicReport } from '@gitrelic/core';

const index = buildEntityIndex(reportJson as unknown as GitrelicReport);

async function openWithShortcut() {
  await fireEvent.keyDown(window, { key: 'k', metaKey: true });
  await tick();
  return screen.getByRole('combobox');
}

describe('CommandPalette', () => {
  it('opens on ⌘K and Ctrl+K, focused, listing analyzers first', async () => {
    render(CommandPalette, { index, onpick: vi.fn() });
    expect(screen.queryByRole('dialog')).toBeNull();
    const input = await openWithShortcut();
    expect(document.activeElement).toBe(input);
    expect(screen.getAllByRole('option')).toHaveLength(18);

    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await fireEvent.keyDown(window, { key: 'K', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('labels a view result "View"', async () => {
    render(CommandPalette, { index, onpick: vi.fn() });
    const input = await openWithShortcut();
    await fireEvent.input(input, { target: { value: 'structure' } });
    const row = screen
      .getAllByRole('option')
      .find((o) => o.textContent?.includes('Structure'));
    expect(row).toBeTruthy();
    expect(row!.querySelector('span')!.textContent!.trim()).toBe('View');
  });

  it('sets itself up when a parent opens it (the Search button)', async () => {
    const button = document.createElement('button');
    document.body.append(button);
    button.focus();
    const { rerender } = render(CommandPalette, { index, onpick: vi.fn() });
    await rerender({ open: true });
    await tick();
    const input = screen.getByRole('combobox') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    await fireEvent.input(input, { target: { value: 'api' } });
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(document.activeElement).toBe(button);

    // Reopening starts from an empty query, not the last search.
    await rerender({ open: true });
    await tick();
    expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe('');
    button.remove();
  });

  it('highlights the best match after typing, even past an empty result', async () => {
    const onpick = vi.fn();
    render(CommandPalette, { index, onpick });
    const input = await openWithShortcut();
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.input(input, { target: { value: 'zzzzqqq' } });
    await fireEvent.keyDown(input, { key: 'ArrowDown' }); // no rows
    await fireEvent.input(input, { target: { value: 'api' } });
    expect(screen.getAllByRole('option')[0].getAttribute('aria-selected')).toBe(
      'true',
    );
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onpick).toHaveBeenCalledOnce();
    expect(onpick.mock.calls[0][0].label).toBe('api.ts');
  });

  it('closes on Escape even when focus has left the input, and says so', async () => {
    render(CommandPalette, { index, onpick: vi.fn() });
    const input = await openWithShortcut();
    input.blur();
    const behind = vi.fn((e: KeyboardEvent) => e.defaultPrevented);
    window.addEventListener('keydown', behind);
    await fireEvent.keyDown(document.body, { key: 'Escape' });
    window.removeEventListener('keydown', behind);
    expect(screen.queryByRole('dialog')).toBeNull();
    // The inspector's listener sees it handled, so it keeps the selection.
    expect(behind).toHaveReturnedWith(true);
  });

  it('keeps focus in the dialog: Tab stays put, clicks on padding refocus', async () => {
    render(CommandPalette, { index, onpick: vi.fn() });
    const input = await openWithShortcut();
    const tab = new KeyboardEvent('keydown', {
      key: 'Tab',
      cancelable: true,
      bubbles: true,
    });
    input.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    input.blur();
    await fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(document.activeElement).toBe(input);
  });

  it('opens on / unless the viewer is typing in a field', async () => {
    render(CommandPalette, { index, onpick: vi.fn() });
    const field = document.createElement('input');
    document.body.append(field);
    await fireEvent.keyDown(field, { key: '/' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await fireEvent.keyDown(document.body, { key: '/' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    field.remove();
  });

  it('ranks matches and picks the highlighted one with Enter', async () => {
    const onpick = vi.fn();
    render(CommandPalette, { index, onpick });
    const input = await openWithShortcut();
    await fireEvent.input(input, { target: { value: 'helpers' } });
    const options = screen.getAllByRole('option');
    expect(options[0].textContent).toContain('helpers.ts');
    expect(options[0].getAttribute('aria-selected')).toBe('true');
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(onpick).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'file:src/helpers.ts' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('moves the highlight with the arrow keys', async () => {
    const onpick = vi.fn();
    render(CommandPalette, { index, onpick });
    const input = await openWithShortcut();
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'ArrowDown' });
    await fireEvent.keyDown(input, { key: 'ArrowUp' });
    await fireEvent.keyDown(input, { key: 'Enter' });
    // The second analyzer in catalog order.
    expect(onpick.mock.calls[0][0].id).toBe('analyzer:tech-debt');
  });

  it('says so when nothing matches', async () => {
    render(CommandPalette, { index, onpick: vi.fn() });
    const input = await openWithShortcut();
    await fireEvent.input(input, { target: { value: 'zzzzqqq' } });
    expect(screen.getByText('No matches.')).toBeTruthy();
  });

  it('returns focus to where it was when it closes', async () => {
    render(CommandPalette, { index, onpick: vi.fn() });
    const before = document.createElement('button');
    document.body.append(before);
    before.focus();
    const input = await openWithShortcut();
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(document.activeElement).toBe(before);
    before.remove();
  });
});
