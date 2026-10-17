import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';

import Rail from './Rail.svelte';

describe('Rail', () => {
  it('starts collapsed and toggles open', async () => {
    render(Rail);
    const toggle = screen.getByRole('button', { name: 'Expand navigation' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Collapse navigation');
  });
});
