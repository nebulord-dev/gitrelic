import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import ThemeSwitch from './ThemeSwitch.svelte';

describe('ThemeSwitch', () => {
  it('marks the active theme and switches on click', async () => {
    render(ThemeSwitch, { theme: 'flat' });
    const glow = screen.getByRole('button', { name: 'Glow' });
    const flat = screen.getByRole('button', { name: 'Flat' });
    expect(flat.getAttribute('aria-pressed')).toBe('true');
    expect(glow.getAttribute('aria-pressed')).toBe('false');

    await fireEvent.click(glow);
    expect(glow.getAttribute('aria-pressed')).toBe('true');
    expect(flat.getAttribute('aria-pressed')).toBe('false');
  });
});
