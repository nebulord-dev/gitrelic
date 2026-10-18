import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

import FormToggle from './FormToggle.svelte';

const forms = [
  { id: 'field', label: 'Field' },
  { id: 'packages', label: 'By package' },
];

describe('FormToggle', () => {
  it('marks the current form pressed and switches to another', async () => {
    const onform = vi.fn();
    render(FormToggle, { forms, form: 'field', onform });
    expect(screen.getByRole('group', { name: 'Form' })).toBeTruthy();
    const field = screen.getByRole('button', { name: 'Field' });
    const pkgs = screen.getByRole('button', { name: 'By package' });
    expect(field.getAttribute('aria-pressed')).toBe('true');
    expect(pkgs.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(pkgs);
    expect(onform).toHaveBeenCalledWith('packages');
  });

  it('ignores a click on the form already showing', async () => {
    const onform = vi.fn();
    render(FormToggle, { forms, form: 'field', onform });
    await fireEvent.click(screen.getByRole('button', { name: 'Field' }));
    expect(onform).not.toHaveBeenCalled();
  });
});
