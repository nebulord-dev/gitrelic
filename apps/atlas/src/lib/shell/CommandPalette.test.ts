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
    expect(screen.getAllByRole('option')).toHaveLength(23);

    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await fireEvent.keyDown(window, { key: 'K', ctrlKey: true });
    expect(screen.getByRole('dialog')).toBeTruthy();
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
    expect(onpick.mock.calls[0][0].id).toBe('analyzer:risk');
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
